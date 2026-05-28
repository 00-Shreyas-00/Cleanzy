import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/app';
import prisma from '../src/config/prisma';
import http from 'http';

const PORT = 4445;
let server: http.Server;

async function request(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  token?: string
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

describe('Cleanzy Service Discovery & Prequalification Integration Tests', () => {
  const marker = Date.now();
  const scheduledTime = new Date('2030-01-15T10:00:00.000Z');
  const alternateTime = new Date('2030-01-15T12:00:00.000Z');
  const password = 'DiscoveryPass123!';

  let userToken: string;
  let workerToken: string;
  let serviceId: string;
  let clientId: string;
  let matchingStaffId: string;
  let closerStaffId: string;
  let unavailableStaffId: string;
  let wrongSkillStaffId: string;
  let busyStaffId: string;

  beforeAll(async () => {
    server = app.listen(PORT);

    await prisma.user.deleteMany({
      where: { email: { contains: `phase3-${marker}` } },
    });
    await prisma.service.deleteMany({
      where: { service_name: { contains: `Phase3 Cleaning ${marker}` } },
    });

    const service = await prisma.service.create({
      data: {
        service_name: `Phase3 Cleaning ${marker}`,
        description: 'Phase 3 test cleaning service.',
        base_price: 88.5,
        duration_mins: 90,
      },
    });
    serviceId = service.service_id;

    const clientRes = await request('POST', '/api/auth/register', {
      name: 'Phase 3 Client',
      email: `client-phase3-${marker}@phase3.local`,
      phone: '7000000001',
      password,
      address: 'Client Address',
    });
    expect(clientRes.status).toBe(201);
    clientId = clientRes.data.data.user_id;
    userToken = await login(`client-phase3-${marker}@phase3.local`, password);

    const matchingWorkerRes = await request('POST', '/api/auth/register-worker', {
      name: 'Matching Worker',
      email: `matching-worker-phase3-${marker}@phase3.local`,
      phone: '7000000002',
      password,
      address: 'Worker Address',
      skill_type: service.service_name,
      location_coords: '12.9716,77.5946',
    });
    expect(matchingWorkerRes.status).toBe(201);
    workerToken = await login(`matching-worker-phase3-${marker}@phase3.local`, password);

    const closerWorkerRes = await request('POST', '/api/auth/register-worker', {
      name: 'Closer Worker',
      email: `closer-worker-phase3-${marker}@phase3.local`,
      phone: '7000000003',
      password,
      address: 'Closer Address',
      skill_type: service.service_name,
      location_coords: '12.9720,77.5950',
    });
    expect(closerWorkerRes.status).toBe(201);

    const unavailableWorkerRes = await request('POST', '/api/auth/register-worker', {
      name: 'Unavailable Worker',
      email: `unavailable-worker-phase3-${marker}@phase3.local`,
      phone: '7000000004',
      password,
      address: 'Unavailable Address',
      skill_type: service.service_name,
      location_coords: '12.9716,77.5946',
    });
    expect(unavailableWorkerRes.status).toBe(201);

    const wrongSkillWorkerRes = await request('POST', '/api/auth/register-worker', {
      name: 'Wrong Skill Worker',
      email: `wrong-skill-worker-phase3-${marker}@phase3.local`,
      phone: '7000000005',
      password,
      address: 'Wrong Skill Address',
      skill_type: `Other Skill ${marker}`,
      location_coords: '12.9716,77.5946',
    });
    expect(wrongSkillWorkerRes.status).toBe(201);

    const busyWorkerRes = await request('POST', '/api/auth/register-worker', {
      name: 'Busy Worker',
      email: `busy-worker-phase3-${marker}@phase3.local`,
      phone: '7000000006',
      password,
      address: 'Busy Address',
      skill_type: service.service_name,
      location_coords: '12.9716,77.5946',
    });
    expect(busyWorkerRes.status).toBe(201);

    const matchingStaff = await prisma.staff.findUniqueOrThrow({
      where: { user_id: matchingWorkerRes.data.data.user_id },
    });
    const closerStaff = await prisma.staff.findUniqueOrThrow({
      where: { user_id: closerWorkerRes.data.data.user_id },
    });
    const unavailableStaff = await prisma.staff.findUniqueOrThrow({
      where: { user_id: unavailableWorkerRes.data.data.user_id },
    });
    const wrongSkillStaff = await prisma.staff.findUniqueOrThrow({
      where: { user_id: wrongSkillWorkerRes.data.data.user_id },
    });
    const busyStaff = await prisma.staff.findUniqueOrThrow({
      where: { user_id: busyWorkerRes.data.data.user_id },
    });

    matchingStaffId = matchingStaff.staff_id;
    closerStaffId = closerStaff.staff_id;
    unavailableStaffId = unavailableStaff.staff_id;
    wrongSkillStaffId = wrongSkillStaff.staff_id;
    busyStaffId = busyStaff.staff_id;

    await prisma.staff.update({
      where: { staff_id: matchingStaffId },
      data: { rating: 4.9 },
    });
    await prisma.staff.update({
      where: { staff_id: closerStaffId },
      data: { rating: 4.1 },
    });
    await prisma.staff.update({
      where: { staff_id: unavailableStaffId },
      data: { availability: false, rating: 5.0 },
    });

    await prisma.booking.create({
      data: {
        client_id: clientId,
        staff_id: busyStaffId,
        service_id: serviceId,
        scheduled_time: scheduledTime,
        status: 'Pending',
        location: 'Existing Client Address',
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: `phase3-${marker}` } },
    });
    await prisma.service.deleteMany({
      where: { service_id: serviceId },
    });

    server.close();
    await prisma.$disconnect();
  });

  it('should require authentication for service discovery', async () => {
    const res = await request('POST', '/api/discovery/search', {
      service_id: serviceId,
      scheduled_time: scheduledTime.toISOString(),
      location: 'Client Address',
    });

    expect(res.status).toBe(401);
    expect(res.data.success).toBe(false);
  });

  it('should restrict service discovery to User role clients', async () => {
    const res = await request(
      'POST',
      '/api/discovery/search',
      {
        service_id: serviceId,
        scheduled_time: scheduledTime.toISOString(),
        location: 'Client Address',
      },
      workerToken
    );

    expect(res.status).toBe(403);
    expect(res.data.error).toContain('User');
  });

  it('should validate required service discovery payload fields', async () => {
    const res = await request(
      'POST',
      '/api/discovery/search',
      {
        service_id: serviceId,
      },
      userToken
    );

    expect(res.status).toBe(400);
    expect(res.data.error).toContain('scheduled_time');
  });

  it('should return only available workers matching the requested service and schedule', async () => {
    const bookingCountBefore = await prisma.booking.count();

    const res = await request(
      'POST',
      '/api/discovery/search',
      {
        service_id: serviceId,
        scheduled_time: scheduledTime.toISOString(),
        location: 'Client Address',
      },
      userToken
    );

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.data.choice_count).toBe(2);

    const staffIds = res.data.data.choices.map((choice: any) => choice.staff_id);
    expect(staffIds).toContain(matchingStaffId);
    expect(staffIds).toContain(closerStaffId);
    expect(staffIds).not.toContain(unavailableStaffId);
    expect(staffIds).not.toContain(wrongSkillStaffId);
    expect(staffIds).not.toContain(busyStaffId);

    const bookingCountAfter = await prisma.booking.count();
    expect(bookingCountAfter).toBe(bookingCountBefore);
  });

  it('should generate booking choices with service price, schedule, and worker profile data', async () => {
    const res = await request(
      'POST',
      '/api/discovery/search',
      {
        service_id: serviceId,
        scheduled_time: alternateTime.toISOString(),
        location: 'Client Address',
      },
      userToken
    );

    expect(res.status).toBe(200);
    expect(res.data.data.choice_count).toBe(3);

    const choice = res.data.data.choices.find((item: any) => item.staff_id === matchingStaffId);
    expect(choice.service.service_id).toBe(serviceId);
    expect(choice.estimated_price).toBe(88.5);
    expect(choice.schedule.scheduled_time).toBe(alternateTime.toISOString());
    expect(choice.worker.name).toBe('Matching Worker');
    expect(choice.worker.rating).toBe(4.9);
  });

  it('should sort by proximity when client coordinates are supplied', async () => {
    const res = await request(
      'POST',
      '/api/discovery/search',
      {
        service_id: serviceId,
        scheduled_time: scheduledTime.toISOString(),
        location: 'Client Address',
        client_location_coords: '12.9720,77.5950',
      },
      userToken
    );

    expect(res.status).toBe(200);
    expect(res.data.data.choices[0].staff_id).toBe(closerStaffId);
    expect(res.data.data.choices[0].distance_km).toBe(0);
  });

  it('should return 404 for an unknown service', async () => {
    const res = await request(
      'POST',
      '/api/discovery/search',
      {
        service_id: '00000000-0000-0000-0000-000000000000',
        scheduled_time: scheduledTime.toISOString(),
        location: 'Client Address',
      },
      userToken
    );

    expect(res.status).toBe(404);
    expect(res.data.error).toContain('Service not found');
  });
});
