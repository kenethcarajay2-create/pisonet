
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

const publicPaidSession = (session, computerId) =>
  session
    ? {
        id: String(session._id),
        type: 'voucher',
        computerId,
        startedAt: session.startedAt,
        expiresAt: session.expiresAt,
        serverTime: new Date()
      }
    : null;

const publicAdminSession = (computer, computerId) =>
  computer?.adminMode
    ? {
        id: String(computer._id),
        type: 'admin',
        mode: computer.adminMode,
        computerId,
        startedAt: computer.adminStartedAt,
        expiresAt:
          computer.adminMode === 'timed'
            ? computer.adminExpiresAt
            : null,
        serverTime: new Date()
      }
    : null;

async function currentSession(computerId) {
  const now = new Date();

  const computer = await Computer.findOne({ computerId });

  if (computer?.adminMode) {
    if (
      computer.adminMode === 'open' ||
      (
        computer.adminMode === 'timed' &&
        computer.adminExpiresAt &&
        computer.adminExpiresAt > now
      )
    ) {
      return publicAdminSession(computer, computerId);
    }

    await Computer.updateOne(
      {
        _id: computer._id,
        adminMode: 'timed',
        adminExpiresAt: { $lte: now }
      },
      {
        $set: {
          adminMode: null,
          adminStartedAt: null,
          adminExpiresAt: null
        }
      }
    );
  }

  const paid = await Session.findOne({
    computerId,
    expiresAt: { $gt: now }
  }).sort({ startedAt: -1 });

  return publicPaidSession(paid, computerId);
}

const redeemAttempts = new Map();

router.post('/redeem', async (req, res, next) => {
  const computerId = req.computerId;
  const code = String(req.body?.code || '')
    .trim()
    .toUpperCase();

  if (
    !/^[A-HJ-NP-Z2-9]{6}$/.test(code) &&
    !/^[A-F0-9]{18}$/.test(code)
  ) {
    return res.status(400).json({
      error: 'Enter a valid 6-character voucher code'
    });
  }

  const nowMs = Date.now();
  const attempts = redeemAttempts.get(computerId) || {
    count: 0,
    until: 0
  };

  if (attempts.until > nowMs) {
    return res.status(429).json({
      error: 'Too many attempts. Please wait a few minutes.'
    });
  }

  const hash = createHash('sha256')
    .update(code)
    .digest('hex');

  let tx;

  try {
    tx = await mongoose.startSession();

    let result;
    let addedMinutes;

    await tx.withTransaction(async () => {
      const now = new Date();

      const computer = await Computer.findOne({
        computerId
      }).session(tx);

      if (
        computer?.adminMode === 'open' ||
        (
          computer?.adminMode === 'timed' &&
          computer.adminExpiresAt > now
        )
      ) {
        const error = new Error('Admin access is active');
        error.status = 409;
        throw error;
      }

      const voucher = await Voucher.findOneAndUpdate(
        {
          codeHash: hash,
          status: 'unused'
        },
        {
          $set: {
            status: 'redeemed',
            redeemedAt: now,
            computerId
          }
        },
        {
          new: true,
          session: tx
        }
      );

      if (!voucher) {
        const error = new Error(
          'Voucher invalid or already used'
        );
        error.status = 409;
        throw error;
      }

      addedMinutes = voucher.durationMinutes;

      const active = await Session.findOne({
        computerId,
        expiresAt: { $gt: now }
      }).session(tx);

      if (active) {
        result = await Session.findOneAndUpdate(
          {
            _id: active._id,
            expiresAt: active.expiresAt
          },
          {
            $set: {
              expiresAt: new Date(
                active.expiresAt.getTime() +
                addedMinutes * 60000
              )
            }
          },
          {
            new: true,
            session: tx
          }
        );

        if (!result) {
          const error = new Error(
            'Session changed. Please retry.'
          );
          error.status = 409;
          throw error;
        }
      } else {
        [result] = await Session.create(
          [{
            voucherId: voucher._id,
            computerId,
            startedAt: now,
            expiresAt: new Date(
              now.getTime() + addedMinutes * 60000
            )
          }],
          { session: tx }
        );
      }

      await Computer.updateOne(
        { computerId },
        {
          $set: {
            lastSeenAt: now
          },
          $setOnInsert: {
            computerId
          }
        },
        {
          upsert: true,
          session: tx
        }
      );
    });

    redeemAttempts.delete(computerId);

    res.json({
      session: publicPaidSession(result, computerId),
      addedMinutes
    });
  } catch (error) {
    if (
      error.status === 409 &&
      error.message === 'Voucher invalid or already used'
    ) {
      const nextCount = attempts.count + 1;

      redeemAttempts.set(
        computerId,
        nextCount >= 5
          ? {
              count: 0,
              until: Date.now() + 5 * 60000
            }
          : {
              count: nextCount,
              until: 0
            }
      );
    }

    if (error.status) {
      return res.status(error.status).json({
        error: error.message
      });
    }

    next(error);
  } finally {
    if (tx) await tx.endSession();
  }
});

