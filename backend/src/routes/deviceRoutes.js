import { Router } from 'express';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import Voucher from '../models/Voucher.js';
import Session from '../models/Session.js';
import Computer from '../models/Computer.js';
import { requireDevice } from '../middleware/deviceAuth.js';

const router = Router();
router.use(requireDevice);
const computerId = 'PC-01';
const publicPaidSession = s => s ? ({ id: String(s._id), type: 'voucher', computerId, startedAt: s.startedAt, expiresAt: s.expiresAt, serverTime: new Date() }) : null;
const publicAdminSession = c => c?.adminMode ? ({ id: String(c._id), type: 'admin', mode: c.adminMode, computerId, startedAt: c.adminStartedAt, expiresAt: c.adminMode === 'timed' ? c.adminExpiresAt : null, serverTime: new Date() }) : null;
async function currentSession() {
  const now = new Date();
  const computer = await Computer.findOne({ computerId });
  if (computer?.adminMode) {
    if (computer.adminMode === 'open' || (computer.adminExpiresAt && computer.adminExpiresAt > now)) return publicAdminSession(computer);
    await Computer.updateOne({ _id: computer._id, adminMode: 'timed', adminExpiresAt: { $lte: now } }, { $set: { adminMode: null, adminStartedAt: null, adminExpiresAt: null } });
  }
  const paid = await Session.findOne({ computerId, expiresAt: { $gt: now } }).sort({ startedAt: -1 });
  return publicPaidSession(paid);
}

router.post('/redeem', async (req, res, next) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  if (!/^[A-F0-9]{18}$/.test(code)) return res.status(400).json({ error: 'Invalid voucher code format' });
  const hash = createHash('sha256').update(code).digest('hex');
  const tx = await mongoose.startSession();
  try {
    let result;
    await tx.withTransaction(async () => {
      const now = new Date();
      const computer = await Computer.findOne({ computerId }).session(tx);
      if (computer?.adminMode === 'open' || (computer?.adminMode === 'timed' && computer.adminExpiresAt > now)) {
        const e = new Error('Admin access is active'); e.status = 409; throw e;
      }
      const active = await Session.findOne({ computerId, expiresAt: { $gt: now } }).session(tx);
      if (active) { const e = new Error('A session is already active'); e.status = 409; throw e; }
      const voucher = await Voucher.findOneAndUpdate({ codeHash: hash, status: 'unused' }, { $set: { status: 'redeemed', redeemedAt: now, computerId } }, { new: true, session: tx });
      if (!voucher) { const e = new Error('Voucher invalid or already used'); e.status = 409; throw e; }
      const [created] = await Session.create([{ voucherId: voucher._id, computerId, startedAt: now, expiresAt: new Date(now.getTime() + voucher.durationMinutes * 60000) }], { session: tx });
      await Computer.updateOne({ computerId }, { $set: { lastSeenAt: now } }, { upsert: true, session: tx });
      result = created;
    });
    res.json({ session: publicPaidSession(result) });
  } catch (e) { if (e.status) return res.status(e.status).json({ error: e.message }); next(e); }
  finally { await tx.endSession(); }
});

// Simple per-process rate limiting for this one-PC prototype.
// Replace with shared persistent limiting before running multiple backend instances.
const failures = new Map();
router.post('/admin/start', async (req, res, next) => {
  try {
    const nowMs = Date.now();
    const key = computerId;
    const record = failures.get(key) || { count: 0, blockedUntil: 0 };
    if (record.blockedUntil > nowMs) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    const password = req.body?.password;
    const mode = req.body?.mode;
    const minutes = Number(req.body?.minutes);
    if (typeof password !== 'string' || password.length < 1 || password.length > 256) return res.status(400).json({ error: 'Invalid password' });
    if (!['open', 'timed'].includes(mode)) return res.status(400).json({ error: 'Invalid admin mode' });
    if (mode === 'timed' && (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440)) return res.status(400).json({ error: 'Duration must be 1–1440 minutes' });
    const hash = process.env.ADMIN_ACCESS_PASSWORD_HASH;
    if (!hash || !/^\$2[aby]\$/.test(hash)) return res.status(503).json({ error: 'Admin access password hash is not configured' });
    const valid = await bcrypt.compare(password, hash);
    if (!valid) {
      record.count += 1;
      if (record.count >= 5) { record.blockedUntil = nowMs + 5 * 60 * 1000; record.count = 0; }
      failures.set(key, record);
      return res.status(401).json({ error: 'Incorrect admin password' });
    }
    failures.delete(key);
    await Computer.updateOne({ computerId }, { $setOnInsert: { computerId } }, { upsert: true });
    const active = await currentSession();
    if (active) return res.status(409).json({ error: 'A session is already active' });
    const now = new Date();
    const expiresAt = mode === 'timed' ? new Date(now.getTime() + minutes * 60000) : null;
    // Conditional update avoids two simultaneous admin starts.
    const computer = await Computer.findOneAndUpdate(
      { computerId, $or: [{ adminMode: null }, { adminMode: { $exists: false } }] },
      { $set: { adminMode: mode, adminStartedAt: now, adminExpiresAt: expiresAt, lastSeenAt: now } },
      { new: true, upsert: false }
    );
    if (!computer) return res.status(409).json({ error: 'Admin session already active; retry after it ends' });
    res.json({ session: publicAdminSession(computer) });
  } catch (e) { next(e); }
});
router.post('/admin/end', async (_req, res, next) => {
  try {
    await Computer.updateOne({ computerId, adminMode: { $in: ['open', 'timed'] } }, { $set: { adminMode: null, adminStartedAt: null, adminExpiresAt: null } });
    res.json({ session: await currentSession() });
  } catch (e) { next(e); }
});
router.get('/session', async (_req, res, next) => {
  try { res.json({ session: await currentSession() }); } catch (e) { next(e); }
});
router.post('/heartbeat', async (_req, res, next) => {
  try { await Computer.updateOne({ computerId }, { $set: { lastSeenAt: new Date() } }, { upsert: true }); res.json({ ok: true }); }
  catch (e) { next(e); }
});
export default router;
