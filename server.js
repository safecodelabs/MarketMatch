require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');

const adRoutes = require('./src/features/ads/ads.routes');
const PORT = process.env.PORT || 3000;

const app = express();
app.use(bodyParser.json());

app.use('/api', adRoutes); // Now available at /api/ad-info

app.listen(PORT, () => {
  console.log(`Bot API running on http://localhost:${PORT}`);
});

const { onMessageReceived } = require('./src/bots/whatsappBot');

app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = "marketmatchai";

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

app.post('/webhook', async (req, res) => {
  const userMessage = req.body.message;
  await onMessageReceived({ body: userMessage });
  res.send('OK');
});
