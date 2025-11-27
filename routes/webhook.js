const express = require("express");
const router = express.Router();
const chatbot = require("../chatbotController");

router.post("/", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const sender = message.from;
    let msg = "";

    if (message.type === "text") msg = message.text.body.trim();
    if (message.type === "interactive") msg = message.interactive.button_reply.id;

    // Pass message to controller
    await chatbot.handleIncoming(sender, msg);

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.sendStatus(500);
  }
});

module.exports = router;
