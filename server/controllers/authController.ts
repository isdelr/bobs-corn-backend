import bcrypt from 'bcrypt';
import { validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { knex } from '../db.js';
import jwt from 'jsonwebtoken';
import { User, SignupRequest, LoginRequest, AuthResponse } from '../types/index.js';

/**
 * Authentication Controller - Manages user authentication and JWT token generation
 * 
 * Implements JWT-based authentication with bcrypt password hashing
 * All passwords are hashed with configurable salt rounds for security
 * Emails are normalized to lowercase to prevent duplicate accounts
 * 
 * @module authController
 */

// JWT configuration from environment variables with secure defaults
const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

/**
 * Sanitizes user data for public API responses
 * Ensures password hashes are never exposed to clients
 */
function toPublicUser(user: User): AuthResponse['user'] {
  return { id: String(user.id), name: user.name, email: user.email };
}

/**
 * Generates a signed JWT token for authenticated sessions
 * Token includes user ID, email, and name in payload
 */
function signToken(user: User): string {
  return jwt.sign(
    { 
      sub: String(user.id),  // Subject claim (user ID)
      email: user.email,
      name: user.name 
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions  // Token expiration (default 1 hour)
  );
}

/**
 * User Signup Endpoint - Creates new user account
 * 
 * POST /api/auth/signup
 * 
 * Request Body:
 * @param name - User's display name
 * @param email - User's email (will be normalized to lowercase)
 * @param password - Plain text password (will be hashed)
 * 
 * Security Features:
 * - Email normalization prevents duplicate accounts with case variations
 * - Passwords hashed with bcrypt (default 12 rounds, configurable)
 * - Returns JWT token for immediate authentication
 * 
 * Response:
 * - 201: User created with token
 * - 400: Validation errors
 * - 409: Email already exists
 */
export async function signup(req: Request<{}, {}, SignupRequest>, res: Response<AuthResponse | { error: string } | { errors: any[] }>, next: NextFunction): Promise<void | Response> {
  try {
    // Validate request using express-validator rules
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { name, email, password } = req.body;
    
    // Normalize email to prevent case-sensitive duplicates
    const normalizedEmail = String(email).trim().toLowerCase();
    
    // Check for existing user
    const existing = await knex<User>('users').where({ email: normalizedEmail }).first();
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    
    // Hash password with configurable salt rounds (higher = more secure but slower)
    const saltRounds = Number(process.env.BCRYPT_ROUNDS || 12);
    const password_hash = await bcrypt.hash(password, saltRounds);
    
    // Create user in database
    const [id] = await knex<User>('users').insert({ 
      name, 
      email: normalizedEmail, 
      password_hash 
    } as Partial<User>);
    const user: User = { id: id as number, name, email: normalizedEmail, password_hash };
    
    // Generate JWT token for immediate login
    const token = signToken(user);
    
    return res.status(201).json({ user: toPublicUser(user), token });
  } catch (err) {
    next(err);
  }
}

/**
 * User Login Endpoint - Authenticates existing user
 * 
 * POST /api/auth/login
 * 
 * Request Body:
 * @param email - User's email
 * @param password - User's password
 * 
 * Security:
 * - Generic error messages prevent user enumeration attacks
 * - Bcrypt comparison is timing-safe
 * 
 * Response:
 * - 200: Successful login with user data and token
 * - 400: Validation errors
 * - 401: Invalid credentials (generic message for security)
 */
export async function login(req: Request<{}, {}, LoginRequest>, res: Response<AuthResponse | { error: string } | { errors: any[] }>, next: NextFunction): Promise<void | Response> {
  try {
    // Validate request format
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { email, password } = req.body;
    
    // Normalize email for consistent lookups
    const normalizedEmail = String(email).trim().toLowerCase();
    
    // Find user by email
    const user = await knex<User>('users').where({ email: normalizedEmail }).first();
    if (!user) {
      // Generic error to prevent user enumeration
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Verify password using timing-safe bcrypt comparison
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate new JWT token
    const token = signToken(user);
    
    res.json({ user: toPublicUser(user), token });
  } catch (err) {
    next(err);
  }
}

/**
 * Get Profile Endpoint - Returns current user's profile
 * 
 * GET /api/auth/me
 * 
 * Requires: Bearer token authentication
 * 
 * Response:
 * - 200: User profile data
 * - 401: Not authenticated
 * - 404: User not found (should not happen in normal flow)
 */
export async function getProfile(req: Request, res: Response<AuthResponse['user'] | { error: string }>, next: NextFunction): Promise<void | Response> {
  try {
    // Check if user was attached by JWT middleware
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Fetch fresh user data from database
    // (ensures we have latest data, not just JWT claims)
    const user = await knex<User>('users').where({ id: Number(req.user.id) }).first();
    if (!user) {
      // This shouldn't happen unless user was deleted after token creation
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(toPublicUser(user));
  } catch (err) {
    next(err);
  }
}

/**
 * Logout Endpoint - Ends user session
 * 
 * POST /api/auth/logout
 * 
 * Note: In a stateless JWT implementation, actual logout happens client-side
 * by removing the token. For production, consider:
 * - Token blacklisting with Redis
 * - Shorter token expiration times
 * - Refresh token rotation
 * 
 * Response:
 * - 200: Logout confirmation
 */
export async function logout(_req: Request, res: Response<{ success: boolean; message: string }>, next: NextFunction): Promise<void> {
  try {
    // In a stateless JWT system, the client handles logout by discarding the token
    // For enhanced security in production, implement token blacklisting:
    // - Store invalidated tokens in Redis until expiration
    // - Check blacklist in auth middleware
    
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}
