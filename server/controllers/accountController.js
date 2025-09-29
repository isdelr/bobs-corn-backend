import { validationResult } from 'express-validator';
import { knex } from '../db.js';

function parseAddress(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

export async function getAddress(req, res, next) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const user = await knex('users').where({ id: Number(req.user.id) }).first();
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ address: parseAddress(user.address) });
  } catch (err) {
    next(err);
  }
}

export async function updateAddress(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const address = req.body;
    await knex('users').where({ id: Number(req.user.id) }).update({ address: JSON.stringify(address) });
    return res.json({ address });
  } catch (err) {
    next(err);
  }
}
