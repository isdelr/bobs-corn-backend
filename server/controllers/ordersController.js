import { validationResult } from 'express-validator';
import { knex } from '../db.js';

/**
 * Orders Controller - Handles corn purchase operations for Bob's Corn
 * 
 * CRITICAL BUSINESS RULE:
 * Bob's fair selling policy: Maximum 1 corn per client per minute
 * This is enforced via a sliding window rate limiter in the purchase endpoint
 * 
 * @module ordersController
 */

/**
 * Utility function to round numbers to 2 decimal places
 * Used for consistent price formatting in API responses
 * @param {number|string} value - Value to round
 * @returns {number} Rounded value to 2 decimal places
 */
function toNumber2(value) {
  const n = Number(value);
  return Math.round(n * 100) / 100;
}

/**
 * Converts decimal price to cents for precise monetary calculations
 * Prevents floating point arithmetic issues with currency
 * @param {number|string} value - Price in dollars
 * @returns {number} Price in cents (integer)
 */
function priceToCents(value) {
  return Math.round(Number(value) * 100);
}

/**
 * Converts cents back to decimal string format for storage
 * Ensures consistent 2-decimal formatting in database
 * @param {number} cents - Price in cents
 * @returns {string} Price as decimal string (e.g., "12.50")
 */
function centsToDecimalString(cents) {
  return (cents / 100).toFixed(2);
}

/**
 * Purchase Endpoint - Core business logic for buying corn
 * 
 * POST /api/orders/purchase
 * 
 * IMPLEMENTS RATE LIMITING:
 * - Default: 1 corn per product per user per 60 seconds
 * - Configurable via environment variables:
 *   - PURCHASE_RATE_LIMIT_PER_PRODUCT (default: 1)
 *   - PURCHASE_RATE_LIMIT_WINDOW_SECONDS (default: 60)
 * 
 * Request Body:
 * @param {Array<Object>} items - Array of products to purchase
 * @param {string} items[].slug - Product slug (optional if productId provided)
 * @param {number} items[].productId - Product ID (optional if slug provided)
 * @param {number} items[].quantity - Quantity to purchase (must be positive integer)
 * @param {Object} [shippingAddress] - Shipping address object
 * @param {boolean} [saveAddress] - Whether to save address to user profile
 * 
 * Response:
 * - 201: Successful purchase with order details
 * - 400: Invalid request data
 * - 401: User not authenticated
 * - 429: Rate limit exceeded (Too Many Requests)
 * - 500: Server error
 * 
 * @async
 * @param {Request} req - Express request object with authenticated user
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next middleware function
 */
