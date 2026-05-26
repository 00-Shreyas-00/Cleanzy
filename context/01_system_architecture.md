# 01_system_architecture

## System Boundary

The Online Housekeeping Management Platform is a bounded enterprise system that enables customers to request, book, pay for, and review housekeeping services while allowing workers to manage assignments and administrators to govern operations. The boundary distinguishes internal application components from external dependencies and user-facing interfaces.

## System Components

- **:User (Frontend Mobile/Web Client)**
  - Public-facing interface for customers, workers, and administrators.
  - Responsible for rendering screens, collecting input, and submitting actions to the App layer.
  - Operates exclusively through the App interface layer and never accesses data persistence directly.

- **:App (App Interface Layer)**
  - The API gateway and orchestration layer for all client interactions.
  - Accepts requests from the User frontend and forwards them to the Backend.
  - Receives responses from the Backend and renders or relays them to the User.
  - Enforces presentation logic, request validation, and session handling.

- **:Backend (Core business logic engine)**
  - Encapsulates domain rules, workflows, access control, and transaction orchestration.
  - Performs all business decisions, booking lifecycle transitions, payment coordination, and record persistence.
  - Serves as the only authorized consumer of the Database and the secure proxy to external systems.

- **:Database (Data persistence layer)**
  - Stores durable application state, including users, staff, services, bookings, payments, attendance, feedback, and notifications.
  - Provides the definitive source of truth for the platform.
  - Is accessed exclusively by the Backend component.

- **:3rd Party Payment Gateway (External transactional processor)**
  - External payment processor responsible for credential capture, authorization, and transaction settlement.
  - Interacts with the Backend only through secure, backend-initiated handshakes.
  - Never receives direct requests from the User frontend without Backend coordination.

## Target Roles (Actors)

- **User**
  - Can book required service.
  - Can receive service from a worker.
  - Can search for required service offerings.
  - Can view worker profiles.
  - Can sign up and log in.

- **Worker**
  - Can sign up and log in.
  - Can confirm bookings assigned to them.
  - Can view upcoming and past bookings.

- **Administrator**
  - Can view bookings across the system.
  - Can manage worker complaints.
  - Can view performance reviews and feedback.
  - Can manage staff holidays and salary details.

## Architectural Guardrails

- **Strict Separation of Concerns**
  - The frontend (:App) must never query the database directly.
  - All data access and domain logic must flow through the :Backend layer.

- **External Gateway Rule**
  - All payment transactions must route securely through the 3rd Party Payment Gateway.
  - Payment interactions must be initiated by the Backend, and the Backend must handle authorization callbacks before updating booking state.

- **Backend Authority**
  - The :Backend is the authoritative orchestration point for bookings, payments, and state transitions.
  - The :App is limited to request/response handling and presentation logic.

- **Data Consistency**
  - The :Database is the single source of truth and must only be modified by Backend-controlled persistence operations.
  - No direct client-side persistence or external service updates may bypass Backend validation.
