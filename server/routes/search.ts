import { Router } from 'express';
import { searchProducts } from '../controllers/productsController.js';

const router = Router();

router.get('/', searchProducts);

export default router;
