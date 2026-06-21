import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/app';
import prisma from '../src/config/prisma';
import { signGatewayPayload } from '../src/services/paymentGateway.service';
import http from 'http';

const PORT = 4447;
let server: http.Server;

async function request(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  token?: string,
  extraHeaders?: Record<string, string>
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(extraHeaders || {}),
      },
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => (responseBody += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 500, data: JSON.parse(responseBody) });
        } catch {
          resolve({ status: res.statusCode || 500, data: responseBody });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function login(email: string, password: string): Promise<string> {
  const res = await request('POST', '/api/auth/login', { email, password });
  expect(res.status).toBe(200);
  return res.data.token;
}

describe('Cleanzy Portal Workflow Integration Tests', () => {
  const marker = Date.now();
  const password = 'PortalPass123!';
  const scheduledTime = new Date('2031-03-15T11:00:00.000Z');

  let userToken: string;
  let workerToken: string;
  let adminToken: string;
  let serviceId: string;
  let staffId: string;
  let bookingId: string;
  let notificationId: string;

  beforeAll(async () => {
    server = app.listen(PORT);

    await prisma.user.deleteMany({
      where: { email: { contains: `phase5-${marker}` } },
    });
    await prisma.service.deleteMany({
      where: { service_name: { contains: `Phase5 Cleaning ${marker}` } },
    });

    const service = await prisma.service.create({
      data: {
        service_name: `Phase5 Cleaning ${marker}`,
        description: 'Phase 5 portal workflow cleaning service.',
        base_price: 175,
        duration_mins: 90,
      },
    });
    serviceId = service.service_id;

    const clientRes = await request('POST', '/api/auth/register', {
      name: 'Phase 5 Client',
      email: `client-phase5-${marker}@phase5.local`,
      phone: '8100000001',
      password,
      address: 'Client Portal Address',
    });
    expect(clientRes.status).toBe(201);
    userToken = await login(`client-phase5-${marker}@phase5.local`, password);

    const adminRes = await request('POST', '/api/auth/register', {
      name: 'Phase 5 Admin',
      email: `admin-phase5-${marker}@phase5.local`,
      phone: '8100000002',
      password,
      address: 'Admin Portal Address',
      role: 'Administrator',
    });
    expect(adminRes.status).toBe(201);
    adminToken = await login(`admin-phase5-${marker}@phase5.local`, password);

    const workerRes = await request('POST', '/api/auth/register-worker', {
      name: 'Phase 5 Worker',
      email: `worker-phase5-${marker}@phase5.local`,
      phone: '8100000003',
      password,
      address: 'Worker Portal Address',
      skill_type: service.service_name,
      location_coords: '12.9716,77.5946',
    });
    expect(workerRes.status).toBe(201);
    workerToken = await login(`worker-phase5-${marker}@phase5.local`, password);

    const staff = await prisma.staff.findUniqueOrThrow({
      where: { user_id: workerRes.data.data.user_id },
    });
    staffId = staff.staff_id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: `phase5-${marker}` } },
    });
    await prisma.service.deleteMany({
      where: { service_id: serviceId },
    });

    server.close();
    await prisma.$disconnect();
  });

  it('should expose the service catalogue for the frontend app', async () => {
    const res = await request('GET', '/api/services');

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.data.services.some((service: any) => service.service_id === serviceId)).toBe(true);
  });

  it('should confirm a portal booking only through the signed payment webhook', async () => {
    const commit = await request(
      'POST',
      '/api/bookings/commit',
      {
        service_id: serviceId,
        staff_id: staffId,
        scheduled_time: scheduledTime.toISOString(),
        location: 'Client Portal Address',
      },
      userToken
    );

    expect(commit.status).toBe(201);
    expect(commit.data.data.booking.status).toBe('Payment_Required');
    bookingId = commit.data.data.booking.booking_id;

    const payload = {
      event_type: 'payment_intent.succeeded',
      booking_id: bookingId,
      payment_intent_id: 'pi_phase5_authorized',
      amount: 175,
      mode: 'Card',
      transaction_status: 'Authorized',
    };

    const webhook = await request('POST', '/api/payments/webhook', payload, undefined, {
      'x-cleanzy-signature': signGatewayPayload(payload),
    });

    expect(webhook.status).toBe(200);
    expect(webhook.data.data.booking.status).toBe('Confirmed');
  });

  it('should show assigned bookings only in the worker portal', async () => {
    const workerRes = await request('GET', '/api/worker/bookings', undefined, workerToken);
    const customerRes = await request('GET', '/api/worker/bookings', undefined, userToken);

    expect(workerRes.status).toBe(200);
    expect(workerRes.data.data.upcoming.some((booking: any) => booking.booking_id === bookingId)).toBe(true);
    expect(customerRes.status).toBe(403);
  });

  it('should support worker attendance check-in and check-out', async () => {
    const checkIn = await request('POST', '/api/worker/attendance/check-in', {}, workerToken);
    const duplicateCheckIn = await request('POST', '/api/worker/attendance/check-in', {}, workerToken);
    const checkOut = await request('POST', '/api/worker/attendance/check-out', {}, workerToken);
    const attendance = await request('GET', '/api/worker/attendance', undefined, workerToken);

    expect(checkIn.status).toBe(201);
    expect(duplicateCheckIn.status).toBe(409);
    expect(checkOut.status).toBe(200);
    expect(checkOut.data.data.attendance.check_out).toBeTruthy();
    expect(attendance.status).toBe(200);
    expect(attendance.data.data.attendance.length).toBeGreaterThanOrEqual(1);
  });

  it('should let customers view bookings and submit feedback that recalculates staff rating', async () => {
    const myBookings = await request('GET', '/api/bookings/my', undefined, userToken);

    expect(myBookings.status).toBe(200);
    expect(myBookings.data.data.bookings.some((booking: any) => booking.booking_id === bookingId)).toBe(true);

    const feedback = await request(
      'POST',
      '/api/feedback',
      {
        booking_id: bookingId,
        rating: 4,
        comments: 'Arrived on time and cleaned thoroughly.',
      },
      userToken
    );

    expect(feedback.status).toBe(201);
    expect(feedback.data.data.feedback.rating).toBe(4);
    expect(feedback.data.data.staff.rating).toBe(4);

    const duplicate = await request(
      'POST',
      '/api/feedback',
      {
        booking_id: bookingId,
        rating: 5,
        comments: 'Second review should fail.',
      },
      userToken
    );

    expect(duplicate.status).toBe(409);
  });

  it('should expose notifications and mark owned notifications as read', async () => {
    const notifications = await request('GET', '/api/notifications', undefined, userToken);

    expect(notifications.status).toBe(200);
    expect(notifications.data.data.notifications.length).toBeGreaterThan(0);
    notificationId = notifications.data.data.notifications[0].notification_id;

    const read = await request(
      'PUT',
      `/api/notifications/${notificationId}/read`,
      {},
      userToken
    );

    expect(read.status).toBe(200);
    expect(read.data.data.notification.is_read).toBe(true);
  });

  it('should provide an administrator operations overview with salary preview data', async () => {
    const denied = await request('GET', '/api/admin/overview', undefined, userToken);
    const overview = await request('GET', '/api/admin/overview', undefined, adminToken);

    expect(denied.status).toBe(403);
    expect(overview.status).toBe(200);
    expect(overview.data.data.recent_bookings.length).toBeGreaterThan(0);
    expect(
      overview.data.data.staff_performance.some(
        (staff: any) => staff.staff_id === staffId && staff.salary_preview.estimated_amount >= 100
      )
    ).toBe(true);
    expect(Array.isArray(overview.data.data.holiday_requests)).toBe(true);
    expect(Array.isArray(overview.data.data.complaints)).toBe(true);
  });
});

