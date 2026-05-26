import { PrismaClient } from '@prisma/client';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const prisma = new PrismaClient();

describe('Cleanzy Database Schema Integration Tests', () => {
  let testClientId: string;
  let testWorkerId: string;
  let testStaffId: string;
  let testServiceId: string;
  let testBookingId: string;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should successfully read seeded services', async () => {
    const services = await prisma.service.findMany();
    expect(services.length).toBeGreaterThanOrEqual(2);
    const serviceNames = services.map(s => s.service_name);
    expect(serviceNames).toContain('Standard Cleaning');
    expect(serviceNames).toContain('Deep Cleaning');
  });

  it('should enforce unique constraint on User email', async () => {
    const email = `duplicate-${Date.now()}@test.com`;
    // Create first user
    const firstUser = await prisma.user.create({
      data: {
        name: 'Test Client',
        email,
        phone: '1234567890',
        role: 'User',
        password_hash: 'hash',
        address: '123 Client Lane',
      },
    });

    // Attempting to create duplicate email user should throw an error
    await expect(
      prisma.user.create({
        data: {
          name: 'Duplicate Client',
          email,
          phone: '0987654321',
          role: 'User',
          password_hash: 'hash2',
          address: '456 Client St',
        },
      })
    ).rejects.toThrow();

    // Clean up
    await prisma.user.delete({ where: { user_id: firstUser.user_id } });
  });

  it('should enforce one-to-one or zero-to-one between User and Staff', async () => {
    // Create user
    const user = await prisma.user.create({
      data: {
        name: 'Test Worker',
        email: `worker-${Date.now()}@test.com`,
        phone: '1234567890',
        role: 'Worker',
        password_hash: 'hash',
        address: '123 Worker St',
      },
    });
    testWorkerId = user.user_id;

    // Create staff profile
    const staff = await prisma.staff.create({
      data: {
        user_id: user.user_id,
        skill_type: 'Standard Cleaning',
        location_coords: '40.7128,-74.0060',
      },
    });
    testStaffId = staff.staff_id;

    expect(staff.staff_id).toBeDefined();

    // Attempting to create another staff profile for the same user should fail (unique constraint)
    await expect(
      prisma.staff.create({
        data: {
          user_id: user.user_id,
          skill_type: 'Deep Cleaning',
          location_coords: '40.7128,-74.0060',
        },
      })
    ).rejects.toThrow();
  });

  it('should complete a full booking creation transaction', async () => {
    // 1. Create a client user
    const client = await prisma.user.create({
      data: {
        name: 'Client Tester',
        email: `client-${Date.now()}@test.com`,
        phone: '1122334455',
        role: 'User',
        password_hash: 'hash',
        address: 'Client Address',
      },
    });
    testClientId = client.user_id;

    // 2. Fetch Deep Cleaning service
    const service = await prisma.service.findFirst({
      where: { service_name: 'Deep Cleaning' },
    });
    expect(service).not.toBeNull();
    testServiceId = service!.service_id;

    // 3. Create a Booking
    const booking = await prisma.booking.create({
      data: {
        client_id: testClientId,
        staff_id: testStaffId,
        service_id: testServiceId,
        scheduled_time: new Date(),
        status: 'Pending',
        location: 'Client Address',
      },
    });
    testBookingId = booking.booking_id;
    expect(booking.booking_id).toBeDefined();
    expect(booking.status).toBe('Pending');
  });

  it('should enforce one-to-one between Booking and Payment', async () => {
    // 1. Create payment
    const payment = await prisma.payment.create({
      data: {
        booking_id: testBookingId,
        amount: 120.0,
        mode: 'Card',
        transaction_status: 'Authorized',
      },
    });
    expect(payment.payment_id).toBeDefined();
    expect(payment.transaction_status).toBe('Authorized');

    // 2. Attempting to create a second payment for the same booking should fail
    await expect(
      prisma.payment.create({
        data: {
          booking_id: testBookingId,
          amount: 120.0,
          mode: 'Cash',
          transaction_status: 'Pending',
        },
      })
    ).rejects.toThrow();
  });

  it('should handle Attendance logging', async () => {
    const attendance = await prisma.attendance.create({
      data: {
        staff_id: testStaffId,
        date: new Date(),
        check_in: new Date(),
      },
    });
    expect(attendance.attendance_id).toBeDefined();

    // Check-out update
    const updated = await prisma.attendance.update({
      where: { attendance_id: attendance.attendance_id },
      data: { check_out: new Date() },
    });
    expect(updated.check_out).not.toBeNull();
  });

  it('should handle Feedback submission', async () => {
    const feedback = await prisma.feedback.create({
      data: {
        booking_id: testBookingId,
        client_id: testClientId,
        rating: 5,
        comments: 'Excellent service!',
      },
    });
    expect(feedback.feedback_id).toBeDefined();
    expect(feedback.rating).toBe(5);
  });

  it('should handle Notification dispatching', async () => {
    const notification = await prisma.notification.create({
      data: {
        user_id: testClientId,
        type: 'BookingConfirmed',
        message: 'Your booking has been successfully confirmed.',
      },
    });
    expect(notification.notification_id).toBeDefined();
    expect(notification.is_read).toBe(false);
  });

  it('should clean up test data successfully via cascading deletes', async () => {
    // Delete test client (should cascade delete booking, feedback, notification, payment)
    await prisma.user.delete({ where: { user_id: testClientId } });
    
    // Delete test worker user (should cascade delete staff profile, which cascades attendance)
    await prisma.user.delete({ where: { user_id: testWorkerId } });

    // Verify bookings, feedback, notifications, payments, attendance are cleaned up
    const bookings = await prisma.booking.findMany({ where: { booking_id: testBookingId } });
    const payments = await prisma.payment.findMany({ where: { booking_id: testBookingId } });
    const feedback = await prisma.feedback.findMany({ where: { booking_id: testBookingId } });
    const notifications = await prisma.notification.findMany({ where: { user_id: testClientId } });
    const attendance = await prisma.attendance.findMany({ where: { staff_id: testStaffId } });

    expect(bookings.length).toBe(0);
    expect(payments.length).toBe(0);
    expect(feedback.length).toBe(0);
    expect(notifications.length).toBe(0);
    expect(attendance.length).toBe(0);
  });
});
