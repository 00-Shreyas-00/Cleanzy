import { Response, NextFunction, Request } from 'express';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import {
  createPaymentIntent,
  isValidGatewaySignature,
  PaymentWebhookPayload,
} from '../services/paymentGateway.service';

const ACTIVE_BOOKING_STATUSES = ['Pending', 'Payment_Required', 'Confirmed'];

export const createBookingCommit = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.user_id;
    const { service_id, staff_id, scheduled_time, location } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Access credentials missing',
      });
    }

    if (!service_id || !staff_id || !scheduled_time || !location) {
      return res.status(400).json({
        success: false,
        error: 'service_id, staff_id, scheduled_time, and location are required',
      });
    }

    const scheduledAt = new Date(scheduled_time);
    if (Number.isNaN(scheduledAt.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'scheduled_time must be a valid datetime',
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const service = await tx.service.findUnique({
        where: { service_id },
      });

      if (!service) {
        return { errorStatus: 404, error: 'Service not found' };
      }

      const staff = await tx.staff.findUnique({
        where: { staff_id },
      });

      if (!staff) {
        return { errorStatus: 404, error: 'Staff not found' };
      }

      if (!staff.availability || staff.skill_type !== service.service_name) {
        return {
          errorStatus: 409,
          error: 'Selected staff is not available for the requested service',
        };
      }

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
        return {
          errorStatus: 409,
          error: 'Selected staff is already booked for the requested time',
        };
      }

      const booking = await tx.booking.create({
        data: {
          client_id: userId,
          staff_id,
          service_id,
          scheduled_time: scheduledAt,
          status: 'Payment_Required',
          location,
        },
      });

      const paymentIntent = createPaymentIntent({
        bookingId: booking.booking_id,
        amount: service.base_price,
      });

      return { booking, service, paymentIntent };
    });

    if ('error' in result) {
      return res.status(result.errorStatus ?? 500).json({
        success: false,
        error: result.error,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Booking created and payment intent generated',
      data: {
        booking: result.booking,
        payment_intent: result.paymentIntent,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const handlePaymentWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['x-cleanzy-signature'];
    const signatureValue = Array.isArray(signature) ? signature[0] : signature;

    if (!isValidGatewaySignature(req.body, signatureValue)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid payment gateway signature',
      });
    }

    const payload = req.body as PaymentWebhookPayload;
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
      return res.status(400).json({
        success: false,
        error: 'Invalid or unsupported payment authorization payload',
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { booking_id },
        include: { payment: true },
      });

      if (!booking) {
        return { errorStatus: 404, error: 'Booking not found' };
      }

      if (booking.status === 'Cancelled') {
        return {
          errorStatus: 409,
          error: 'Cancelled bookings cannot be confirmed',
        };
      }

      if (booking.payment) {
        return {
          errorStatus: 409,
          error: 'Payment has already been recorded for this booking',
        };
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
        data: { status: 'Confirmed' },
      });

      return { booking: confirmedBooking, payment };
    });

    if ('error' in result) {
      return res.status(result.errorStatus ?? 500).json({
        success: false,
        error: result.error,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Payment authorized and booking confirmed',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const cleanupPendingBookings = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const olderThanMinutes = Number(req.body.older_than_minutes ?? 30);

    if (!Number.isFinite(olderThanMinutes) || olderThanMinutes <= 0) {
      return res.status(400).json({
        success: false,
        error: 'older_than_minutes must be a positive number',
      });
    }

    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);

    const result = await prisma.booking.updateMany({
      where: {
        status: {
          in: ['Pending', 'Payment_Required'],
        },
        scheduled_time: {
          lt: cutoff,
        },
      },
      data: {
        status: 'Cancelled',
      },
    });

    res.status(200).json({
      success: true,
      message: 'Stale pending bookings cleaned up',
      data: {
        cancelled_count: result.count,
        cutoff: cutoff.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};
