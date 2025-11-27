// src/flows/housingFlow.js

const { addListing, getAllListings } = require("../../database/firestore");

const DEFAULT_SESSION = {
  flow: "housing",
  step: "start",
  intent: null,
  data: {}
};

/**
 * Main router for all housing actions
 */
async function startOrContinue(action, text, session = {}, entities = {}, userId) {
  session = session && typeof session === "object"
    ? { ...DEFAULT_SESSION, ...session }
    : { ...DEFAULT_SESSION };

  session.intent = action;
  session.flow = "housing";
  session.data = { ...(session.data || {}), ...(entities || {}) };
  session.step = session.step || "collect";

  try {
    switch (action) {
      case "buy":
        return await handleBuy(text, session, userId);

      case "sell":
      case "post":
        return await handlePost(text, session, userId);

      default:
        return {
          reply: {
            type: "text",
            text: { body: "I didn’t understand that. Please tell me what you're looking for." }
          },
          nextSession: session
        };
    }
  } catch (err) {
    console.error("housingFlow error:", err);
    return {
      reply: {
        type: "text",
        text: { body: "Oops! Something went wrong. Try again." }
      },
      nextSession: session
    };
  }
}

/* -----------------------------------
   BUY → Fetch & Filter Firestore data
------------------------------------- */
async function handleBuy(text, session, userId) {
  const filters = {
    category: session.data.property_type || null,
    location: session.data.location || null,
    maxPrice: session.data.budget || null
  };

  const allListings = await getAllListings();
  const listings = filterListings(allListings, filters);

  if (!listings.length) {
    return {
      reply: { type: "text", text: { body: "⚠️ No properties match your criteria." }},
      nextSession: session
    };
  }

  const replyText = listings
    .slice(0, 5)
    .map(item =>
      `${item.property_type || item.type} in ${item.location}\n` +
      `Price: ${item.price}\n` +
      `Contact: ${item.contact}\n` +
      `Description: ${item.description || "N/A"}`
    )
    .join("\n\n");

  return {
    reply: { type: "text", text: { body: replyText }},
    nextSession: session
  };
}

/* -----------------------------------
 SELL / POST → Add listing to Firestore
------------------------------------- */
async function handlePost(text, session, userId) {
  const parts = text.split(",").map(p => p.trim());

  if (parts.length < 6) {
    return {
      reply: {
        type: "text",
        text: {
          body: "⚠️ Provide details in this exact format:\n\nName, Location, Type, Price, Contact, Description"
        }
      },
      nextSession: session
    };
  }

  const [name, location, type, price, contact, description] = parts;

  await addListing({
    title: name,
    location,
    property_type: type,
    price,
    contact,
    description,
    userId,
    createdAt: Date.now()
  });

  return {
    reply: { type: "text", text: { body: "✅ Your property has been posted successfully!" }},
    nextSession: session
  };
}

/* -----------------------------------
 Listing Filter Logic
------------------------------------- */
function filterListings(list, filters) {
  return list.filter(item => {
    if (filters.category && item.property_type?.toLowerCase() !== filters.category.toLowerCase()) {
      return false;
    }
    if (filters.location && item.location?.toLowerCase() !== filters.location.toLowerCase()) {
      return false;
    }
    if (filters.maxPrice && Number(item.price) > Number(filters.maxPrice)) {
      return false;
    }
    return true;
  });
}

module.exports = { startOrContinue };
