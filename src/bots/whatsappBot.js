// =======================================================
// src/bots/whatsappBot.js (CLEAN + FINAL PATCHED VERSION)
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

// ⭐ Import AI + classification (not used, but kept for completeness)
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
// HELPERS (No changes needed)
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

  // 1. DETECT MESSAGE BODY / BUTTON ID
  let buttonId = null;

  if (metadata?.interactive?.type === "list_reply") {
    msgBody = metadata.interactive.list_reply.id.toLowerCase();
  } else if (metadata?.interactive?.type === "button_reply") {
    buttonId = metadata.interactive.button_reply.id.toLowerCase();
    msgBody = buttonId; // Use buttonId for command checks below
  } else {
    msgBody = msgBody?.toString().trim().toLowerCase();
  }

  // 2. Detect SESSION
  let session =
    (await getSession(sender)) || {
      step: "start",
      isInitialized: false,
      awaitingLang: false,
      housingFlow: { data: {} },
      // Initialize lastResults and listingIndex for interactive card flow
      lastResults: [], 
      listingIndex: 0
    };

  const userProfile = await getUserProfile(sender);
  const greetings = ["hi", "hello", "hey", "start"];
  const isGreeting = greetings.includes(msgBody);
  const isNewUser = !session.isInitialized;

  // -------------------------------
  // 🅰️ INTERACTIVE CARD BUTTONS (High Priority)
  // These handlers send the message and return immediately.
  // -------------------------------
  if (msgBody.startsWith("view_")) {
    const listingId = msgBody.replace("view_", "");
    const result = await handleViewDetails({ sender, listingId, session });
    await saveSession(sender, result.nextSession);
    return; // ✅ CRITICAL: Return immediately.
  }

  if (msgBody.startsWith("save_")) {
    const listingId = msgBody.replace("save_", "");
    const result = await handleSaveListing({ sender, listingId, session });
    await saveSession(sender, result.nextSession);
    return; // ✅ CRITICAL: Return immediately.
  }

  if (msgBody === "next_listing") {
    const result = await handleNextListing({ sender, session });
    await saveSession(sender, result.nextSession);
    return; // ✅ CRITICAL: Return immediately.
  }
  
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
  // 4️⃣ MENU ACTIONS & OTHER COMMANDS
  // -------------------------------
  switch (msgBody) {
    case "view_listings":
      // The flow sends the card and returns the next session state
      const listResult = await handleShowListings({ sender, session, userLang: userProfile.language || 'en' }); 
      session = listResult.nextSession; 
      
      // ✅ FIX: Save session and RETURN to prevent falling through to the final block.
      await saveSession(sender, session);
      return; 

    case "post_listing":
      await sendMessage(
        sender,
        "Send your listing in this format:\n\nRahul, Noida Sector 56, 2BHK, 15000, +9199XXXXXXXX, Semi-furnished, near metro"
      );
      session.step = "awaiting_post_details";
      break; // Falls through to the final save.

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
      break; // Falls through to the final save.

    case "change_language":
      session.awaitingLang = true;
      await saveSession(sender, session);
      return sendLanguageSelection(sender); // Returns the list message directly

    default:
        // If the user sends an unrecognized command, we send the fallback text.
        await sendMessage(sender, "I didn't understand that. Please choose an option.");
        break; // Falls through to the final save and menu send.
  }

  // -------------------------------------------------------------------------
  // FINAL EXIT LOGIC: Handles cases that used 'break' (post_listing, manage_listings, default)
  // -------------------------------------------------------------------------
  await saveSession(sender, session);
  
  // Send the main menu only if the message was NOT 'post_listing' or 'manage_listings',
  // and it was NOT a command that returned the menu earlier (like default case).
  // Since the default case now sends the 'I didn't understand' message,
  // we send the menu immediately after that for clarity.
  if (msgBody !== "post_listing" && msgBody !== "manage_listings") {
      return sendMainMenu(sender);
  }
  
  // If it was post_listing, we just return silently as we expect input.
  return;
}

module.exports = {
  handleIncomingMessage,
};