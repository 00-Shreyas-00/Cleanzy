# 🧹 Cleanzy — Online Housekeeping Management Platform

Cleanzy is a full-stack, enterprise-grade housekeeping management web platform built with **TypeScript**, **Node.js (Express)**, **Prisma ORM**, and **PostgreSQL**.

The platform provides role-based interfaces for three distinct personas:
- **Customers**: Browse cleaning services, calculate distance-based pricing, schedule bookings, leave ratings/reviews, and track service history.
- **Housekeepers (Workers)**: View assignments, record daily check-in/check-out attendance, accept/reject jobs, and manage availability.
- **Administrators**: Monitor live bookings, inspect staff performance metrics, manage leave requests, and oversee platform analytics.

---

## 🚀 Quick Start (Automated Setup)

The fastest way to get Cleanzy running on any machine is using the automated setup script:

```bash
# Clone the repository (if not already cloned)
git clone <repository-url>
cd Cleanzy

# Run the automated setup
./setup.sh

# Start the application in development mode
npm run dev
```

Visit the app in your browser: **[http://localhost:4200](http://localhost:4200)**

---

## 🛠 Manual Installation & Setup

If you prefer to configure the project step by step:

### 1. Prerequisites
- **Node.js**: v18.x or newer ([Download Node.js](https://nodejs.org/))
- **npm**: v9.x or newer
- **PostgreSQL** or **Docker**

For full specifications, refer to [REQUIREMENTS.md](REQUIREMENTS.md).

### 2. Configure Environment Variables
Copy the sample environment file:
```bash
cp .env.example .env
```

Ensure the configuration matches your local port preference:
```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5445/cleanzy?schema=public"
PORT=4200
JWT_SECRET="super-secret-key-change-in-production"
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Start the Database

Choose one of the two options below:

#### Option A: Using Docker (Recommended)
```bash
npm run db:up
```

#### Option B: Without Docker (Built-in Local Database)
If Docker is not installed on your system, you can use the embedded PostgreSQL runner:
```bash
npm run db:local:start
```

*(To stop the local runner later, run `npm run db:local:stop`)*

### 5. Apply Database Migrations & Seed Mock Data
```bash
# Deploy database migrations
npx prisma migrate deploy

# Seed test accounts and initial cleaning catalog
npm run seed
```

### 6. Start the Server
```bash
# Development mode (with live reload)
npm run dev

# Or standard production mode
npm start
```

Access the application at: **[http://localhost:4200](http://localhost:4200)**

---

## 🔑 Pre-Seeded Demo Accounts

You can immediately sign in using any of the seeded credentials below:

| Role | Email | Password | Dashboard URL |
| :--- | :--- | :--- | :--- |
| **Customer** (Prefilled in UI) | `client@example.com` | `SecurePass123!` | `/customer/dashboard` |
| **Customer** (Secondary) | `john@gmail.com` | `SecurePass123!` | `/customer/dashboard` |
| **Housekeeper / Staff** | `jane@cleanzy.com` | `WorkerPass123!` | `/worker/dashboard` |
| **Administrator** | `admin@cleanzy.com` | `AdminPass123!` | `/admin/dashboard` |

---

## 📜 Available NPM Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts server with `nodemon` and `ts-node` for live development |
| `npm start` | Runs server directly via `ts-node src/index.ts` |
| `npm test` | Runs the full automated test suite with `vitest` |
| `npm run seed` | Seeds database with mock roles, services, and accounts |
| `npm run prisma:migrate` | Runs Prisma interactive migrations for schema updates |
| `npm run prisma:generate`| Re-generates `@prisma/client` types |
| `npm run db:up` | Starts Dockerized PostgreSQL on port `5445` |
| `npm run db:down` | Stops Dockerized PostgreSQL container |
| `npm run db:local:start` | Starts local PostgreSQL on port `5445` without Docker |
| `npm run db:local:stop` | Stops the local embedded PostgreSQL process |
| `npm run db:local:status`| Checks status of the local PostgreSQL process |

---

## 📂 Project Architecture

```
Cleanzy/
├── context/               # Architecture documents, API specs, and schemas
├── pages/                 # Front-end dashboard templates
│   ├── admin/             # Administrator dashboard UI
│   ├── customer/          # Customer dashboard UI
│   └── worker/            # Housekeeper dashboard UI
├── prisma/
│   ├── migrations/        # SQL migration history
│   ├── schema.prisma      # Prisma schema (Models: User, Staff, Service, Booking, Payment, Attendance, etc.)
│   └── seed.ts            # Database seeding script
├── public/                # Static public assets (landing page, CSS, frontend JS)
├── scripts/
│   └── local-db.ts        # Embedded database controller (Docker-less fallback)
├── src/
│   ├── config/            # Prisma and database connection setup
│   ├── controllers/       # Route request handlers
│   ├── middleware/        # Authentication guards and error handling
│   ├── routes/            # Express endpoint routers
│   ├── services/          # Business logic & notification dispatchers
│   ├── app.ts             # Express application definition & route mounting
│   └── index.ts           # HTTP server entrypoint
├── tests/                 # Vitest automated test suite (auth, bookings, portal, etc.)
├── .env.example           # Template for environment configuration
├── docker-compose.yml     # Docker definition for PostgreSQL
├── Dockerfile             # Production container definition
├── REQUIREMENTS.md        # Technical specifications and dependencies
├── setup.sh               # One-click environment bootstrap script
└── tsconfig.json          # TypeScript compiler configuration
```

---

## 🧪 Testing

Cleanzy includes an extensive automated test suite covering authentication, role-based access control, scheduling logic, and portal workflows:

```bash
npm test
```

---

## ❓ Troubleshooting

### Error: `Can't reach database server at 127.0.0.1:5445`
This indicates the PostgreSQL service is not running.
- If using Docker: Ensure Docker Desktop is active and run `npm run db:up`.
- If Docker is not available: Run `npm run db:local:start`.
- If using your own PostgreSQL instance: Change `DATABASE_URL` in `.env` to your database port (e.g. `5432`).

### Error: `Port 4200 is already in use`
Change the `PORT` in your `.env` file to another port (e.g. `PORT=5000`) and restart the server with `npm start`.

---

## 📄 License
ISC
