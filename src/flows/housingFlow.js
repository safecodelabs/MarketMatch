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
 * Routes user input to the appropriate housing flow handler.
 * 
 * @param {"buy"|"sell"|"post"} action
 * @param {string} text
 * @param {object} session
 * @param {object} entities
 * @param {string} userId
 * @returns {Promise<{reply: object, nextSession: object}>}
 */
async function startOrContinue(action, text, session = {}, entities = {}, userId) {
  // Initialize session safely
  session = session && typeof session === "object" ? { ...DEFAULT_SESSION, ...session } : { ...DEFAULT_SESSION };

  // Set current intent
  session.intent = action;
  session.flow = "housing";

  // Merge entities into session data
  session.data = { ...(session.data || {}), ...(entities || {}) };

  // Ensure step is set
  if (!session.step || ["start", "collect"].includes(session.step)) {
    session.step = "collect";
  }

  // Route based on action
  try {
    switch (action) {
      case "buy":
        return await handleBuy(text, session, userId);

      case "sell":
        return await handleSell(text, session, userId);

      case "post":
        return await handlePost(text, session, userId);

      default:
        return {
          reply: {
            type: "text",
            text: {
              body: "I didn't understand that. Please tell me what you are looking for (e.g., '2BHK in Mumbai under 25k')."
            }
          },
          nextSession: session
        };
    }
  } catch (err) {
    console.error("housingFlow error:", err);
    return {
      reply: {
        type: "text",
        text: {
          body: "Oops! Something went wrong. Please try again."
        }
      },
      nextSession: session
    };
  }
}

module.exports = { startOrContinue };
