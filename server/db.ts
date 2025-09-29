/**
 * Database Configuration and Schema Management
 * 
 * Manages SQLite database connection, schema migrations, and data transformations.
 * Uses Knex.js as query builder and schema management tool.
 * 
 * Features:
 * - Automatic table creation on first run
 * - JSON field handling for flexible product data
 * - Foreign key constraints for data integrity
 * - Automatic product seeding for demo purposes
 * 
 * @module db
 */

import knexLib, { Knex } from 'knex';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { seedProducts } from './productsSeed.js';
import { Product, ProductResponse, CountResult } from './types/index.js';

// ESM module directory resolution
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Database file location (configurable via env)
const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data.sqlite3');

// Ensure database directory exists
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

/**
 * Knex Database Connection Instance
 * 
 * Configuration:
 * - SQLite3 as database engine (file-based, zero-config)
 * - Foreign keys enabled for referential integrity
 * - Connection pooling for concurrent requests
 * 
 * Production Considerations:
 * - Consider PostgreSQL/MySQL for high traffic
 * - Add read replicas for scaling
 * - Implement connection retry logic
 */
export const knex: Knex = knexLib({
  client: 'sqlite3',
  connection: {
    filename: DB_FILE,
  },
  useNullAsDefault: true,  // SQLite requires this for default values
  pool: {
    afterCreate: (conn: any, done: (err?: Error | null) => void) => {
      // Enable foreign key constraints (off by default in SQLite)
      conn.run('PRAGMA foreign_keys = ON', done);
    },
  },
});

/**
 * Safely parse JSON strings from database
 * SQLite stores JSON as TEXT, so we need to parse it
 * 
 * @param val - JSON string or null
 * @returns Parsed object or null if invalid/empty
 */
function parseJSONSafe<T = any>(val: string | null | undefined): T | null {
  if (val == null) return null;
  try { 
    return JSON.parse(val) as T; 
  } catch { 
    // Return null for malformed JSON instead of crashing
    return null; 
  }
}

/**
 * Convert JavaScript values to JSON strings for storage
 * 
 * @param val - JavaScript value to stringify
 * @returns JSON string or null
 */
function stringifyJSON(val: any): string | null {
  if (val == null) return null;
  return JSON.stringify(val);
}

/**
 * Transform database row to API-friendly product object
 * 
 * Handles:
 * - Type conversions (SQLite stores numbers as strings sometimes)
 * - JSON field parsing (stored as TEXT in SQLite)
 * - Optional field handling (undefined vs null)
 * - Consistent ID formatting (always strings)
 * 
 * @param row - Raw database row
 * @returns Formatted product object or null
 */
export function rowToProduct(row: Product | null | undefined): ProductResponse | null {
  if (!row) return null;
  
  return {
    id: String(row.id),                    // Always string for consistency
    slug: row.slug,                        // URL-friendly identifier
    title: row.title,                      // Product name
    subtitle: row.subtitle || undefined,   // Optional tagline
    price: Number(row.price),              // Current price
    originalPrice: row.original_price != null 
      ? Number(row.original_price) 
      : undefined,                         // Sale comparison price
    rating: Number(row.rating || 0),       // Average rating
    ratingCount: Number(row.rating_count || 0), // Number of reviews
    tags: parseJSONSafe<string[]>(row.tags) || undefined,        // Category tags
    images: parseJSONSafe<string[]>(row.images) || [],           // Product images
    options: parseJSONSafe<Record<string, any>>(row.options) || undefined,  // Size/color variants
    description: row.description || '',                // Full description
    details: parseJSONSafe<string[]>(row.details) || undefined,  // Bullet points
    specs: parseJSONSafe<Record<string, string>>(row.specs) || undefined,      // Technical specs
    badges: parseJSONSafe<string[]>(row.badges) || undefined,    // "New", "Sale", etc.
  };
}

/**
 * Initialize Database Schema and Seed Data
 * 
 * Creates tables if they don't exist and optionally seeds initial data.
 * Safe to call multiple times - checks for existing tables.
 * 
 * Table Structure:
 * - users: Authentication and profile data
 * - products: Product catalog
 * - orders: Purchase records
 * - order_items: Line items for each order
 * 
 * Environment Variables:
 * - SKIP_INITIAL_PRODUCT_SEED: Skip auto-seeding products
 * 
 * @async
 * @returns Promise<void>
 */
