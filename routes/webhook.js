// routes/webhook.js
const express = require("express");
const router = express.Router();

const chatbotController = require("../chatbotController");
const { getSession, saveSession } = require("../utils/sessionStore");

function getGreetingByIST() {
  const date = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffset);
  const hour = istDate.getUTCHours();

  if (hour < 12) return "Good Morning ☀️";
  if (hour < 17) return "Good Afternoon 🌤️";
  return "Good Evening 🌙";
}

// ------------------------------
// MAIN WEBHOOK
// ------------------------------
router.post("/", async (req, res) => {
  try {
    console.log("📩 Incoming Webhook:", JSON.stringify(req.body));

    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value || !value.messages) return res.sendStatus(200);

    const phoneNumberId = value.metadata?.phone_number_id;
    const message = value.messages[0];
    const sender = message.from;

    let text = "";

    // ------------------------------
    // EXTRACT MESSAGE PROPERLY
    // ------------------------------
    if (message.type === "text") {
      text = message.text.body.trim();
    }

    if (message.type === "interactive") {
      const inter = message.interactive;

      if (inter.button_reply) text = inter.button_reply.id || inter.button_reply.title;
      if (inter.list_reply) text = inter.list_reply.id || inter.list_reply.title;
    }

    text = text.toLowerCase();
    console.log("💬 User:", sender, "said:", text);

    // ------------------------------
    // GET OR CREATE SESSION
    // ------------------------------
    let session = await getSession(sender);
    if (!session) session = { step: "start", data: {} };

    // ------------------------------
    // GREETINGS RESET LOGIC
    // ------------------------------
    const greetings = ["hi", "hello", "hey", "start"];

    if (greetings.includes(text)) {
      const greet = getGreetingByIST();
      await chatbotController.sendMessage(sender, `${greet}! 👋`, phoneNumberId);

      await chatbotController.sendMessage(
        sender,
        "How can I help you today?",
        phoneNumberId
      );

      session.step = "start";
      await saveSession(sender, session);

      return res.sendStatus(200);
    }

    // ------------------------------
    // FORWARD MESSAGE TO CONTROLLER
    // ------------------------------
    const updatedSession = await chatbotController.handleIncomingMessage(
      sender,
      text,
      session,
      phoneNumberId
    );

    if (updatedSession) {
      await saveSession(sender, updatedSession);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Webhook Error:", err);
    res.sendStatus(500);
  }
});

module.exports = router;
