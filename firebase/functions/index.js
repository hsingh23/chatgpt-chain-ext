const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Stripe = require('stripe');

admin.initializeApp();
const db = admin.firestore();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Webhook to record successful Stripe checkout
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_ENDPOINT_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed', err);
    return res.status(400).send('Invalid signature');
  }

  if (event.type === 'checkout.session.completed') {
    const email = event.data.object.customer_email;
    if (email) {
      await db.collection('payments').doc(email).set({ paid: true, updated: admin.firestore.FieldValue.serverTimestamp() });
    }
  }

  res.json({ received: true });
});

// Endpoint for the extension to check if a user has paid
exports.checkPayment = functions.https.onRequest(async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'missing email' });
  }

  const snap = await db.collection('payments').doc(email).get();
  const paid = snap.exists && snap.data().paid === true;
  res.json({ paid });
});
