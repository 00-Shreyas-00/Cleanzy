# Current State

## Context Standards Adopted

The `context/` folder is the governing reference for Cleanzy development. All coding work should follow these local project rules:

- The App layer must not access the database directly; all persistence and domain decisions belong to the Backend.
- The Backend is authoritative for booking state, payment coordination, access control, and persistence.
- Booking status must not transition to `Confirmed` unless a valid payment gateway authorization callback has been received and validated.
- Data models, validation, and persistence should align with `context/02_database_schema.md`.
- Temporary logs, response dumps, and debugging artifacts must be stored only in `context/dump/`.
- Before adding booking or payment logic, cross-reference `context/03_business_workflows.md`.
- Handoff requests should update `context/handoff.md` with the current run state.

## Completed Project State

The repository currently reflects completed work through Phase 4 of `context/Action_Plan.md`.

### Phase 1: Core Infrastructure and Database Schema

Implemented:

- TypeScript, Express, Prisma, PostgreSQL, and Vitest project structure.
- Docker Compose setup for PostgreSQL and backend services.
- Prisma schema covering the core entities from the context schema:
  - `User`
  - `Staff`
  - `Service`
  - `Booking`
  - `Payment`
  - `Attendance`
  - `Feedback`
  - `Notification`
- Initial migration exists under `prisma/migrations/20260522123352_init/`.
- Seed script exists at `prisma/seed.ts` for services, users, and a sample worker profile.
- Database integration tests cover schema relationships, constraints, cascading deletes, and core records.

### Phase 2: Authentication, Identity, and Session Management

Implemented:

- User registration endpoint: `POST /api/auth/register`.
- Worker registration endpoint: `POST /api/auth/register-worker`.
- Login endpoint with JWT issuance: `POST /api/auth/login`.
- Password hashing with `bcryptjs`.
- JWT authentication middleware.
- Role-check middleware helper via `requireRoles`.
- Authenticated profile read endpoint: `GET /api/profiles/me`.
- Authenticated profile update endpoint: `PUT /api/profiles/me`.
- Worker profile updates support staff-specific fields such as `skill_type`, `availability`, and `location_coords`.
- Integration tests cover registration, duplicate rejection, missing field rejection, login, invalid credentials, protected profile access, and profile updates.

### Phase 3: Service Discovery and Prequalification

Implemented:

- Customer-only service discovery endpoint: `POST /api/discovery/search`.
- Discovery route mounted at `/api/discovery`.
- Request validation for `service_id`, `scheduled_time`, and `location`.
- Service lookup by `Service_ID`.
- Worker matching for active, available staff where `Staff.skill_type` matches `Service.service_name`.
- Schedule prequalification that excludes staff already booked at the requested time unless the conflicting booking is cancelled.
- Booking choice generation with worker profile details, service metadata, requested schedule/location, estimated base price, and optional distance in kilometers.
- Candidate sorting by proximity when coordinates are available, otherwise by worker rating.
- Phase 3 integration tests prove authentication, role restriction, validation, matching, exclusion rules, choice generation, sorting, unknown service handling, and read-only behavior.

### Phase 4: Booking Engine and Payment Gateway Integration

Implemented:

- Customer-only booking commit endpoint: `POST /api/bookings/commit`.
- Booking commits validate `service_id`, `staff_id`, `scheduled_time`, and `location`.
- Booking commits verify the selected staff member exists, is available, matches the requested service skill, and is not already actively booked for the requested time.
- Booking commits create records with status `Payment_Required`; they do not create payment records and do not confirm bookings.
- Backend payment gateway abstraction in `src/services/paymentGateway.service.ts`.
- Mock payment intent generation with `payment_intent_id`, checkout URL, amount, currency, and local gateway status.
- Public payment webhook endpoint: `POST /api/payments/webhook`.
- Payment webhook signature validation with HMAC SHA-256 via `x-cleanzy-signature`.
- Only signed `payment_intent.succeeded` payloads with `transaction_status = Authorized` can create a `Payment` record and transition a booking to `Confirmed`.
- Duplicate payment callbacks for the same booking are rejected because `Payment.booking_id` is unique and the controller checks for existing payment records.
- Cancelled bookings cannot be confirmed by later callbacks.
- Admin-only stale pending cleanup endpoint: `POST /api/bookings/cleanup-pending`.
- Cleanup cancels stale `Pending` and `Payment_Required` bookings older than the requested threshold without changing confirmed bookings.
- Phase 4 integration tests prove role restrictions, pending booking creation, payment intent generation, double-booking prevention, unsigned callback rejection, invalid event rejection, valid callback confirmation, duplicate callback rejection, and stale cleanup behavior.

## Test Run

Latest commands run:

```bash
npm.cmd test
npx.cmd tsc --noEmit
```

Latest result:

- Test files: 4 passed.
- Tests: 46 passed.
- TypeScript compile check: passed.
- Suites:
  - `tests/db.test.ts`: 9 passed.
  - `tests/auth.test.ts`: 21 passed.
  - `tests/discovery.test.ts`: 7 passed.
  - `tests/booking.test.ts`: 9 passed.

Environment note:

- The integration tests require PostgreSQL at `127.0.0.1:5445`.
- The project database/backend containers were previously started with `npm.cmd run db:up`.

## Current Implementation Notes

- Phase 4 uses a local mock gateway abstraction suitable for integration testing; it is not a production payment provider integration.
- The critical state-machine guardrail is enforced: normal booking creation cannot create `Confirmed` bookings, and confirmation occurs only through a signed authorization webhook.
- The schema currently uses string fields for roles, statuses, payment modes, and transaction statuses. Future work should consider explicit enums or validation constants to keep state transitions controlled.
- The stale cleanup mechanism uses `scheduled_time` as the age signal because the current schema does not include `created_at` for bookings.
- Admin concepts from the action plan, such as complaints, holidays, and salary management, are not represented in the current Prisma schema.

## Ready for Phase 5

The project is ready to begin Phase 5: Portal Workflows and Supporting Subsystems.

Recommended next implementation focus:

1. Add worker attendance check-in/check-out APIs.
2. Add worker booking views for upcoming and past assignments.
3. Add administrator booking overview APIs.
4. Add feedback submission and staff rating recalculation.
5. Add notification logging for booking/payment lifecycle events.

