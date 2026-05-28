import { Router } from 'express';
import {
  cleanupPendingBookings,
  createBookingCommit,
  handlePaymentWebhook,
} from '../controllers/booking.controller';
import { authenticateJWT, requireRoles } from '../middleware/auth.middleware';

const router = Router();

router.post('/payments/webhook', handlePaymentWebhook);

router.post('/bookings/commit', authenticateJWT, requireRoles(['User']), createBookingCommit);
router.post(
  '/bookings/cleanup-pending',
  authenticateJWT,
  requireRoles(['Administrator']),
  cleanupPendingBookings
);

export default router;

