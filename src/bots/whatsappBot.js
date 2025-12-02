// Import entire service (fixes missing functions)
const messageService = require("../services/messageService");

// Import the command router to delegate interactive/menu command processing
const commandRouter = require("../router/commandRouter");

// Import housing flow for flow-specific text input handling (e.g., posting a listing)
const housingFlow = require("../flows/housingFlow");

const { getSession, saveSession } = require("../../utils/sessionStore");

// AI (kept, but not used in your core flow)
const { classify, askAI } = require("../ai/aiEngine");

// Firestore helpers (only keep necessary ones, as some are only used in flow files)
const {
  getUserProfile,
  saveUserLanguage,
} = require("../../database/firestore"); // Assuming these are still needed here


// =======================================================
// HELPERS (Menu & Language Options)
// =======================================================

function menuRows() {
  return [
    // IDs changed to match static commands in commandRouter
    { id: "listings", title: "View listings" }, 
    { id: "post_command", title: "Post listing" }, 
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
  // 🌟 1. Extract Interactive Inputs
  // ======================================================
  let rawInput = msgBody;
  let command = msgBody; // Initialize command with text body

  try {
    if (metadata.type === "interactive") {
      const inter = metadata.interactive;

      if (inter.button_reply) {
        command = inter.button_reply.id;
      } else if (inter.list_reply) {
        command = inter.list_reply.id;
      }
    }

    // WhatsApp new formats:
    if (metadata.type === "interactive_response") {
      // Interactive_response is used for quick reply buttons (like the ones on listing cards)
      command = metadata.interactive_response.id; 
    }

    if (metadata.type === "button") {
      command = metadata.button?.payload;
    }
  } catch (e) {
    console.log("⚠️ Interactive parse error:", e);
  }
  
  // Normalize command for comparison (lowercase)
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
  const userLang = userProfile?.language || "en";
  
  const greetings = ["hi", "hello", "hey", "start", "menu"];
  const isGreeting = greetings.includes(command);
  const isNewUser = !session.isInitialized;

  // ⚠️ Removed all manual command handlers (Sections 3 and the switch in 7) 
  // and replaced them with delegation to commandRouter.

  // ======================================================
  // 🅱️ 3. Greeting → new user → language selection
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
  // 🅲️ 4. Returning user greeting → main menu
  // ======================================================
  if (isGreeting && !isNewUser) {
    session.step = "menu";
    await saveSession(sender, session);
    return sendMainMenu(sender);
  }

  // ======================================================
  // 🅳️ 5. Language selection flow
  // ======================================================
  if (session.awaitingLang || command.startsWith("lang_")) {
    let lang = "en";
    
    if (command.startsWith("lang_")) {
        lang = command.split("_")[1];
        await saveUserLanguage(sender, lang);
    }
    
    session.awaitingLang = false;
    session.step = "menu";
    await saveSession(sender, session);

    // If they were awaiting language but didn't send a lang_ command, resend selection.
    if (!command.startsWith("lang_") && !isGreeting) {
        return sendLanguageSelection(sender); 
    }
    
    // If language was successfully set or they sent a greeting, send main menu
    return sendMainMenu(sender);
  }

  // ======================================================
  // 🅴️ 6. Command/Menu Handling (Delegate to Router)
  // ======================================================
  
  // Try to parse/normalize the command (handles prefixes, text-to-command conversion)
  const normalizedCommand = commandRouter.parseCommand(command);

  if (normalizedCommand) {
    // Delegate command execution to the router
    const routerResult = await commandRouter.handle(
      normalizedCommand,
      session,
      sender,
      userLang,
      metadata
    );

    // Update session from router result
    if (routerResult && routerResult.nextSession) {
      await saveSession(sender, routerResult.nextSession);
    }
    
    // Router sends messages directly, so we just return here
    return;
  }
  
  // ======================================================
  // 🅵️ 7. Flow-specific text input handling (Not a command)
  // ======================================================

  // If the user is expected to provide text input (e.g., listing details)
  if (session.step === "awaiting_post_details") {
    // Assuming housingFlow exports this handler to process the raw message body
    // NOTE: handlePostListingInput is assumed to be defined in housingFlow
    const postResult = await housingFlow.handlePostListingInput({
      sender,
      msgBody: rawInput, // Use the raw message body for processing
      session
    });
    
    await saveSession(sender, postResult.nextSession);
    return;
  }


  // ======================================================
  // 🅶️ 8. DEFAULT FALLBACK
  // ======================================================
  await messageService.sendMessage(
    sender,
    "I didn't understand that. Please choose an option from the menu."
  );

  await saveSession(sender, session);
  return sendMainMenu(sender);
}

module.exports = {
  handleIncomingMessage
};