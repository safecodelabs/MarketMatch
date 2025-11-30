require("dotenv").config();
const express = require("express");
const app = express();
const webhookRoute = require("./routes/webhook");

// ---------------------------------------------------------
// 1) DEFAULT JSON PARSER — used for normal routes
// ---------------------------------------------------------
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: false }));

// ---------------------------------------------------------
// 2) WHATSAPP WEBHOOK VERIFICATION (GET)
// ---------------------------------------------------------
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    console.log("✅ Webhook Verified!");
    return res.status(200).send(challenge);
  }

  console.error("❌ Webhook Verification Failed");
  return res.sendStatus(403);
});

// ---------------------------------------------------------
// 3) WHATSAPP WEBHOOK MESSAGE HANDLER (POST)
//    ⚠️ MUST USE RAW BODY — NOT express.json()
// ---------------------------------------------------------
app.post(
  "/webhook",
  express.raw({ type: "application/json" }), // <-- very important
  webhookRoute
);

// ---------------------------------------------------------
app.get("/", (_, res) => {
  res.send("🚀 MarketMatchAI WhatsApp Bot is running…");
});

// ---------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
