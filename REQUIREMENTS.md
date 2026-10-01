# Cleanzy — System & Project Requirements

This document outlines the software requirements, system specifications, environment configurations, and dependency prerequisites necessary to run and develop the **Cleanzy** platform.

---

## 1. System & Runtime Prerequisites

| Component | Minimum Version | Recommended Version | Notes |
| :--- | :--- | :--- | :--- |
| **Node.js** | `>= 18.x` | `v20.x` or `v22.x LTS` | JavaScript runtime environment |
| **npm** | `>= 9.x` | `v10.x+` | Package manager bundled with Node |
| **PostgreSQL** | `14.x+` | `17.x` | Relational database (run via Docker or locally) |
| **Docker & Compose** | `20.10+` / `v2.0+` | Latest Docker Desktop | Optional, but recommended for isolated database service |
| **OS** | Linux (Ubuntu/Debian), macOS, or Windows (WSL2 / PowerShell) | — | Cross-platform |

---

## 2. Port Requirements

Ensure the following network ports are unblocked and available on `localhost`:

| Port | Service | Configuration Variable | Default |
| :--- | :--- | :--- | :--- |
| `4200` | Cleanzy Web & API Server | `PORT` in `.env` | `4200` (or `3000`) |
| `5445` | PostgreSQL Database Service | `DATABASE_URL` in `.env` | `5445` |

---

## 3. Environment Variables Configuration

Create a `.env` file in the root directory (or copy from `.env.example`).

```env
# Database connection string
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5445/cleanzy?schema=public"

# HTTP server port
PORT=4200

# Secret key used for signing JWT authentication tokens
JWT_SECRET="super-secret-key-change-in-production"
```

### Environment Variable Details:
- **`DATABASE_URL`**: PostgreSQL connection URI in standard format:  
  `postgresql://<username>:<password>@<host>:<port>/<database_name>?schema=public`
- **`PORT`**: The TCP port on which Express listens for incoming HTTP traffic.
- **`JWT_SECRET`**: HMAC secret key used by `jsonwebtoken` to sign and verify role-based access tokens.

---

## 4. Key Dependencies & Libraries

### Core Runtime Dependencies
- **`express`** (`^4.21.2`): Minimalist web framework for HTTP routes, static asset serving, and middleware.
- **`@prisma/client`** (`^6.4.1`): Type-safe database client and query builder.
- **`bcryptjs`** (`^2.4.3`): Password hashing algorithm used during registration and login authentication.
- **`jsonwebtoken`** (`^9.0.2`): Stateless token generation and verification for session management.
- **`dotenv`** (`^16.4.7`): Environment variable loader from `.env` files.

### Development & Tooling Dependencies
- **`typescript`** (`^5.7.3`): Type definitions and compiler.
- **`ts-node`** (`^10.9.2`): Direct execution of TypeScript files without manual pre-compilation.
- **`prisma`** (`^6.4.1`): Prisma CLI for schema management, migrations, and introspection.
- **`nodemon`** (`^3.1.9`): File watcher for hot-reloading development server on code changes.
- **`vitest`** (`^3.0.5`): Fast, ESM-native unit and integration test runner.
- **`embedded-postgres`**: Precompiled local Postgres service provider used as fallback when Docker is unavailable.

---

## 5. Verification Checklist

Run these commands to verify your development environment is ready:

```bash
# Check Node and npm versions
node -v
npm -v

# Verify project dependencies
npm ls --depth=0

# Verify database connection and schema
npx prisma db pull --print

# Run automated tests
npm test
```
