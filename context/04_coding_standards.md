# 04_coding_standards

## Environment Behavior

- Never clutter the project root directory with diagnostic logs, temporary API payloads, or standard output trace files.
- Use `context/dump/` as the exclusive sandbox directory for any raw server response snapshot, temporary scraping file, or terminal execution log readout generated during debugging.
- Do not create or persist debugging artifacts outside `context/dump/` unless explicitly required by the project workflow.

## Directory Guidelines

- Keep source code, architecture context, and operational metadata separated from debugging artifacts.
- Use `context/dump/` for all ephemeral files, scratchpads, and runtime logs only.
- Treat `context/dump/.gitkeep` as the sole tracked marker for the sandbox directory.

## Error Handling & Typing

- Enforce explicit validation layers at all external boundaries, especially for user input, booking commands, payment callbacks, and staff assignment payloads.
- Implement unified error-handling middleware in the Backend to standardize error responses and preserve stable state transitions.
- Maintain strong typing across all models, using explicit type definitions for:
  - USER
  - STAFF
  - SERVICE
  - BOOKING
  - PAYMENT
  - ATTENDANCE
  - FEEDBACK
  - NOTIFICATION
- Validate schema compliance before persistence and reject invalid data with clear domain-specific error messages.
- Ensure typed contracts align with the entities defined in `02_database_schema.md`.

## Agent Directives

- Before writing any code modification, cross-reference `03_business_workflows.md` to ensure state logic alignment.
- Do not introduce booking or payment state transitions that conflict with the workflows and state machine rules defined in `03_business_workflows.md`.
- Use the business workflow document as the primary source for sequencing actions, gateway interactions, and confirmation rules.
