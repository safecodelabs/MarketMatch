require('dotenv').config();
const express = require('express');
app.use('/webhook', webhookRouter);

const webhookRouter = require('./routes/webhook'); // Import the webhook router

// --- EXPRESS SETUP ---
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON request bodies, which is required for the webhook
app.use(express.json());

// --- WEBHOOK VERIFICATION (Required by Meta) ---
// This handles the verification request from the Meta App dashboard.
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === process.env.VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    res.status(200).send(challenge);
  } else {
    console.error('❌ Webhook verification failed');
    res.sendStatus(403);
  }
});

// --- WEBHOOK MESSAGE HANDLER ---
// All incoming messages from WhatsApp will be sent to this endpoint.
app.use('/webhook', webhookRouter);

// --- START SERVER ---
app.get('/', (_, res) => res.send('🚀 MarketMatchAI WhatsApp Bot is running...'));
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
