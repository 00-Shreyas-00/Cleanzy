import prisma from '../config/prisma';
import {
  createPaymentIntent,
  isValidGatewaySignature,
  PaymentWebhookPayload,
} from './paymentGateway.service';
import { logNotification } from './notification.service';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
} from '../errors/AppError';
import { ACTIVE_BOOKING_STATUSES, BookingStatus } from '../constants/enums';

export interface CreateBookingDTO {
  userId: string;
  service_id: string;
  staff_id: string;
  scheduled_time: string;
  location: string;
}

export class BookingService {
  static async createBookingCommit(dto: CreateBookingDTO) {
    const { userId, service_id, staff_id, scheduled_time, location } = dto;

    if (!userId) {
      throw new UnauthorizedError('Unauthorized: Access credentials missing');
    }

    if (!service_id || !staff_id || !scheduled_time || !location) {
      throw new BadRequestError('service_id, staff_id, scheduled_time, and location are required');
    }

    const scheduledAt = new Date(scheduled_time);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestError('scheduled_time must be a valid datetime');
    }

    const result = await prisma.$transaction(async (tx) => {
      const service = await tx.service.findUnique({
        where: { service_id },
      });

      if (!service) {
        throw new NotFoundError('Service not found');
      }

      const staff = await tx.staff.findUnique({
        where: { staff_id },
      });

      if (!staff) {
        throw new NotFoundError('Staff not found');
      }

      if (!staff.availability || staff.skill_type !== service.service_name) {
        throw new ConflictError('Selected staff is not available for the requested service');
      }

      // Check conflicting active bookings for this staff member
      const conflictingBooking = await tx.booking.findFirst({
        where: {
          staff_id,
          scheduled_time: scheduledAt,
          status: {
            in: ACTIVE_BOOKING_STATUSES,
          },
        },
      });

      if (conflictingBooking) {
        throw new ConflictError('Selected staff is already booked for the requested time');
      }

      const booking = await tx.booking.create({
        data: {
          client_id: userId,
          staff_id,
          service_id,
          scheduled_time: scheduledAt,
          status: BookingStatus.PAYMENT_REQUIRED,
          location,
        },
      });

      await logNotification(tx, {
        userId,
        type: 'BookingPaymentRequired',
        message: `Payment is required to confirm your ${service.service_name} booking.`,
      });

      await logNotification(tx, {
        userId: staff.user_id,
        type: 'BookingAssigned',
        message: `A ${service.service_name} booking is awaiting payment authorization.`,
      });

      const paymentIntent = createPaymentIntent({
        bookingId: booking.booking_id,
        amount: service.base_price,
      });

      return { booking, service, paymentIntent };
    });

    return {
      booking: result.booking,
      payment_intent: result.paymentIntent,
    };
  }

  static async handlePaymentWebhook(
    signatureValue: string | undefined,
    payload: PaymentWebhookPayload
  ) {
    if (!isValidGatewaySignature(payload, signatureValue)) {
      throw new UnauthorizedError('Invalid payment gateway signature');
    }

    const {
      event_type,
      booking_id,
      payment_intent_id,
      amount,
      mode,
      transaction_status,
    } = payload;

    if (
      event_type !== 'payment_intent.succeeded' ||
      !booking_id ||
      !payment_intent_id ||
      typeof amount !== 'number' ||
      !mode ||
      transaction_status !== 'Authorized'
    ) {
      throw new BadRequestError('Invalid or unsupported payment authorization payload');
    }

    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { booking_id },
        include: {
          payment: true,
          service: true,
          staff: true,
        },
      });

      if (!booking) {
        throw new NotFoundError('Booking not found');
      }

      if (booking.status === BookingStatus.CANCELLED) {
        throw new ConflictError('Cancelled bookings cannot be confirmed');
      }

      if (booking.payment) {
        throw new ConflictError('Payment has already been recorded for this booking');
      }

      const payment = await tx.payment.create({
        data: {
          booking_id,
          amount,
          mode,
          transaction_status,
        },
      });

      const confirmedBooking = await tx.booking.update({
        where: { booking_id },
        data: { status: BookingStatus.CONFIRMED },
      });

      await logNotification(tx, {
        userId: booking.client_id,
        type: 'BookingConfirmed',
        message: `Payment authorized. Your ${booking.service.service_name} booking is confirmed.`,
      });

      await logNotification(tx, {
        userId: booking.staff.user_id,
        type: 'BookingConfirmed',
        message: `A ${booking.service.service_name} booking has been confirmed.`,
      });

      return { booking: confirmedBooking, payment };
    });

    return result;
  }

  static async cleanupPendingBookings(olderThanMinutesRaw: unknown) {
    const olderThanMinutes = Number(olderThanMinutesRaw ?? 30);

    if (!Number.isFinite(olderThanMinutes) || olderThanMinutes <= 0) {
      throw new BadRequestError('older_than_minutes must be a positive number');
    }

    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);

    const staleBookings = await prisma.booking.findMany({
      where: {
        status: {
          in: [BookingStatus.PENDING, BookingStatus.PAYMENT_REQUIRED],
        },
        scheduled_time: {
          lt: cutoff,
        },
      },
      include: {
        service: true,
        staff: true,
      },
    });

    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.booking.updateMany({
        where: {
          booking_id: {
            in: staleBookings.map((b) => b.booking_id),
          },
        },
        data: {
          status: BookingStatus.CANCELLED,
        },
      });

      for (const booking of staleBookings) {
        await logNotification(tx, {
          userId: booking.client_id,
          type: 'BookingCancelled',
          message: `Your stale ${booking.service.service_name} booking was cancelled.`,
        });

        await logNotification(tx, {
          userId: booking.staff.user_id,
          type: 'BookingCancelled',
          message: `A stale ${booking.service.service_name} assignment was cancelled.`,
        });
      }

      return updateResult;
    });

    return {
      cancelled_count: result.count,
      cutoff: cutoff.toISOString(),
    };
  }
}
