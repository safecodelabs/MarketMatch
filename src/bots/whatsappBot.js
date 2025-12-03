// =======================================================
// ✅ PATCHED FILE: src/bots/whatsappBot.js
// =======================================================

// Import entire service (fixes missing functions)
const messageService = require("../services/messageService");

const { getSession, saveSession } = require("../../utils/sessionStore");

// Housing flow handlers
const {
  handleShowListings: housingFlowHandleShowListings, // Renamed to avoid conflict
  handleNextListing,
  handleViewDetails,
  handleSaveListing,
  handleDeleteListing,
  handleManageSelection
} = require("../flows/housingFlow");

// IMPORTANT: Import your controller functions
const { 
  handleShowListings: controllerHandleShowListings,
  handleManageListings: controllerHandleManageListings
} = require("./chatbotController");

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
// 🔥 MAIN MESSAGE HANDLER - PATCHED VERSION
// =======================================================

async function handleIncomingMessage(sender, msgBody, metadata = {}) {
  console.log("🔍 [WHATSAPP_BOT] handleIncomingMessage called");
  console.log("🔍 [WHATSAPP_BOT] sender:", sender);
  console.log("🔍 [WHATSAPP_BOT] msgBody:", msgBody);
  console.log("🔍 [WHATSAPP_BOT] metadata type:", metadata?.type);
  
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
        console.log("🔍 [WHATSAPP_BOT] Button reply ID:", command);
      } else if (inter.list_reply) {
        command = inter.list_reply.id?.toLowerCase();
        console.log("🔍 [WHATSAPP_BOT] List reply ID:", command);
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
  console.log("🔍 [WHATSAPP_BOT] Final command:", command);

  // ======================================================
  // 2. Load session
  // ======================================================
  let session =
    (await getSession(sender)) || {
      step: "start",
      isInitialized: false,
      awaitingLang: false,
      housingFlow: { 
        step: "start", 
        data: {},
        currentIndex: 0, 
        listingData: null
      },
      lastResults: [],
      listingIndex: 0
    };

  console.log("🔍 [WHATSAPP_BOT] Session loaded, step:", session.step);

  const userProfile = await getUserProfile(sender);
  const greetings = ["hi", "hello", "hey", "start"];
  const isGreeting = greetings.includes(command);
  const isNewUser = !session.isInitialized;

  // ======================================================
  // 🅰️ 3. Interactive card buttons (HIGH PRIORITY)
  // ======================================================

  if (command.startsWith("view_")) {
    console.log(`🔍 [WHATSAPP_BOT] Handling view_ command: ${command}`);
    const listingId = command.replace("view_", "");
    const result = await handleViewDetails({ sender, listingId, session });
    await saveSession(sender, result.nextSession);
    return;
  }

  if (command.startsWith("save_")) {
    console.log(`🔍 [WHATSAPP_BOT] Handling save_ command: ${command}`);
    const listingId = command.replace("save_", "");
    const result = await handleSaveListing({ sender, listingId, session });
    await saveSession(sender, result.nextSession);
    return;
  }

  if (command.startsWith("manage_")) {
    console.log(`🔍 [WHATSAPP_BOT] Handling manage_ command: ${command}`);
    const listingId = command.replace("manage_", "");
    const result = await handleManageSelection({ sender, listingId, session });
    await saveSession(sender, result.nextSession);
    return;
  }

  if (command.startsWith("delete_")) {
    console.log(`🔍 [WHATSAPP_BOT] Handling delete_ command: ${command}`);
    const listingId = command.replace("delete_", "");
    const result = await handleDeleteListing({ sender, listingId, session });
    await saveSession(sender, result.nextSession);
    return;
  }

  if (command === "next_listing") {
    console.log("🔍 [WHATSAPP_BOT] Handling next_listing command");
    const result = await handleNextListing({ sender, session });
    await saveSession(sender, result.nextSession);
    return;
  }

  // ======================================================
  // 🅱️ 4. Greeting → new user → language selection
  // ======================================================
  if (isGreeting && isNewUser) {
    console.log("🔍 [WHATSAPP_BOT] New user greeting");
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
    console.log("🔍 [WHATSAPP_BOT] Returning user greeting");
    session.step = "menu";
    await saveSession(sender, session);
    return sendMainMenu(sender);
  }

  // ======================================================
  // 🅳️ 6. Language selection flow
  // ======================================================
  if (session.awaitingLang || command.startsWith("lang_")) {
    console.log("🔍 [WHATSAPP_BOT] Language selection");
    let lang = "en";
    if (command.startsWith("lang_")) lang = command.split("_")[1];

    await saveUserLanguage(sender, lang);

    session.awaitingLang = false;
    session.step = "menu";
    await saveSession(sender, session);

    return sendMainMenu(sender);
  }

  // ======================================================
  // 🅴️ 7. Menu Options - CRITICAL PATCH HERE
  // ======================================================
  switch (command) {
    case "view_listings": {
      console.log("🎯 [WHATSAPP_BOT] view_listings selected - Calling controller's handleShowListings");
      
      // PATCHED: Use your controller's handleShowListings instead of housingFlow
      try {
        await controllerHandleShowListings(sender, session);
      } catch (error) {
        console.error("❌ [WHATSAPP_BOT] Error in controllerHandleShowListings:", error);
        // Fallback to housingFlow version if controller fails
        console.log("🔄 [WHATSAPP_BOT] Falling back to housingFlow handleShowListings");
        const result = await housingFlowHandleShowListings({
          sender,
          session,
          userLang: userProfile.language || "en"
        });
        await saveSession(sender, result.nextSession);
      }
      return;
    }

    case "post_listing":
      console.log("🔍 [WHATSAPP_BOT] post_listing selected");
      await messageService.sendMessage(
        sender,
        "Send your listing like this:\n\nRahul, Noida Sector 56, 2BHK, 15000, +9199XXXXXXXX, Semi-furnished, near metro"
      );
      session.step = "awaiting_post_details";
      await saveSession(sender, session);
      return;

    case "manage_listings": {
      console.log("🔍 [WHATSAPP_BOT] manage_listings selected");
      
      // PATCHED: Use your controller's handleManageListings
      try {
        await controllerHandleManageListings(sender);
      } catch (error) {
        console.error("❌ [WHATSAPP_BOT] Error in controllerHandleManageListings:", error);
        
        // Fallback to original logic
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
      }
      
      await saveSession(sender, session);
      return;
    }

    case "change_language":
      console.log("🔍 [WHATSAPP_BOT] change_language selected");
      session.awaitingLang = true;
      await saveSession(sender, session);
      return sendLanguageSelection(sender);
  }

  // ======================================================
  // 🅵️ 8. Handle post listing details
  // ======================================================
  if (session.step === "awaiting_post_details") {
    console.log("🔍 [WHATSAPP_BOT] Processing post listing details");
    try {
      const parts = command.split(",").map(p => p.trim());
      
      if (parts.length < 5) {
        await messageService.sendMessage(sender, "Please provide all required fields.");
        return;
      }

      const rawPrice = parts[3].replace(/[^\d]/g, '');
      const price = parseInt(rawPrice);

      const listing = {
        user: sender,
        title: `${parts[0]} - ${parts[2]} Listing`, 
        listingType: parts[2],
        location: parts[1], 
        price: isNaN(price) ? rawPrice : price,
        contact: parts[4],
        description: parts.slice(5).join(", ") || "No additional details provided.",
        createdAt: Date.now()
      };

      await db.collection("listings").add(listing);
      
      await messageService.sendMessage(sender, "🎉 Your listing has been posted!");
      
      session.step = "menu";
      await saveSession(sender, session);
      return sendMainMenu(sender);

    } catch (err) {
      console.error("Error processing listing details:", err);
      await messageService.sendMessage(
        sender,
        "❌ I had trouble parsing those details. Please use the exact format."
      );
      return;
    }
  }

  // ======================================================
  // 🅶️ 9. DEFAULT FALLBACK
  // ======================================================
  console.log(`🔍 [WHATSAPP_BOT] Unknown command: "${command}", showing menu`);
  
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