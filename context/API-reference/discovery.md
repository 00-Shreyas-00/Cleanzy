# Service Discovery API

## `POST /api/discovery/search`

Generates candidate worker options for a requested service and schedule. This is a prequalification endpoint only; it does not create bookings or payments.

### Authentication

JWT required.

Required role:

- `User`

### Request

```json
{
  "service_id": "14b4fb12-c31b-4976-b29f-e0672d7be442",
  "scheduled_time": "2031-02-20T09:30:00.000Z",
  "location": "Client Address",
  "client_location_coords": "12.9720,77.5950"
}
```

Required:

- `service_id`
- `scheduled_time`
- `location`

Optional:

- `client_location_coords`, as `"lat,lng"`

### Matching Rules

The backend returns staff who:

- have `availability = true`
- have `skill_type` equal to the selected `Service.service_name`
- do not have a non-cancelled booking at the same `scheduled_time`

Sorting:

- if coordinates are supplied and parseable, sort by nearest distance, then higher rating
- otherwise sort by higher rating

### Response `200`

```json
{
  "success": true,
  "message": "Booking choices generated successfully",
  "data": {
    "service": {
      "service_id": "14b4fb12-c31b-4976-b29f-e0672d7be442",
      "service_name": "Deep Cleaning",
      "description": "Deep disinfection, kitchen scrub, and bathroom sanitation.",
      "base_price": 120,
      "duration_mins": 240
    },
    "requested_schedule": "2031-02-20T09:30:00.000Z",
    "requested_location": "Client Address",
    "choice_count": 1,
    "choices": [
      {
        "staff_id": "5d0c49e7-bd9d-4bd5-9099-d0086a5b8a97",
        "worker": {
          "user_id": "9f0c8fa3-3cbf-4569-b2ef-75524fa53b41",
          "name": "Jane Smith",
          "email": "jane@example.com",
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
    ]
  }
}
```

### Errors

Missing fields: `400`

```json
{
  "success": false,
  "error": "service_id, scheduled_time, and location are required"
}
```

Invalid date: `400`

```json
{
  "success": false,
  "error": "scheduled_time must be a valid datetime"
}
```

Unknown service: `404`

```json
{
  "success": false,
  "error": "Service not found"
}
```

