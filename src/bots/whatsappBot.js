// =======================================================
// ✅ PATCHED FILE: src/bots/whatsappBot.js
// =======================================================

// Import entire service (fixes missing functions)
const messageService = require("../services/messageService");

const { getSession, saveSession } = require("../../utils/sessionStore");

// Housing flow handlers
const {
  handleShowListings,
  handleNextListing,
  handleViewDetails,
  handleSaveListing,
  handleDeleteListing,
  handleManageSelection
} = require("../flows/housingFlow");

// AI (kept, but not used in your core flow)
const { classify, askAI } = require("../ai/aiEngine");

// Firestore helpers
const {
  db,
  addListing,
  getAllListings,
  getUserListings,
  getUserProfile,
  saveUserLanguage,
  getListingById,
  deleteListing
} = require("../../database/firestore");

// =======================================================
// HELPERS
// =======================================================

function menuRows() {
  return [
    { id: "view_listings", title: "View listings" },
    { id: "post_listing", title: "Post listing" },
    { id: "manage_listings", title: "Manage listings" },
    { id: "change_language", title: "Change Language" }
  ];
}

function languageRows() {
  return [
    { id: "lang_en", title: "English" },
    { id: "lang_hi", title: "हिंदी" },
    { id: "lang_ta", title: "தமிழ்" },
    { id: "lang_mr", title: "मराठी" }
  ];
}

async function sendLanguageSelection(sender) {
  return messageService.sendList(
    sender,
    "🌐 Select your language",
    "Choose one option:",
    "Select",
    [{ title: "Languages", rows: languageRows() }]
  );
}

async function sendMainMenu(sender) {
  return messageService.sendList(
    sender,
    "🏡 MarketMatch AI",
    "Choose an option:",
    "Menu",
    [{ title: "Main Menu", rows: menuRows() }]
  );
}

// =======================================================
// 🔥 MAIN MESSAGE HANDLER
// =======================================================

async function handleIncomingMessage(sender, msgBody, metadata = {}) {
  if (!sender) return;

  // ======================================================
  // 🌟 1. Extract Interactive Inputs (FINAL FIX)
  // ======================================================
  let command = msgBody;

  try {
    if (metadata.type === "interactive") {
      const inter = metadata.interactive;

      if (inter.button_reply) {
        command = inter.button_reply.id?.toLowerCase();
      } else if (inter.list_reply) {
        command = inter.list_reply.id?.toLowerCase();
      }
    }

    // WhatsApp new formats:
    if (metadata.type === "interactive_response") {
      command = metadata.interactive_response.id?.toLowerCase();
    }

    if (metadata.type === "button") {
      command = metadata.button?.payload?.toLowerCase();
    }
  } catch (e) {
    console.log("⚠️ Interactive parse error:", e);
  }

  command = command?.toString().trim().toLowerCase();

  // ======================================================
  // 2. Load session
  // ======================================================
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
  const isGreeting = greetings.includes(command);
  const isNewUser = !session.isInitialized;

  // ======================================================
  // 🅰️ 3. Interactive card buttons (HIGH PRIORITY)
  // ======================================================

  if (command.startsWith("view_")) {
    const listingId = command.replace("view_", "");
    const result = await handleViewDetails({ sender, listingId, session });
    await saveSession(sender, result.nextSession);
    return;
  }

  if (command.startsWith("save_")) {
    const listingId = command.replace("save_", "");
    const result = await handleSaveListing({ sender, listingId, session });
    await saveSession(sender, result.nextSession);
    return;
  }

  if (command.startsWith("manage_")) {
    const listingId = command.replace("manage_", "");
    const result = await handleManageSelection({ sender, listingId, session });
    await saveSession(sender, result.nextSession);
    return;
  }

  if (command.startsWith("delete_")) {
    const listingId = command.replace("delete_", "");
    const result = await handleDeleteListing({ sender, listingId, session });
    await saveSession(sender, result.nextSession);
    return;
  }

  if (command === "next_listing") {
    const result = await handleNextListing({ sender, session });
    await saveSession(sender, result.nextSession);
    return;
  }

  // ======================================================
  // 🅱️ 4. Greeting → new user → language selection
  // ======================================================
  if (isGreeting && isNewUser) {
    await messageService.sendMessage(
      sender,
      "🤖 MarketMatch AI helps you find rental properties, services & more."
    );

    session.isInitialized = true;
    session.awaitingLang = true;
    await saveSession(sender, session);

    return sendLanguageSelection(sender);
  }

  // ======================================================
  // 🅲️ 5. Returning user greeting → main menu
  // ======================================================
  if (isGreeting && !isNewUser) {
    session.step = "menu";
    await saveSession(sender, session);
    return sendMainMenu(sender);
  }

  // ======================================================
  // 🅳️ 6. Language selection flow
  // ======================================================
  if (session.awaitingLang || command.startsWith("lang_")) {
    let lang = "en";
    if (command.startsWith("lang_")) lang = command.split("_")[1];

    await saveUserLanguage(sender, lang);

    session.awaitingLang = false;
    session.step = "menu";
    await saveSession(sender, session);

    return sendMainMenu(sender);
  }

  // ======================================================
  // 🅴️ 7. Menu Options
  // ======================================================
  switch (command) {
    case "view_listings": {
      const r = await handleShowListings({
        sender,
        session,
        userLang: userProfile.language || "en"
      });

      await saveSession(sender, r.nextSession);
      return;
    }

    case "post_listing":
      await messageService.sendMessage(
        sender,
        "Send your listing like this:\n\nRahul, Noida Sector 56, 2BHK, 15000, +9199XXXXXXXX, Semi-furnished, near metro"
      );
      session.step = "awaiting_post_details";
      await saveSession(sender, session);
      return;

    case "manage_listings": {
      const list = await getUserListings(sender);

      if (!list || list.length === 0) {
        await messageService.sendMessage(sender, "You have no listings to manage.");
      } else {
        const rows = list.map((l, i) => ({
          id: `manage_${l.id}`,
          title: `${i + 1}. ${l.title || "Untitled"}`,
          description: `Price: ₹${l.price || "N/A"} • ${l.location || "N/A"}`
        }));

        await messageService.sendList(
          sender,
          "📝 Manage Listings",
          `Select a listing to view/delete.\nYou have ${list.length} active listings.`,
          "Select",
          [{ title: "Your Listings", rows }]
        );

        session.step = "awaiting_management_selection";
      }

      await saveSession(sender, session);
      return;
    }

    case "change_language":
      session.awaitingLang = true;
      await saveSession(sender, session);
      return sendLanguageSelection(sender);
  }

  // ======================================================
  // 🅵️ 8. DEFAULT FALLBACK
  // ======================================================
  await messageService.sendMessage(
    sender,
    "I didn't understand that. Please choose an option."
  );

  await saveSession(sender, session);
  return sendMainMenu(sender);
}

module.exports = {
  handleIncomingMessage
};
