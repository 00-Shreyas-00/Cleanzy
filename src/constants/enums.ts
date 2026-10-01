export enum UserRole {
  USER = 'User',
  WORKER = 'Worker',
  ADMINISTRATOR = 'Administrator',
}

export enum BookingStatus {
  PENDING = 'Pending',
  PAYMENT_REQUIRED = 'Payment_Required',
  CONFIRMED = 'Confirmed',
  CANCELLED = 'Cancelled',
}

export const ACTIVE_BOOKING_STATUSES: string[] = [
  BookingStatus.PENDING,
  BookingStatus.PAYMENT_REQUIRED,
  BookingStatus.CONFIRMED,
];
