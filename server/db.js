import knexLib from 'knex';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { seedProducts } from './productsSeed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data.sqlite3');

// Ensure directory exists
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

export const knex = knexLib({
  client: 'sqlite3',
  connection: {
    filename: DB_FILE,
  },
  useNullAsDefault: true,
  pool: {
    afterCreate: (conn, done) => {
      conn.run('PRAGMA foreign_keys = ON', done);
    },
  },
});

function parseJSONSafe(val) {
  if (val == null) return null;
  try { return JSON.parse(val); } catch { return null; }
}

function stringifyJSON(val) {
  if (val == null) return null;
  return JSON.stringify(val);
}

export function rowToProduct(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle || undefined,
    price: Number(row.price),
    originalPrice: row.original_price != null ? Number(row.original_price) : undefined,
    rating: Number(row.rating || 0),
    ratingCount: Number(row.rating_count || 0),
    tags: parseJSONSafe(row.tags) || undefined,
    images: parseJSONSafe(row.images) || [],
    options: parseJSONSafe(row.options) || undefined,
    description: row.description || '',
    details: parseJSONSafe(row.details) || undefined,
    specs: parseJSONSafe(row.specs) || undefined,
    badges: parseJSONSafe(row.badges) || undefined,
  };
}

export async function initDb() {
  const skipInitialSeed = String(process.env.SKIP_INITIAL_PRODUCT_SEED || '').toLowerCase() === 'true';
  const hasUsers = await knex.schema.hasTable('users');
  if (!hasUsers) {
    await knex.schema.createTable('users', (t) => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.string('email').notNullable().unique();
      t.string('password_hash').notNullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }
  // Add address column if missing (stores JSON)
  const hasUserAddress = await knex.schema.hasColumn('users', 'address');
  if (!hasUserAddress) {
    await knex.schema.alterTable('users', (t) => {
      t.text('address');
    });
  }

  const hasProducts = await knex.schema.hasTable('products');
  if (!hasProducts) {
    await knex.schema.createTable('products', (t) => {
      t.increments('id').primary();
      t.string('slug').notNullable().unique();
      t.string('title').notNullable();
      t.string('subtitle');
      t.decimal('price', 10, 2).notNullable();
      t.decimal('original_price', 10, 2);
      t.float('rating');
      t.integer('rating_count');
      t.text('tags'); // JSON
      t.text('images'); // JSON
      t.text('options'); // JSON
      t.text('description');
      t.text('details'); // JSON
      t.text('specs'); // JSON
      t.text('badges'); // JSON
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  // Orders table
  const hasOrders = await knex.schema.hasTable('orders');
  if (!hasOrders) {
    await knex.schema.createTable('orders', (t) => {
      t.increments('id').primary();
      t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.decimal('total', 10, 2).notNullable();
      t.text('shipping_address'); // JSON
      t.string('status').notNullable().defaultTo('paid');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  // Order items table
  const hasOrderItems = await knex.schema.hasTable('order_items');
  if (!hasOrderItems) {
    await knex.schema.createTable('order_items', (t) => {
      t.increments('id').primary();
      t.integer('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE');
      t.integer('product_id').notNullable().references('id').inTable('products');
      t.string('slug').notNullable();
      t.string('title').notNullable();
      t.decimal('price', 10, 2).notNullable(); // price at purchase time
      t.integer('quantity').notNullable();
    });
  }

  if (!skipInitialSeed) {
    const [{ count }] = await knex('products').count({ count: '*' });
    if (Number(count) === 0) {
      // Seed initial products
      const rows = seedProducts.map((p) => ({
        slug: p.slug,
        title: p.title,
        subtitle: p.subtitle ?? null,
        price: p.price,
        original_price: p.originalPrice ?? null,
        rating: p.rating ?? null,
        rating_count: p.ratingCount ?? null,
        tags: stringifyJSON(p.tags ?? null),
        images: stringifyJSON(p.images ?? []),
        options: stringifyJSON(p.options ?? null),
        description: p.description ?? '',
        details: stringifyJSON(p.details ?? null),
        specs: stringifyJSON(p.specs ?? null),
        badges: stringifyJSON(p.badges ?? null),
      }));
      await knex('products').insert(rows);
    }
  }
}
