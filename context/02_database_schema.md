# 02_database_schema

## Database Schema

### USER
- **User_ID**: uuid, PK
- **Name**: string
- **Email**: string
- **Phone**: string
- **Role**: string
- **Password_Hash**: string
- **Address**: string

### STAFF
- **Staff_ID**: uuid, PK
- **User_ID**: uuid, FK to USER(User_ID)
- **Skill_Type**: string
- **Rating**: float
- **Availability**: bool
- **Location_Coords**: string

### SERVICE
- **Service_ID**: uuid, PK
- **Service_Name**: string
- **Description**: string
- **Base_Price**: float
- **Duration_Mins**: int

### BOOKING
- **Booking_ID**: uuid, PK
- **Client_ID**: uuid, FK to USER(User_ID)
- **Staff_ID**: uuid, FK to STAFF(Staff_ID)
- **Service_ID**: uuid, FK to SERVICE(Service_ID)
- **Scheduled_Time**: datetime
- **Status**: string
- **Location**: string

### PAYMENT
- **Payment_ID**: uuid, PK
- **Booking_ID**: uuid, FK to BOOKING(Booking_ID)
- **Amount**: float
- **Mode**: string
- **Transaction_Status**: string
- **Timestamp**: datetime

### ATTENDANCE
- **Attendance_ID**: uuid, PK
- **Staff_ID**: uuid, FK to STAFF(Staff_ID)
- **Date**: date
- **Check_In**: datetime
- **Check_Out**: datetime

### FEEDBACK
- **Feedback_ID**: uuid, PK
- **Booking_ID**: uuid, FK to BOOKING(Booking_ID)
- **Client_ID**: uuid, FK to USER(User_ID)
- **Rating**: int
- **Comments**: string

### NOTIFICATION
- **Notification_ID**: uuid, PK
- **User_ID**: uuid, FK to USER(User_ID)
- **Type**: string
- **Message**: string
- **Sent_At**: datetime
- **Is_Read**: bool

## Relationship Rules

- **USER to STAFF**: One-to-One / One-to-Zero-or-One
  - A user may register as a worker and have a single STAFF record, or have none.

- **USER to BOOKING**: One-to-Many
  - A user can place multiple bookings as a client.

- **USER to NOTIFICATION**: One-to-Many
  - A user can receive many notifications.

- **USER to FEEDBACK**: One-to-Many
  - A user can submit many feedback entries across bookings.

- **STAFF to ATTENDANCE**: One-to-Many
  - A staff member can have multiple attendance records.

- **STAFF to BOOKING**: One-to-Many
  - A staff member can be assigned to multiple bookings.

- **SERVICE to BOOKING**: One-to-Many
  - A service definition can be referenced by many bookings.

- **BOOKING to PAYMENT**: One-to-One
  - Each booking generates a single payment record.

- **BOOKING to FEEDBACK**: One-to-One / One-to-Many
  - A booking can receive one feedback entry, and the system permits a primary review relationship while remaining compatible with one-to-many extension semantics if needed.
