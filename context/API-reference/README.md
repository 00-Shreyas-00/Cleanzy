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
| `POST` | `/api/payments/webhook` | HMAC gateway signature | Process gateway authorization callbacks and confirm bookings. |
| `POST` | `/api/bookings/cleanup-pending` | Bearer JWT, `Administrator` role | Cancel stale pending/payment-required bookings. |

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

