require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');

const adRoutes = require('./src/features/ads/ads.routes');

const app = express();
app.use(bodyParser.json());

app.use('/api', adRoutes); // Now available at /api/ad-info

app.listen(3000, () => {
  console.log('Bot API running on http://localhost:3000');
});

const { onMessageReceived } = require('./src/bots/whatsappBot');

app.post('/webhook', async (req, res) => {
  const userMessage = req.body.message;
  await onMessageReceived({ body: userMessage });
  res.send('OK');
});
