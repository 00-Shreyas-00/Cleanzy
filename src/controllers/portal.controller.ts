import { Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { logNotification } from '../services/notification.service';

const bookingInclude = {
  service: true,
  payment: true,
  feedback: true,
  staff: {
    include: {
      user: {
        select: {
          user_id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  },
  client: {
    select: {
      user_id: true,
      name: true,
      email: true,
      phone: true,
      address: true,
    },
  },
};

const getWorkerStaff = async (userId: string) =>
  prisma.staff.findUnique({
    where: { user_id: userId },
  });

export const getMyBookings = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Access credentials missing' });
    }

    const bookings = await prisma.booking.findMany({
      where: { client_id: userId },
      include: bookingInclude,
      orderBy: { scheduled_time: 'desc' },
    });

    res.status(200).json({
      success: true,
      data: { bookings },
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
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Access credentials missing' });
    }

    const staff = await getWorkerStaff(userId);
    if (!staff) {
      return res.status(404).json({ success: false, error: 'Worker staff profile not found' });
    }

    const now = new Date();
    const bookings = await prisma.booking.findMany({
      where: { staff_id: staff.staff_id },
      include: bookingInclude,
      orderBy: { scheduled_time: 'asc' },
    });

    res.status(200).json({
      success: true,
      data: {
        upcoming: bookings.filter((booking) => booking.scheduled_time >= now),
        past: bookings.filter((booking) => booking.scheduled_time < now),
      },
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
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Access credentials missing' });
    }

    const staff = await getWorkerStaff(userId);
    if (!staff) {
      return res.status(404).json({ success: false, error: 'Worker staff profile not found' });
    }

    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const openAttendance = await prisma.attendance.findFirst({
      where: {
        staff_id: staff.staff_id,
        date: today,
        check_out: null,
      },
    });

    if (openAttendance) {
      return res.status(409).json({
        success: false,
        error: 'Worker is already checked in',
      });
    }

    const attendance = await prisma.attendance.create({
      data: {
        staff_id: staff.staff_id,
        date: today,
        check_in: now,
      },
    });

    await logNotification(prisma, {
      userId,
      type: 'AttendanceCheckIn',
      message: 'Attendance check-in recorded.',
    });

    res.status(201).json({
      success: true,
      message: 'Attendance check-in recorded',
      data: { attendance },
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
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Access credentials missing' });
    }

    const staff = await getWorkerStaff(userId);
    if (!staff) {
      return res.status(404).json({ success: false, error: 'Worker staff profile not found' });
    }

    const openAttendance = await prisma.attendance.findFirst({
      where: {
        staff_id: staff.staff_id,
        check_out: null,
      },
      orderBy: { check_in: 'desc' },
    });

    if (!openAttendance) {
      return res.status(409).json({
        success: false,
        error: 'No open attendance session found',
      });
    }

    const attendance = await prisma.attendance.update({
      where: { attendance_id: openAttendance.attendance_id },
      data: { check_out: new Date() },
    });

    await logNotification(prisma, {
      userId,
      type: 'AttendanceCheckOut',
      message: 'Attendance check-out recorded.',
    });

    res.status(200).json({
      success: true,
      message: 'Attendance check-out recorded',
      data: { attendance },
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
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Access credentials missing' });
    }

    const staff = await getWorkerStaff(userId);
    if (!staff) {
      return res.status(404).json({ success: false, error: 'Worker staff profile not found' });
    }

    const attendance = await prisma.attendance.findMany({
      where: { staff_id: staff.staff_id },
      orderBy: { check_in: 'desc' },
      take: 30,
    });

    res.status(200).json({
      success: true,
      data: { attendance },
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
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Access credentials missing' });
    }

    const { booking_id, rating, comments } = req.body;
    const numericRating = Number(rating);

    if (!booking_id || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        error: 'booking_id and rating between 1 and 5 are required',
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { booking_id },
        include: {
          feedback: true,
          staff: { include: { user: true } },
          service: true,
        },
      });

      if (!booking) {
        return { errorStatus: 404, error: 'Booking not found' };
      }

      if (booking.client_id !== userId) {
        return { errorStatus: 403, error: 'Cannot review another customer booking' };
      }

      if (booking.status !== 'Confirmed') {
        return { errorStatus: 409, error: 'Only confirmed bookings can receive feedback' };
      }

      if (booking.feedback) {
        return { errorStatus: 409, error: 'Feedback has already been submitted for this booking' };
      }

      const feedback = await tx.feedback.create({
        data: {
          booking_id,
          client_id: userId,
          rating: numericRating,
          comments: typeof comments === 'string' ? comments : '',
        },
      });

      const staffFeedback = await tx.feedback.findMany({
        where: {
          booking: {
            staff_id: booking.staff_id,
          },
        },
        select: { rating: true },
      });

      const averageRating =
        staffFeedback.reduce((sum, item) => sum + item.rating, 0) / staffFeedback.length;

      const staff = await tx.staff.update({
        where: { staff_id: booking.staff_id },
        data: { rating: Number(averageRating.toFixed(2)) },
      });

      await logNotification(tx, {
        userId: booking.staff.user_id,
        type: 'FeedbackReceived',
        message: `New ${numericRating}-star feedback received for ${booking.service.service_name}.`,
      });

      await logNotification(tx, {
        userId,
        type: 'FeedbackSubmitted',
        message: 'Your service feedback was submitted.',
      });

      return { feedback, staff };
    });

    if ('error' in result) {
      return res.status(result.errorStatus ?? 500).json({
        success: false,
        error: result.error,
      });
    }

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
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Access credentials missing' });
    }

    const notifications = await prisma.notification.findMany({
      where: { user_id: userId },
      orderBy: { sent_at: 'desc' },
      take: 50,
    });

    res.status(200).json({
      success: true,
      data: { notifications },
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
    const userId = req.user?.user_id;
    const notificationId = req.params.notification_id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Access credentials missing' });
    }

    if (typeof notificationId !== 'string') {
      return res.status(400).json({ success: false, error: 'notification_id is required' });
    }

    const notification = await prisma.notification.findUnique({
      where: { notification_id: notificationId },
    });

    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    if (notification.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Cannot update another user notification' });
    }

    const updated = await prisma.notification.update({
      where: { notification_id: notificationId },
      data: { is_read: true },
    });

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: { notification: updated },
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
    const [bookingCounts, usersByRole, staff, attendanceCount, recentBookings] = await Promise.all([
      prisma.booking.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.user.groupBy({
        by: ['role'],
        _count: { role: true },
      }),
      prisma.staff.findMany({
        include: {
          user: {
            select: {
              user_id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          bookings: {
            include: {
              payment: true,
              feedback: true,
              service: true,
            },
          },
          attendance: true,
        },
        orderBy: { rating: 'desc' },
      }),
      prisma.attendance.count(),
      prisma.booking.findMany({
        include: bookingInclude,
        orderBy: { scheduled_time: 'desc' },
        take: 20,
      }),
    ]);

    const staffPerformance = staff.map((worker) => {
      const confirmedBookings = worker.bookings.filter((booking) => booking.status === 'Confirmed');
      const authorizedAmount = confirmedBookings.reduce(
        (sum, booking) => sum + (booking.payment?.amount ?? 0),
        0
      );

      return {
        staff_id: worker.staff_id,
        worker: worker.user,
        skill_type: worker.skill_type,
        rating: worker.rating,
        availability: worker.availability,
        total_bookings: worker.bookings.length,
        confirmed_bookings: confirmedBookings.length,
        feedback_count: worker.bookings.filter((booking) => booking.feedback).length,
        attendance_days: worker.attendance.length,
        salary_preview: {
          currency: 'INR',
          daily_rate: 500,
          booking_bonus: 100,
          estimated_amount: worker.attendance.length * 500 + confirmedBookings.length * 100,
          authorized_booking_amount: authorizedAmount,
        },
      };
    });

    res.status(200).json({
      success: true,
      data: {
        booking_counts: bookingCounts.map((item) => ({
          status: item.status,
          count: item._count.status,
        })),
        users_by_role: usersByRole.map((item) => ({
          role: item.role,
          count: item._count.role,
        })),
        attendance_count: attendanceCount,
        staff_performance: staffPerformance,
        recent_bookings: recentBookings,
        holiday_requests: [],
        complaints: [],
      },
    });
  } catch (error) {
    next(error);
  }
};
