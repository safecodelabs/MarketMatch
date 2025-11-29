const express = require("express");
const router = express.Router();

const chatbotController = require("../chatbotController");
const { getSession, saveSession } = require("../utils/sessionStore");

// ------------------------------
// MAIN WEBHOOK (POST)
// ------------------------------
router.post("/", async (req, res) => {
  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value || !value.messages) return res.sendStatus(200); // ignore non-message webhooks

    const phoneNumberId = value.metadata?.phone_number_id;
    const message = value.messages[0];
    const sender = message.from;

    let text = "";
    if (message.type === "text") {
      text = message.text.body.trim();
    } else if (message.type === "interactive") {
      const inter = message.interactive;
      if (inter.button_reply) text = inter.button_reply.id || inter.button_reply.title;
      if (inter.list_reply) text = inter.list_reply.id || inter.list_reply.title;
    }
    text = text.toLowerCase();

    // ------------------------------
    // GET SESSION (can be undefined for new users)
    // ------------------------------
    const session = await getSession(sender); // do NOT default to an object here

    // ------------------------------
    // PASS MESSAGE TO MAIN CONTROLLER
    // ------------------------------
    const updatedSession = await chatbotController.handleIncomingMessage(
      sender,
      text,
      session,
      { phoneNumberId } // pass as metadata
    );

    if (updatedSession) await saveSession(sender, updatedSession);

    res.sendStatus(200);

  } catch (err) {
    console.error("❌ Webhook Error:", err);
    res.sendStatus(500);
  }
});

module.exports = router;
