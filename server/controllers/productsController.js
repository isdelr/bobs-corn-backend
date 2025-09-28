import { knex, rowToProduct } from '../db.js';

export async function listProducts(req, res, next) {
  try {
    const limit = req.query.limit ? Math.max(0, Math.min(100, Number(req.query.limit))) : undefined;
    let q = knex('products').select('*').orderBy('id', 'asc');
    if (limit) q = q.limit(limit);
    const rows = await q;
    res.json(rows.map(rowToProduct));
  } catch (err) {
    next(err);
  }
}

export async function getProduct(req, res, next) {
  try {
    const row = await knex('products').where({ slug: req.params.slug }).first();
    if (!row) return res.status(404).json({ error: 'Product not found' });
    res.json(rowToProduct(row));
  } catch (err) {
    next(err);
  }
}

export async function searchProducts(req, res, next) {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    if (q.length === 0) return res.json([]);
    const like = `%${q}%`;
    const rows = await knex('products')
      .whereILike('title', like)
      .orWhereILike('subtitle', like)
      .orWhereILike('description', like)
      .orWhereILike('tags', like)
      .select('*');
    res.json(rows.map(rowToProduct));
  } catch (err) {
    next(err);
  }
}
