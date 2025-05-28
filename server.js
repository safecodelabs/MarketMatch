const express = require('express');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const adRoutes = require('./src/features/ads/ads.routes');
const { onMessageReceived } = require('./src/bots/whatsappBot');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Routes
app.use('/api', adRoutes); // /api/ad-info

// Webhook verification
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = 'marketmatchai';

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WEBHOOK_VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Webhook message handler
app.post('/webhook', async (req, res) => {
  const userMessage = req.body.message;
  await onMessageReceived({ body: userMessage });
  res.send('OK');
});

// Start server
app.listen(PORT, () => {
  console.log(`Bot API running on http://localhost:${PORT}`);
});
