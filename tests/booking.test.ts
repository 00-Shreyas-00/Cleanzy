import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/app';
import prisma from '../src/config/prisma';
import { signGatewayPayload } from '../src/services/paymentGateway.service';
import http from 'http';

const PORT = 4446;
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

describe('Cleanzy Booking Engine & Payment Gateway Integration Tests', () => {
  const marker = Date.now();
  const password = 'BookingPass123!';
  const scheduledTime = new Date('2031-02-20T09:30:00.000Z');

  let userToken: string;
  let workerToken: string;
  let adminToken: string;
  let clientId: string;
  let serviceId: string;
  let staffId: string;
  let bookingId: string;

  beforeAll(async () => {
    server = app.listen(PORT);

    await prisma.user.deleteMany({
      where: { email: { contains: `phase4-${marker}` } },
    });
    await prisma.service.deleteMany({
      where: { service_name: { contains: `Phase4 Cleaning ${marker}` } },
    });

    const service = await prisma.service.create({
      data: {
        service_name: `Phase4 Cleaning ${marker}`,
        description: 'Phase 4 payment workflow cleaning service.',
        base_price: 145.75,
        duration_mins: 120,
      },
    });
    serviceId = service.service_id;

    const clientRes = await request('POST', '/api/auth/register', {
      name: 'Phase 4 Client',
      email: `client-phase4-${marker}@phase4.local`,
      phone: '8000000001',
      password,
      address: 'Client Address',
    });
    expect(clientRes.status).toBe(201);
    clientId = clientRes.data.data.user_id;
    userToken = await login(`client-phase4-${marker}@phase4.local`, password);

    const adminRes = await request('POST', '/api/auth/register', {
      name: 'Phase 4 Admin',
      email: `admin-phase4-${marker}@phase4.local`,
      phone: '8000000002',
      password,
      address: 'Admin Address',
      role: 'Administrator',
    });
    expect(adminRes.status).toBe(201);
    adminToken = await login(`admin-phase4-${marker}@phase4.local`, password);

    const workerRes = await request('POST', '/api/auth/register-worker', {
      name: 'Phase 4 Worker',
      email: `worker-phase4-${marker}@phase4.local`,
      phone: '8000000003',
      password,
      address: 'Worker Address',
      skill_type: service.service_name,
      location_coords: '12.9716,77.5946',
    });
    expect(workerRes.status).toBe(201);
    workerToken = await login(`worker-phase4-${marker}@phase4.local`, password);

    const staff = await prisma.staff.findUniqueOrThrow({
      where: { user_id: workerRes.data.data.user_id },
    });
    staffId = staff.staff_id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: `phase4-${marker}` } },
    });
    await prisma.service.deleteMany({
      where: { service_id: serviceId },
    });

    server.close();
    await prisma.$disconnect();
  });

  it('should restrict booking commits to User clients', async () => {
    const res = await request(
      'POST',
      '/api/bookings/commit',
      {
        service_id: serviceId,
        staff_id: staffId,
        scheduled_time: scheduledTime.toISOString(),
        location: 'Client Address',
      },
      workerToken
    );

    expect(res.status).toBe(403);
    expect(res.data.success).toBe(false);
  });

  it('should create a Payment_Required booking and generate a payment intent', async () => {
    const res = await request(
      'POST',
      '/api/bookings/commit',
      {
        service_id: serviceId,
        staff_id: staffId,
        scheduled_time: scheduledTime.toISOString(),
        location: 'Client Address',
      },
      userToken
    );

    expect(res.status).toBe(201);
    expect(res.data.success).toBe(true);
    expect(res.data.data.booking.status).toBe('Payment_Required');
    expect(res.data.data.payment_intent.payment_intent_id).toMatch(/^pi_/);
    expect(res.data.data.payment_intent.amount).toBe(145.75);
    bookingId = res.data.data.booking.booking_id;

    const payment = await prisma.payment.findUnique({
      where: { booking_id: bookingId },
    });
    expect(payment).toBeNull();
  });

  it('should prevent double-booking the same staff and schedule while payment is pending', async () => {
    const res = await request(
      'POST',
      '/api/bookings/commit',
      {
        service_id: serviceId,
        staff_id: staffId,
        scheduled_time: scheduledTime.toISOString(),
        location: 'Another Address',
      },
      userToken
    );

    expect(res.status).toBe(409);
    expect(res.data.error).toContain('already booked');
  });

  it('should reject unsigned payment callbacks and keep booking unconfirmed', async () => {
    const payload = {
      event_type: 'payment_intent.succeeded',
      booking_id: bookingId,
      payment_intent_id: 'pi_unsigned',
      amount: 145.75,
      mode: 'Card',
      transaction_status: 'Authorized',
    };

    const res = await request('POST', '/api/payments/webhook', payload);
    expect(res.status).toBe(401);

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { booking_id: bookingId },
    });
    expect(booking.status).toBe('Payment_Required');
  });

  it('should reject signed callbacks that are not successful authorization events', async () => {
    const payload = {
      event_type: 'payment_intent.failed',
      booking_id: bookingId,
      payment_intent_id: 'pi_failed',
      amount: 145.75,
      mode: 'Card',
      transaction_status: 'Failed',
    };

    const res = await request('POST', '/api/payments/webhook', payload, undefined, {
      'x-cleanzy-signature': signGatewayPayload(payload),
    });

    expect(res.status).toBe(400);

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { booking_id: bookingId },
    });
    expect(booking.status).toBe('Payment_Required');
  });

  it('should confirm booking only after a valid signed authorization callback', async () => {
    const payload = {
      event_type: 'payment_intent.succeeded',
      booking_id: bookingId,
      payment_intent_id: 'pi_authorized_phase4',
      amount: 145.75,
      mode: 'Card',
      transaction_status: 'Authorized',
    };

    const res = await request('POST', '/api/payments/webhook', payload, undefined, {
      'x-cleanzy-signature': signGatewayPayload(payload),
    });

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.data.booking.status).toBe('Confirmed');
    expect(res.data.data.payment.transaction_status).toBe('Authorized');

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { booking_id: bookingId },
      include: { payment: true },
    });
    expect(booking.status).toBe('Confirmed');
    expect(booking.payment).not.toBeNull();
    expect(booking.payment!.amount).toBe(145.75);
  });

  it('should reject duplicate payment callbacks for the same booking', async () => {
    const payload = {
      event_type: 'payment_intent.succeeded',
      booking_id: bookingId,
      payment_intent_id: 'pi_duplicate_phase4',
      amount: 145.75,
      mode: 'Card',
      transaction_status: 'Authorized',
    };

    const res = await request('POST', '/api/payments/webhook', payload, undefined, {
      'x-cleanzy-signature': signGatewayPayload(payload),
    });

    expect(res.status).toBe(409);
    expect(res.data.error).toContain('already been recorded');
  });

  it('should allow administrators to cancel stale pending bookings', async () => {
    const staleService = await prisma.service.create({
      data: {
        service_name: `Phase4 Stale Cleaning ${marker}`,
        description: 'Stale cleanup service.',
        base_price: 50,
        duration_mins: 30,
      },
    });

    const staleWorkerRes = await request('POST', '/api/auth/register-worker', {
      name: 'Phase 4 Stale Worker',
      email: `stale-worker-phase4-${marker}@phase4.local`,
      phone: '8000000004',
      password,
      address: 'Stale Worker Address',
      skill_type: staleService.service_name,
      location_coords: '12.9716,77.5946',
    });
    expect(staleWorkerRes.status).toBe(201);

    const staleStaff = await prisma.staff.findUniqueOrThrow({
      where: { user_id: staleWorkerRes.data.data.user_id },
    });

    const staleBooking = await prisma.booking.create({
      data: {
        client_id: clientId,
        staff_id: staleStaff.staff_id,
        service_id: staleService.service_id,
        scheduled_time: new Date(Date.now() - 2 * 60 * 60 * 1000),
        status: 'Payment_Required',
        location: 'Old Address',
      },
    });

    const res = await request(
      'POST',
      '/api/bookings/cleanup-pending',
      { older_than_minutes: 30 },
      adminToken
    );

    expect(res.status).toBe(200);
    expect(res.data.data.cancelled_count).toBeGreaterThanOrEqual(1);

    const updatedStaleBooking = await prisma.booking.findUniqueOrThrow({
      where: { booking_id: staleBooking.booking_id },
    });
    const confirmedBooking = await prisma.booking.findUniqueOrThrow({
      where: { booking_id: bookingId },
    });

    expect(updatedStaleBooking.status).toBe('Cancelled');
    expect(confirmedBooking.status).toBe('Confirmed');
  });

  it('should reject cleanup requests from non-admin users', async () => {
    const res = await request(
      'POST',
      '/api/bookings/cleanup-pending',
      { older_than_minutes: 30 },
      userToken
    );

    expect(res.status).toBe(403);
  });
});

