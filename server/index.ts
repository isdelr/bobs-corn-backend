/**
 * Bob's Corn Backend API Server
 * 
 * Main entry point for the Express application.
 * Implements a RESTful API for an e-commerce platform selling corn products.
 * 
 * Key Features:
 * - JWT-based authentication
 * - Rate limiting (general + per-product purchase limits)
 * - SQLite database with Knex ORM
 * - Structured logging with Winston
 * - Security hardening with Helmet
 * - CORS support for frontend integration
 * 
 * Business Logic:
 * - Enforces Bob's fair selling policy: 1 corn per user per minute
 * - Provides product catalog, search, and ordering functionality
 * 
 * @module server/index
 */

import 'dotenv/config';  // Load environment variables from .env file
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { initDb } from './db.js';
import healthRouter from './routes/health.js';
import productsRouter from './routes/products.js';
import searchRouter from './routes/search.js';
import authRouter from './routes/auth.js';
import ordersRouter from './routes/orders.js';
import accountRouter from './routes/account.js';
import { httpLogger, logger } from './logger.js';

// Initialize Express application
const app = express();

// Configuration from environment variables
const PORT = Number(process.env.PORT || 4000);
const NODE_ENV = process.env.NODE_ENV || 'development';
const TRUST_PROXY = process.env.TRUST_PROXY || 'false';

// Configure proxy trust settings
// This is important for accurate IP detection when behind a reverse proxy
// Set TRUST_PROXY=true when running behind nginx, Docker, or cloud load balancers
if (TRUST_PROXY === 'true' || TRUST_PROXY === '1') {
  app.set('trust proxy', true);
} else if (TRUST_PROXY && TRUST_PROXY !== 'false' && TRUST_PROXY !== '0') {
  // Allow specific proxy configurations like 'loopback' or IP addresses
  app.set('trust proxy', TRUST_PROXY);
}

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================

/**
 * Helmet - Sets various HTTP headers for security
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - X-XSS-Protection: 1; mode=block
 * - Strict-Transport-Security (HTTPS only)
 * - And more...
 */
app.use(helmet());

/**
 * CORS Configuration - Controls cross-origin resource sharing
 * Allows frontend applications to communicate with this API
 */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001,https://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (mobile apps, Postman, server-to-server)
      if (!origin) return cb(null, true);
      
      // Development mode: Allow all origins for easier testing
      if (NODE_ENV === 'development') return cb(null, true);
      
      // Production mode: Check against whitelist
      if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
        return cb(null, true);
      }
      
      // Reject unauthorized origins
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,  // Allow cookies and auth headers
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],  // Allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'],      // Required for JWT auth
  })
);

// ============================================================
// REQUEST PROCESSING MIDDLEWARE
// ============================================================

/**
 * HTTP Request Logger
 * Logs all incoming requests with timing, status codes, and metadata
 * Useful for debugging, monitoring, and analytics
 */
app.use(httpLogger);

/**
 * JSON Body Parser
 * Parses incoming JSON payloads (up to 1MB to prevent DoS)
 * Makes request body available as req.body
 */
app.use(express.json({ limit: '1mb' }));

/**
 * General Rate Limiter
 * Prevents abuse and DoS attacks at the application level
 * - Window: 15 minutes
 * - Max requests: 100 per window per IP
 * - Uses draft-7 standard headers (RateLimit-*)
 * 
 * Note: This is separate from the business logic rate limiter
 * for corn purchases (1 per minute per product)
 */
const generalLimiter = rateLimit({ 
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per window
  standardHeaders: 'draft-7', // RateLimit-* headers
  legacyHeaders: false        // Disable X-RateLimit-* headers
});
app.use(generalLimiter);

// ============================================================
// API ROUTES
// ============================================================

/**
 * Route Mounting
 * Each router handles a specific domain of the application
 */

// Health check endpoint (no /api prefix for easy monitoring)
app.use('/health', healthRouter);

// Product catalog endpoints
app.use('/api/products', productsRouter);

// Search functionality (separate for potential caching/optimization)
app.use('/api/search', searchRouter);

// Authentication endpoints (signup, login, profile)
app.use('/api/auth', authRouter);

// Order management (purchase, history) - Contains rate limiter!
app.use('/api/orders', ordersRouter);

// Account settings (addresses, preferences)
app.use('/api/account', accountRouter);

// ============================================================
// ERROR HANDLING
// ============================================================

/**
 * 404 Handler - Catches all unmatched routes
 * Must be defined after all other routes
 */
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

/**
 * Global Error Handler - Catches all errors from middleware/routes
 * 
 * Features:
 * - Logs full error details for debugging
 * - Returns generic error message to client (security)
 * - Includes request ID for support correlation
 * 
 * @param err - Error object
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next (unused but required)
 */
// eslint-disable-next-line no-unused-vars
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  // Log full error details internally
  logger.error('Unhandled error', { err: err.message, stack: err.stack, reqId: req.id });
  
  // Return generic error to client (don't leak internals)
  res.status(500).json({ 
    error: 'Server error', 
    requestId: req.id  // Include for support tickets
  });
});

// ============================================================
// SERVER INITIALIZATION
// ============================================================

/**
 * Application Bootstrap
 * 
 * Startup sequence:
 * 1. Initialize database (create tables if needed)
 * 2. Seed initial data (if configured)
 * 3. Start Express server
 * 4. Log startup confirmation
 * 
 * Error handling:
 * - Database errors will prevent startup
 * - Port conflicts will be logged
 */
(async () => {
  try {
    // Initialize database schema and seed data
    await initDb();
    
    // Start Express server
    app.listen(PORT, () => {
      logger.info(`🌽 Bob's Corn API ready on http://localhost:${PORT} (${NODE_ENV})`);
      logger.info(`Rate limiting: 1 corn per minute per product`);
      
      // Log important configuration for debugging
      if (NODE_ENV === 'development') {
        logger.debug('CORS: Accepting all origins (development mode)');
      } else {
        logger.debug(`CORS: Accepting origins: ${ALLOWED_ORIGINS.join(', ')}`);
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);  // Exit with error code
  }
})();
