# Authentication API

## `POST /api/auth/register`

Registers a normal user or administrator. If `role` is set to `Worker`, this endpoint downgrades it to `User`; workers must use `/api/auth/register-worker`.

### Authentication

Public.

### Request

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password": "SecurePass123!",
  "address": "456 Client Lane",
  "role": "User"
}
```

Required:

- `name`
- `email`
- `phone`
- `password`
- `address`

Optional:

- `role`, defaults to `User`

### Response `201`

```json
{
  "success": true,
  "message": "User successfully registered",
  "data": {
    "user_id": "9f0c8fa3-3cbf-4569-b2ef-75524fa53b41",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "User"
  }
}
```

### Errors

Missing fields: `400`

```json
{
  "success": false,
  "error": "Missing required registration fields"
}
```

Duplicate email: `400`

```json
{
  "success": false,
  "error": "A user with this email already exists"
}
```

## `POST /api/auth/register-worker`

Registers a worker user and creates the associated `Staff` record in one transaction.

### Authentication

Public.

### Request

```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "5551234567",
  "password": "WorkerPass123!",
  "address": "789 Worker Blvd",
  "skill_type": "Deep Cleaning",
  "location_coords": "12.9716,77.5946"
}
```

Required:

- `name`
- `email`
- `phone`
- `password`
- `address`
- `skill_type`
- `location_coords`

### Response `201`

```json
{
  "success": true,
  "message": "Worker and Staff profile successfully registered",
  "data": {
    "user_id": "9f0c8fa3-3cbf-4569-b2ef-75524fa53b41",
    "staff_id": "5d0c49e7-bd9d-4bd5-9099-d0086a5b8a97",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "role": "Worker",
    "skill_type": "Deep Cleaning"
  }
}
```

### Errors

Missing fields: `400`

```json
{
  "success": false,
  "error": "Missing required worker registration fields"
}
```

Duplicate email: `400`

```json
{
  "success": false,
  "error": "A user with this email already exists"
}
```

## `POST /api/auth/login`

Authenticates a user and returns a JWT.

### Authentication

Public.

### Request

```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

Required:

- `email`
- `password`

### Response `200`

```json
{
  "success": true,
  "message": "Login successful",
  "token": "jwt-token",
  "data": {
    "user_id": "9f0c8fa3-3cbf-4569-b2ef-75524fa53b41",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "User"
  }
}
```

### Errors

Missing fields: `400`

```json
{
  "success": false,
  "error": "Email and password are required"
}
```

Invalid credentials: `400`

```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

