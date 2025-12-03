
// -----------------------------------------------------------
// MAIN COMMAND HANDLER
// -----------------------------------------------------------
async function handle(cmd, session = {}, userId, language = "en", payload = {}) {
  console.log(`🤖 CommandRouter.handle called with cmd: "${cmd}"`);

  // ============================
  // DYNAMIC PREFIX COMMANDS - SIMPLIFIED
  // ============================

  // VIEW_xxxxxxxxx
  if (cmd.startsWith("view_")) {
    console.log(`🔍 Would handle view command for ID: ${cmd}`);
    // Just return without doing anything for now
    return { reply: null, nextSession: session };
  }

  // SAVE_xxxxxxxxx
  if (cmd.startsWith("save_")) {
    console.log(`💾 Would handle save command for ID: ${cmd}`);
    return { reply: null, nextSession: session };
  }

  // DELETE_xxxxxxxxx
  if (cmd.startsWith("DELETE_")) {
    console.log(`🗑️ Would handle delete command for ID: ${cmd}`);
    return { 
      reply: { type: "text", text: { body: "Delete functionality not available yet." } },
      nextSession: session
    };
  }

  // MANAGE_xxxxxxxxx
  if (cmd.startsWith("MANAGE_")) {
    console.log(`⚙️ Would handle manage command for ID: ${cmd}`);
    return { 
      reply: { type: "text", text: { body: "Manage functionality not available yet." } },
      nextSession: session
    };
  }

  // NEXT LISTING
  if (cmd === "next_listing") {
    console.log("⏭️ Would handle next listing command");
    return { 
      reply: { type: "text", text: { body: "Next listing functionality not available yet." } },
      nextSession: session
    };
  }

  // ---------------------------------------------------------
  // STATIC COMMANDS (MENU / SHOW LISTINGS / BUY / SELL ETC.)
  // ---------------------------------------------------------
  switch (cmd) {
    case "menu":
      console.log("📱 Handling menu command");
      return {
        reply: {
          type: "text",
          text: { body: "Main Menu: Type 'view_listings', 'post_listing', 'manage_listings', or 'change_language'" }
        },
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
      return {
        reply: {
          type: "text",
          text: { body: "Please provide listing details: title, location, type, price, and contact." }
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

  // Simple menu commands (kept minimal)
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