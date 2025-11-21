// src/bots/commandRouter.js
// small router for explicit commands: menu, restart, listings, post, buy, sell

async function handle(cmd, session = {}, userId) {
  switch (cmd) {
    case "menu":
      return {
        reply: {
          type: "text",
          text: { body: "Menu:\n• Type 'Buy' to find houses\n• Type 'Sell' to post a listing\n• Type 'Post:' to post directly\n• Type 'Listings' to view latest" }
        },
        nextSession: { step: "start" }
      };
    case "restart":
      return {
        reply: { type: "text", text: { body: "Session restarted. What do you want to do?\nBuy / Sell / Post" } },
        nextSession: { step: "start" }
      };
    case "listings":
      return {
        reply: { type: "text", text: { body: "Please type location or say 'Show me listings' to get latest properties." } },
        nextSession: { step: "start" }
      };
    default:
      return {
        reply: { type: "text", text: { body: "Unknown command" } },
        nextSession: session
      };
  }
}

function parseCommand(text) {
  if (!text || !text.trim()) return null;
  const t = text.trim().toLowerCase();
  if (t === "menu") return "menu";
  if (t === "restart") return "restart";
  if (t === "listings" || t === "show listings") return "listings";
  if (/^post[:\s]/i.test(t)) return "post_command";
  if (t === "buy") return "buy";
  if (t === "sell") return "sell";
  return null;
}

module.exports = { parseCommand, handle };