const failures = new Map();

async function verifyAdminPassword(password, computerId) {
  const nowMs = Date.now();

  const record = failures.get(computerId) || {
    count: 0,
    blockedUntil: 0
  };

  if (record.blockedUntil > nowMs) {
    const error = new Error(
      'Too many attempts. Try again later.'
    );
    error.status = 429;
    throw error;
  }

  if (
    typeof password !== 'string' ||
    password.length < 1 ||
    password.length > 256
  ) {
    const error = new Error('Invalid password');
    error.status = 400;
    throw error;
  }

  const hash = process.env.ADMIN_ACCESS_PASSWORD_HASH;

  if (!hash || !/^\$2[aby]\$/.test(hash)) {
    const error = new Error(
      'Admin access password hash is not configured'
    );
    error.status = 503;
    throw error;
  }

  const valid = await bcrypt.compare(password, hash);

  if (!valid) {
    record.count += 1;

    if (record.count >= 5) {
      record.blockedUntil = nowMs + 5 * 60000;
      record.count = 0;
    }

    failures.set(computerId, record);

    const error = new Error('Incorrect admin password');
    error.status = 401;
    throw error;
  }

  failures.delete(computerId);
  return true;
}

router.post('/admin/verify-exit', async (req, res, next) => {
  try {
    await verifyAdminPassword(
      req.body?.password,
      req.computerId
    );

    res.json({ authorized: true });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        error: error.message
      });
    }
    next(error);
  }
});

router.post('/admin/start', async (req, res, next) => {
  try {
    const computerId = req.computerId;
    const { password, mode } = req.body || {};
    const minutes = Number(req.body?.minutes);

    if (!['open', 'timed'].includes(mode)) {
      return res.status(400).json({
        error: 'Invalid admin mode'
      });
    }

    if (
      mode === 'timed' &&
      (
        !Number.isInteger(minutes) ||
        minutes < 1 ||
        minutes > 1440
      )
    ) {
      return res.status(400).json({
        error: 'Duration must be 1–1440 minutes'
      });
    }

    await verifyAdminPassword(password, computerId);

    await Computer.updateOne(
      { computerId },
      { $setOnInsert: { computerId } },
      { upsert: true }
    );

    const active = await currentSession(computerId);

    if (active) {
      return res.status(409).json({
        error: 'A session is already active'
      });
    }

    const now = new Date();

    const expiresAt =
      mode === 'timed'
        ? new Date(now.getTime() + minutes * 60000)
        : null;

    const computer = await Computer.findOneAndUpdate(
      {
        computerId,
        $or: [
          { adminMode: null },
          { adminMode: { $exists: false } }
        ]
      },
      {
        $set: {
          adminMode: mode,
          adminStartedAt: now,
          adminExpiresAt: expiresAt,
          lastSeenAt: now
        }
      },
      { new: true }
    );

    if (!computer) {
      return res.status(409).json({
        error: 'Admin session already active; retry after it ends'
      });
    }

    res.json({
      session: publicAdminSession(computer, computerId)
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        error: error.message
      });
    }
    next(error);
  }
});

router.post('/admin/end', async (req, res, next) => {
  try {
    await Computer.updateOne(
      {
        computerId: req.computerId,
        adminMode: { $in: ['open', 'timed'] }
      },
      {
        $set: {
          adminMode: null,
          adminStartedAt: null,
          adminExpiresAt: null
        }
      }
    );

    res.json({
      session: await currentSession(req.computerId)
    });
  } catch (error) {
    next(error);
  }
});

router.get('/session', async (req, res, next) => {
  try {
    res.json({
      session: await currentSession(req.computerId)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/heartbeat', async (req, res, next) => {
  try {
    await Computer.updateOne(
      { computerId: req.computerId },
      {
        $set: { lastSeenAt: new Date() },
        $setOnInsert: { computerId: req.computerId }
      },
      { upsert: true }
    );

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
