// chatbotcontroller.js
const { getSession, saveSession } = require("./utils/sessionStore");
const { getUserProfile, saveUserLanguage } = require("./database/firestore");
const { sendMessage, sendList } = require("./src/services/messageService");

const LANG_ROWS = [
  { id: "lang_en", title: "English" },
  { id: "lang_hi", title: "हिंदी (Hindi)" },
  { id: "lang_ta", title: "தமிழ் (Tamil)" },
  { id: "lang_gu", title: "ગુજરાતી (Gujarati)" },
  { id: "lang_kn", title: "ಕನ್ನಡ (Kannada)" },
];

const MENU_ROWS = [
  { id: "view_listings", title: "View listings" },
  { id: "post_listing", title: "Post listing" },
  { id: "manage_listings", title: "Manage listings" },
  { id: "change_language", title: "Change language" },
];

async function sendLanguageListViaService(to) {
  const sections = [{ title: "Available languages", rows: LANG_ROWS }];
  // sendList(to, headerText, bodyText, footerText, buttonText, sections)
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

function parseLangFromText(text) {
  if (!text) return null;
  const lower = text.toLowerCase().trim();
  if (lower.startsWith("lang_")) return lower.split("lang_")[1];
  // manual typed options
  if (lower.includes("english")) return "en";
  if (lower.includes("hindi") || lower === "hi") return "hi";
  if (lower.includes("tamil") || lower === "ta") return "ta";
  if (lower.includes("gujarati") || lower === "gu") return "gu";
  if (lower.includes("kannada") || lower === "kn") return "kn";
  return null;
}

// main entry used by webhook
// args:
//  - sender (phone number like '919xxxxxxxxx')
//  - text (raw text or interactive id like 'lang_en')
//  - metadata (optional - interactive object from webhook)
//  // NOTE: this controller expects getSession/saveSession to be used by caller; but it can also fetch inside.
async function handleIncomingMessage(sender, text = "", metadata = {}) {
  if (!sender) return;

  // prefer interactive payload id if present
  if (metadata?.interactive?.type === "list_reply") {
    text = metadata.interactive.list_reply.id || text;
  }

  // normalize
  const msg = String(text || "").trim();
  const lower = msg.toLowerCase();

  // fetch session & user profile
  let session = (await getSession(sender)) || { step: "start", housingFlow: { step: "start", data: {} }, isInitialized: false };
  session.housingFlow = session.housingFlow || { step: "start", data: {} };

  const user = await getUserProfile(sender);

  const greetings = ["hi", "hello", "hey", "start"];
  const isGreeting = greetings.includes(lower);
  const isNewUser = !user && !session.isInitialized;

  // 1) New user: intro + language list
  if (isGreeting && isNewUser) {
    await sendMessage(
      sender,
      "👋 *Welcome to MarketMatch AI!* \n\nI’m your personal assistant for:\n🏠 Rentals\n🏢 Real Estate\n👤 PG / Flatmates\n🧹 Home Services\n\nLet's begin by choosing your preferred language."
    );

    // send interactive language list via messageService
    await sendLanguageListViaService(sender);

    // mark session
    session.isInitialized = true;
    session.housingFlow.awaitingLangSelection = true;
    session.step = "awaiting_language";
    await saveSession(sender, session);
    return session;
  }

  // 2) Existing user greeting -> show main menu immediately
  if (isGreeting && !isNewUser) {
    session.step = "menu";
    await saveSession(sender, session);
    await sendMainMenuViaService(sender);
    return session;
  }

  // 3) If awaiting language selection (either interactive or typed)
  if (session.housingFlow?.awaitingLangSelection) {
    const parsed = parseLangFromText(msg);
    if (parsed) {
      try {
        await saveUserLanguage(sender, parsed);
      } catch (err) {
        console.warn("saveUserLanguage failed:", err?.message || err);
      }

      session.housingFlow.awaitingLangSelection = false;
      session.step = "menu";
      await saveSession(sender, session);

      // show main menu after language selection
      await sendMainMenuViaService(sender);
      return session;
    } else {
      // user didn't select valid option — re-send list
      await sendMessage(sender, "Please select a language to continue 👇");
      await sendLanguageListViaService(sender);
      return session;
    }
  }

  // 4) Default: if session not expecting anything, show main menu or handle commands
  // If user sends an explicit menu command (list reply ids are like 'view_listings' etc.)
  const cmd = lower;

  switch (cmd) {
    case "view_listings":
      await sendMessage(sender, "Send me your search query (e.g. `2BHK in Noida sector 56`) and I'll filter results.");
      session.step = "awaiting_query";
      break;

    case "post_listing":
      await sendMessage(sender, "Please send the listing details in this format:\nExample: Rahul, Noida Sector 56, 2BHK, 15000, +9199XXXXXXXX, Semi-furnished, near metro");
      session.step = "awaiting_post_details";
      session.pending = ["title", "location", "property_type", "price", "contact", "description"];
      break;

    case "manage_listings":
      // the heavy lifting about fetching listings should be in your bot file
      // this controller only triggers the listing display flow
      await sendMessage(sender, "Fetching your listings...");
      // your bot layer should call getUserListings etc and then respond
      session.step = "managing";
      break;

    case "change_language":
      session.housingFlow.awaitingLangSelection = true;
      session.step = "awaiting_language";
      await saveSession(sender, session);
      await sendLanguageListViaService(sender);
      break;

    default:
      // show menu if unknown
      await sendMessage(sender, "I didn't understand that. Choose an option or type 'hi' to restart.");
      await sendMainMenuViaService(sender);
      session.step = "menu";
      break;
  }

  await saveSession(sender, session);
  return session;
}

module.exports = {
  handleIncomingMessage,
};
