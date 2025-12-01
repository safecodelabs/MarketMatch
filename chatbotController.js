// ========================================
// IMPORTS
// ========================================
const { getSession, saveSession } = require("./utils/sessionStore");
const { 
  getUserProfile, 
  saveUserLanguage,
  getTopListings
} = require("./database/firestore");

const { sendMessage, sendList } = require("./src/services/messageService");
const { db } = require("./database/firestore");   // <-- required for flow submission



// ========================================
// FLOW SUBMISSION HANDLER
// ========================================
async function handleFlowSubmission(metadata, sender) {
  if (
    metadata?.type === "interactive" &&
    metadata?.interactive?.type === "flow_submission"
  ) {
    const data = metadata.interactive.data;

    await db.collection("listings").add({
      user: sender,
      title: data.title,
      type: data.listingType,
      bhk: data.bhk,
      location: data.location,
      price: data.price,
      contact: data.contact,
      createdAt: Date.now()
    });

    await sendMessage(sender, "🎉 Your listing has been posted successfully!");
    return true; // stop further processing
  }

  return false;
}



// ========================================
// LIST MESSAGE DATA
// ========================================
const LANG_ROWS = [
  { id: "lang_en", title: "English" },
  { id: "lang_hi", title: "हिंदी (Hindi)" },
  { id: "lang_ta", title: "தமிழ் (Tamil)" },
  { id: "lang_gu", title: "ગુજરાતી (Gujarati)" },
  { id: "lang_kn", title: "ಕನ್ನಡ (Kannada)" },
];

const MENU_ROWS = [
  { id: "view_listings", title: "View Listings" },
  { id: "post_listing", title: "Post Listing" },
  { id: "manage_listings", title: "Manage Listings" },
  { id: "change_language", title: "Change Language" },
];



// ========================================
// SEND LIST HELPERS
// ========================================
async function sendLanguageListViaService(to) {
  const sections = [{ title: "Available languages", rows: LANG_ROWS }];
  return sendList(
    to,
    "🌐 Select your preferred language",
    "Choose one option from below:",
    "MarketMatch AI",
    "Select Language",
    sections
  );
}

async function sendMainMenuViaService(to) {
  const sections = [{ title: "Menu", rows: MENU_ROWS }];
  return sendList(
    to,
    "🏡 MarketMatch AI",
    "Choose an option:",
    "MarketMatch AI",
    "Select an option",
    sections
  );
}



// ========================================
// PARSE LANGUAGE TYPED INPUT
// ========================================
function parseLangFromText(text) {
  if (!text) return null;
  const lower = text.toLowerCase().trim();

  if (lower.startsWith("lang_")) return lower.split("lang_")[1];

  if (lower.includes("english")) return "en";
  if (lower.includes("hindi") || lower === "hi") return "hi";
  if (lower.includes("tamil") || lower === "ta") return "ta";
  if (lower.includes("gujarati") || lower === "gu") return "gu";
  if (lower.includes("kannada") || lower === "kn") return "kn";

  return null;
}



// ========================================
// SHOW TOP LISTINGS
// ========================================
async function handleShowListings(sender) {
  try {
    const { listings, totalCount } = await getTopListings();

    if (!listings.length) {
      return sendMessage(sender, "No listings available right now.");
    }

    let txt = "🏘️ *Top Listings*\n\n";
    listings.forEach((l, i) => {
      txt += `*${i + 1}. ${l.title || "Untitled"}*\n`;
      txt += `${l.location || "Location not provided"}\n`;
      txt += `Price: ₹${l.price || "N/A"}\n`;
      txt += "-------------------------\n";
    });

    await sendMessage(sender, txt);

    await sendMessage(
      sender,
      `📦 We currently have a total of *${totalCount}* listings saved in our database.`
    );

    await sendMessage(
      sender,
      "To find the best match, kindly tell me the *location* and *type of property* you want.\n\nExample: *2BHK flats in Noida Sector 56*"
    );

  } catch (err) {
    console.error("Error in handleShowListings:", err);
    await sendMessage(sender, "❌ Unable to fetch listings right now.");
  }
}



