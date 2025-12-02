// =======================================================
// ✅ PATCHED FILE: src/bots/whatsappBot.js
// =======================================================

// ❌ FIX 1: Import entire module to resolve 'sendList is not a function' TypeError
const messageService = require("../services/messageService"); 
const { getSession, saveSession } = require("../../utils/sessionStore");

// ⭐ Import housing flow handlers
const {
  handleShowListings,
  handleNextListing,
  handleViewDetails,
  handleSaveListing
} = require("../flows/housingFlow");

// ⭐ Import AI + classification (kept for completeness)
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
// HELPERS (Updated to use messageService properties)
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
  // ✅ FIX 1: Use messageService.sendList
  return messageService.sendList( 
    sender,
    "🌐 Select your language",
    "Choose one option:",
    "Select",
    [{ title: "Languages", rows: languageRows() }]
  );
}

async function sendMainMenu(sender) {
  // ✅ FIX 1: Use messageService.sendList
  return messageService.sendList(
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
      lastResults: [], 
      listingIndex: 0
    };

  const userProfile = await getUserProfile(sender);
  const greetings = ["hi", "hello", "hey", "start"];
  const isGreeting = greetings.includes(msgBody);
  const isNewUser = !session.isInitialized;

  // -------------------------------
  // 🅰️ INTERACTIVE CARD BUTTONS (High Priority)
  // -------------------------------
  if (msgBody.startsWith("view_")) {
    const listingId = msgBody.replace("view_", "");
    // NOTE: handleViewDetails uses the generic sendMessage for text reply, which is correct.
    const result = await handleViewDetails({ sender, listingId, session });
    await saveSession(sender, result.nextSession);
    return; 
  }

  if (msgBody.startsWith("save_")) {
    const listingId = msgBody.replace("save_", "");
    // NOTE: handleSaveListing uses the generic sendMessage for text reply, which is correct.
    const result = await handleSaveListing({ sender, listingId, session });
    await saveSession(sender, result.nextSession);
    return; 
  }
  
  // Fix case mismatch issue in button IDs from housingFlow.js
  if (msgBody === "next_listing" || msgBody === "NEXT_LISTING") { 
    const result = await handleNextListing({ sender, session });
    await saveSession(sender, result.nextSession);
    return; 
  }
  
  // -------------------------------
  // 1️⃣ NEW USER → WELCOME + LANGUAGE
  // -------------------------------
  if (isGreeting && isNewUser) {
    // ✅ FIX 1: Use messageService.sendMessage
    await messageService.sendMessage( 
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
      
      // Save session and return immediately.
      await saveSession(sender, session);
      return; 

    case "post_listing":
      // ✅ FIX 1: Use messageService.sendMessage
      await messageService.sendMessage( 
        sender,
        "Send your listing in this format:\n\nRahul, Noida Sector 56, 2BHK, 15000, +9199XXXXXXXX, Semi-furnished, near metro"
      );
      session.step = "awaiting_post_details";
      await saveSession(sender, session); 
      return; 

    case "manage_listings":
      const list = await getUserListings(sender);

      if (!list || list.length === 0) {
        // ✅ FIX 1: Use messageService.sendMessage
        await messageService.sendMessage(sender, "You have no listings yet."); 
      } else {
        const preview = list
          .map(
            (l, i) =>
              `${i + 1}. ${l.title || "Listing"} — ${l.location || "N/A"} — ₹${l.price}`
          )
          .join("\n\n");
        // ✅ FIX 1: Use messageService.sendMessage
        await messageService.sendMessage(sender, `Your listings:\n\n${preview}`); 
      }

      session.step = "menu";
      await saveSession(sender, session); 
      return sendMainMenu(sender); 

    case "change_language":
      session.awaitingLang = true;
      await saveSession(sender, session);
      return sendLanguageSelection(sender); 

    default:
        // 5️⃣ Fallback: Send message, save session, and send menu immediately.
        // ✅ FIX 1: Use messageService.sendMessage
        await messageService.sendMessage(sender, "I didn't understand that. Please choose an option."); 
        await saveSession(sender, session); 
        return sendMainMenu(sender); 
  }
}

module.exports = {
  handleIncomingMessage,
};