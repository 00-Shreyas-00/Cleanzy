# Common Models and Reusable Schemas

## Response Envelope

Most successful responses use:

```json
{
  "success": true,
  "message": "Optional message",
  "data": {}
}
```

Most errors use:

```json
{
  "success": false,
  "error": "Human-readable error"
}
```

## User

```json
{
  "user_id": "9f0c8fa3-3cbf-4569-b2ef-75524fa53b41",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "role": "User",
  "address": "456 Client Lane"
}
```

Persisted field not returned by profile/auth responses:

- `password_hash`

## Staff

```json
{
  "staff_id": "5d0c49e7-bd9d-4bd5-9099-d0086a5b8a97",
  "user_id": "9f0c8fa3-3cbf-4569-b2ef-75524fa53b41",
  "skill_type": "Deep Cleaning",
  "rating": 4.8,
  "availability": true,
  "location_coords": "12.9716,77.5946"
}
```

## Service

```json
{
  "service_id": "14b4fb12-c31b-4976-b29f-e0672d7be442",
  "service_name": "Deep Cleaning",
  "description": "Deep disinfection, kitchen scrub, and bathroom sanitation.",
  "base_price": 120,
  "duration_mins": 240
}
```

## Booking

```json
{
  "booking_id": "2205216f-cdf6-42d8-86f3-bd8fdfc89974",
  "client_id": "9f0c8fa3-3cbf-4569-b2ef-75524fa53b41",
  "staff_id": "5d0c49e7-bd9d-4bd5-9099-d0086a5b8a97",
  "service_id": "14b4fb12-c31b-4976-b29f-e0672d7be442",
  "scheduled_time": "2031-02-20T09:30:00.000Z",
  "status": "Payment_Required",
  "location": "Client Address"
}
```

Known status strings in current backend behavior:

- `Pending`
- `Payment_Required`
- `Confirmed`
- `Cancelled`

## Payment

```json
{
  "payment_id": "4f238fd8-b403-41a7-98c9-07100fc7de98",
  "booking_id": "2205216f-cdf6-42d8-86f3-bd8fdfc89974",
  "amount": 120,
  "mode": "Card",
  "transaction_status": "Authorized",
  "timestamp": "2026-05-28T13:17:33.000Z"
}
```

## Payment Intent

```json
{
  "payment_intent_id": "pi_2a386d4c-44b3-44f8-96b8-c54e10a52288",
  "checkout_url": "https://payments.cleanzy.local/checkout/pi_2a386d4c-44b3-44f8-96b8-c54e10a52288",
  "amount": 145.75,
  "currency": "INR",
  "status": "requires_payment_method"
}
```

## Discovery Choice

```json
{
  "staff_id": "5d0c49e7-bd9d-4bd5-9099-d0086a5b8a97",
  "worker": {
    "user_id": "9f0c8fa3-3cbf-4569-b2ef-75524fa53b41",
    "name": "Jane Smith",
    "email": "jane@cleanzy.com",
    "phone": "5551234567",
    "rating": 4.8,
    "skill_type": "Deep Cleaning",
    "availability": true,
    "location_coords": "12.9716,77.5946"
  },
  "service": {
    "service_id": "14b4fb12-c31b-4976-b29f-e0672d7be442",
    "service_name": "Deep Cleaning",
    "description": "Deep disinfection, kitchen scrub, and bathroom sanitation.",
    "base_price": 120,
    "duration_mins": 240
  },
  "schedule": {
    "scheduled_time": "2031-02-20T09:30:00.000Z",
    "duration_mins": 240
  },
  "location": "Client Address",
  "estimated_price": 120,
  "distance_km": 4.2
}

```

