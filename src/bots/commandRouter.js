// Import the core housing flow logic (including state management, and complex functions)
const housingFlow = require("../flows/housingFlow"); 
const { startOrContinue } = require('../flows/housingFlow');
const { generateFollowUpQuestion } = require('../ai/aiEngine');
const { getString } = require('../utils/languageStrings');

// Import the dedicated, simple handlers for the listing *actions* // (which send the message directly using the new list card design).
const { 
  handleViewDetails: handleViewDetailsAction,
  handleNextListing: handleNextListingAction,
  handleSaveListing: handleSaveListingAction,
} = require("../flows/listingHandlers");


async function handle(cmd, session = {}, userId, language = "en", payload = {}) {
  // NOTE: Interactive button/list IDs (like VIEW_123, NEXT_LISTING, show_listings)
  // are passed directly as the 'cmd' string from the webhook.
    
  // TEXT COMMAND HANDLING / INTERACTIVE ID HANDLING
  switch (cmd) {

    // 1. Interactive List Handler: VIEW_ (Calls simple handler, which sends the reply)
    case (cmd.startsWith("VIEW_") ? cmd : null): {
        const id = cmd.replace("VIEW_", "");
        // Call the simple handler, which sends the message directly
        await handleViewDetailsAction(userId, id); 
        // Return null reply, as the message is already sent
        return { reply: null, nextSession: session };
    }

    // 2. Interactive List Handler: SAVE_ (Calls simple handler, which sends the reply)
    case (cmd.startsWith("SAVE_") ? cmd : null): {
        const id = cmd.replace("SAVE_", "");
        // Call the simple handler, which sends the message directly
        await handleSaveListingAction(userId, id); 
        // Return null reply, as the message is already sent
        return { reply: null, nextSession: session };
    }

    // 3. Interactive List Handler: DELETE_ (New for Management, assuming complex flow structure)
    case (cmd.startsWith("DELETE_") ? cmd : null): {
        const id = cmd.replace("DELETE_", "");
        // Assuming this flow function is complex and handles its own reply/session updates
        const flowResult = await housingFlow.handleDeleteListing({ sender: userId, listingId: id, session }); 
        return { reply: flowResult.reply, nextSession: flowResult.nextSession || session };
    }

    // 4. Interactive List Handler: MANAGE_ (New for Management Selection, assuming complex flow structure)
    case (cmd.startsWith("MANAGE_") ? cmd : null): {
        const id = cmd.replace("MANAGE_", "");
        // Assuming this flow function is complex and handles its own reply/session updates
        const flowResult = await housingFlow.handleManageSelection({ sender: userId, listingId: id, session }); 
        return { reply: flowResult.reply, nextSession: flowResult.nextSession || session };
    }
    
    // 5. Interactive List Handler: NEXT_LISTING (Calls simple handler, which sends the reply)
    case "next_listing": // Webhook converts to lowercase
    case "NEXT_LISTING": {s
        // Call the simple handler, which sends the message directly
        await handleNextListingAction(userId); 
        // Return null reply, as the message is already sent
        return { reply: null, nextSession: session };
    }
    
    // 6. Main Menu/List Commands (assuming complex flow structure)
    // Note: handleShowListings must also be imported from housingFlow
    case "show_listings":
    case "listings":
      // handleShowListings sends the message internally, so we extract session and return empty reply
      const listingResult = await housingFlow.handleShowListings({ sender: userId, session, userLang: language });
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
  
  // Check for dynamic commands (VIEW_, SAVE_, MANAGE_, DELETE_)
  if (t.startsWith("view_")) return t.toUpperCase(); 
  if (t.startsWith("save_")) return t.toUpperCase();
  if (t.startsWith("manage_")) return t.toUpperCase(); // New management selection command
  if (t.startsWith("delete_")) return t.toUpperCase(); // New deletion command
  
  if (t === "next_listing") return "NEXT_LISTING"; // Return uppercase for consistency/clarity
  if (t === "listings" || t === "show listings" || t === "show_listings") return "listings"; 
  if (/^post[:\s]/i.test(t)) return "post_command";
  if (t === "buy") return "buy";
  if (t === "sell") return "sell";

  return null;
}

module.exports = { parseCommand, handle };