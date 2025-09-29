/**
 * Orders Routes - Handles all order-related API endpoints
 * 
 * This is the core business logic router implementing Bob's Corn fair selling policy.
 * All endpoints require authentication to track per-user purchase limits.
 * 
 * Endpoints:
 * - POST /api/orders/purchase - Create new order (RATE LIMITED: 1 corn/minute)
 * - GET /api/orders - List user's order history
 * - GET /api/orders/:id - Get specific order details
 * 
 * @module routes/orders
 */

import { Router } from 'express';
import { body, param } from 'express-validator';
import { requireAuth } from '../middleware/auth.js';
import { purchase, listOrders, getOrder } from '../controllers/ordersController.js';

const router = Router();

/**
 * Validation Rules for Purchase Endpoint
 * 
 * Ensures request integrity before processing:
 * - Items array must exist and contain at least one item
 * - Each item must have valid quantity (positive integer)
 * - Each item must identify a product (via slug or productId)
 * - Optional shipping address must be valid object
 * - Optional save address flag must be boolean
 * 
 * These validators run before the controller to prevent invalid data
 * from reaching business logic or database.
 */
const purchaseValidators = [
  // Items array validation
  body('items')
    .isArray({ min: 1 })
    .withMessage('items must be a non-empty array'),
  
  // Quantity validation for each item
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('quantity must be >= 1'),
  
  // Custom validation for item structure
  body('items.*').custom((v) => {
    if (!v || typeof v !== 'object') {
      throw new Error('invalid item');
    }
    // Must have either slug OR productId
    if (!('slug' in v) && !('productId' in v)) {
      throw new Error('each item must include slug or productId');
    }
    return true;
  }),
  
  // Optional shipping address
  body('shippingAddress')
    .optional()
    .isObject()
    .withMessage('shippingAddress must be an object'),
  
  // Optional address save flag
  body('saveAddress')
    .optional()
    .isBoolean()
    .withMessage('saveAddress must be boolean'),
];

/**
 * POST /api/orders/purchase
 * 
 * Creates a new order for authenticated user.
 * 
 * CRITICAL: Implements rate limiting - max 1 corn per product per minute!
 * Returns 429 Too Many Requests if limit exceeded.
 * 
 * Security:
 * - Requires JWT authentication
 * - Validates all input data
 * - Uses database transactions for consistency
 */
router.post('/purchase', requireAuth, purchaseValidators, purchase);

/**
 * GET /api/orders
 * 
 * Returns list of all orders for authenticated user.
 * Orders are sorted by most recent first.
 * 
 * Security:
 * - Requires JWT authentication
 * - Users can only see their own orders
 */
router.get('/', requireAuth, listOrders);

/**
 * GET /api/orders/:id
 * 
 * Returns details of specific order.
 * 
 * Security:
 * - Requires JWT authentication  
 * - Users can only access their own orders
 * - Returns 404 if order doesn't exist or belongs to another user
 */
router.get(
  '/:id', 
  requireAuth, 
  [param('id').isInt().withMessage('id must be an integer')], 
  getOrder
);

export default router;
