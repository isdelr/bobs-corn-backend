import { Router } from 'express';
import { body, param } from 'express-validator';
import { requireAuth } from '../middleware/auth.js';
import { purchase, listOrders, getOrder } from '../controllers/ordersController.js';

const router = Router();

const purchaseValidators = [
  body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('quantity must be >= 1'),
  body('items.*').custom((v) => {
    if (!v || typeof v !== 'object') throw new Error('invalid item');
    if (!('slug' in v) && !('productId' in v)) throw new Error('each item must include slug or productId');
    return true;
  }),
  body('shippingAddress').optional().isObject().withMessage('shippingAddress must be an object'),
  body('saveAddress').optional().isBoolean().withMessage('saveAddress must be boolean'),
];

router.post('/purchase', requireAuth, purchaseValidators, purchase);
router.get('/', requireAuth, listOrders);
router.get('/:id', requireAuth, [param('id').isInt().withMessage('id must be an integer')], getOrder);

export default router;
