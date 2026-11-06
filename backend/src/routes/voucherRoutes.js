import { Router } from 'express';
import { randomInt, createHash } from 'node:crypto';
import Voucher from '../models/Voucher.js';
import { requireAdmin } from '../middleware/auth.js';
import { getPricing } from './pricingRoutes.js';

const router = Router();
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const createCode = () => Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
const hashCode = code => createHash('sha256').update(code).digest('hex');

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { price, mode = 'automatic', durationMinutes } = req.body ?? {};
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price > 100000 || Math.abs(Math.round(price * 100) - price * 100) > 1e-7) {
      return res.status(400).json({ error: 'Price must be a positive amount with at most two decimal places' });
    }
    const settings = await getPricing();
    let minutes;
    if (mode === 'automatic') minutes = Math.round(price * settings.minutesPerPeso);
    else if (mode === 'preset') {
      const match = settings.presets.find(p => p.price === price && p.minutes === durationMinutes);
      if (!match) return res.status(400).json({ error: 'Preset no longer matches saved pricing settings' });
      minutes = match.minutes;
    } else if (mode === 'manual') minutes = durationMinutes;
    else return res.status(400).json({ error: 'Invalid pricing mode' });
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
      return res.status(400).json({ error: 'Playtime must be between 1 and 1440 minutes' });
    }
    // A unique index on codeHash prevents a collision from creating duplicate vouchers.
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = createCode();
      try {
        const voucher = await Voucher.create({ codeHash: hashCode(code), durationMinutes: minutes, price });
        return res.status(201).json({ id: voucher.id, code, durationMinutes: minutes, price, status: voucher.status });
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }
    return res.status(503).json({ error: 'Could not generate a unique voucher. Please retry.' });
  } catch (e) { next(e); }
});

router.get('/', requireAdmin, async (_req, res, next) => {
  try { res.json(await Voucher.find().sort({ createdAt: -1 }).limit(100).select('-codeHash')); }
  catch (e) { next(e); }
});
export default router;
