import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/app';
import prisma from '../src/config/prisma';
import http from 'http';

const PORT = 4444; // Isolated test port
let server: http.Server;

// Helper to make HTTP requests against the test server
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
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 500, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode || 500, data: body });
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

describe('Cleanzy Auth, RBAC & Profile Integration Tests', () => {
  const testEmail = `testuser-${Date.now()}@cleanzy.test`;
  const workerEmail = `testworker-${Date.now()}@cleanzy.test`;
  const adminEmail = `testadmin-${Date.now()}@cleanzy.test`;
  let userToken: string;
  let workerToken: string;
  let adminToken: string;
  let userId: string;
  let workerId: string;
  let adminId: string;

  beforeAll(async () => {
    // Clean up any leftover test data
    await prisma.user.deleteMany({
      where: { email: { contains: '@cleanzy.test' } },
    });

    // Start the Express app on the test port
    server = app.listen(PORT);
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: { email: { contains: '@cleanzy.test' } },
    });

    server.close();
    await prisma.$disconnect();
  });

  // ─── Registration Tests ────────────────────────────────────────────

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const res = await request('POST', '/api/auth/register', {
        name: 'Test User',
        email: testEmail,
        phone: '1234567890',
        password: 'SecurePass123!',
        address: '123 Test Street',
      });

      expect(res.status).toBe(201);
      expect(res.data.success).toBe(true);
      expect(res.data.data.email).toBe(testEmail);
      expect(res.data.data.role).toBe('User');
      userId = res.data.data.user_id;
    });

    it('should reject duplicate email registration', async () => {
      const res = await request('POST', '/api/auth/register', {
        name: 'Duplicate User',
        email: testEmail,
        phone: '0987654321',
        password: 'AnotherPass!',
        address: '456 Dup Lane',
      });

      expect(res.status).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.error).toContain('already exists');
    });

    it('should reject registration with missing fields', async () => {
      const res = await request('POST', '/api/auth/register', {
        name: 'Incomplete',
        email: 'incomplete@cleanzy.test',
      });

      expect(res.status).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.error).toContain('Missing required');
    });

    it('should register an administrator', async () => {
      const res = await request('POST', '/api/auth/register', {
        name: 'Admin User',
        email: adminEmail,
        phone: '5551112222',
        password: 'AdminPass123!',
        address: 'Admin HQ',
        role: 'Administrator',
      });

      expect(res.status).toBe(201);
      expect(res.data.data.role).toBe('Administrator');
      adminId = res.data.data.user_id;
    });
  });

  // ─── Worker Registration Tests ─────────────────────────────────────

  describe('POST /api/auth/register-worker', () => {
    it('should register a worker with a Staff profile atomically', async () => {
      const res = await request('POST', '/api/auth/register-worker', {
        name: 'Test Worker',
        email: workerEmail,
        phone: '5559876543',
        password: 'WorkerPass123!',
        address: '789 Worker Blvd',
        skill_type: 'Deep Cleaning',
        location_coords: '40.7128,-74.0060',
      });

      expect(res.status).toBe(201);
      expect(res.data.success).toBe(true);
      expect(res.data.data.role).toBe('Worker');
      expect(res.data.data.staff_id).toBeDefined();
      expect(res.data.data.skill_type).toBe('Deep Cleaning');
      workerId = res.data.data.user_id;
    });

    it('should reject worker registration with missing skill fields', async () => {
      const res = await request('POST', '/api/auth/register-worker', {
        name: 'Incomplete Worker',
        email: 'incworker@cleanzy.test',
        phone: '5550001111',
        password: 'Pass123!',
        address: 'Somewhere',
        // Missing skill_type and location_coords
      });

      expect(res.status).toBe(400);
      expect(res.data.success).toBe(false);
    });

    it('should create both User and Staff records in the database', async () => {
      const user = await prisma.user.findUnique({
        where: { user_id: workerId },
        include: { staff: true },
      });

      expect(user).not.toBeNull();
      expect(user!.role).toBe('Worker');
      expect(user!.staff).not.toBeNull();
      expect(user!.staff!.skill_type).toBe('Deep Cleaning');
    });
  });

  // ─── Login Tests ───────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('should login successfully and return a JWT token', async () => {
      const res = await request('POST', '/api/auth/login', {
        email: testEmail,
        password: 'SecurePass123!',
      });

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.token).toBeDefined();
      expect(typeof res.data.token).toBe('string');
      expect(res.data.data.role).toBe('User');
      userToken = res.data.token;
    });

    it('should login worker and return a JWT token', async () => {
      const res = await request('POST', '/api/auth/login', {
        email: workerEmail,
        password: 'WorkerPass123!',
      });

      expect(res.status).toBe(200);
      expect(res.data.token).toBeDefined();
      workerToken = res.data.token;
    });

    it('should login administrator and return a JWT token', async () => {
      const res = await request('POST', '/api/auth/login', {
        email: adminEmail,
        password: 'AdminPass123!',
      });

      expect(res.status).toBe(200);
      expect(res.data.token).toBeDefined();
      adminToken = res.data.token;
    });

    it('should reject login with wrong password', async () => {
      const res = await request('POST', '/api/auth/login', {
        email: testEmail,
        password: 'WrongPassword!',
      });

      expect(res.status).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.error).toContain('Invalid credentials');
    });

    it('should reject login for non-existent user', async () => {
      const res = await request('POST', '/api/auth/login', {
        email: 'ghost@cleanzy.test',
        password: 'anything',
      });

      expect(res.status).toBe(400);
      expect(res.data.error).toContain('Invalid credentials');
    });

    it('should reject login with missing fields', async () => {
      const res = await request('POST', '/api/auth/login', {
        email: testEmail,
      });

      expect(res.status).toBe(400);
      expect(res.data.error).toContain('required');
    });
  });

  // ─── Profile Access Tests ─────────────────────────────────────────

  describe('GET /api/profiles/me', () => {
    it('should return 401 when no token is provided', async () => {
      const res = await request('GET', '/api/profiles/me');

      expect(res.status).toBe(401);
      expect(res.data.error).toContain('No token provided');
    });

    it('should return 403 with an invalid token', async () => {
      const res = await request('GET', '/api/profiles/me', undefined, 'invalid.jwt.token');

      expect(res.status).toBe(403);
      expect(res.data.error).toContain('Invalid or expired');
    });

    it('should return user profile with valid token', async () => {
      const res = await request('GET', '/api/profiles/me', undefined, userToken);

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.data.email).toBe(testEmail);
      expect(res.data.data.role).toBe('User');
      expect(res.data.data.staff).toBeNull();
    });

    it('should return worker profile including staff data', async () => {
      const res = await request('GET', '/api/profiles/me', undefined, workerToken);

      expect(res.status).toBe(200);
      expect(res.data.data.role).toBe('Worker');
      expect(res.data.data.staff).not.toBeNull();
      expect(res.data.data.staff.skill_type).toBe('Deep Cleaning');
      expect(res.data.data.staff.availability).toBe(true);
    });
  });

  // ─── Profile Update Tests ─────────────────────────────────────────

  describe('PUT /api/profiles/me', () => {
    it('should update user profile fields', async () => {
      const res = await request('PUT', '/api/profiles/me', {
        name: 'Updated Test User',
        address: '999 New Address',
      }, userToken);

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.data.name).toBe('Updated Test User');
      expect(res.data.data.address).toBe('999 New Address');
    });

    it('should update worker staff profile (availability and skill)', async () => {
      const res = await request('PUT', '/api/profiles/me', {
        availability: false,
        skill_type: 'Standard Cleaning',
        location_coords: '34.0522,-118.2437',
      }, workerToken);

      expect(res.status).toBe(200);
      expect(res.data.data.staff).not.toBeNull();
      expect(res.data.data.staff.availability).toBe(false);
      expect(res.data.data.staff.skill_type).toBe('Standard Cleaning');
    });

    it('should persist updates in the database', async () => {
      const user = await prisma.user.findUnique({
        where: { user_id: userId },
      });
      expect(user!.name).toBe('Updated Test User');

      const staff = await prisma.staff.findUnique({
        where: { user_id: workerId },
      });
      expect(staff!.availability).toBe(false);
      expect(staff!.skill_type).toBe('Standard Cleaning');
    });

    it('should reject profile update without authentication', async () => {
      const res = await request('PUT', '/api/profiles/me', {
        name: 'Hacker',
      });

      expect(res.status).toBe(401);
    });
  });
});
