# Booking and Payment API

## `POST /api/bookings/commit`

Commits a selected service/staff/schedule into a booking that requires payment. This endpoint must not confirm bookings.

### Authentication

JWT required.

Required role:

- `User`

### Request

```json
{
  "service_id": "14b4fb12-c31b-4976-b29f-e0672d7be442",
  "staff_id": "5d0c49e7-bd9d-4bd5-9099-d0086a5b8a97",
  "scheduled_time": "2031-02-20T09:30:00.000Z",
  "location": "Client Address"
}
```

Required:

- `service_id`
- `staff_id`
- `scheduled_time`
- `location`

### Validation Rules

The backend verifies:

- service exists
- staff exists
- staff is available
- staff skill matches the selected service name
- staff has no active booking at that exact scheduled time

Active booking statuses:

- `Pending`
- `Payment_Required`
- `Confirmed`

### Response `201`

```json
{
  "success": true,
  "message": "Booking created and payment intent generated",
  "data": {
    "booking": {
      "booking_id": "2205216f-cdf6-42d8-86f3-bd8fdfc89974",
      "client_id": "9f0c8fa3-3cbf-4569-b2ef-75524fa53b41",
      "staff_id": "5d0c49e7-bd9d-4bd5-9099-d0086a5b8a97",
      "service_id": "14b4fb12-c31b-4976-b29f-e0672d7be442",
      "scheduled_time": "2031-02-20T09:30:00.000Z",
      "status": "Payment_Required",
      "location": "Client Address"
    },
    "payment_intent": {
      "payment_intent_id": "pi_2a386d4c-44b3-44f8-96b8-c54e10a52288",
      "checkout_url": "https://payments.cleanzy.local/checkout/pi_2a386d4c-44b3-44f8-96b8-c54e10a52288",
      "amount": 145.75,
      "currency": "INR",
      "status": "requires_payment_method"
    }
  }
}
```

### Errors

Missing fields: `400`

Invalid date: `400`

Unknown service: `404`

Unknown staff: `404`

Staff unavailable or mismatched: `409`

```json
{
  "success": false,
  "error": "Selected staff is not available for the requested service"
}
```

Staff already booked: `409`

```json
{
  "success": false,
  "error": "Selected staff is already booked for the requested time"
}
```

## `POST /api/payments/webhook`

Receives signed payment gateway authorization callbacks. This is the only implemented path that transitions a booking to `Confirmed`.

### Authentication

No JWT.

Requires HMAC header:

```http
x-cleanzy-signature: <hex hmac sha256>
```

### Request

```json
{
  "event_type": "payment_intent.succeeded",
  "booking_id": "2205216f-cdf6-42d8-86f3-bd8fdfc89974",
  "payment_intent_id": "pi_authorized_123",
  "amount": 145.75,
  "mode": "Card",
  "transaction_status": "Authorized"
}
```

Accepted event:

- `payment_intent.succeeded`

Required transaction status:

- `Authorized`

### Response `200`

```json
{
  "success": true,
  "message": "Payment authorized and booking confirmed",
  "data": {
    "booking": {
      "booking_id": "2205216f-cdf6-42d8-86f3-bd8fdfc89974",
      "client_id": "9f0c8fa3-3cbf-4569-b2ef-75524fa53b41",
      "staff_id": "5d0c49e7-bd9d-4bd5-9099-d0086a5b8a97",
      "service_id": "14b4fb12-c31b-4976-b29f-e0672d7be442",
      "scheduled_time": "2031-02-20T09:30:00.000Z",
      "status": "Confirmed",
      "location": "Client Address"
    },
    "payment": {
      "payment_id": "4f238fd8-b403-41a7-98c9-07100fc7de98",
      "booking_id": "2205216f-cdf6-42d8-86f3-bd8fdfc89974",
      "amount": 145.75,
      "mode": "Card",
      "transaction_status": "Authorized",
      "timestamp": "2026-05-28T13:17:33.000Z"
    }
  }
}
```

### Errors

Invalid signature: `401`

```json
{
  "success": false,
  "error": "Invalid payment gateway signature"
}
```

Invalid payload or unsupported event: `400`

Unknown booking: `404`

Cancelled booking: `409`

Duplicate payment: `409`

```json
{
  "success": false,
  "error": "Payment has already been recorded for this booking"
}
```

## `POST /api/bookings/cleanup-pending`

Cancels stale `Pending` and `Payment_Required` bookings older than the requested threshold.

### Authentication

JWT required.

Required role:

- `Administrator`

### Request

```json
{
  "older_than_minutes": 30
}
```

Optional:

- `older_than_minutes`, defaults to `30`

### Response `200`

```json
{
  "success": true,
  "message": "Stale pending bookings cleaned up",
  "data": {
    "cancelled_count": 2,
    "cutoff": "2026-05-28T12:47:33.000Z"
  }
}
```

### Errors

Invalid threshold: `400`

```json
{
  "success": false,
  "error": "older_than_minutes must be a positive number"
}
```

Wrong role: `403`

