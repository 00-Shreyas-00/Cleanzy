import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/app';
import http from 'http';

const PORT = 4449;
let server: http.Server;

async function request(method: string, path: string): Promise<{ status: number; headers: Record<string, string>; data: string }> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
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

  it('should contain all required DOM elements in index.html', async () => {
    const res = await request('GET', '/');
    expect(res.status).toBe(200);
    const html = res.data;

    // Check Auth & Session Elements
    expect(html).toContain('id="emailInput"');
    expect(html).toContain('id="passwordInput"');
    expect(html).toContain('id="loginButton"');
    expect(html).toContain('id="logoutButton"');
    expect(html).toContain('id="sessionStatus"');
    expect(html).toContain('id="welcomeTitle"');

    // Check Registration Details Elements
    expect(html).toContain('id="registerName"');
    expect(html).toContain('id="registerPhone"');
    expect(html).toContain('id="registerAddress"');
    expect(html).toContain('id="registerRole"');
    expect(html).toContain('id="registerSkill"');
    expect(html).toContain('id="registerCoords"');
    expect(html).toContain('id="registerButton"');

    // Check Customer Portal Elements
    expect(html).toContain('id="serviceSelect"');
    expect(html).toContain('id="scheduleInput"');
    expect(html).toContain('id="locationInput"');
    expect(html).toContain('id="clientCoordsInput"');
    expect(html).toContain('id="searchButton"');
    expect(html).toContain('id="choicesList"');
    expect(html).toContain('id="myBookingsList"');

    // Check Worker Portal Elements
    expect(html).toContain('id="workerBookingsList"');
    expect(html).toContain('id="attendanceList"');
    expect(html).toContain('id="checkInButton"');
    expect(html).toContain('id="checkOutButton"');

    // Check Administrator Portal Elements
    expect(html).toContain('id="adminOverview"');

    // Check Notifications Elements
    expect(html).toContain('id="notificationsList"');
    expect(html).toContain('id="refreshNotificationsButton"');
  });

  it('should support multi-role tab switching views in index.html', async () => {
    const res = await request('GET', '/');
    expect(res.status).toBe(200);
    const html = res.data;

    expect(html).toContain('data-view="customerView"');
    expect(html).toContain('data-view="workerView"');
    expect(html).toContain('data-view="adminView"');
    expect(html).toContain('id="customerView"');
    expect(html).toContain('id="workerView"');
    expect(html).toContain('id="adminView"');
  });
});
