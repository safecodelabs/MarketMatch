// src/flows/housingFlow.js
const { getHousingData, addHousingLead } = require("../utils/sheets");

const DEFAULT_SESSION = {
  flow: "housing",
  step: "start",
  intent: null,
  data: {}
};

/**
 * startOrContinue(action, text, session, entities, userId)
 * Routes user input to the appropriate housing flow handler.
 * @param {"buy"|"sell"|"post"} action
 * @param {string} text
 * @param {object} session
 * @param {object} entities
 * @param {string} userId
 */
async function startOrContinue(action, text, session = {}, entities = {}, userId) {
  // Initialize session safely
  session = session && typeof session === "object" ? { ...DEFAULT_SESSION, ...session } : { ...DEFAULT_SESSION };
  session.intent = action;
  session.flow = "housing";
  session.data = { ...(session.data || {}), ...(entities || {}) };
  session.step = session.step || "collect";

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
              body: "I didn't understand that. Please tell me what you are looking for (e.g., '2BHK in Delhi under 30k')."
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

// ------------------------
// HANDLERS
// ------------------------

async function handleBuy(text, session, userId) {
  const listings = await getHousingData();

  // Filter listings based on session.entities
  const filtered = listings.filter(item => {
    return (!session.data.property_type || item.property_type.toLowerCase() === session.data.property_type.toLowerCase()) &&
           (!session.data.location || item.location.toLowerCase() === session.data.location.toLowerCase()) &&
           (!session.data.budget || parseInt(item.price) <= parseInt(session.data.budget));
  });

  if (!filtered.length) {
    return {
      reply: {
        type: "text",
        text: { body: "⚠️ No properties match your criteria." }
      },
      nextSession: session
    };
  }

  const replyText = filtered
    .slice(0, 5) // limit results
    .map(f => `${f.property_type} in ${f.location}, Price: ${f.price}, Contact: ${f.contact}`)
    .join("\n\n");

  return {
    reply: {
      type: "text",
      text: { body: replyText }
    },
    nextSession: session
  };
}

async function handleSell(text, session, userId) {
  // Collect info from user
  session.step = "collect";

  return {
    reply: {
      type: "text",
      text: { body: "Please provide your property details in the format: Name, Location, Property Type, Price, Contact, Description" }
    },
    nextSession: session
  };
}

async function handlePost(text, session, userId) {
  // Parse user input
  const parts = text.split(",").map(p => p.trim());
  if (parts.length < 6) {
    return {
      reply: {
        type: "text",
        text: { body: "⚠️ Please provide all details: Name, Location, Property Type, Price, Contact, Description" }
      },
      nextSession: session
    };
  }

  const [name, location, property_type, price, contact, description] = parts;

  await addHousingLead({ name, location, property_type, price, contact, description });

  return {
    reply: {
      type: "text",
      text: { body: "✅ Your property has been posted successfully!" }
    },
    nextSession: session
  };
}

module.exports = { startOrContinue };
