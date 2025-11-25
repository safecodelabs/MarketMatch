// src/flows/housingFlow.js

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

  // Unified flow handlers
  try {
    switch (action) {
      case "buy":
        return handleBuy(text, session);

      case "sell":
        return handleSell(text, session);

      case "post":
        return handlePost(text, session);

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

// -----------------------
// Internal handlers
// -----------------------
function handleBuy(text, session) {
  // Collect or confirm buy details
  if (!session.data.location && !session.data.budget) {
    return {
      reply: {
        type: "text",
        text: { body: "🏠 You're looking to *buy*. Please provide location and budget." }
      },
      nextSession: session
    };
  }

  return {
    reply: {
      type: "text",
      text: { body: `Searching for properties in ${session.data.location || "your area"} under ${session.data.budget || "your budget"}...` }
    },
    nextSession: session
  };
}

function handleSell(text, session) {
  if (!session.data.propertyType && !session.data.location && !session.data.price) {
    return {
      reply: {
        type: "text",
        text: { body: "📤 You want to *sell/rent out* a property. Please provide property type, location and price/rent." }
      },
      nextSession: session
    };
  }

  return {
    reply: {
      type: "text",
      text: { body: `Your listing for ${session.data.propertyType || "property"} in ${session.data.location || "location"} at ${session.data.price || "price"} has been noted.` }
    },
    nextSession: session
  };
}

function handlePost(text, session) {
  if (!text) {
    return {
      reply: {
        type: "text",
        text: { body: "📝 Please send your complete listing:\nExample:\n'2BHK in Noida sector 62, Rent 15k, Contact 9876543210'" }
      },
      nextSession: session
    };
  }

  session.data.listingText = text;

  return {
    reply: {
      type: "text",
      text: { body: "✅ Your listing has been received. Thank you!" }
    },
    nextSession: session
  };
}

module.exports = { startOrContinue };
