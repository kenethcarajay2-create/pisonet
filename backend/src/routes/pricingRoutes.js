import { Router } from 'express';
import PricingSettings from '../models/PricingSettings.js';
import { requireAdmin } from '../middleware/auth.js';
const router = Router();
router.use(requireAdmin);
export async function getPricing() {
  return PricingSettings.findOneAndUpdate({ key: 'default' }, { $setOnInsert: { key: 'default' } }, { upsert: true, new: true, setDefaultsOnInsert: true });
}
router.get('/', async (_req, res, next) => { try { const settings = await getPricing(); res.json({ minutesPerPeso: settings.minutesPerPeso, presets: settings.presets }); } catch (e) { next(e); } });
router.put('/', async (req, res, next) => {
  try {
    const { minutesPerPeso, presets } = req.body ?? {};
    if (typeof minutesPerPeso !== 'number' || !Number.isFinite(minutesPerPeso) || minutesPerPeso <= 0 || minutesPerPeso > 1440 || !Array.isArray(presets) || presets.length > 30 || presets.some(p => typeof p.price !== 'number' || !Number.isFinite(p.price) || p.price <= 0 || p.price > 100000 || Math.abs(Math.round(p.price * 100) - p.price * 100) > 1e-7 || !Number.isInteger(p.minutes) || p.minutes < 1 || p.minutes > 1440)) return res.status(400).json({ error: 'Invalid pricing settings' });
    const settings = await getPricing();
    settings.minutesPerPeso = minutesPerPeso;
    settings.presets = presets.map(({price,minutes})=>({price,minutes}));
    await settings.save();
    res.json({ minutesPerPeso: settings.minutesPerPeso, presets: settings.presets });
  } catch (e) { next(e); }
});
export default router;
