import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/app';
import http from 'http';
import jwt from 'jsonwebtoken';

const PORT = 4449;
let server: http.Server;

async function request(
  method: string,
  path: string,
  headers?: Record<string, string>
): Promise<{ status: number; headers: Record<string, string>; data: string }> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers: headers || {},
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode || 500,
          headers: res.headers as Record<string, string>,
          data: body,
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

const secret = process.env.JWT_SECRET || 'super-secret-key-change-in-production';
const makeCookie = (role: string) => {
  const token = jwt.sign({ user_id: 'test-user-id', email: 'test@example.com', role }, secret);
  return { Cookie: `cleanzy_token=${token}` };
};

describe('Cleanzy Presentation & Frontend Integration Tests', () => {
  beforeAll(() => {
    server = app.listen(PORT);
  });

  afterAll(() => {
    server.close();
  });

  it('should serve index.html at root route', async () => {
    const res = await request('GET', '/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.data).toContain('<!doctype html>');
    expect(res.data).toContain('<title>Cleanzy Operations</title>');
  });

  it('should serve app.js successfully', async () => {
    const res = await request('GET', '/app.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/javascript');
    expect(res.data).toContain('const state =');
  });

  it('should serve styles.css successfully', async () => {
    const res = await request('GET', '/styles.css');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/css');
    expect(res.data).toContain(':root');
  });

  it('should redirect unauthenticated dashboard access to root', async () => {
    const customerRes = await request('GET', '/customer/dashboard');
    expect(customerRes.status).toBe(302);
    expect(customerRes.headers['location']).toBe('/');

    const workerRes = await request('GET', '/worker/dashboard');
    expect(workerRes.status).toBe(302);
    expect(workerRes.headers['location']).toBe('/');

    const adminRes = await request('GET', '/admin/dashboard');
    expect(adminRes.status).toBe(302);
    expect(adminRes.headers['location']).toBe('/');
  });

  it('should redirect authenticated root access to appropriate dashboard', async () => {
    const res = await request('GET', '/', makeCookie('User'));
    expect(res.status).toBe(302);
    expect(res.headers['location']).toBe('/customer/dashboard');
  });

  it('should redirect dashboard access to correct dashboard if role mismatches', async () => {
    // Customer accessing admin
    const resAdmin = await request('GET', '/admin/dashboard', makeCookie('User'));
    expect(resAdmin.status).toBe(302);
    expect(resAdmin.headers['location']).toBe('/customer/dashboard');

    // Worker accessing customer
    const resCustomer = await request('GET', '/customer/dashboard', makeCookie('Worker'));
    expect(resCustomer.status).toBe(302);
    expect(resCustomer.headers['location']).toBe('/worker/dashboard');
  });

  it('should serve Customer Dashboard to User and contain correct elements', async () => {
    const res = await request('GET', '/customer/dashboard', makeCookie('User'));
    expect(res.status).toBe(200);
    const html = res.data;

    // Check Customer elements
    expect(html).toContain('id="serviceSelect"');
    expect(html).toContain('id="scheduleInput"');
    expect(html).toContain('id="locationInput"');
    expect(html).toContain('id="choicesList"');
    expect(html).toContain('id="myBookingsList"');

    // Should NOT contain worker or admin elements
    expect(html).not.toContain('id="workerBookingsList"');
    expect(html).not.toContain('id="adminOverview"');
  });

  it('should serve Worker Dashboard to Worker and contain correct elements', async () => {
    const res = await request('GET', '/worker/dashboard', makeCookie('Worker'));
    expect(res.status).toBe(200);
    const html = res.data;

    // Check Worker elements
    expect(html).toContain('id="workerBookingsList"');
    expect(html).toContain('id="attendanceList"');
    expect(html).toContain('id="checkInButton"');
    expect(html).toContain('id="checkOutButton"');

    // Should NOT contain customer or admin elements
    expect(html).not.toContain('id="serviceSelect"');
    expect(html).not.toContain('id="adminOverview"');
  });

  it('should serve Admin Dashboard to Administrator and contain correct elements', async () => {
    const res = await request('GET', '/admin/dashboard', makeCookie('Administrator'));
    expect(res.status).toBe(200);
    const html = res.data;

    // Check Admin elements
    expect(html).toContain('id="adminOverview"');
    expect(html).toContain('id="bookingsChart"');

    // Should NOT contain customer or worker inputs/buttons
    expect(html).not.toContain('id="serviceSelect"');
    expect(html).not.toContain('id="checkInButton"');
  });

  it('should expose the analytics back action and chart tooltip container in the admin dashboard', async () => {
    const res = await request('GET', '/admin/dashboard', makeCookie('Administrator'));
    expect(res.status).toBe(200);
    const html = res.data;

    expect(html).toContain('id="backToOverviewButton"');
    expect(html).toContain('id="chartTooltip"');
  });
});

