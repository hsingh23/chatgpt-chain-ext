# Firebase Functions

This directory contains Firebase Cloud Functions used by the extension.

- `checkPayment` – HTTP endpoint the extension calls to verify if a user has completed a Stripe payment.
- `stripeWebhook` – Webhook used by Stripe to record successful checkouts in Firestore.

Deploy using the Firebase CLI:

```bash
firebase deploy --only functions
```
