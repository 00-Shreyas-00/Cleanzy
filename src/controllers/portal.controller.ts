import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { PortalService } from '../services/portal.service';

export const getMyBookings = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await PortalService.getMyBookings(req.user?.user_id!);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getWorkerBookings = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await PortalService.getWorkerBookings(req.user?.user_id!);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const checkInAttendance = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await PortalService.checkInAttendance(req.user?.user_id!);
    res.status(201).json({
      success: true,
      message: 'Attendance check-in recorded',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const checkOutAttendance = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await PortalService.checkOutAttendance(req.user?.user_id!);
    res.status(200).json({
      success: true,
      message: 'Attendance check-out recorded',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyAttendance = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await PortalService.getMyAttendance(req.user?.user_id!);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const submitFeedback = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { booking_id, rating, comments } = req.body;
    const result = await PortalService.submitFeedback(
      req.user?.user_id!,
      booking_id,
      rating,
      comments
    );
    res.status(201).json({
      success: true,
      message: 'Feedback submitted and worker rating updated',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getNotifications = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await PortalService.getNotifications(req.user?.user_id!);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const rawId = req.params.notification_id || req.params.notificationId;
    const notificationId = Array.isArray(rawId) ? rawId[0] : rawId;
    const data = await PortalService.markNotificationRead(req.user?.user_id!, notificationId);
    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminOverview = async (
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await PortalService.getAdminOverview();
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};
