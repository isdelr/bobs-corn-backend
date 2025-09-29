import bcrypt from 'bcrypt';
import { validationResult } from 'express-validator';
import { knex } from '../db.js';

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

function toPublicUser(user) {
  return { id: String(user.id), name: user.name, email: user.email };
}

function signToken(user) {
  return jwt.sign(
    { sub: String(user.id), email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export async function signup(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { name, email, password } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await knex('users').where({ email: normalizedEmail }).first();
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const saltRounds = Number(process.env.BCRYPT_ROUNDS || 12);
    const password_hash = await bcrypt.hash(password, saltRounds);
    const [id] = await knex('users').insert({ name, email: normalizedEmail, password_hash });
    const user = { id, name, email: normalizedEmail };
    const token = signToken(user);
    return res.status(201).json({ user: toPublicUser(user), token });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, password } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await knex('users').where({ email: normalizedEmail }).first();
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken(user);
    res.json({ user: toPublicUser(user), token });
  } catch (err) {
    next(err);
  }
}

export async function getProfile(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await knex('users').where({ id: Number(req.user.id) }).first();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(toPublicUser(user));
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    // In a real implementation, this would clear the session or invalidate the JWT
    // For now, just return success
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}
