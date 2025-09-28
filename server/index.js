import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { initDb } from './db.js';
import healthRouter from './routes/health.js';
import productsRouter from './routes/products.js';
import searchRouter from './routes/search.js';
import authRouter from './routes/auth.js';
import { httpLogger, logger } from './logger.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security: Helmet
app.use(helmet());

// CORS
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
        return cb(null, true);
      }
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// Structured HTTP logging
app.use(httpLogger);

// JSON body parsing
app.use(express.json({ limit: '1mb' }));

// Rate limiting (general)
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: 'draft-7', legacyHeaders: false });
app.use(generalLimiter);

// Routers
app.use('/health', healthRouter);
app.use('/api/products', productsRouter);
app.use('/api/search', searchRouter);
app.use('/api/auth', authRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { err, reqId: req.id });
  res.status(500).json({ error: 'Server error', requestId: req.id });
});

// Start server
(async () => {
  await initDb();
  app.listen(PORT, () => {
    logger.info(`API ready on http://localhost:${PORT} (${NODE_ENV})`);
  });
})();