export async function initDb(): Promise<void> {
  // Check if we should skip automatic product seeding
  const skipInitialSeed = String(process.env.SKIP_INITIAL_PRODUCT_SEED || '').toLowerCase() === 'true';
  
  // ============================================================
  // USERS TABLE - Authentication and profile storage
  // ============================================================
  const hasUsers = await knex.schema.hasTable('users');
  if (!hasUsers) {
    await knex.schema.createTable('users', (t) => {
      t.increments('id').primary();              // Auto-incrementing primary key
      t.string('name').notNullable();            // Display name
      t.string('email').notNullable().unique();  // Login email (unique constraint)
      t.string('password_hash').notNullable();   // Bcrypt hashed password
      t.timestamp('created_at').defaultTo(knex.fn.now()); // Registration timestamp
    });
  }
  
  // Migration: Add address column if missing (for saved shipping addresses)
  const hasUserAddress = await knex.schema.hasColumn('users', 'address');
  if (!hasUserAddress) {
    await knex.schema.alterTable('users', (t) => {
      t.text('address');  // JSON string containing address object
    });
  }

  // ============================================================
  // PRODUCTS TABLE - Product catalog
  // ============================================================
  const hasProducts = await knex.schema.hasTable('products');
  if (!hasProducts) {
    await knex.schema.createTable('products', (t) => {
      t.increments('id').primary();                      // Product ID
      t.string('slug').notNullable().unique();           // URL-friendly identifier
      t.string('title').notNullable();                   // Product name
      t.string('subtitle');                              // Short description/tagline
      t.decimal('price', 10, 2).notNullable();          // Current price (10 digits, 2 decimal)
      t.decimal('original_price', 10, 2);                // Original price (for sales)
      t.float('rating');                                 // Average rating (0-5)
      t.integer('rating_count');                         // Number of ratings
      t.text('tags');        // JSON: ["organic", "non-gmo", etc.]
      t.text('images');      // JSON: ["url1.jpg", "url2.jpg", ...]
      t.text('options');     // JSON: {"sizes": ["small", "large"], ...}
      t.text('description'); // Long form product description
      t.text('details');     // JSON: ["detail1", "detail2", ...]
      t.text('specs');       // JSON: {"weight": "1lb", ...}
      t.text('badges');      // JSON: ["new", "bestseller", ...]
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  // ============================================================
  // ORDERS TABLE - Purchase transactions
  // ============================================================
  const hasOrders = await knex.schema.hasTable('orders');
  if (!hasOrders) {
    await knex.schema.createTable('orders', (t) => {
      t.increments('id').primary();                        // Order ID
      t.integer('user_id')
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE');                              // User who placed order
      t.decimal('total', 10, 2).notNullable();           // Order total amount
      t.text('shipping_address');                         // JSON: Address object
      t.string('status').notNullable().defaultTo('paid'); // Order status
      t.timestamp('created_at').defaultTo(knex.fn.now()); // Order timestamp (for rate limiting!)
    });
  }

  // ============================================================
  // ORDER_ITEMS TABLE - Line items for each order
  // ============================================================
  const hasOrderItems = await knex.schema.hasTable('order_items');
  if (!hasOrderItems) {
    await knex.schema.createTable('order_items', (t) => {
      t.increments('id').primary();                     // Line item ID
      t.integer('order_id')
        .notNullable()
        .references('id')
        .inTable('orders')
        .onDelete('CASCADE');                           // Parent order
      t.integer('product_id')
        .notNullable()
        .references('id')
        .inTable('products');                           // Product reference
      
      // Snapshot of product data at purchase time
      // (Preserves historical data even if product changes)
      t.string('slug').notNullable();                  // Product slug at purchase
      t.string('title').notNullable();                 // Product name at purchase
      t.decimal('price', 10, 2).notNullable();       // Price at purchase time
      t.integer('quantity').notNullable();             // Quantity purchased
    });
  }

  // ============================================================
  // INITIAL DATA SEEDING
  // ============================================================
  
  // Seed initial products if database is empty (for demo/development)
  if (!skipInitialSeed) {
    const result = await knex('products').count('* as count').first() as CountResult | undefined;
    const count = result ? Number(result.count) : 0;
    
    if (count === 0) {
      // Transform seed data to database format
      const rows = seedProducts.map((p) => ({
        slug: p.slug,
        title: p.title,
        subtitle: p.subtitle ?? null,
        price: p.price,
        original_price: p.originalPrice ?? null,
        rating: p.rating ?? null,
        rating_count: p.ratingCount ?? null,
        tags: stringifyJSON(p.tags ?? null),          // Convert arrays to JSON
        images: stringifyJSON(p.images ?? []),        // Convert arrays to JSON
        options: stringifyJSON(p.options ?? null),    // Convert objects to JSON
        description: p.description ?? '',
        details: stringifyJSON(p.details ?? null),    // Convert arrays to JSON
        specs: stringifyJSON(p.specs ?? null),        // Convert objects to JSON
        badges: stringifyJSON(p.badges ?? null),      // Convert arrays to JSON
      }));
      
      // Insert seed products
      await knex('products').insert(rows);
      console.log(`🌽 Seeded ${rows.length} products`);
    }
  }
}