export async function purchase(req, res, next) {
  try {
    // Validate request body using express-validator
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Ensure user is authenticated (JWT middleware should have attached user)
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const userId = Number(req.user.id);

    // Extract purchase data from request
    const { items, shippingAddress, saveAddress } = req.body;

    // Validate items array exists and is not empty
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items required' });
    }

    // Validate each item structure and quantity
    // Each item must have either slug OR productId for product identification
    for (const [i, it] of items.entries()) {
      if (!it || typeof it !== 'object') return res.status(400).json({ error: `Item ${i} is invalid` });
      if (!('slug' in it) && !('productId' in it)) {
        return res.status(400).json({ error: `Item ${i} must include slug or productId` });
      }
      const qty = Number(it.quantity);
      // Quantity must be a positive integer (no fractional corn!)
      if (!Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({ error: `Item ${i} has invalid quantity` });
      }
    }

    // Separate items by identifier type for efficient database querying
    const slugs = items.filter((it) => it.slug).map((it) => String(it.slug));
    const ids = items.filter((it) => it.productId).map((it) => Number(it.productId));

    // Fetch all requested products in a single query (performance optimization)
    const products = await knex('products')
      .modify((qb) => {
        if (slugs.length) qb.whereIn('slug', slugs);
        if (ids.length) qb.orWhereIn('id', ids);
      })
      .select('*');

    // Create lookup maps for O(1) product access
    const bySlug = new Map(products.map((p) => [p.slug, p]));
    const byId = new Map(products.map((p) => [p.id, p]));

    // Build order items with snapshot of current product data
    // This preserves historical purchase data even if products change later
    const orderItems = [];
    for (const it of items) {
      const row = it.slug ? bySlug.get(String(it.slug)) : byId.get(Number(it.productId));
      if (!row) {
        return res.status(400).json({ error: `Product not found for ${it.slug ?? it.productId}` });
      }
      const quantity = Number(it.quantity);
      const priceCents = priceToCents(row.price);
      // Store product snapshot at time of purchase
      orderItems.push({
        product_id: row.id,
        slug: row.slug,
        title: row.title,
        price: centsToDecimalString(priceCents), // Store as decimal string
        quantity,
      });
    }
    // ============================================================
    // RATE LIMITING IMPLEMENTATION - Bob's Fair Selling Policy
    // ============================================================
    // Implements a sliding window rate limiter to ensure fair corn distribution
    // Default: 1 corn per product per user per 60 seconds (configurable)
    
    // Parse rate limit configuration with safe defaults
    const parsedLimit = Number.parseInt(process.env.PURCHASE_RATE_LIMIT_PER_PRODUCT ?? '', 10);
    const limitPerProduct = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 1;
    const parsedWindow = Number.parseInt(process.env.PURCHASE_RATE_LIMIT_WINDOW_SECONDS ?? '', 10);
    const windowSeconds = Number.isFinite(parsedWindow) && parsedWindow > 0 ? parsedWindow : 60;
    // Aggregate requested quantities by product ID
    // (handles case where same product appears multiple times in request)
    const requestedQtyByProductId = new Map();
    for (const oi of orderItems) {
      requestedQtyByProductId.set(oi.product_id, (requestedQtyByProductId.get(oi.product_id) || 0) + oi.quantity);
    }
    
    // Check rate limits only if there are products to purchase
    if (requestedQtyByProductId.size) {
      const productIds = Array.from(requestedQtyByProductId.keys());
      
      // Query recent purchases within the sliding time window
      // Uses SQLite datetime function with parameterized time offset for security
      const recentRows = await knex('order_items as oi')
        .join('orders as o', 'oi.order_id', 'o.id')
        .where('o.user_id', userId)
        .whereIn('oi.product_id', productIds)
        .whereRaw("o.created_at >= datetime('now', ?)", [`-${windowSeconds} seconds`]) // SQLite-specific
        .select('oi.product_id')
        .sum({ purchased: 'oi.quantity' })
        .groupBy('oi.product_id');
      // Map recent purchase quantities by product
      const purchasedInWindow = new Map(recentRows.map((r) => [Number(r.product_id), Number(r.purchased) || 0]));

      // Check each product against rate limits
      for (const [pid, wantQty] of requestedQtyByProductId.entries()) {
        const prevQty = purchasedInWindow.get(pid) || 0;
        
        // If total (previous + requested) exceeds limit, reject with 429
        if (prevQty + wantQty > limitPerProduct) {
          const offending = orderItems.find((x) => x.product_id === pid);
          
          // Return detailed error response for client transparency
          return res.status(429).json({
            error: `Rate limit exceeded for product '${offending?.slug ?? String(pid)}'. Limit is ${limitPerProduct} per ${windowSeconds} seconds.`,
            limit: limitPerProduct,
            windowSeconds,
            product: {
              id: String(pid),
              slug: offending?.slug,
              requestedQuantity: wantQty,
              recentPurchasedQuantity: prevQty,
            },
          });
        }
      }
    }

    // Calculate order total using cent-based arithmetic for precision
    const totalCents = orderItems.reduce((sum, oi) => sum + priceToCents(oi.price) * oi.quantity, 0);
    const total = centsToDecimalString(totalCents);

    // Determine shipping address: use provided or fall back to saved user address
    let shippingAddressToUse = null;
    if (shippingAddress && typeof shippingAddress === 'object') {
      shippingAddressToUse = shippingAddress;
    } else {
      // Fetch user's saved address if no address provided
      const u = await knex('users').where({ id: userId }).first();
      if (u && u.address) {
        try { shippingAddressToUse = JSON.parse(u.address); } catch { shippingAddressToUse = null; }
      }
    }

    // Save address to user profile if requested
    if (saveAddress && shippingAddressToUse) {
      await knex('users').where({ id: userId }).update({ address: JSON.stringify(shippingAddressToUse) });
    }

    // Create order and items atomically using database transaction
    // Ensures data consistency - either all succeed or all fail
    const orderId = await knex.transaction(async (trx) => {
      // Insert order record
      const [oid] = await trx('orders').insert({
        user_id: userId,
        total,
        shipping_address: shippingAddressToUse ? JSON.stringify(shippingAddressToUse) : null,
        status: 'paid', // Assuming instant payment for this demo
      });
      
      // Insert order items with foreign key reference
      const rows = orderItems.map((oi) => ({ ...oi, order_id: oid }));
      if (rows.length) await trx('order_items').insert(rows);
      
      return oid;
    });

    // Build response object with consistent formatting
    const response = {
      id: String(orderId),
      total: toNumber2(total),
      status: 'paid',
      createdAt: new Date().toISOString(),
      shippingAddress: shippingAddressToUse || null,
      items: orderItems.map((oi) => ({
        productId: String(oi.product_id),
        slug: oi.slug,
        title: oi.title,
        price: toNumber2(oi.price),
        quantity: oi.quantity,
      })),
    };

    // Return 201 Created with order details (🌽 successful corn purchase!)
    return res.status(201).json({ order: response });
  } catch (err) {
    next(err);
  }
}

