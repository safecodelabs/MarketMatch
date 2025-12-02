// Import the core housing flow logic (complex flows)
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
async function handle(cmd, session = {}, userId, language = "en", payload = {}) {

  // ============================
  // DYNAMIC PREFIX COMMANDS
  // ============================

  // VIEW_xxxxxxxxx
  if (cmd.startsWith("VIEW_")) {
    const id = cmd.replace("VIEW_", "");
    await handleViewDetailsAction(userId, id);
    return { reply: null, nextSession: session };
  }

  // SAVE_xxxxxxxxx
  if (cmd.startsWith("SAVE_")) {
    const id = cmd.replace("SAVE_", "");
    await handleSaveListingAction(userId, id);
    return { reply: null, nextSession: session };
  }

  // DELETE_xxxxxxxxx (complex flow)
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

  // MANAGE_xxxxxxxxx (complex flow)
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
  if (cmd === "NEXT_LISTING" || cmd === "next_listing") {
    await handleNextListingAction(userId);
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

      return {
        reply: listingResult.reply
          ? { type: "text", text: { body: listingResult.reply } }
          : null,
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
function parseCommand(text) {
  if (!text || !text.trim()) return null;
  const t = text.trim().toLowerCase();

  if (t === "menu") return "menu";
  if (t === "restart") return "restart";

  // Dynamic prefix detection
  if (t.startsWith("view_")) return t.toUpperCase();
  if (t.startsWith("save_")) return t.toUpperCase();
  if (t.startsWith("manage_")) return t.toUpperCase();
  if (t.startsWith("delete_")) return t.toUpperCase();

  if (t === "next_listing") return "NEXT_LISTING";
  if (t === "listings" || t === "show listings" || t === "show_listings")
    return "listings";

  if (/^post[:\s]/i.test(t)) return "post_command";
  if (t === "buy") return "buy";
  if (t === "sell") return "sell";

  return null;
}

module.exports = { parseCommand, handle };
