// ===== FILE: src/bots/commandRouter.js =====

const { 
  handleShowListings,
  handleNextListing,
  handleViewDetails,
  handleSaveListing
} = require("../flows/housingFlow");

const { startOrContinue } = require('../flows/housingFlow');
const { generateFollowUpQuestion } = require('../ai/aiEngine');
const { getString } = require('../utils/languageStrings');

async function handle(cmd, session = {}, userId, language = "en", payload = {}) {
  // HANDLE INTERACTIVE BUTTONS
  if (payload?.buttonId) {
    const btn = payload.buttonId;

    if (btn.startsWith("VIEW_")) {
      const id = btn.replace("VIEW_", "");
      return await handleViewDetails({ sender: userId, listingId: id, session });
    }

    if (btn.startsWith("SAVE_")) {
      const id = btn.replace("SAVE_", "");
      return await handleSaveListing(userId, id);
    }

    if (btn === "NEXT_LISTING") {
      return await handleNextListing(userId);
    }
  }

  // TEXT COMMAND HANDLING
  switch (cmd) {

    case "menu":
      return {
        reply: {
          type: "text",
          text: { body: getString(language, "menu") }
        },
        nextSession: { ...session, step: "start" }
      };

    case "restart":
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

    case "listings":
      // Trigger new card listing flow
      await handleShowListings(userId);
      return {
        reply: null,
        nextSession: { ...session, step: "show_listings" }
      };

    case "post_command": {
      const postSession = await startOrContinue("post", "", session.housingFlow || {}, {}, userId);
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
      const buySession = await startOrContinue("buy", "", session.housingFlow || {}, {}, userId);
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
      const sellSession = await startOrContinue("sell", "", session.housingFlow || {}, {}, userId);
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
      return {
        reply: {
          type: "text",
          text: { body: getString(language, "unknownCommand") }
        },
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



// ===== FILE: src/flows/housingFlow.js =====

const { sendMessage } = require("../services/messageService");
const { saveUserSession, getUserSession } = require("../utils/sessionStore");
const {
  getAllListings,
  getListingById,
  saveSavedListing
} = require("../../database/listings");

// ------------------------------
// SHOW 1ST LISTING
// ------------------------------
async function handleShowListings(sender) {
  const all = await getAllListings(20);
  if (!all || all.length === 0) {
    await sendMessage(sender, "No listings available right now.");
    return;
  }

  await saveUserSession(sender, { listingIndex: 0 });
  await sendListingCard(sender, all[0]);
}

// ------------------------------
// SEND CARD
// ------------------------------
async function sendListingCard(sender, listing) {
  const text =
    `🏡 ${listing.title || "Property"}\n` +
    `💰 Rent: ₹${listing.price || "N/A"}\n` +
    `📍 ${listing.location || "N/A"}\n` +
    `📏 Area: ${listing.area || "N/A"}\n` +
    `🛋 ${listing.furnishing || "N/A"}`;

  const payload = {
    messaging_product: "whatsapp",
    to: sender,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text },
      action: {
        buttons: [
          {
            type: "reply",
            reply: { id: `VIEW_${listing.id}`, title: "View Details" }
          },
          {
            type: "reply",
            reply: { id: `SAVE_${listing.id}`, title: "Save ❤️" }
          },
          {
            type: "reply",
            reply: { id: "NEXT_LISTING", title: "Next ➡" }
          }
        ]
      }
    }
  };

  await sendMessage(sender, payload, true);
}

// ------------------------------
// NEXT LISTING
// ------------------------------
async function handleNextListing(sender) {
  const sess = await getUserSession(sender);
  let index = sess?.listingIndex || 0;

  const all = await getAllListings(20);
  if (all.length === 0) return sendMessage(sender, "No more listings.");

  index = index + 1;
  if (index >= all.length) index = 0;

  await saveUserSession(sender, { listingIndex: index });
  await sendListingCard(sender, all[index]);
}

// ------------------------------
// VIEW DETAILS
// ------------------------------
async function handleViewDetails(sender, listingId) {
  const l = await getListingById(listingId);
  if (!l) return sendMessage(sender, "Listing not found.");

  const msg =
    `🏡 *${l.title}*\n\n` +
    `📍 Location: ${l.location}\n` +
    `💰 Price: ₹${l.price}\n` +
    `📏 Area: ${l.area}\n` +
    `🛋 Furnishing: ${l.furnishing}\n` +
    `☎ Contact: ${l.contact}\n\n` +
    `${l.description || ""}`;

  await sendMessage(sender, msg);
}

// ------------------------------
// SAVE LISTING
// ------------------------------
async function handleSaveListing(sender, listingId) {
  await saveSavedListing(sender, listingId);
  await sendMessage(sender, "❤️ Listing saved!");
}

module.exports = {
  handleShowListings,
  handleNextListing,
  handleViewDetails,
  handleSaveListing
};
