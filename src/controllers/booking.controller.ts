import { Response, NextFunction, Request } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { BookingService } from '../services/booking.service';
import { PaymentWebhookPayload } from '../services/paymentGateway.service';

export const createBookingCommit = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.user_id;
    const { service_id, staff_id, scheduled_time, location } = req.body;

    const data = await BookingService.createBookingCommit({
      userId: userId!,
      service_id,
      staff_id,
      scheduled_time,
      location,
    });

    res.status(201).json({
      success: true,
      message: 'Booking created and payment intent generated',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const handlePaymentWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['x-cleanzy-signature'];
    const signatureValue = Array.isArray(signature) ? signature[0] : signature;

    const result = await BookingService.handlePaymentWebhook(
      signatureValue,
      req.body as PaymentWebhookPayload
    );

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
    const data = await BookingService.cleanupPendingBookings(req.body.older_than_minutes);

    res.status(200).json({
      success: true,
      message: 'Stale pending bookings cleaned up',
      data,
    });
  } catch (error) {
    next(error);
  }
};
