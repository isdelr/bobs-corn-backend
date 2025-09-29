import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import { signup, login, getProfile, logout } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const emailValidator = body('email').isEmail().withMessage('Valid email required');
const passwordValidator = body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

router.post('/signup', authLimiter, [body('name').trim().isLength({ min: 2 }).withMessage('Name is required'), emailValidator, passwordValidator], signup);
router.post('/login', authLimiter, [emailValidator, passwordValidator], login);
router.get('/me', requireAuth, getProfile);
router.post('/logout', requireAuth, logout);

export default router;
