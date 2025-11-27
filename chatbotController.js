// chatbotController.js
const axios = require("axios");
const { getSession, saveSession } = require("./utils/sessionStore");
const { getUserProfile, saveUserLanguage } = require("./database/firestore");

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

// -------------------------------------------------------
// 📤 Send WhatsApp Message (NO TRANSLATION)
// -------------------------------------------------------
async function sendMessage(to, text) {
  if (!text) return;

  const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text }
  };

  try {
    await axios.post(url, payload, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
    });
  } catch (err) {
    console.error("❌ WhatsApp send error:", err.response?.data || err);
  }
}

// -------------------------------------------------------
// 📤 Send Language Buttons
// -------------------------------------------------------
async function sendLanguageButtons(to) {
  const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "Choose your preferred language:" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "lang_en", title: "English" } },
          { type: "reply", reply: { id: "lang_hi", title: "हिंदी" } },
          { type: "reply", reply: { id: "lang_ta", title: "தமிழ்" } }
        ]
      }
    }
  };

  try {
    await axios.post(url, payload, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
    });
  } catch (err) {
    console.error("❌ WhatsApp button send error:", err.response?.data || err);
  }
}

// -------------------------------------------------------
// 🧠 MAIN HANDLER (NO TRANSLATION)
// -------------------------------------------------------
async function handleIncoming(sender, msg) {
  const session = (await getSession(sender)) || {};
  const user = await getUserProfile(sender);

  const lang = user?.preferredLanguage || "en";

  // NEW USER → show welcome + language buttons
  if (!user && msg.toLowerCase() === "hi") {
    await sendMessage(
      sender,
      "Hello! 👋 I’m MarketMatch AI.\nI can help you with:\n• Buying or selling properties\n• Renting houses or PG\n• Finding a cleaner or maid\n• Hiring a handyman, technician or electrician"
    );

    await sendLanguageButtons(sender);

    session.awaitingLang = true;
    await saveSession(sender, session);
    return session;
  }

  // RETURNING USER
  if (user && msg.toLowerCase() === "hi") {
    await sendMessage(
      sender,
      "Welcome back! 😊 How can I help you today?"
    );
    return session;
  }

  // LANGUAGE SELECTION
  if (session.awaitingLang && msg.startsWith("lang_")) {
    const langCode = msg.replace("lang_", "");
    await saveUserLanguage(sender, langCode);

    await sendMessage(sender, `Language updated successfully! 🎉`);
    await sendMessage(
      sender,
      "How can I assist you today?\nTry:\n• 2BHK in Noida\n• Sell my house\n• I need a maid"
    );

    session.awaitingLang = false;
    await saveSession(sender, session);
    return session;
  }

  // DEFAULT RESPONSE
  await sendMessage(
    sender,
    "I'm ready! Tell me what you are looking for.\nExamples:\n• 2BHK in Noida\n• Sell my plot\n• 1RK in Pune\n• Need an electrician"
  );

  return session;
}

module.exports = {
  handleIncoming,
  sendMessage
};
