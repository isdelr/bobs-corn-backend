import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { JWTPayload } from '../types/index.js';

/**
 * Authentication Middleware - JWT token verification for protected routes
 * 
 * Provides two middleware functions:
 * - requireAuth: Enforces authentication, blocks unauthenticated requests
 * - optionalAuth: Attempts authentication but allows anonymous access
 * 
 * Token Format: Bearer <JWT>
 * Example: Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 * 
 * @module middleware/auth
 */

const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret';

/**
 * Extracts JWT token from Authorization header
 * Follows RFC 6750 Bearer Token standard
 * 
 * @param req - Express request object
 * @returns JWT token or null if not found/invalid format
 */
function extractToken(req: Request): string | null {
  const auth = req.headers.authorization || '';
  const [scheme, token] = auth.split(' ');
  
  // Only accept Bearer token scheme (RFC 6750)
  if (scheme === 'Bearer' && token) return token;
  return null;
}

/**
 * Enforces authentication on protected routes
 * 
 * Usage: router.get('/protected', requireAuth, handler)
 * 
 * Behavior:
 * 1. Extracts Bearer token from Authorization header
 * 2. Verifies JWT signature and expiration
 * 3. Attaches user object to req.user
 * 4. Calls next() if valid, returns 401 if invalid
 * 
 * Error Responses:
 * - 401: Missing/invalid token, expired token
 * - 500: Other JWT verification errors
 * 
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next middleware
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void | Response {
  try {
    const token = extractToken(req);
    
    // Check token exists and has correct format
    if (!token) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    
    // Verify JWT signature and decode payload
    // This also checks token expiration automatically
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    
    // Attach user info to request for downstream handlers
    // Using minimal payload to reduce memory footprint
    req.user = {
      id: String(payload.sub),     // User ID from subject claim
      email: payload.email,
      name: payload.name,
    };
    
    next();
  } catch (err: any) {
    // Handle specific JWT errors with appropriate messages
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Pass other errors to Express error handler
    next(err);
  }
}

/**
 * Optional authentication for mixed-access routes
 * 
 * Usage: router.get('/public', optionalAuth, handler)
 * 
 * Behavior:
 * - If valid token provided: Sets req.user
 * - If no token or invalid: Continues without req.user
 * - Never blocks the request (always calls next)
 * 
 * Use Cases:
 * - Public endpoints with enhanced features for logged-in users
 * - Analytics that track both anonymous and authenticated usage
 * - Shopping carts that work before login
 * 
 * @param req - Express request
 * @param _res - Express response (unused)
 * @param next - Express next middleware
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  
  // No token provided - continue as anonymous
  if (!token) return next();
  
  try {
    // Attempt to verify and decode token
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    
    // Valid token - attach user info
    req.user = {
      id: String(payload.sub),
      email: payload.email,
      name: payload.name,
    };
  } catch {
    // Invalid/expired token - treat as anonymous
    // Silently ignore to allow public access
  }
  
  next();
}
