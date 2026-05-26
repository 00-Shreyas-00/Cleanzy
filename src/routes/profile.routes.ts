import { Router } from 'express';
import { getProfile, updateProfile } from '../controllers/profile.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// Protect all routes in this router with JWT auth
router.use(authenticateJWT);

router.get('/me', getProfile);
router.put('/me', updateProfile);

export default router;
