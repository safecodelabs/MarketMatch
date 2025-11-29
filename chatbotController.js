const axios = require("axios");
const { getSession, saveSession } = require("./utils/sessionStore");
const { getUserProfile, saveUserLanguage } = require("./database/firestore");

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

const API_URL = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

// =======================================================================
// 📤 SEND TEXT MESSAGE
// =======================================================================
async function sendMessage(to, text) {
  if (!text) return;

  try {
    await axios.post(
      API_URL,
      {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text }
      },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
    );
  } catch (err) {
    console.error("❌ sendMessage error:", err.response?.data || err);
  }
}

// =======================================================================
// 📤 SEND LANGUAGE LIST MESSAGE (5 LANGUAGES)
// =======================================================================
async function sendLanguageList(to) {
  try {
    await axios.post(
      API_URL,
      {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: "🌐 Please choose your preferred language:" },
          footer: { text: "MarketMatch AI" },
          action: {
            button: "Select Language",
            sections: [
              {
                title: "Available Languages",
                rows: [
                  { id: "lang_en", title: "English" },
                  { id: "lang_hi", title: "हिंदी (Hindi)" },
                  { id: "lang_ta", title: "தமிழ் (Tamil)" },
                  { id: "lang_gu", title: "ગુજરાતી (Gujarati)" },
                  { id: "lang_kn", title: "ಕನ್ನಡ (Kannada)" }
                ]
              }
            ]
          }
        }
      },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
    );
  } catch (err) {
    console.error("❌ sendLanguageList error:", err.response?.data || err);
  }
}

// =======================================================================
// 🧠 MAIN BOT LOGIC
// =======================================================================
async function handleIncoming(sender, messageObj) {
  const session = (await getSession(sender)) || {};
  const user = await getUserProfile(sender);

  let userText = "";
  let listId = "";

  // Detect type
  if (messageObj.type === "text") userText = messageObj.text.body.toLowerCase();
  if (messageObj.type === "interactive" && messageObj.interactive.list_reply) {
    listId = messageObj.interactive.list_reply.id;
  }

  console.log("📥 USER INPUT:", { text: userText, listId });

  // ===============================================================
  // 1️⃣ BRAND NEW USER (no profile in database)
  // ===============================================================
  if (!user && !session.introduced) {
    await sendMessage(
      sender,
      "👋 *Welcome to MarketMatch AI!*\n\nI’m your personal assistant for:\n🏠 Renting\n🏢 Buying\n💼 Selling\n👤 PG/Roommates\n🧹 House Services\n\nLet's begin by selecting your preferred language."
    );

    await sendLanguageList(sender);

    session.introduced = true;
    session.awaitingLanguage = true;
    await saveSession(sender, session);
    return;
  }

  // ===============================================================
  // 2️⃣ AWAITING LANGUAGE (must choose before using bot)
  // ===============================================================
  if (session.awaitingLanguage) {
    // CASE A: User selected language via LIST message
    if (listId.startsWith("lang_")) {
      const langCode = listId.replace("lang_", "");
      await saveUserLanguage(sender, langCode);

      await sendMessage(sender, "✅ Language saved successfully!");

      session.awaitingLanguage = false;
      await saveSession(sender, session);

      await sendMessage(
        sender,
        "How can I help you today?\nExample:\n• 2BHK in Noida\n• Need a cleaner\n• PG in Bangalore"
      );
      return;
    }

    // CASE B: User typed language manually
    const textToLang = {
      english: "en",
      hindi: "hi",
      tamil: "ta",
      gujarati: "gu",
      kannada: "kn"
    };

    if (textToLang[userText]) {
      await saveUserLanguage(sender, textToLang[userText]);

      await sendMessage(sender, "✅ Language saved successfully!");

      session.awaitingLanguage = false;
      await saveSession(sender, session);
      return;
    }

    // Otherwise → force language selection again
    await sendMessage(sender, "Please choose a language to continue 👇");
    await sendLanguageList(sender);
    return;
  }

  // ===============================================================
  // 3️⃣ User already selected language — proceed with actual queries
  // ===============================================================

  await sendMessage(
    sender,
    "👍 I received your request. Soon this will connect to the AI engine.\n(You said: " + userText + ")"
  );

  // Later: call classify() + housingFlow + listingSearch
}

module.exports = {
  handleIncoming,
  sendMessage,
  sendLanguageList
};
