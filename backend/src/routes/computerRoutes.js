
import { Router } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import Computer from '../models/Computer.js';
import Session from '../models/Session.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(requireAdmin);

router.get('/', async (_req, res, next) => {
  try {
    const computers = await Computer.find()
      .sort({ computerId: 1 })
      .lean();

    const now = new Date();

    const sessions = await Session.find({
      computerId: {
        $in: computers.map(c => c.computerId)
      },
      expiresAt: { $gt: now }
    })
      .sort({ startedAt: -1 })
      .lean();

    const sessionMap = new Map();

    for (const session of sessions) {
      if (!sessionMap.has(session.computerId)) {
        sessionMap.set(session.computerId, session);
      }
    }

    const result = computers.map(computer => {
      const session = sessionMap.get(computer.computerId);

      return {
        computerId: computer.computerId,
        lastSeenAt: computer.lastSeenAt ?? null,
        adminMode: computer.adminMode ?? null,
        adminExpiresAt: computer.adminExpiresAt ?? null,
        session: session
          ? {
              startedAt: session.startedAt,
              expiresAt: session.expiresAt
            }
          : null
      };
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const computerId = String(
      req.body?.computerId || ''
    ).trim().toUpperCase();

    if (!/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(computerId)) {
      return res.status(400).json({
        error: 'Use 2-32 letters, numbers, hyphens or underscores'
      });
    }

    if (computerId === 'PC-01') {
      return res.status(409).json({
        error: 'PC-01 is reserved for your existing computer'
      });
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256')
      .update(token)
      .digest('hex');

    const computer = await Computer.create({
      computerId,
      tokenHash
    });

    res.status(201).json({
      computerId: computer.computerId,
      deviceToken: token,
      message: 'Save this token now. It will not be shown again.'
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'A computer with this ID already exists'
      });
    }

    next(error);
  }
});

export default router;
