# Architecture Overview

Cleanzy is an Express backend backed by Prisma and PostgreSQL. The backend is the only component authorized to access persistence and enforce business rules.

## Runtime Modules

### App Composition

File: `src/app.ts`

Responsibilities:

- configure JSON request parsing
- mount route modules
- expose `/health`
- register the global error handler last

Mounted modules:

- `/api/auth` -> authentication routes
- `/api/profiles` -> authenticated profile routes
- `/api/discovery` -> service discovery routes
- `/api` -> booking and payment routes

### Authentication Middleware

File: `src/middleware/auth.middleware.ts`

Responsibilities:

- parse `Authorization: Bearer <token>`
- verify JWT using `JWT_SECRET`
- attach `{ user_id, email, role }` to the request
- enforce role gates with `requireRoles([...])`

### Auth Module

Files:

- `src/routes/auth.routes.ts`
- `src/controllers/auth.controller.ts`

Flow:

1. User submits registration or login payload.
2. Backend validates required fields.
3. Registration hashes password with bcrypt.
4. Login compares submitted password with stored hash.
5. Login returns a JWT containing `user_id`, `email`, and `role`.

### Profile Module

Files:

- `src/routes/profile.routes.ts`
- `src/controllers/profile.controller.ts`

Flow:

1. JWT middleware authenticates the user.
2. `GET /me` returns the user's own profile.
3. `PUT /me` updates only the authenticated user's own record.
4. Worker-specific staff fields are updated only when the authenticated user's role is `Worker`.

### Discovery Module

Files:

- `src/routes/discovery.routes.ts`
- `src/controllers/discovery.controller.ts`

Flow:

1. Customer sends service, schedule, and location criteria.
2. Backend validates request shape and service existence.
3. Backend queries available staff whose `skill_type` equals the requested `Service.service_name`.
4. Backend excludes staff with non-cancelled bookings at the same scheduled time.
5. Backend returns candidate choices with worker, service, schedule, estimated price, and optional distance.

### Booking and Payment Module

Files:

- `src/routes/booking.routes.ts`
- `src/controllers/booking.controller.ts`
- `src/services/paymentGateway.service.ts`

Booking commit flow:

1. Customer selects a service, staff member, schedule, and location.
2. Backend validates staff/service compatibility and active schedule conflicts.
3. Backend creates a booking with status `Payment_Required`.
4. Backend generates a payment intent through the local gateway abstraction.
5. No `Payment` record is created at commit time.

Payment callback flow:

1. Gateway posts an authorization payload to `/api/payments/webhook`.
2. Backend verifies `x-cleanzy-signature` using HMAC SHA-256.
3. Backend accepts only `payment_intent.succeeded` with `transaction_status = Authorized`.
4. Backend creates a `Payment` record.
5. Backend updates the booking to `Confirmed`.

Cleanup flow:

1. Administrator posts a threshold to `/api/bookings/cleanup-pending`.
2. Backend cancels stale `Pending` and `Payment_Required` bookings older than the computed cutoff.
3. Confirmed bookings are not changed.

## Data Layer

File: `prisma/schema.prisma`

Core persisted entities:

- `User`
- `Staff`
- `Service`
- `Booking`
- `Payment`
- `Attendance`
- `Feedback`
- `Notification`

The schema currently stores role, booking status, payment mode, and transaction status as strings. API behavior narrows these values through controller validation and role middleware.

