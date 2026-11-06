import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import Computer from '../models/Computer.js';
import Session from '../models/Session.js';
const router = Router();
router.get('/', requireAdmin, async (_req, res, next) => {
  try {
    const computer = await Computer.findOne({ computerId: 'PC-01' }).lean();
    const session = await Session.findOne({ computerId: 'PC-01', expiresAt: { $gt: new Date() } }).sort({ startedAt: -1 }).lean();
    res.json([{ computerId: 'PC-01', lastSeenAt: computer?.lastSeenAt ?? null, session: session ? { startedAt: session.startedAt, expiresAt: session.expiresAt } : null }]);
  } catch (e) { next(e); }
});
export default router;
