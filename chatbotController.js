// chatbotController.js
const axios = require("axios");
const { getSession, saveSession } = require("./utils/sessionStore");
const { getUserProfile, saveUserLanguage } = require("./database/firestore");

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

// =======================================================================
// 📤 SEND TEXT
// =======================================================================
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

// =======================================================================
// 📤 SEND LANGUAGE LIST (5 LANGUAGES)
// =======================================================================
async function sendLanguageList(to) {
  const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: "Choose Language" },
      body: { text: "Please select your preferred language:" },
      action: {
        button: "Select Language",
        sections: [
          {
            title: "Languages",
            rows: [
              { id: "lang_en", title: "English" },
              { id: "lang_hi", title: "हिन्दी" },
              { id: "lang_ta", title: "தமிழ்" },
              { id: "lang_gu", title: "ગુજરાતી" },
              { id: "lang_kn", title: "ಕನ್ನಡ" }
            ]
          }
        ]
      }
    }
  };

  try {
    await axios.post(url, payload, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
    });
  } catch (err) {
    console.error("❌ Language list send error:", err.response?.data || err);
  }
}

// =======================================================================
// 🧠 MAIN BOT LOGIC — MUST MATCH WEBHOOK NAME
// =======================================================================
async function handleIncomingMessage(sender, text, session) {
  const user = await getUserProfile(sender);
  text = text.toLowerCase();

  let listId = "";
  if (text.startsWith("lang_")) listId = text;

  console.log("📥 USER INPUT:", { text, listId });

  // =====================================================================
  // 1️⃣ FIRST TIME USER — SHOW INTRO + LANG LIST
  // =====================================================================
  if (!user && ["hi", "hello", "hey"].includes(text)) {
    await sendMessage(
      sender,
      "Hello! 👋 I’m *MarketMatch AI*.\n\nI can help you with:\n• Renting homes\n• PG/Hostels\n• Buying or Selling\n• Cleaning & Home services\n\nBefore we begin, choose your preferred language:"
    );

    await sendLanguageList(sender);

    session.awaitingLang = true;
    await saveSession(sender, session);
    return session;
  }

  // =====================================================================
  // 2️⃣ RETURNING USER — JUST GREET
  // =====================================================================
  if (user && ["hi", "hello", "hey"].includes(text)) {
    await sendMessage(sender, `Welcome back! 😊 How can I help you today?`);
    return session;
  }

  // =====================================================================
  // 3️⃣ LANGUAGE SELECTED VIA LIST BUTTON
  // =====================================================================
  if (session.awaitingLang && listId.startsWith("lang_")) {
    const langCode = listId.replace("lang_", "");

    await saveUserLanguage(sender, langCode);

    await sendMessage(sender, `🎉 Language saved successfully!`);
    await sendMessage(
      sender,
      "Tell me what you're looking for:\n• 2BHK in Noida\n• PG in Gurgaon\n• Need a cleaner\n• Sell my house"
    );

    session.awaitingLang = false;
    await saveSession(sender, session);
    return session;
  }

  // =====================================================================
  // 4️⃣ IF USER TYPES LANGUAGE IN TEXT
  // =====================================================================
  const languageMap = {
    english: "en",
    hindi: "hi",
    हिन्दी: "hi",
    tamil: "ta",
    தமிழ்: "ta",
    gujarati: "gu",
    ગુજરાતી: "gu",
    kannada: "kn",
    ಕನ್ನಡ: "kn"
  };

  if (session.awaitingLang && languageMap[text]) {
    await saveUserLanguage(sender, languageMap[text]);

    await sendMessage(sender, `🎉 Language saved successfully!`);
    await sendMessage(
      sender,
      "Now tell me the requirement:\n• 2BHK in Noida\n• PG in Gurgaon\n• Need a maid\n• Sell my plot"
    );

    session.awaitingLang = false;
    await saveSession(sender, session);
    return session;
  }

  // =====================================================================
  // 5️⃣ DEFAULT FALLBACK
  // =====================================================================
  await sendMessage(
    sender,
    "I'm ready! 😊 Just tell me what you're looking for.\nExample:\n• 2BHK in Noida\n• PG in Gurgaon\n• Sell my house"
  );

  return session;
}

module.exports = {
  handleIncomingMessage,
  sendMessage,
  sendLanguageList
};
