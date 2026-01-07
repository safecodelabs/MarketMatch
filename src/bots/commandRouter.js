// -----------------------------------------------------------
// MAIN COMMAND HANDLER
// -----------------------------------------------------------
async function handle(cmd, session = {}, userId, language = "en", payload = {}) {
  console.log(`🤖 CommandRouter.handle called with cmd: "${cmd}"`);

  // ============================
  // DYNAMIC PREFIX COMMANDS
  // ============================

  if (cmd.startsWith("view_")) {
    console.log(`🔍 Would handle view command for ID: ${cmd}`);
    return { reply: null, nextSession: session };
  }

  if (cmd.startsWith("save_")) {
    console.log(`💾 Would handle save command for ID: ${cmd}`);
    return { reply: null, nextSession: session };
  }

  if (cmd.startsWith("DELETE_")) {
    console.log(`🗑️ Would handle delete command for ID: ${cmd}`);
    return { 
      reply: { type: "text", text: { body: "Delete functionality not available yet." } },
      nextSession: session
    };
  }

  if (cmd.startsWith("MANAGE_")) {
    console.log(`⚙️ Would handle manage command for ID: ${cmd}`);
    return { 
      reply: { type: "text", text: { body: "Manage functionality not available yet." } },
      nextSession: session
    };
  }

  if (cmd === "next_listing") {
    console.log("⏭️ Would handle next listing command");
    return { 
      reply: { type: "text", text: { body: "Next listing functionality not available yet." } },
      nextSession: session
    };
  }

  // ---------------------------------------------------------
  // STATIC COMMANDS
  // ---------------------------------------------------------
  switch (cmd) {

    // ⭐ NEW FIX — TRUE /menu HANDLING ⭐
    case "menu":
      console.log("📱 Handling menu command (interactive list trigger)");
      return {
        reply: { action: "show_menu_list" },   // <-- controller now catches this!
        nextSession: { ...session, step: "start" }
      };

    case "restart":
      console.log("🔄 Handling restart command");
      return {
        reply: {
          type: "text",
          text: { body: "Bot restarted! Type 'hi' to begin." }
        },
        nextSession: {
          ...session,
          step: "start",
          housingFlow: { step: "start", data: {} }
        }
      };

    case "post_command":
      console.log("📝 Handling post_command");
      const prompt = require('../../utils/multiLanguage').getMessageForUser(userId, 'prompt_provide_listing_details');
      return {
        reply: {
          type: "text",
          text: { body: prompt }
        },
        nextSession: session
      };

    case "buy":
      console.log("💰 Handling buy command");
      return {
        reply: {
          type: "text",
          text: { body: "What type of property are you looking for?" }
        },
        nextSession: session
      };

    case "sell":
      console.log("🏷️ Handling sell command");
      return {
        reply: {
          type: "text",
          text: { body: "Tell me about the property you want to sell." }
        },
        nextSession: session
      };

    default:
      console.log(`❓ CommandRouter: Unknown command "${cmd}"`);
      return {
        reply: {
          type: "text",
          text: { body: "I didn't understand that command. Please try again." }
        },
        nextSession: session
      };
  }
}

// -----------------------------------------------------------
// PARSE COMMAND - SIMPLIFIED VERSION
// -----------------------------------------------------------
function parseCommand(text) {
  if (!text || !text.trim()) return null;

  const t = text.trim().toLowerCase();
  console.log(`🔍 CommandRouter.parseCommand analyzing: "${t}"`);

  // Dynamic commands
  if (t.startsWith("view_")) return t;
  if (t.startsWith("save_")) return t;
  if (t.startsWith("manage_")) return t.toUpperCase();
  if (t.startsWith("delete_")) return t.toUpperCase();
  if (t === "next_listing") return "next_listing";

  // ⭐ FIXED: Menu commands mapping ⭐
  if (t === "/menu") return "menu";
  if (t === "menu") return "menu";

  if (t === "restart") return "restart";

  // NLP triggers
  if (/^post[:\s]/i.test(t)) return "post_command";
  if (t === "buy") return "buy";
  if (t === "sell") return "sell";

  console.log(`❌ Router: No match for "${t}" - returning null`);
  return null;
}

module.exports = { parseCommand, handle };
