import { Router } from 'express';
import { body } from 'express-validator';
import { requireAuth } from '../middleware/auth.js';
import { getAddress, updateAddress } from '../controllers/accountController.js';

const router = Router();

const addressValidators = [
  body().isObject().withMessage('address payload must be an object'),
  body('fullName').optional().isString().trim(),
  body('line1').optional().isString().trim(),
  body('line2').optional().isString().trim(),
  body('city').optional().isString().trim(),
  body('state').optional().isString().trim(),
  body('postalCode').optional().isString().trim(),
  body('country').optional().isString().trim(),
  body('phone').optional().isString().trim(),
];

router.get('/address', requireAuth, getAddress);
router.put('/address', requireAuth, addressValidators, updateAddress);

export default router;
