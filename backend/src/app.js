
    import express from 'express';
    import cors from 'cors';
    import helmet from 'helmet';
    import path from 'node:path';
    import fs from 'node:fs';
    import { fileURLToPath } from 'node:url';

    import authRoutes from './routes/authRoutes.js';
    import voucherRoutes from './routes/voucherRoutes.js';
    import pricingRoutes from './routes/pricingRoutes.js';
    import deviceRoutes from './routes/deviceRoutes.js';
    import computerRoutes from './routes/computerRoutes.js';

    const app = express();

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // ============================================
    // SECURITY
    // ============================================

    app.disable('x-powered-by');

    app.use(
    helmet({
        contentSecurityPolicy: false,
    })
    );

    // ============================================
    // CORS
    // ============================================

    const allowedOrigins = (
  process.env.CORS_ORIGIN || 'http://localhost:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Requests without an Origin header are allowed.
      if (!origin) {
        return callback(null, true);
      }

      // Allow configured frontend origins.
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow requests from the same host as the backend.
      // Same-origin requests do not need CORS headers.
      // Other origins remain restricted.
      return callback(null, false);
    },
  })
);
    app.use(express.json({ limit: '20kb' }));

    // ============================================
    // HEALTH CHECK
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
    // API 404
    // ============================================

    app.use('/api', (_req, res) => {
    res.status(404).json({
        error: 'API endpoint not found',
    });
    });

    // ============================================
    // REACT FRONTEND
    // ============================================

    // Resolve from this file rather than process.cwd()
    const frontendPath = path.resolve(
    __dirname,
    '../../admin-web/dist'
    );

    const indexPath = path.join(
    frontendPath,
    'index.html'
    );

    const assetsPath = path.join(
    frontendPath,
    'assets'
    );

    const frontendExists = fs.existsSync(indexPath);

    console.log('====================================');
    console.log('PisoNet frontend configuration');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('Frontend path:', frontendPath);
    console.log('Index exists:', frontendExists);
    console.log('Assets exist:', fs.existsSync(assetsPath));

    if (fs.existsSync(assetsPath)) {
    console.log(
        'Built assets:',
        fs.readdirSync(assetsPath)
    );
    }

    console.log('====================================');

    if (frontendExists) {
    // Explicitly serve Vite-generated assets
    app.use(
        '/assets',
        express.static(assetsPath, {
        fallthrough: false,
        maxAge: '1h',
        })
    );

    // Serve other public files
    app.use(
        express.static(frontendPath, {
        index: false,
        })
    );

    // Serve React for application routes
    app.get(/.*/, (req, res, next) => {
        if (path.extname(req.path)) {
        return res.status(404).json({
            error: 'Static file not found',
            path: req.path,
        });
        }

        res.sendFile(indexPath, (error) => {
        if (error) next(error);
        });
    });
    } else {
    console.error(
        'WARNING: React frontend build missing.'
    );

    app.get(/.*/, (_req, res) => {
        res.status(503).json({
        error: 'React frontend build missing',
        });
    });
    }

    // ============================================
    // ERROR HANDLER
    // ============================================

    app.use((err, req, res, _next) => {
    console.error('====================================');
    console.error('Request failed:', req.method, req.originalUrl);
    console.error('Error:', err.message);
    console.error('====================================');

    res.status(err.status || 500).json({
        error:
        process.env.NODE_ENV === 'production'
            ? 'Request failed'
            : err.message,
    });
    });

    export default app;
