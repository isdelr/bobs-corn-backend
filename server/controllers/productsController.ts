import { Request, Response, NextFunction } from 'express';
import { knex, rowToProduct } from '../db.js';
import { Product, ProductResponse } from '../types/index.js';

/**
 * Products Controller - Manages product catalog operations
 * 
 * Provides endpoints for:
 * - Listing products with pagination
 * - Fetching individual products by slug
 * - Searching products across multiple fields
 * - Featured products selection
 * - Product categories
 * 
 * @module productsController
 */

// Category type definition
interface Category {
  key: string;
  title: string;
  subtitle: string;
}

/**
 * List Products Endpoint - Returns paginated product catalog
 * 
 * GET /api/products
 * 
 * Query Parameters:
 * @param limit - Maximum products to return (0-100, default: all)
 * 
 * Response:
 * - 200: Array of product objects
 * - 500: Server error
 */
export async function listProducts(
  req: Request<{}, {}, {}, { limit?: string }>, 
  res: Response<(ProductResponse | null)[]>, 
  next: NextFunction
): Promise<void> {
  try {
    // Parse and validate limit parameter (prevent excessive data transfer)
    const limit = req.query.limit 
      ? Math.max(0, Math.min(100, Number(req.query.limit))) 
      : undefined;
    
    // Build query with optional limit
    let q = knex<Product>('products').select('*').orderBy('id', 'asc');
    if (limit) q = q.limit(limit);
    
    // Execute query and transform rows to API format
    const rows = await q;
    res.json(rows.map(rowToProduct));
  } catch (err) {
    next(err);
  }
}

/**
 * Get Single Product Endpoint - Fetches product by slug
 * 
 * GET /api/products/:slug
 * 
 * Path Parameters:
 * @param slug - Product URL slug (e.g., "premium-corn-kernels")
 * 
 * Response:
 * - 200: Product object with all details
 * - 404: Product not found
 * - 500: Server error
 */
export async function getProduct(
  req: Request<{ slug: string }>, 
  res: Response<ProductResponse | { error: string } | null>, 
  next: NextFunction
): Promise<void | Response> {
  try {
    // Query by slug (SEO-friendly identifier)
    const row = await knex<Product>('products').where({ slug: req.params.slug }).first();
    
    if (!row) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Transform database row to API format
    res.json(rowToProduct(row));
  } catch (err) {
    next(err);
  }
}

/**
 * Search Products Endpoint - Full-text search across product fields
 * 
 * GET /api/products/search OR /api/search
 * 
 * Query Parameters:
 * @param q - Search query (case-insensitive)
 * 
 * Search Fields:
 * - title: Product name
 * - subtitle: Product tagline
 * - description: Full product description
 * - tags: JSON array of tags
 * 
 * Response:
 * - 200: Array of matching products (empty if no matches)
 * - 500: Server error
 * 
 * Note: Uses SQLite's LIKE operator (case-insensitive by default)
 * For production, consider full-text search with FTS5 or Elasticsearch
 */
export async function searchProducts(
  req: Request<{}, {}, {}, { q?: string }>, 
  res: Response<(ProductResponse | null)[]>, 
  next: NextFunction
): Promise<void | Response> {
  try {
    // Extract and sanitize search query
    const q = String(req.query.q || '').trim().toLowerCase();
    
    // Return empty array for empty searches
    if (q.length === 0) return res.json([]);
    
    // Build LIKE pattern for partial matching
    const like = `%${q}%`;
    
    // Search across multiple fields using OR conditions
    // Note: Using whereLike for SQLite compatibility (not ILIKE)
    const rows = await knex<Product>('products')
      .whereLike('title', like)
      .orWhereLike('subtitle', like)
      .orWhereLike('description', like)
      .orWhereLike('tags', like)  // Searches within JSON string
      .select('*');
    
    res.json(rows.map(rowToProduct));
  } catch (err) {
    next(err);
  }
}

/**
 * Featured Products Endpoint - Returns top products for homepage/promotions
 * 
 * GET /api/products/featured
 * 
 * Selection Criteria:
 * - Top 4 products sorted by:
 *   1. Rating (highest first)
 *   2. Rating count (tie-breaker for same rating)
 * 
 * Response:
 * - 200: Array of 4 featured products
 * - 500: Server error
 * 
 * Future Enhancements:
 * - Add "featured" flag in database
 * - Weight by recent sales velocity
 * - Personalized recommendations
 */
export async function getFeaturedProducts(
  _req: Request, 
  res: Response<(ProductResponse | null)[]>, 
  next: NextFunction
): Promise<void> {
  try {
    // Select top-rated products with most reviews
    // Business logic: Popular + well-reviewed items sell best
    const rows = await knex<Product>('products')
      .select('*')
      .orderBy('rating', 'desc')        // Highest rated first
      .orderBy('rating_count', 'desc')  // Most reviewed as tie-breaker
      .limit(4);  // Homepage typically shows 4 featured items
    
    res.json(rows.map(rowToProduct));
  } catch (err) {
    next(err);
  }
}

/**
 * Product Categories Endpoint - Returns available product categories
 * 
 * GET /api/products/categories
 * 
 * Response:
 * - 200: Array of category objects
 *   - key: Category identifier
 *   - title: Display name
 *   - subtitle: Category description
 * 
 * Note: Currently returns static categories
 * For production, consider:
 * - Dynamic categories from database
 * - Product count per category
 * - Category hierarchy/nesting
 */
export async function getCategories(
  _req: Request, 
  res: Response<Category[]>, 
  next: NextFunction
): Promise<void> {
  try {
    // Static categories matching Bob's Corn product lines
    const categories: Category[] = [
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
