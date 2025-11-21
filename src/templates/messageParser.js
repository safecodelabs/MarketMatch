// src/bots/messageParser.js
const { classify } = require("../ai/aiEngine");

/**
 * parseMessage(text)
 * Returns { intent, entities }
 * wrapper around aiEngine.classify for consistent shape
 */
async function parseMessage(text) {
  try {
    const result = await classify(text);
    // ensure shape
    return {
      intent: result.intent || "unknown",
      entities: result.entities || {}
    };
  } catch (err) {
    console.error("parseMessage error:", err?.message || err);
    return { intent: "unknown", entities: {} };
  }
}

module.exports = { parseMessage };
