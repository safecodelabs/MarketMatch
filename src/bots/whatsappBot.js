// =======================================================
// src/bots/whatsappBot.js (FINAL CLEAN VERSION)
// =======================================================

const { sendMessage, sendList } = require("../services/messageService");
const { getSession, saveSession } = require("../../utils/sessionStore");
const {
  getUserProfile,
  saveUserLanguage,
  getUserListings,
  addListing,
} = require("../../database/firestore");

const { classify, askAI } = require("../ai/aiEngine");
const { getString } = require("../../utils/languageStrings");

// =======================================================
// HELPERS
// =======================================================

function menuRows() {
  return [
    { id: "view_listings", title: "View listings" },
    { id: "post_listing", title: "Post listing" },
    { id: "manage_listings", title: "Manage listings" },
    { id: "change_language", title: "Change Language" },
  ];
}

function languageRows() {
  return [
    { id: "lang_en", title: "English" },
    { id: "lang_hi", title: "हिंदी" },
    { id: "lang_ta", title: "தமிழ்" },
    { id: "lang_mr", title: "मराठी" },
  ];
}

async function sendLanguageSelection(sender) {
  return sendList(
    sender,
    "🌐 Select your language",
    "Choose one option:",
    "Select",
    [{ title: "Languages", rows: languageRows() }]
  );
}

async function sendMainMenu(sender) {
  return sendList(
    sender,
    "🏡 MarketMatch AI",
    "Choose an option:",
    "Menu",
    [{ title: "Main Menu", rows: menuRows() }]
  );
}

// =======================================================
// MAIN HANDLER
// =======================================================

async function handleIncomingMessage(sender, msgBody, metadata = {}) {
  if (!sender || !msgBody) return;

  msgBody = msgBody.toString().trim().toLowerCase();

  // Detect LIST REPLY
  if (metadata?.interactive?.type === "list_reply") {
    msgBody = metadata.interactive.list_reply.id.toLowerCase();
  }

  // Load session
  let session =
    (await getSession(sender)) || {
      step: "start",
      isInitialized: false,
      awaitingLang: false,
      housingFlow: { data: {} },
    };

  const userProfile = await getUserProfile(sender);
  const userLang = userProfile?.preferredLanguage || "en";

  const greetings = ["hi", "hello", "hey", "start"];
  const isGreeting = greetings.includes(msgBody);
  const isNewUser = !session.isInitialized;

  // =======================================================
  // 🚀 1️⃣ NEW USER → INTRO + LANGUAGE SELECTION
  // =======================================================
  if (isGreeting && isNewUser) {
    console.log("🆕 NEW USER — Sending intro");

    await sendMessage(
      sender,
      "MarketMatch AI is a smart, WhatsApp-native marketplace designed to help communities buy, sell, and access reliable local services.\nMarketMatch AI एक स्मार्ट, व्हाट्सऐप-आधारित मार्केटप्लेस है, जो आपको खरीदने, बेचने और भरोसेमंद स्थानीय सेवाएँ पाने में मदद करता है।"
    );

    await sendLanguageSelection(sender);

    session.isInitialized = true;
    session.awaitingLang = true;
    await saveSession(sender, session);
    return;
  }

  // =======================================================
  // 🔁 2️⃣ RETURNING USER → SHOW MAIN MENU
  // =======================================================
  if (isGreeting && !isNewUser) {
    console.log("👋 Returning user — Showing menu");

    session.step = "menu";
    await saveSession(sender, session);

    await sendMainMenu(sender);
    return;
  }

  // =======================================================
  // 🌐 3️⃣ LANGUAGE SELECTION HANDLING
  // =======================================================
  if (session.awaitingLang || msgBody.startsWith("lang_")) {
    let lang = "en";

    if (msgBody.startsWith("lang_")) {
      lang = msgBody.split("_")[1];
    }

    await saveUserLanguage(sender, lang);

    session.awaitingLang = false;
    session.step = "menu";

    await saveSession(sender, session);

    await sendMainMenu(sender);
    return;
  }

  // =======================================================
  // 📌 4️⃣ MENU ACTIONS
  // =======================================================
  switch (msgBody) {
    case "view_listings":
      await sendMessage(
        sender,
        "Send your search query.\nExample: *2BHK in Noida sector 56*."
      );
      session.step = "awaiting_query";
      break;

    case "post_listing":
      await sendMessage(
        sender,
        "Send your listing details in this format:\n\nRahul, Noida Sector 56, 2BHK, 15000, +9199XXXXXXXX, Semi-furnished, near metro"
      );
      session.step = "awaiting_post_details";
      break;

    case "manage_listings":
      const list = await getUserListings(sender);
      if (!list || list.length === 0) {
        await sendMessage(sender, "You have no listings yet.");
      } else {
        const preview = list
          .slice(0, 8)
          .map(
            (l, i) =>
              `${i + 1}. ${l.title || "Listing"} — ${l.location} — ${
                l.price || "N/A"
              }`
          )
          .join("\n\n");

        await sendMessage(sender, `Your listings:\n\n${preview}`);
      }
      break;

    case "change_language":
      session.awaitingLang = true;
      await saveSession(sender, session);
      await sendLanguageSelection(sender);
      break;

    default:
      await sendMessage(
        sender,
        "I didn't understand that. Please choose from the menu."
      );
      await sendMainMenu(sender);
      break;
  }

  await saveSession(sender, session);
}

module.exports = { handleIncomingMessage };
