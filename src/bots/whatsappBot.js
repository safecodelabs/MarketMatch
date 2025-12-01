// =======================================================
// src/bots/whatsappBot.js (FINAL PATCHED VERSION)
// =======================================================

const { sendMessage, sendList } = require("../services/messageService");
const { getSession, saveSession } = require("../../utils/sessionStore");
const {
  db,
  addListing,
  getAllListings,
  getUserListings,
  getUserProfile,
  saveUserLanguage,
  getTopListings
} = require("../../database/firestore");

const { classify, askAI } = require("../ai/aiEngine");

// =======================================================
// HELPERS
// =======================================================

function menuRows() {
  return [
    { id: "view_listings", title: "View listings" },
    { id: "post_listing", title: "Post listing" },
    { id: "manage_listings", title: "Manage listings" },
    { id: "change_language", title: "Change Language" },
  ];
}

function languageRows() {
  return [
    { id: "lang_en", title: "English" },
    { id: "lang_hi", title: "हिंदी" },
    { id: "lang_ta", title: "தமிழ்" },
    { id: "lang_mr", title: "मराठी" },
  ];
}

async function sendLanguageSelection(sender) {
  return sendList(
    sender,
    "🌐 Select your language",
    "Choose one option:",
    "Select",
    [{ title: "Languages", rows: languageRows() }]
  );
}

async function sendMainMenu(sender) {
  return sendList(
    sender,
    "🏡 MarketMatch AI",
    "Choose an option:",
    "Menu",
    [{ title: "Main Menu", rows: menuRows() }]
  );
}

// =======================================================
// FETCH AND SHOW 3 LISTINGS + FOLLOW-UP PROMPT
// =======================================================
async function handleShowListings(sender) {
  const allListings = await getAllListings(); // fetch all listings
  if (!allListings || allListings.length === 0) {
    await sendMessage(sender, "No listings available at the moment.");
    return;
  }

  const topListings = allListings.slice(0, 3); // get top 3 listings
  const formatted = topListings
    .map((l, i) => {
      return `${i + 1}. ${l.title || "Listing"}\n` +
             `Location: ${l.location || "N/A"}\n` +
             `Price: ${l.price || "N/A"}\n` +
             `Contact: ${l.contact || "N/A"}`;
    })
    .join("\n\n");

  const totalCount = allListings.length;

  const msg = `🏡 Here are some listings:\n\n${formatted}\n\n` +
              `📊 Total listings in database: ${totalCount}\n\n` +
              `Kindly help me with the location and type of property you are looking for (e.g., 2BHK flats in Noida sector 56).`;

  await sendMessage(sender, msg);
}

// =======================================================
// MAIN HANDLER
// =======================================================

async function handleIncomingMessage(sender, msgBody, metadata = {}) {
  if (!sender || !msgBody) return;

  msgBody = msgBody.toString().trim().toLowerCase();

  // Detect LIST REPLY
  if (metadata?.interactive?.type === "list_reply") {
    msgBody = metadata.interactive.list_reply.id.toLowerCase();
  }

  // Load session
  let session =
    (await getSession(sender)) || {
      step: "start",
      isInitialized: false,
      awaitingLang: false,
      housingFlow: { data: {} },
    };

  const userProfile = await getUserProfile(sender);

  const greetings = ["hi", "hello", "hey", "start"];
  const isGreeting = greetings.includes(msgBody);
  const isNewUser = !session.isInitialized;

  // =======================================================
  // 🚀 1️⃣ NEW USER → INTRO + LANGUAGE SELECTION
  // =======================================================
  if (isGreeting && isNewUser) {
    console.log("🆕 NEW USER — Sending intro");

    await sendMessage(
      sender,
      "🤖 MarketMatch AI is a smart, WhatsApp-native marketplace designed to help communities buy, sell, and access reliable local services."
    );

    await sendLanguageSelection(sender);

    session.isInitialized = true;
    session.awaitingLang = true;
    await saveSession(sender, session);
    return;
  }

  // =======================================================
  // 🔁 2️⃣ RETURNING USER → SHOW MAIN MENU
  // =======================================================
  if (isGreeting && !isNewUser) {
    console.log("👋 Returning user — Showing menu");

    session.step = "menu";
    await saveSession(sender, session);

    await sendMainMenu(sender);
    return;
  }

  // =======================================================
  // 🌐 3️⃣ LANGUAGE SELECTION HANDLING
  // =======================================================
  if (session.awaitingLang || msgBody.startsWith("lang_")) {
    let lang = "en";

    if (msgBody.startsWith("lang_")) {
      lang = msgBody.split("_")[1];
    }

    await saveUserLanguage(sender, lang);

    session.awaitingLang = false;
    session.step = "menu";

    await saveSession(sender, session);

    await sendMainMenu(sender);
    return;
  }

  // =======================================================
  // 📌 4️⃣ IF USER IS AWAITING SEARCH QUERY
  // =======================================================
  if (session.step === "awaiting_query") {
    const query = msgBody;
    await sendMessage(sender, `You searched for: *${query}*`);
    // TODO: integrate AI search/filter later
    session.step = "menu";
    await saveSession(sender);
    await sendMainMenu(sender);
    return;
  }

  // =======================================================
  // 📌 5️⃣ MENU ACTIONS
  // =======================================================
  switch (msgBody) {
    case "view_listings":
      await handleShowListings(sender);
      session.step = "menu";
      break;

    case "post_listing":
      await sendMessage(
        sender,
        "Send your listing details in this format:\n\nRahul, Noida Sector 56, 2BHK, 15000, +9199XXXXXXXX, Semi-furnished, near metro"
      );
      session.step = "awaiting_post_details";
      break;

    case "manage_listings":
      const list = await getUserListings(sender);
      if (!list || list.length === 0) {
        await sendMessage(sender, "You have no listings yet.");
      } else {
        const preview = list
          .slice(0, 8)
          .map(
            (l, i) =>
              `${i + 1}. ${l.title || "Listing"} — ${l.location || "N/A"} — ${l.price || "N/A"}`
          )
          .join("\n\n");

        await sendMessage(sender, `Your listings:\n\n${preview}`);
      }
      session.step = "menu";
      break;

    case "change_language":
      session.awaitingLang = true;
      await saveSession(sender, session);
      await sendLanguageSelection(sender);
      break;

    default:
      await sendMessage(
        sender,
        "I didn't understand that. Please choose from the menu."
      );
      await sendMainMenu(sender);
      break;
  }

  await saveSession(sender, session);
}

module.exports = { handleIncomingMessage };