# 03_business_workflows

## Phase A: Requesting and Presenting Service Options

1. **User requests a service via App.**
   - The User frontend collects service criteria and submit request payload to the App interface.

2. **App initiates booking request to Backend.**
   - The App forwards the service request to the Backend API endpoint dedicated to service discovery and booking prequalification.

3. **Backend fetches the Staff list from Database.**
   - The Backend queries the Database for available staff matching the requested service type and scheduling constraints.

4. **Database provides the available staff back to Backend.**
   - The Database returns staff records, availability status, and location metadata.

5. **Backend computes and returns booking choices to App.**
   - The Backend evaluates availability, pricing, worker rating, and client preferences.
   - It constructs booking choices and candidate worker options.

6. **App displays service options to User.**
   - The App renders the curated options and allows the User to select a preferred worker, service time, and location.

## Phase B: Booking and Payment Processing Workflow

1. **User commits and books a service via App.**
   - The User confirms a selected booking option and triggers the commit action.

2. **App sends a confirm and assign service command to Backend.**
   - The App submits the booking confirmation payload to the Backend with the chosen staff, service, schedule, and payment intent.

3. **Backend initiates payment with the 3rd Party Payment Gateway.**
   - The Backend prepares a payment authorization request and securely invokes the external gateway.

4. **Payment Gateway requests payment directly from User.**
   - The gateway prompts the User for payment credentials and consent through a secure checkout flow.

5. **User provides payment credentials and confirms payment with Gateway.**
   - The User completes the payment form and submits authorization to the gateway.

6. **Gateway processes and returns an Authorize Transaction message to Backend.**
   - The gateway validates the transaction, performs fraud checks, and returns an authorized callback to the Backend.

7. **Backend updates booking state, saves records, and commands App to display confirmation.**
   - On receiving authorized payment confirmation, the Backend updates the booking status, persists payment and booking records, and sends a confirmation response to the App.

8. **App renders confirmation of booking to the User.**
   - The App displays the confirmed booking details, payment receipt status, and next steps to the User.

## Booking State Machine Rule

- **Booking status must never transition to `Confirmed` unless an explicit authorized callback is logged from the payment gateway.**
- The Backend must enforce the state transition by validating the payment authorization event before updating the booking status.
- If payment authorization is not received, the booking remains in a pending or payment-required state until the callback is confirmed.
