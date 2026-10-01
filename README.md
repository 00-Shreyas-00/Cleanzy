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

## 🐳 Running with Docker

Cleanzy includes full Docker support with a multi-stage `Dockerfile` and `docker-compose.yml` for running both the application and the PostgreSQL database in containers.

### 1. Start Application & Database Stack
```bash
# Build and start all services in the background
docker compose up -d --build
```

### 2. Apply Migrations & Seed Mock Data in Container
```bash
# Run database migrations inside the backend container
docker compose exec backend npx prisma migrate deploy

# Seed initial test data and demo user accounts
docker compose exec backend npm run seed
```

### 3. Access Cleanzy
Open **[http://localhost:4200](http://localhost:4200)** in your browser.

### 4. Stopping Containers
```bash
# Stop containers without losing database data
docker compose down

# Stop containers and reset database volume
docker compose down -v
```

---

## 🛠 Manual Installation & Setup (Without Docker)

If you prefer to configure the project manually on your host machine:

### 1. Prerequisites
- **Node.js**: v18.x or newer ([Download Node.js](https://nodejs.org/))
- **npm**: v9.x or newer
- **PostgreSQL** or local embedded DB runner

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
If you do not have PostgreSQL installed, use Cleanzy's built-in local runner:
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

# Or compile and run in production mode
npm run build
npm start
```

Access the application at: **[http://localhost:4200](http://localhost:4200)**

---

## 🚢 Production Deployment Guide

### 1. Build the Production Docker Image
Cleanzy's `Dockerfile` uses a 4-stage build to produce a lean, secure container running as an unprivileged `node` user:

```bash
docker build --target runner -t cleanzy:latest .
```

### 2. Run with Production Docker Compose
```bash
docker compose -f docker-compose.prod.yml up -d
```

### 3. Cloud Deployment Options

#### Option A: AWS ECS / AWS Fargate
1. Push the production image to **Amazon Elastic Container Registry (ECR)**.
2. Create an **ECS Task Definition** pointing to an **Amazon RDS for PostgreSQL** or **Aurora PostgreSQL** instance.
3. Configure environment variables in AWS Secrets Manager:
   - `DATABASE_URL`: Connection string with `?sslmode=require`
   - `JWT_SECRET`: High-entropy 256-bit secret
   - `PORT`: `4200`
4. Attach an **Application Load Balancer (ALB)** with an ACM SSL/TLS certificate on port `443` forwarding to port `4200`.

#### Option B: Google Cloud Run
1. Build and push image:
   ```bash
   gcloud builds submit --tag gcr.io/[PROJECT_ID]/cleanzy
   ```
2. Deploy to Cloud Run with Cloud SQL PostgreSQL connection:
   ```bash
   gcloud run deploy cleanzy \
     --image gcr.io/[PROJECT_ID]/cleanzy \
     --platform managed \
     --add-cloudsql-instances [INSTANCE_CONNECTION_NAME] \
     --set-env-vars DATABASE_URL="postgresql://...",JWT_SECRET="..."
   ```

#### Option C: Render / Railway / Fly.io
1. Connect your repository to Render or Railway.
2. Provision a managed PostgreSQL instance and copy the internal connection URL.
3. Set the build command to `npm install && npx prisma generate && npm run build`.
4. Set the start command to `node dist/index.js` or `npm start`.

#### Option D: Self-Hosted VPS (Ubuntu/Debian)
1. Set up a reverse proxy using **Nginx**:
   ```nginx
   server {
       server_name cleanzy.yourdomain.com;

       location / {
           proxy_pass http://127.0.0.1:4200;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
2. Secure with Let's Encrypt SSL:
   ```bash
   sudo certbot --nginx -d cleanzy.yourdomain.com
   ```
3. Use `pm2` or systemd service to manage the Node.js process:
   ```bash
   npm run build
   npx pm2 start dist/index.js --name "cleanzy"
   ```

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
| `npm run build` | Compiles TypeScript into `dist/` |
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
├── pages/                 # Front-end dashboard templates (Untouched)
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
│   ├── constants/         # Domain Enums (UserRole, BookingStatus)
│   ├── controllers/       # Lean HTTP request handlers
│   ├── errors/            # Centralized AppError hierarchy (NotFound, Conflict, etc.)
│   ├── middleware/        # Authentication guards and structured error handling
│   ├── routes/            # Express endpoint routers
│   ├── services/          # Decoupled domain business logic & transactions
│   │   ├── auth.service.ts
│   │   ├── booking.service.ts
│   │   ├── discovery.service.ts
│   │   ├── notification.service.ts
│   │   ├── paymentGateway.service.ts
│   │   └── portal.service.ts
│   ├── utils/             # Helpers (cookie parser)
│   ├── app.ts             # Express application definition & route mounting
│   └── index.ts           # HTTP server entrypoint
├── tests/                 # Vitest automated test suite (auth, bookings, portal, etc.)
├── .env.example           # Template for environment configuration
├── docker-compose.yml     # Multi-stage development container compose
├── docker-compose.prod.yml# Production container compose
├── Dockerfile             # 4-stage production & dev Dockerfile
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
- If using Docker: Ensure Docker is active and run `npm run db:up` (or `docker compose up -d`).
- If Docker is not available: Run `npm run db:local:start`.
- If using your own PostgreSQL instance: Change `DATABASE_URL` in `.env` to your database port (e.g. `5432`).

### Error: `Port 4200 is already in use`
Change the `PORT` in your `.env` file to another port (e.g. `PORT=5000`) and restart the server with `npm start`.

---

## 📄 License
ISC