// ========================================
// MAIN CONTROLLER
// ========================================
async function handleIncomingMessage(sender, text = "", metadata = {}) {
  if (!sender) return;

  // ===========================
  // 0) PRIORITY: CHECK FLOW SUBMISSION
  // ===========================
  const flowHandled = await handleFlowSubmission(metadata, sender);
  if (flowHandled) return; // stop further logic, flow form already handled



  // prefer list_reply id for menu selection
  if (metadata?.interactive?.type === "list_reply") {
    text = metadata.interactive.list_reply.id || text;
  }

  const msg = String(text || "").trim();
  const lower = msg.toLowerCase();

  // session
  let session = (await getSession(sender)) || { 
    step: "start",
    housingFlow: { step: "start", data: {} },
    isInitialized: false
  };

  const user = await getUserProfile(sender);

  const greetings = ["hi", "hello", "hey", "start"];
  const isGreeting = greetings.includes(lower);
  const isNewUser = !user && !session.isInitialized;



  // ===========================
  // 1) NEW USER INTRO
  // ===========================
  if (isGreeting && isNewUser) {
    await sendMessage(
      sender,
      "👋 *Welcome to MarketMatch AI!* \n\nI’m your personal assistant for:\n🏠 Rentals\n🏢 Real Estate\n👤 PG / Flatmates\n🧹 Home Services\n\nLet's begin by choosing your preferred language."
    );

    await sendLanguageListViaService(sender);

    session.isInitialized = true;
    session.housingFlow.awaitingLangSelection = true;
    session.step = "awaiting_language";
    await saveSession(sender, session);
    return session;
  }



  // ===========================
  // 2) EXISTING USER GREETING
  // ===========================
  if (isGreeting && !isNewUser) {
    session.step = "menu";
    await saveSession(sender, session);
    await sendMainMenuViaService(sender);
    return session;
  }



  // ===========================
  // 3) LANGUAGE SELECTION
  // ===========================
  if (session.housingFlow?.awaitingLangSelection) {
    const parsed = parseLangFromText(msg);

    if (parsed) {
      try {
        await saveUserLanguage(sender, parsed);
      } catch (err) {
        console.warn("saveUserLanguage error:", err);
      }

      session.housingFlow.awaitingLangSelection = false;
      session.step = "menu";
      await saveSession(sender, session);

      await sendMainMenuViaService(sender);
      return session;
    } else {
      await sendMessage(sender, "Please select a language 👇");
      await sendLanguageListViaService(sender);
      return session;
    }
  }



  // ===========================
  // 4) MENU COMMAND HANDLING
  // ===========================
  switch (lower) {
    case "view_listings":
      await handleShowListings(sender);
      session.step = "awaiting_query";
      break;

    case "post_listing":
      await sendMessage(
        sender,
        "Please send the listing details in this format:\nExample: Rahul, Noida Sector 56, 2BHK, 15000, +9199XXXXXXXX, Semi-furnished, near metro"
      );
      session.step = "awaiting_post_details";
      session.pending = ["title", "location", "property_type", "price", "contact", "description"];
      break;

    case "manage_listings":
      await sendMessage(sender, "Fetching your listings...");
      session.step = "managing";
      break;

    case "change_language":
      session.housingFlow.awaitingLangSelection = true;
      session.step = "awaiting_language";
      await saveSession(sender, session);
      await sendLanguageListViaService(sender);
      break;

    default:
      await sendMessage(sender, "I didn't understand that. Choose an option or type *hi* to restart.");
      await sendMainMenuViaService(sender);
      session.step = "menu";
      break;
  }

  await saveSession(sender, session);
  return session;
}



// ========================================
module.exports = {
  handleIncomingMessage,
};
