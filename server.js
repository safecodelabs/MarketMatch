require('dotenv').config();
const express = require('express');
const webhookRouter = require('./routes/webhook'); // Import the webhook router

// --- EXPRESS SETUP ---
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON request bodies (required for Meta Webhooks)
app.use(express.json());

// --- WEBHOOK VERIFICATION (Required by Meta) ---
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === process.env.VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    return res.status(200).send(challenge);
  } else {
    console.error('❌ Webhook verification failed');
    return res.sendStatus(403);
  }
});

// --- WEBHOOK MESSAGE HANDLER ---
app.use('/webhook', webhookRouter);

// --- START SERVER ---
app.get('/', (_, res) => res.send('🚀 MarketMatchAI WhatsApp Bot is running...'));

app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
