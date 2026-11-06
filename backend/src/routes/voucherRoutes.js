import { Router } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import Voucher from '../models/Voucher.js';
import { requireAdmin } from '../middleware/auth.js';
import { getPricing } from './pricingRoutes.js';
const router = Router();
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { price, mode = 'automatic', durationMinutes } = req.body ?? {};
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price > 100000 || Math.abs(Math.round(price * 100) - price * 100) > 1e-7) return res.status(400).json({ error: 'Price must be a positive amount with at most two decimal places' });
    const settings = await getPricing();
    let minutes;
    if (mode === 'automatic') minutes = Math.round(price * settings.minutesPerPeso);
    else if (mode === 'preset') {
      const match = settings.presets.find(p => p.price === price && p.minutes === durationMinutes);
      if (!match) return res.status(400).json({ error: 'Preset no longer matches saved pricing settings' });
      minutes = match.minutes;
    } else if (mode === 'manual') minutes = durationMinutes;
    else return res.status(400).json({ error: 'Invalid pricing mode' });
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) return res.status(400).json({ error: 'Playtime must be between 1 and 1440 minutes' });
    const code = randomBytes(9).toString('hex').toUpperCase();
    const codeHash = createHash('sha256').update(code).digest('hex');
    const voucher = await Voucher.create({ codeHash, durationMinutes: minutes, price });
    res.status(201).json({ id: voucher.id, code, durationMinutes: minutes, price, status: voucher.status });
  } catch (e) { next(e); }
});
router.get('/', requireAdmin, async (_req, res, next) => {
  try { res.json(await Voucher.find().sort({ createdAt: -1 }).limit(100).select('-codeHash')); }
  catch (e) { next(e); }
});
export default router;
