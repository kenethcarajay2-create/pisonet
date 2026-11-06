
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Existing API routes
import authRoutes from './routes/authRoutes.js';
import voucherRoutes from './routes/voucherRoutes.js';
import pricingRoutes from './routes/pricingRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';
import computerRoutes from './routes/computerRoutes.js';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security middleware
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

// CORS configuration
const allowedOrigins = (
  process.env.CORS_ORIGIN || 'http://localhost:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Origin not allowed by CORS'));
    },
  })
);

// Parse JSON requests
app.use(express.json({ limit: '20kb' }));

// ============================================
// API HEALTH CHECK
// ============================================

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'PisoNet Cloud',
  });
});

// ============================================
// API ROUTES
// ============================================

app.use('/api/auth', authRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/device', deviceRoutes);
app.use('/api/computers', computerRoutes);

// ============================================
// API 404 HANDLER
// ============================================

app.use('/api', (_req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
  });
});

// ============================================
// REACT FRONTEND — PRODUCTION
// ============================================

if (process.env.NODE_ENV === 'production') {
  // backend/src -> project root -> admin-web/dist
  const frontendPath = path.resolve(
    __dirname,
    '../../admin-web/dist'
  );

  const indexPath = path.join(
    frontendPath,
    'index.html'
  );

  console.log('Frontend directory:', frontendPath);

  if (fs.existsSync(indexPath)) {
    console.log('React frontend build found.');

    // Serve React JS, CSS, images and other assets
    app.use(
      express.static(frontendPath, {
        index: false,
      })
    );

    // React Router fallback for page navigation
    app.get(/.*/, (req, res, next) => {
      // Do not return HTML for missing asset files
      if (path.extname(req.path)) {
        return res.status(404).json({
          error: 'Static asset not found',
        });
      }

      res.sendFile(indexPath, (err) => {
        if (err) next(err);
      });
    });
  } else {
    console.error(
      'React build not found at:',
      indexPath
    );

    app.get(/.*/, (_req, res) => {
      res.status(503).send(
        'Admin dashboard build not found.'
      );
    });
  }
}

// ============================================
// ERROR HANDLER
// ============================================

app.use((err, _req, res, _next) => {
  console.error('Server error:', err);

  res.status(500).json({
    error: 'Internal server error',
  });
});

export default app;
