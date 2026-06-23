# Cleanzy API Reference

This folder documents the Cleanzy backend API as implemented in the TypeScript/Express codebase.

## Base URL

Local development default:

```text
http://localhost:3000
```

Integration tests use isolated ports, but the API paths are the same.

## API Inventory by Business Domain

### Platform Health

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | Check whether the API server is running. |

### Authentication and Identity

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Public | Register a customer/admin user. Worker role is redirected to normal user unless using worker endpoint. |
| `POST` | `/api/auth/register-worker` | Public | Register a worker user and matching staff profile atomically. |
| `POST` | `/api/auth/login` | Public | Authenticate credentials and return a JWT. |

### Profile Management

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/profiles/me` | Bearer JWT | Return the authenticated user's profile, including staff profile for workers. |
| `PUT` | `/api/profiles/me` | Bearer JWT | Update the authenticated user's profile and worker staff fields when applicable. |

### Service Discovery and Prequalification

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/discovery/search` | Bearer JWT, `User` role | Generate available worker booking choices for a service and schedule. |

### Booking and Payment

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/bookings/commit` | Bearer JWT, `User` role | Commit a selected service/staff/schedule into a `Payment_Required` booking and create a payment intent. |
| `GET` | `/api/bookings/my` | Bearer JWT, `User` role | Return the authenticated customer's booking history and current bookings. |
| `POST` | `/api/payments/webhook` | HMAC gateway signature | Process gateway authorization callbacks and confirm bookings. |
| `POST` | `/api/bookings/cleanup-pending` | Bearer JWT, `Administrator` role | Cancel stale pending/payment-required bookings. |

### Worker Portal and Attendance

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/worker/bookings` | Bearer JWT, `Worker` role | Return upcoming and past bookings for the authenticated worker. |
| `POST` | `/api/worker/attendance/check-in` | Bearer JWT, `Worker` role | Record worker attendance check-in for the current day. |
| `POST` | `/api/worker/attendance/check-out` | Bearer JWT, `Worker` role | Record worker attendance check-out for the current open attendance session. |
| `GET` | `/api/worker/attendance` | Bearer JWT, `Worker` role | Fetch the authenticated worker's attendance history. |

### Feedback and Notifications

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/feedback` | Bearer JWT, `User` role | Submit feedback for a confirmed booking and update worker rating. |
| `GET` | `/api/notifications` | Bearer JWT | Fetch recent notifications for the authenticated user. |
| `PUT` | `/api/notifications/:notification_id/read` | Bearer JWT | Mark a specific notification as read. |

### Administration

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/admin/overview` | Bearer JWT, `Administrator` role | Return admin dashboard metrics and staff performance summaries. |

## Documentation Files

- [Architecture Overview](./architecture.md)
- [Authentication and Authorization](./authentication.md)
- [Common Models and Schemas](./models.md)
- [Health API](./health.md)
- [Authentication API](./auth.md)
- [Profile API](./profiles.md)
- [Service Discovery API](./discovery.md)
- [Booking and Payment API](./booking-payments.md)
- [OpenAPI 3.0 Specification](./openapi.yaml)

## State Machine Guardrail

Booking status must never become `Confirmed` during ordinary booking creation. Confirmation is allowed only through a valid signed payment gateway callback at `POST /api/payments/webhook`.