/**
 * List Orders Endpoint - Retrieves all orders for authenticated user
 * 
 * GET /api/orders
 * 
 * Returns array of user's orders sorted by most recent first
 * Includes full order details with items
 * 
 * Response:
 * - 200: Array of orders (empty array if no orders)
 * - 401: User not authenticated
 * 
 * @async
 * @param {Request} req - Express request with authenticated user
 * @param {Response} res - Express response
 * @param {NextFunction} next - Express next middleware
 */
export async function listOrders(req, res, next) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const userId = Number(req.user.id);

    // Fetch user's orders, most recent first
    const orders = await knex('orders').where({ user_id: userId }).orderBy('id', 'desc');
    if (orders.length === 0) return res.json([]);

    // Batch fetch all order items for efficiency (N+1 query prevention)
    const ids = orders.map((o) => o.id);
    const items = await knex('order_items').whereIn('order_id', ids);
    
    // Group items by order ID for O(1) lookup
    const byOrderId = new Map();
    for (const it of items) {
      if (!byOrderId.has(it.order_id)) byOrderId.set(it.order_id, []);
      byOrderId.get(it.order_id).push(it);
    }

    const result = orders.map((o) => ({
      id: String(o.id),
      total: toNumber2(o.total),
      status: o.status,
      createdAt: o.created_at ? new Date(o.created_at).toISOString() : undefined,
      shippingAddress: o.shipping_address ? (() => { try { return JSON.parse(o.shipping_address); } catch { return null; } })() : null,
      items: (byOrderId.get(o.id) || []).map((it) => ({
        productId: String(it.product_id),
        slug: it.slug,
        title: it.title,
        price: toNumber2(it.price),
        quantity: it.quantity,
      })),
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Get Single Order Endpoint - Retrieves specific order details
 * 
 * GET /api/orders/:id
 * 
 * Returns detailed information about a specific order
 * Users can only access their own orders
 * 
 * Path Parameters:
 * @param {number} id - Order ID
 * 
 * Response:
 * - 200: Order details with items
 * - 401: User not authenticated
 * - 404: Order not found or doesn't belong to user
 * 
 * @async
 * @param {Request} req - Express request with order ID param
 * @param {Response} res - Express response
 * @param {NextFunction} next - Express next middleware
 */
export async function getOrder(req, res, next) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const userId = Number(req.user.id);
    const orderId = Number(req.params.id);

    // Fetch order with user ID check (security: users can only see their own orders)
    const order = await knex('orders').where({ id: orderId, user_id: userId }).first();
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Fetch associated order items
    const items = await knex('order_items').where({ order_id: order.id });

    const result = {
      id: String(order.id),
      total: toNumber2(order.total),
      status: order.status,
      createdAt: order.created_at ? new Date(order.created_at).toISOString() : undefined,
      shippingAddress: order.shipping_address ? (() => { try { return JSON.parse(order.shipping_address); } catch { return null; } })() : null,
      items: items.map((it) => ({
        productId: String(it.product_id),
        slug: it.slug,
        title: it.title,
        price: toNumber2(it.price),
        quantity: it.quantity,
      })),
    };

    res.json(result);
  } catch (err) {
    next(err);
  }
}
