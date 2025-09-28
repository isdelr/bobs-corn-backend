import bcrypt from 'bcrypt';
import { validationResult } from 'express-validator';
import { knex } from '../db.js';

export async function signup(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { name, email, password } = req.body;
    const existing = await knex('users').where({ email }).first();
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const saltRounds = Number(process.env.BCRYPT_ROUNDS || 12);
    const password_hash = await bcrypt.hash(password, saltRounds);
    const [id] = await knex('users').insert({ name, email, password_hash });
    return res.status(201).json({ id: String(id), name, email });
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
    const user = await knex('users').where({ email }).first();
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ id: String(user.id), name: user.name, email: user.email });
  } catch (err) {
    next(err);
  }
}
