import { Router } from 'express';
import { searchServiceOptions } from '../controllers/discovery.controller';
import { authenticateJWT, requireRoles } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateJWT);

router.post('/search', requireRoles(['User']), searchServiceOptions);

export default router;

