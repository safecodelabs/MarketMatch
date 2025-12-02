// =======================================================
// src/bots/whatsappBot.js (CLEAN + FIXED VERSION)
// =======================================================

const { sendMessage, sendList } = require("../services/messageService");
const { getSession, saveSession } = require("../../utils/sessionStore");

// ⭐ Import housing flow handlers
const {
  handleShowListings,
  handleNextListing,
  handleViewDetails,
  handleSaveListing
} = require("../flows/housingFlow");

// ⭐ Import AI + classification
const { classify, askAI } = require("../ai/aiEngine");

// Database helpers
const {
  db,
  addListing,
  getAllListings,
  getUserListings,
  getUserProfile,
  saveUserLanguage
} = require("../../database/firestore");

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
  if (!sender) return;

  // Detect list selections
  if (metadata?.interactive?.type === "list_reply") {
    msgBody = metadata.interactive.list_reply.id.toLowerCase();
  } else {
    msgBody = msgBody?.toString().trim().toLowerCase();
  }

  // Detect SESSION
  let session =
    (await getSession(sender)) || {
      step: "start",
      isInitialized: false,
      awaitingLang: false,
      housingFlow: { data: {} },
    };

  const userProfile = await getUserProfile(sender);

  const greetings = ["hi", "hello", "hey", "start"];
  const isGreeting = greetings.includes(msgBody);
  const isNewUser = !session.isInitialized;

  // -------------------------------
  // 1️⃣ NEW USER → WELCOME + LANGUAGE
  // -------------------------------
  if (isGreeting && isNewUser) {
    await sendMessage(
      sender,
      "🤖 MarketMatch AI helps you find rental properties, services & more in your area."
    );

    session.isInitialized = true;
    session.awaitingLang = true;
    await saveSession(sender, session);

    return sendLanguageSelection(sender);
  }

  // -------------------------------
  // 2️⃣ RETURNING USER → MAIN MENU
  // -------------------------------
  if (isGreeting && !isNewUser) {
    session.step = "menu";
    await saveSession(sender, session);
    return sendMainMenu(sender);
  }

  // -------------------------------
  // 3️⃣ LANGUAGE SELECTION
  // -------------------------------
  if (session.awaitingLang || msgBody.startsWith("lang_")) {
    let lang = "en";
    if (msgBody.startsWith("lang_")) lang = msgBody.split("_")[1];

    await saveUserLanguage(sender, lang);

    session.awaitingLang = false;
    session.step = "menu";
    await saveSession(sender, session);

    return sendMainMenu(sender);
  }

  // -------------------------------
  // 4️⃣ MENU ACTIONS
  // -------------------------------
  switch (msgBody) {
    case "view_listings":
      await handleShowListings(sender); // ⭐ Uses the new card system
      session.step = "menu";
      break;

    case "post_listing":
      await sendMessage(
        sender,
        "Send your listing in this format:\n\nRahul, Noida Sector 56, 2BHK, 15000, +9199XXXXXXXX, Semi-furnished, near metro"
      );
      session.step = "awaiting_post_details";
      break;

    case "manage_listings":
      const list = await getUserListings(sender);

      if (!list || list.length === 0) {
        await sendMessage(sender, "You have no listings yet.");
      } else {
        const preview = list
          .map(
            (l, i) =>
              `${i + 1}. ${l.title || "Listing"} — ${l.location || "N/A"} — ₹${l.price}`
          )
          .join("\n\n");

        await sendMessage(sender, `Your listings:\n\n${preview}`);
      }

      session.step = "menu";
      break;

    case "change_language":
      session.awaitingLang = true;
      await saveSession(sender, session);
      return sendLanguageSelection(sender);

    default:
      await sendMessage(sender, "I didn't understand that. Please choose an option.");
      return sendMainMenu(sender);
  }

  await saveSession(sender, session);
}

module.exports = {
  handleIncomingMessage,
};
