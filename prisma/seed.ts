import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean existing records in dependency order
  await prisma.notification.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.service.deleteMany();
  await prisma.user.deleteMany();

  // 1. Create standard services
  const standardCleaning = await prisma.service.create({
    data: {
      service_name: 'Standard Cleaning',
      description: 'Standard home dusting, vacuuming, and cleaning.',
      base_price: 50.0,
      duration_mins: 120,
    },
  });

  const deepCleaning = await prisma.service.create({
    data: {
      service_name: 'Deep Cleaning',
      description: 'Deep disinfection, kitchen scrub, and bathroom sanitation.',
      base_price: 120.0,
      duration_mins: 240,
    },
  });

  console.log('Services created:', [standardCleaning.service_name, deepCleaning.service_name]);

  const defaultPasswordHash = await bcrypt.hash('SecurePass123!', 10);
  const adminPasswordHash = await bcrypt.hash('AdminPass123!', 10);
  const workerPasswordHash = await bcrypt.hash('WorkerPass123!', 10);

  // 2. Create administrator user
  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin Shreyas',
      email: 'admin@cleanzy.com',
      phone: '1234567890',
      role: 'Administrator',
      password_hash: adminPasswordHash,
      address: '123 Head Office St',
    },
  });

  // 3. Create customer users (including default UI prefill user)
  const defaultClient = await prisma.user.create({
    data: {
      name: 'Client User',
      email: 'client@example.com',
      phone: '9876543210',
      role: 'User',
      password_hash: defaultPasswordHash,
      address: '100 Downtown Avenue',
    },
  });

  const customerUser = await prisma.user.create({
    data: {
      name: 'John Doe',
      email: 'john@gmail.com',
      phone: '9876543211',
      role: 'User',
      password_hash: defaultPasswordHash,
      address: '456 Client Lane',
    },
  });

  // 4. Create worker user & staff profile
  const workerUser = await prisma.user.create({
    data: {
      name: 'Jane Smith',
      email: 'jane@cleanzy.com',
      phone: '5551234567',
      role: 'Worker',
      password_hash: workerPasswordHash,
      address: '789 Worker Blvd',
    },
  });

  const workerStaff = await prisma.staff.create({
    data: {
      user_id: workerUser.user_id,
      skill_type: 'Deep Cleaning',
      rating: 4.8,
      availability: true,
      location_coords: '40.7128,-74.0060',
    },
  });

  console.log('Initial roles and mock records seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
