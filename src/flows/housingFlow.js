// src/flows/housingFlow.js
const { handleBuy } = require("./buy.flow");
const { handleSell } = require("./sell.flow");
const { handlePost } = require("./postListing.flow");

const DEFAULT_SESSION = {
  flow: "housing",
  step: "start",
  intent: null,
  data: {}
};

/**
 * startOrContinue(action, text, session, entities, userId)
 * action: "buy" | "sell" | "post"
 */
async function startOrContinue(action, text, session = {}, entities = {}, userId) {
  session = session && typeof session === "object" ? { ...DEFAULT_SESSION, ...session } : { ...DEFAULT_SESSION };

  session.intent = action;
  session.flow = "housing";
  // merge entities into session.data
  session.data = { ...(session.data || {}), ...(entities || {}) };

  // if session.step is start or collecting, route accordingly
  if (!session.step || session.step === "start" || session.step === "collect") {
    session.step = "collect";
  }

  if (action === "buy") {
    return await handleBuy(text, session);
  }

  if (action === "sell") {
    return await handleSell(text, session);
  }

  if (action === "post") {
    return await handlePost(text, session);
  }

  // default fallback
  return {
    reply: { type: "text", text: { body: "Tell me what you are looking for (example: 2BHK in Mumbai under 25k)." } },
    nextSession: session
  };
}

module.exports = { startOrContinue };
