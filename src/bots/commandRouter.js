// ===== FILE: src/bots/commandRouter.js (Final Patched Version) =====

const { 
  handleShowListings,
  handleNextListing,
  handleViewDetails,
  handleSaveListing
} = require("../flows/housingFlow");

const { startOrContinue } = require('../flows/housingFlow');
const { generateFollowUpQuestion } = require('../ai/aiEngine');
const { getString } = require('../utils/languageStrings');

async function handle(cmd, session = {}, userId, language = "en", payload = {}) {
  // NOTE: Assuming interactive button/list IDs (like VIEW_123, NEXT_LISTING, show_listings)
  // are passed directly as the 'cmd' string from the webhook.
    
  // TEXT COMMAND HANDLING / INTERACTIVE ID HANDLING
  switch (cmd) {

    // 1. Interactive Button Handler: VIEW_
    case (cmd.startsWith("VIEW_") ? cmd : null): {
        const id = cmd.replace("VIEW_", "");
        const flowResult = await handleViewDetails({ sender: userId, listingId: id, session });
        // NOTE: Since flowResult.reply is null or a simple string, we return it.
        return { reply: flowResult.reply, nextSession: flowResult.nextSession || session };
    }

    // 2. Interactive Button Handler: SAVE_
    case (cmd.startsWith("SAVE_") ? cmd : null): {
        const id = cmd.replace("SAVE_", "");
        const flowResult = await handleSaveListing({ sender: userId, listingId: id, session });
        return { reply: flowResult.reply, nextSession: flowResult.nextSession || session };
    }

    // 3. Interactive Button Handler: NEXT_LISTING
    case "next_listing": // Webhook converts to lowercase
    case "NEXT_LISTING": {
        const flowResult = await handleNextListing({ sender: userId, session });
        return { reply: flowResult.reply, nextSession: flowResult.nextSession || session };
    }
    
    // 4. Main Menu/List Commands
    case "show_listings":
    case "listings":
      // handleShowListings sends the message internally, so we extract session and return empty reply
      const listingResult = await handleShowListings({ sender: userId, session, userLang: language });
      return {
        reply: listingResult.reply ? { type: "text", text: { body: listingResult.reply } } : null,
        nextSession: listingResult.nextSession || { ...session, step: "show_listings" }
      };
      
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
      const postSession = await startOrContinue("post", "", session.housingFlow || {}, {}, userId);
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
      const buySession = await startOrContinue("buy", "", session.housingFlow || {}, {}, userId);
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
      const sellSession = await startOrContinue("sell", "", session.housingFlow || {}, {}, userId);
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

function parseCommand(text) {
  if (!text || !text.trim()) return null;
  const t = text.trim().toLowerCase();
    
  if (t === "menu") return "menu";
  if (t === "restart") return "restart";
  if (t.startsWith("view_")) return t; // Return the raw ID for switch case
  if (t.startsWith("save_")) return t; // Return the raw ID for switch case
  if (t === "next_listing") return "NEXT_LISTING"; // Return uppercase for consistency/clarity
  if (t === "listings" || t === "show listings" || t === "show_listings") return "listings"; 
  if (/^post[:\s]/i.test(t)) return "post_command";
  if (t === "buy") return "buy";
  if (t === "sell") return "sell";

  return null;
}

module.exports = { parseCommand, handle };