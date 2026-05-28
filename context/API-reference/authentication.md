# Authentication and Authorization

## JWT Authentication

Protected routes require:

```http
Authorization: Bearer <jwt>
```

JWTs are issued by:

```http
POST /api/auth/login
```

The token payload contains:

```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "role": "User"
}
```

Tokens expire in 24 hours.

## Roles

Current supported role strings:

- `User`
- `Worker`
- `Administrator`

## Role Requirements

| Feature | Required Role |
| --- | --- |
| View/update own profile | Any authenticated role |
| Service discovery | `User` |
| Booking commit | `User` |
| Pending booking cleanup | `Administrator` |
| Payment webhook | Gateway HMAC signature, not JWT |

## Payment Webhook Signature

Payment callbacks require:

```http
x-cleanzy-signature: <hex hmac sha256>
```

The signature is calculated over a stable JSON representation of the request body using:

```text
PAYMENT_GATEWAY_WEBHOOK_SECRET
```

If the environment variable is missing, the local fallback is:

```text
cleanzy-local-gateway-secret
```

Unsigned or incorrectly signed callbacks return `401`.

## Standard Auth Errors

No bearer token:

```json
{
  "success": false,
  "error": "Unauthorized: No token provided"
}
```

Invalid or expired token:

```json
{
  "success": false,
  "error": "Forbidden: Invalid or expired token"
}
```

Wrong role:

```json
{
  "success": false,
  "error": "Forbidden: Access restricted to roles: [User]"
}
```

