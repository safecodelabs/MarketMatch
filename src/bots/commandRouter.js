const housingFlow = require("../flows/housingFlow"); 
const { startOrContinue } = require("../flows/housingFlow");
const { generateFollowUpQuestion } = require("../ai/aiEngine");
const { getString } = require("../utils/languageStrings");

// Simple action handlers (send their own messages)
const { 
  handleViewDetails: handleViewDetailsAction,
  handleNextListing: handleNextListingAction,
  handleSaveListing: handleSaveListingAction,
} = require("../flows/listingHandlers");


// -----------------------------------------------------------
// MAIN COMMAND HANDLER
// -----------------------------------------------------------
/**
 * Processes a command received from a user, potentially modifying the session state.
 * @param {string} cmd - The normalized command string (e.g., 'view_123', 'menu').
 * @param {object} session - The current user session object.
 * @param {string} userId - The unique identifier for the user.
 * @param {string} language - The user's preferred language code.
 * @param {object} payload - The original message payload (unused in this version).
 * @returns {object} An object containing the reply message (if any) and the updated session.
 */
async function handle(cmd, session = {}, userId, language = "en", payload = {}) {

  // ============================
  // DYNAMIC PREFIX COMMANDS (e.g., from interactive buttons)
  // ============================

  // VIEW_xxxxxxxxx
  if (cmd.startsWith("view_")) {
    const id = cmd.replace("view_", ""); // Command is already lowercased by parseCommand
    await handleViewDetailsAction(userId, id);
    return { reply: null, nextSession: session };
  }

  // SAVE_xxxxxxxxx
  if (cmd.startsWith("save_")) {
    const id = cmd.replace("save_", ""); // Command is already lowercased by parseCommand
    await handleSaveListingAction(userId, id);
    return { reply: null, nextSession: session };
  }

  // DELETE_xxxxxxxxx (complex flow) - These remain UPPERCASE for router consistency
  if (cmd.startsWith("DELETE_")) {
    const id = cmd.replace("DELETE_", "");
    const flowResult = await housingFlow.handleDeleteListing({
      sender: userId,
      listingId: id,
      session
    });
    return { 
      reply: flowResult.reply || null,
      nextSession: flowResult.nextSession || session
    };
  }

  // MANAGE_xxxxxxxxx (complex flow) - These remain UPPERCASE for router consistency
  if (cmd.startsWith("MANAGE_")) {
    const id = cmd.replace("MANAGE_", "");
    const flowResult = await housingFlow.handleManageSelection({
      sender: userId,
      listingId: id,
      session
    });
    return { 
      reply: flowResult.reply || null,
      nextSession: flowResult.nextSession || session
    };
  }

  // NEXT LISTING
  if (cmd === "next_listing") {
    await handleNextListingAction(userId, session);
    return { reply: null, nextSession: session };
  }


  // ---------------------------------------------------------
  // STATIC COMMANDS (MENU / SHOW LISTINGS / BUY / SELL ETC.)
  // ---------------------------------------------------------
  switch (cmd) {

    case "show_listings":
    case "listings": {
      const listingResult = await housingFlow.handleShowListings({
        sender: userId,
        session,
        userLang: language
      });

// If housingFlow already sent the listing card, do NOT send anything else
if (!listingResult.reply) {
  return {
    reply: null,
    nextSession: listingResult.nextSession || { ...session, step: "show_listings" }
  };
}

// If housingFlow returned a text-based reply (e.g., "No listings found")
return {
  reply: { type: "text", text: { body: listingResult.reply } },
  nextSession: listingResult.nextSession || { ...session, step: "show_listings" }
};
    }

    case "menu":
      return {
        reply: {
          type: "text",
          text: { body: getString(language, "menu") }
        },
        nextSession: { ...session, step: "start" }
      };

    case "restart":
      return {
        reply: {
          type: "text",
          text: { body: getString(language, "restart") }
        },
        nextSession: {
          ...session,
          step: "start",
          housingFlow: { step: "start", data: {} }
        }
      };

    case "post_command": {
      const postSession = await startOrContinue(
        "post",
        "",
        session.housingFlow || {},
        {},
        userId
      );

      const question = await generateFollowUpQuestion({
        missing: postSession.missing || [],
        entities: postSession.data || {},
        language
      });

      return {
        reply: {
          type: "text",
          text: { body: question || getString(language, "postPrompt") }
        },
        nextSession: { ...session, housingFlow: postSession }
      };
    }

    case "buy": {
      const buySession = await startOrContinue(
        "buy",
        "",
        session.housingFlow || {},
        {},
        userId
      );

      const buyQuestion = await generateFollowUpQuestion({
        missing: buySession.missing || [],
        entities: buySession.data || {},
        language
      });

      return {
        reply: {
          type: "text",
          text: { body: buyQuestion || getString(language, "buyPrompt") }
        },
        nextSession: { ...session, housingFlow: buySession }
      };
    }

    case "sell": {
      const sellSession = await startOrContinue(
        "sell",
        "",
        session.housingFlow || {},
        {},
        userId
      );

      const sellQuestion = await generateFollowUpQuestion({
        missing: sellSession.missing || [],
        entities: sellSession.data || {},
        language
      });

      return {
        reply: {
          type: "text",
          text: { body: sellQuestion || getString(language, "sellPrompt") }
        },
        nextSession: { ...session, housingFlow: sellSession }
      };
    }

    default:
      return {
        reply: {
          type: "text",
          text: { body: getString(language, "unknownCommand") }
        },
        nextSession: session
      };
  }
}


// -----------------------------------------------------------
// PARSE COMMAND
// -----------------------------------------------------------
/**
 * Parses raw incoming text into a normalized command string.
 * This function also handles interactive button/list replies.
 * @param {string} text - The raw text or button ID.
 * @returns {string | null} The normalized command, or null if no command is detected.
 */
function parseCommand(text) {
  if (!text || !text.trim()) return null;
  const t = text.trim().toLowerCase();

  if (t === "menu") return "menu";
  if (t === "restart") return "restart";

  // Dynamic prefix detection
  // Dynamic button commands (from interactive buttons, IDs are lowercased)
  if (t.startsWith("view_")) return t;
  if (t.startsWith("save_")) return t;

  // manage/delete use text menu, keep uppercase for distinction in router logic
  // These are typically commands coming from list items, which we assume are already normalized
  // but we enforce the prefix check here.
  if (t.startsWith("manage_")) return t.toUpperCase();
  if (t.startsWith("delete_")) return t.toUpperCase();

  // next listing
  if (t === "next_listing") return "next_listing";

  if (t === "listings" || t === "show listings" || t === "show_listings")
    return "listings";

  // NLP command triggers
  if (/^post[:\s]/i.test(t)) return "post_command";
  if (t === "buy") return "buy";
  if (t === "sell") return "sell";

  return null;
}

module.exports = { parseCommand, handle };