import prisma from '../config/prisma';
import { logNotification } from './notification.service';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
} from '../errors/AppError';
import { BookingStatus } from '../constants/enums';

export const bookingInclude = {
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

export class PortalService {
  static async getWorkerStaff(userId: string) {
    return prisma.staff.findUnique({
      where: { user_id: userId },
    });
  }

  static async getMyBookings(userId: string) {
    if (!userId) {
      throw new UnauthorizedError('Unauthorized: Access credentials missing');
    }

    const bookings = await prisma.booking.findMany({
      where: { client_id: userId },
      include: bookingInclude,
      orderBy: { scheduled_time: 'desc' },
    });

    return { bookings };
  }

  static async getWorkerBookings(userId: string) {
    if (!userId) {
      throw new UnauthorizedError('Unauthorized: Access credentials missing');
    }

    const staff = await this.getWorkerStaff(userId);
    if (!staff) {
      throw new NotFoundError('Worker staff profile not found');
    }

    const now = new Date();
    const bookings = await prisma.booking.findMany({
      where: { staff_id: staff.staff_id },
      include: bookingInclude,
      orderBy: { scheduled_time: 'asc' },
    });

    return {
      upcoming: bookings.filter((booking) => booking.scheduled_time >= now),
      past: bookings.filter((booking) => booking.scheduled_time < now),
    };
  }

  static async checkInAttendance(userId: string) {
    if (!userId) {
      throw new UnauthorizedError('Unauthorized: Access credentials missing');
    }

    const staff = await this.getWorkerStaff(userId);
    if (!staff) {
      throw new NotFoundError('Worker staff profile not found');
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
      throw new ConflictError('Worker is already checked in');
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

    return { attendance };
  }

  static async checkOutAttendance(userId: string) {
    if (!userId) {
      throw new UnauthorizedError('Unauthorized: Access credentials missing');
    }

    const staff = await this.getWorkerStaff(userId);
    if (!staff) {
      throw new NotFoundError('Worker staff profile not found');
    }

    const openAttendance = await prisma.attendance.findFirst({
      where: {
        staff_id: staff.staff_id,
        check_out: null,
      },
      orderBy: { check_in: 'desc' },
    });

    if (!openAttendance) {
      throw new ConflictError('No open attendance session found');
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

    return { attendance };
  }

  static async getMyAttendance(userId: string) {
    if (!userId) {
      throw new UnauthorizedError('Unauthorized: Access credentials missing');
    }

    const staff = await this.getWorkerStaff(userId);
    if (!staff) {
      throw new NotFoundError('Worker staff profile not found');
    }

    const attendance = await prisma.attendance.findMany({
      where: { staff_id: staff.staff_id },
      orderBy: { check_in: 'desc' },
      take: 30,
    });

    return { attendance };
  }

  static async submitFeedback(
    userId: string,
    booking_id: string,
    ratingRaw: unknown,
    comments?: unknown
  ) {
    if (!userId) {
      throw new UnauthorizedError('Unauthorized: Access credentials missing');
    }

    const numericRating = Number(ratingRaw);

    if (!booking_id || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      throw new BadRequestError('booking_id and rating between 1 and 5 are required');
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
        throw new NotFoundError('Booking not found');
      }

      if (booking.client_id !== userId) {
        throw new ForbiddenError('Cannot review another customer booking');
      }

      if (booking.status !== BookingStatus.CONFIRMED) {
        throw new ConflictError('Only confirmed bookings can receive feedback');
      }

      if (booking.feedback) {
        throw new ConflictError('Feedback has already been submitted for this booking');
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

    return result;
  }

  static async getNotifications(userId: string) {
    if (!userId) {
      throw new UnauthorizedError('Unauthorized: Access credentials missing');
    }

    const notifications = await prisma.notification.findMany({
      where: { user_id: userId },
      orderBy: { sent_at: 'desc' },
      take: 20,
    });

    return {
      notifications,
      unread_count: notifications.filter((n) => !n.is_read).length,
    };
  }

  static async markNotificationRead(userId: string, notificationId: string) {
    if (!userId) {
      throw new UnauthorizedError('Unauthorized: Access credentials missing');
    }

    if (!notificationId) {
      throw new BadRequestError('notification_id is required');
    }

    const notification = await prisma.notification.findUnique({
      where: { notification_id: notificationId },
    });

    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    if (notification.user_id !== userId) {
      throw new ForbiddenError('Cannot mark another user notification as read');
    }

    const updated = await prisma.notification.update({
      where: { notification_id: notificationId },
      data: { is_read: true },
    });

    return { notification: updated };
  }

  static async getAdminOverview() {
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
      const confirmedBookings = worker.bookings.filter((b) => b.status === BookingStatus.CONFIRMED);
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
        feedback_count: worker.bookings.filter((b) => b.feedback).length,
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

    return {
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
    };
  }
}
