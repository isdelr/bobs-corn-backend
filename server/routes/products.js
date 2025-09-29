import { Router } from 'express';
import { listProducts, getProduct, searchProducts, getFeaturedProducts, getCategories } from '../controllers/productsController.js';

const router = Router();

router.get('/', listProducts);
router.get('/search', searchProducts);
router.get('/featured', getFeaturedProducts);
router.get('/categories', getCategories);
router.get('/:slug', getProduct);

export default router;
