const housingFlow = require("../flows/housingFlow"); 
const { startOrContinue } = require("../flows/housingFlow");
const { generateFollowUpQuestion } = require("../ai/aiEngine");
const { getString } = require("../../utils/languageStrings");

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
  console.log(`🤖 CommandRouter.handle called with cmd: "${cmd}"`);

  // ============================
  // DYNAMIC PREFIX COMMANDS
  // ============================

  // VIEW_xxxxxxxxx
  if (cmd.startsWith("view_")) {
    console.log(`🔍 Handling view command for ID: ${cmd}`);
    const id = cmd.replace("view_", "");
    await handleViewDetailsAction(userId, id);
    return { reply: null, nextSession: session };
  }

  // SAVE_xxxxxxxxx
  if (cmd.startsWith("save_")) {
    console.log(`💾 Handling save command for ID: ${cmd}`);
    const id = cmd.replace("save_", "");
    await handleSaveListingAction(userId, id);
    return { reply: null, nextSession: session };
  }

  // DELETE_xxxxxxxxx
  if (cmd.startsWith("DELETE_")) {
    console.log(`🗑️ Handling delete command for ID: ${cmd}`);
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

  // MANAGE_xxxxxxxxx
  if (cmd.startsWith("MANAGE_")) {
    console.log(`⚙️ Handling manage command for ID: ${cmd}`);
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
    console.log("⏭️ Handling next listing command");
    await handleNextListingAction(userId, session);
    return { reply: null, nextSession: session };
  }


  // ---------------------------------------------------------
  // STATIC COMMANDS (MENU / SHOW LISTINGS / BUY / SELL ETC.)
  // ---------------------------------------------------------
  switch (cmd) {
    // ⚠️ REMOVED: "listings" command - this was causing the conflict!
    // The controller should handle "view_listings" menu item directly
    // case "listings": {
    //   console.log("🏠 CommandRouter: listings command intercepted - THIS IS THE PROBLEM!");
    //   const listingResult = await housingFlow.handleShowListings({
    //     sender: userId,
    //     session,
    //     userLang: language
    //   });
    // 
    //   if (!listingResult.reply) {
    //     return {
    //       reply: null,
    //       nextSession: listingResult.nextSession || { ...session, step: "show_listings" }
    //     };
    //   }
    // 
    //   return {
    //     reply: { type: "text", text: { body: listingResult.reply } },
    //     nextSession: listingResult.nextSession || { ...session, step: "show_listings" }
    //   };
    // }

    case "menu":
      console.log("📱 Handling menu command");
      return {
        reply: {
          type: "text",
          text: { body: getString(language, "menu") }
        },
        nextSession: { ...session, step: "start" }
      };

    case "restart":
      console.log("🔄 Handling restart command");
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
      console.log("📝 Handling post_command (NLP trigger)");
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
      console.log("💰 Handling buy command (NLP trigger)");
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
      console.log("🏷️ Handling sell command (NLP trigger)");
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
      console.log(`❓ CommandRouter: Unknown command "${cmd}"`);
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
// PARSE COMMAND - FIXED VERSION
// -----------------------------------------------------------
function parseCommand(text) {
  if (!text || !text.trim()) return null;
  const t = text.trim().toLowerCase();

  console.log(`🔍 CommandRouter.parseCommand analyzing: "${t}"`);

  // ⚠️ REMOVED menu items - let controller handle them
  // if (t === "menu") return "menu"; // REMOVED
  // if (t === "restart") return "restart"; // REMOVED

  // Dynamic commands only - these should be handled by router
  if (t.startsWith("view_")) {
    console.log(`✅ Router: Matched view_ prefix command: ${t}`);
    return t;
  }
  
  if (t.startsWith("save_")) {
    console.log(`✅ Router: Matched save_ prefix command: ${t}`);
    return t;
  }
  
  if (t.startsWith("manage_")) {
    console.log(`✅ Router: Matched manage_ prefix command: ${t}`);
    return t.toUpperCase();
  }
  
  if (t.startsWith("delete_")) {
    console.log(`✅ Router: Matched delete_ prefix command: ${t}`);
    return t.toUpperCase();
  }

  if (t === "next_listing") {
    console.log("✅ Router: Matched next_listing command");
    return "next_listing";
  }

  // ⚠️ CRITICAL: REMOVE these lines that were catching menu items
  // This was causing "view_listings" to be intercepted by router!
  // if (
  //   t === "listings" ||
  //   t === "show listings" ||
  //   t === "show_listings" ||
  //   t === "view_listings"  // ⚠️ THIS WAS THE CULPRIT!
  // ) {
  //   console.log(`❌ Router: INTERCEPTING menu item "${t}" - THIS IS WRONG!`);
  //   return "listings";
  // }

  // ⚠️ REMOVED: NLP triggers that overlap with menu - let controller handle them
  // if (/^post[:\s]/i.test(t)) return "post_command"; // REMOVED
  // if (t === "buy") return "buy"; // REMOVED
  // if (t === "sell") return "sell"; // REMOVED

  console.log(`❌ Router: No match for "${t}" - returning null`);
  return null;
}

module.exports = { parseCommand, handle };