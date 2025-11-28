require('dotenv').config();
const express = require('express');
const app = express();

// ---------------------------
// ONLY ONE JSON PARSER — SAFE
// ---------------------------
app.use(express.json({ limit: "5mb" }));

// ---------------------------
// WEBHOOK VERIFICATION (GET)
// ---------------------------
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log("✅ Webhook Verified!");
    return res.status(200).send(challenge);
  }

  console.error("❌ Webhook Verification Failed");
  return res.sendStatus(403);
});

// ---------------------------
// WEBHOOK MESSAGE ROUTE (POST)
// ---------------------------
app.use('/webhook', require('./routes/webhook'));

// ---------------------------
app.get('/', (_, res) => res.send("🚀 MarketMatchAI WhatsApp Bot is running…"));
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
