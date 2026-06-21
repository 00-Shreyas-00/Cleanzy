import { Router } from 'express';
import {
  checkInAttendance,
  checkOutAttendance,
  getAdminOverview,
  getMyAttendance,
  getMyBookings,
  getNotifications,
  getWorkerBookings,
  markNotificationRead,
  submitFeedback,
} from '../controllers/portal.controller';
import { authenticateJWT, requireRoles } from '../middleware/auth.middleware';

const router = Router();

router.get('/bookings/my', authenticateJWT, requireRoles(['User']), getMyBookings);
router.get('/worker/bookings', authenticateJWT, requireRoles(['Worker']), getWorkerBookings);
router.post('/worker/attendance/check-in', authenticateJWT, requireRoles(['Worker']), checkInAttendance);
router.post('/worker/attendance/check-out', authenticateJWT, requireRoles(['Worker']), checkOutAttendance);
router.get('/worker/attendance', authenticateJWT, requireRoles(['Worker']), getMyAttendance);
router.post('/feedback', authenticateJWT, requireRoles(['User']), submitFeedback);
router.get('/notifications', authenticateJWT, getNotifications);
router.put('/notifications/:notification_id/read', authenticateJWT, markNotificationRead);
router.get('/admin/overview', authenticateJWT, requireRoles(['Administrator']), getAdminOverview);

export default router;

