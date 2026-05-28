# Profile API

All profile routes require a JWT.

```http
Authorization: Bearer <jwt>
```

## `GET /api/profiles/me`

Returns the authenticated user's profile. If the user is a worker, the response includes the linked staff profile.

### Authentication

Any authenticated role.

### Response `200`

Customer example:

```json
{
  "success": true,
  "data": {
    "user_id": "9f0c8fa3-3cbf-4569-b2ef-75524fa53b41",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "9876543210",
    "role": "User",
    "address": "456 Client Lane",
    "staff": null
  }
}
```

Worker example:

```json
{
  "success": true,
  "data": {
    "user_id": "9f0c8fa3-3cbf-4569-b2ef-75524fa53b41",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "phone": "5551234567",
    "role": "Worker",
    "address": "789 Worker Blvd",
    "staff": {
      "staff_id": "5d0c49e7-bd9d-4bd5-9099-d0086a5b8a97",
      "user_id": "9f0c8fa3-3cbf-4569-b2ef-75524fa53b41",
      "skill_type": "Deep Cleaning",
      "rating": 5,
      "availability": true,
      "location_coords": "12.9716,77.5946"
    }
  }
}
```

### Errors

Missing token: `401`

Profile not found: `404`

## `PUT /api/profiles/me`

Updates the authenticated user's own profile. For workers, staff fields can also be updated.

### Authentication

Any authenticated role.

### Request

```json
{
  "name": "Updated Name",
  "phone": "9998887777",
  "address": "999 New Address",
  "skill_type": "Standard Cleaning",
  "availability": false,
  "location_coords": "12.9716,77.5946"
}
```

All fields are optional. Staff fields are applied only when the authenticated user's role is `Worker`.

### Response `200`

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user_id": "9f0c8fa3-3cbf-4569-b2ef-75524fa53b41",
    "name": "Updated Name",
    "email": "jane@example.com",
    "phone": "9998887777",
    "role": "Worker",
    "address": "999 New Address",
    "staff": {
      "staff_id": "5d0c49e7-bd9d-4bd5-9099-d0086a5b8a97",
      "user_id": "9f0c8fa3-3cbf-4569-b2ef-75524fa53b41",
      "skill_type": "Standard Cleaning",
      "rating": 5,
      "availability": false,
      "location_coords": "12.9716,77.5946"
    }
  }
}
```

### Errors

Missing token: `401`

Profile not found: `404`

