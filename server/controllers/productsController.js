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
      .whereLike('title', like)
      .orWhereLike('subtitle', like)
      .orWhereLike('description', like)
      .orWhereLike('tags', like)
      .select('*');
    res.json(rows.map(rowToProduct));
  } catch (err) {
    next(err);
  }
}

export async function getFeaturedProducts(req, res, next) {
  try {
    // Get top 4 products by rating, with preference for "Best Seller" tag
    const rows = await knex('products')
      .select('*')
      .orderBy('rating', 'desc')
      .orderBy('rating_count', 'desc')
      .limit(4);
    res.json(rows.map(rowToProduct));
  } catch (err) {
    next(err);
  }
}

export async function getCategories(req, res, next) {
  try {
    // Return static categories as defined in frontend
    const categories = [
      { key: 'kernels', title: 'Popcorn Kernels', subtitle: 'Classic & heirloom' },
      { key: 'seasonings', title: 'Seasonings', subtitle: 'Sweet & savory' },
      { key: 'gourmet', title: 'Gourmet Flavors', subtitle: 'Small‑batch treats' },
      { key: 'gifts', title: 'Gifts & Bundles', subtitle: 'Share the joy' },
      { key: 'merch', title: 'Merch', subtitle: 'Tees, hats & more' },
    ];
    res.json(categories);
  } catch (err) {
    next(err);
  }
}
