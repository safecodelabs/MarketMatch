const axios = require("axios");
const { getSession, saveSession } = require("./utils/sessionStore");
const { getUserProfile, saveUserLanguage } = require("./database/firestore");

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

const API_URL = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

// =======================================================
// SEND BUTTONS (Fix for missing function)
// =======================================================
async function sendButtons(to, text, buttons, phoneNumberId = PHONE_NUMBER_ID) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text },
          action: {
            buttons: buttons.map((b) => ({
              type: "reply",
              reply: { id: b.id, title: b.title }
            }))
          }
        }
      },
      {
        headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
      }
    );
  } catch (err) {
    console.error("❌ sendButtons error:", err.response?.data || err);
  }
}


// ===================================================================================
// SEND LANGUAGE LIST (Interactive List)
// ===================================================================================
async function sendLanguageList(to, phoneNumberId = PHONE_NUMBER_ID) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
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

// ===================================================================================
// MAIN: HANDLE INCOMING MESSAGE
//  ⚠️ THIS MATCHES WEBHOOK FORMAT NOW
// ===================================================================================
async function handleIncomingMessage(sender, text, session, phoneNumberId) {
  text = text?.toLowerCase() || "";

  const user = await getUserProfile(sender);

  console.log("📥 Parsed Input:", text);

  // =======================================================
  // 1️⃣ First time user
  // =======================================================
  if (!user && !session.introduced) {
    await sendMessage(
      sender,
      "👋 *Welcome to MarketMatch AI!*\n\nI’m your personal assistant for:\n🏠 Rentals\n🏢 Real Estate\n👤 PG / Flatmates\n🧹 Home Services\n\nLet's begin. Please pick a language."
    );

    await sendLanguageList(sender, phoneNumberId);

    session.introduced = true;
    session.awaitingLanguage = true;
    await saveSession(sender, session);
    return session;
  }

  // =======================================================
  // 2️⃣ User must pick language
  // =======================================================
  if (session.awaitingLanguage) {
    const textToLang = {
      english: "en",
      hindi: "hi",
      tamil: "ta",
      gujarati: "gu",
      kannada: "kn"
    };

    // manual typed language
    if (textToLang[text]) {
      await saveUserLanguage(sender, textToLang[text]);
      session.awaitingLanguage = false;
      await saveSession(sender, session);

      await sendMessage(sender, "✅ Language saved!");
      await sendMessage(sender, "How can I help you today?");
      return session;
    }

    // pressed interactive list
    if (text.startsWith("lang_")) {
      const lang = text.replace("lang_", "");
      await saveUserLanguage(sender, lang);

      session.awaitingLanguage = false;
      await saveSession(sender, session);

      await sendMessage(sender, "✅ Language saved!");
      await sendMessage(sender, "How can I help you today?");
      return session;
    }

    await sendMessage(sender, "Please choose a language to continue 👇");
    await sendLanguageList(sender, phoneNumberId);
    return session;
  }

  // =======================================================
  // 3️⃣ User is active, language selected — now handle queries
  // =======================================================
  await sendMessage(
    sender,
    `👍 Received your request: "${text}".\nAI engine will process this soon.`
  );

  return session;
}

// ===================================================================================
module.exports = {
  sendLanguageList,
  sendButtons,
  handleIncomingMessage
};

