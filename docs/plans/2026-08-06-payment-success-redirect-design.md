# Payment Success Redirect Design

## Goal

Replace the generic order-status card with a clear payment-result experience. A verified successful payment shows a five-second countdown and then returns the customer to the storefront home page. A visible Home button always allows immediate manual navigation.

## Trust Boundary

The Pakasir return URL is not proof of payment. The page continues to load the authenticated order status from the server and, when needed, asks the server to verify Pakasir through its Transaction Detail API. Only `PAID`, `PROCESSING`, or `COMPLETED` may render the success state or start automatic navigation. Pending, review, underpaid, failed, expired, disputed, and refunded states never masquerade as success.

## Interface States

- Checking: show a calm verification state while the first server response is pending.
- Success: show a strong confirmation mark, the server message, order number when available, a visible five-second countdown, and a Home button.
- Pending or review: show the current status and continue polling without redirecting.
- Failed or unavailable: show an honest error state with Home and shopping actions, without automatic redirect.

Client navigation uses `router.replace("/")` after the countdown so the payment return page does not remain as the natural back-navigation destination. Existing polling and ownership checks remain unchanged.

## Verification

Run payment package tests, web typecheck, targeted lint, and the production build. Confirm the deleted admin payment-setting route remains absent and the order-success route is present in the build manifest.
