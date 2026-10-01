#!/usr/bin/env bash
set -e

echo "============================================="
echo "        Cleanzy Project Setup Script         "
echo "============================================="

# 1. Check Node.js and npm
if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is not installed. Please install Node.js (v18+) first."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not installed."
  exit 1
fi

echo "✔ Detected Node.js $(node -v) and npm $(npm -v)"

# 2. Environment file
if [ ! -f .env ]; then
  echo "--> Creating .env from .env.example..."
  cp .env.example .env
  echo "✔ Created .env"
else
  echo "✔ .env already exists"
fi

# 3. Install dependencies
echo "--> Installing npm dependencies..."
npm install

# 4. Start database (Docker if present, otherwise local embedded postgres)
echo "--> Setting up PostgreSQL database..."
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  echo "Starting database container via Docker Compose..."
  npm run db:up
else
  echo "Docker not detected. Starting local embedded PostgreSQL on port 5445..."
  npm run db:local:start
fi

# Give DB a brief moment to initialize
sleep 2

# 5. Run Prisma migrations and generate client
echo "--> Applying Prisma database migrations..."
npx prisma migrate deploy

# 6. Seed mock database records
echo "--> Seeding database with initial data & test accounts..."
npm run seed

echo ""
echo "============================================="
echo "   Cleanzy Setup Completed Successfully!     "
echo "============================================="
echo ""
echo "To start the development server:"
echo "   npm run dev       (with auto-reload)"
echo "   or"
echo "   npm start         (production mode)"
echo ""
echo "Access the portal at: http://localhost:4200"
echo ""
echo "Default Seed Credentials:"
echo "  - Customer:      client@example.com / SecurePass123!"
echo "  - Housekeeper:   jane@cleanzy.com    / WorkerPass123!"
echo "  - Administrator: admin@cleanzy.com   / AdminPass123!"
echo "============================================="
