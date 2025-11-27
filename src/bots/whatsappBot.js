const { sendMessage, sendButtons } = require('../services/messageService');
const { startOrContinue } = require('../flows/housingFlow');
const { getSession, saveSession } = require('../utils/sessionStore');
const { classify, generateFollowUpQuestion } = require('../ai/aiEngine');
const { getAllListings, db } = require('../../database/firestore');
const { getString } = require('../utils/languageStrings');

/**
 * Helper: send translated text
 */
async function sendTranslated(sender, key, lang, extra = "") {
  const text = getString(lang, key);
  return sendMessage(sender, extra ? `${text}\n${extra}` : text);
}

/**
 * Helper: get user profile
 */
async function getUserProfile(sender) {
  const doc = await db.collection('users').doc(sender).get();
  return doc.exists ? doc.data() : null;
}

/**
 * Helper: save user language preference
 */
async function saveUserLanguage(sender, lang) {
  await db.collection('users').doc(sender).set(
    { preferredLanguage: lang },
    { merge: true }
  );
}

/**
 * Main entry for incoming WhatsApp messages
 */
async function handleIncomingMessage(sender, msgBody) {
  if (!sender || !msgBody) return;

  msgBody = msgBody.trim();
  
  // Load session
  let session = await getSession(sender) || { housingFlow: { step: "start" } };
  const userProfile = await getUserProfile(sender);
  const userLang = userProfile?.preferredLanguage || "en";

  console.log("📨 Incoming:", msgBody);
  console.log("📌 Current Session:", session);

  // --- Handle /start ---
  if (msgBody.toLowerCase() === "/start") {
    if (!userProfile?.preferredLanguage) {
      // Ask user to select language with buttons
      await sendButtons(sender, "Select your language:", [
        { id: "lang_en", title: "English" },
        { id: "lang_hi", title: "हिंदी" },
        { id: "lang_mr", title: "Marathi" }
      ]);
    } else {
      // Show Home Menu
      await sendTranslated(sender, "menu", userProfile.preferredLanguage);
    }

    // Reset session
    await saveSession(sender, { step: "start", housingFlow: { step: "start", data: {} } });
    return;
  }

  // --- Step 1: AI classification ---
  const ai = await classify(msgBody);
  console.log("🤖 AI classify:", ai);

  // Map AI category → flow action
  let action;
  switch (ai.category) {
    case "buy_house":
    case "browse_housing":
      action = "buy";
      break;
    case "sell_house":
      action = "sell";
      break;
    case "post_listing":
      action = "post";
      break;
    default:
      action = null;
  }

  if (action) {
    const nextSession = await startOrContinue(
      action,
      msgBody,
      session.housingFlow,
      ai.entities,
      sender
    );

    // Step 2: Ask follow-up if missing fields
    if (nextSession.missing?.length > 0) {
      const question = await generateFollowUpQuestion({
        missing: nextSession.missing,
        entities: nextSession.data,
        language: userLang
      });
      await sendMessage(sender, question || getString(userLang, "moreDetails"));
    } 
    // Step 3: Buying → fetch listings
    else if (action === "buy") {
      const listings = await getAllListings(200);

      const filtered = listings.filter(item => {
        return (
          (!nextSession.data.location ||
            item.location?.toLowerCase() === nextSession.data.location?.toLowerCase()) &&
          (!nextSession.data.budget ||
            parseInt(item.price) <= parseInt(nextSession.data.budget))
        );
      });

      if (filtered.length === 0) {
        await sendTranslated(sender, "noProperties", userLang);
      } else {
        const reply = filtered
          .slice(0, 5)
          .map(
            i => `${i.category || i.property_type} in ${i.location}\nPrice: ${i.price}\nContact: ${i.contact}`
          )
          .join("\n\n");
        await sendMessage(sender, reply);
      }
    }

    // Save session
    await saveSession(sender, { ...session, housingFlow: nextSession });
    return { ...session, housingFlow: nextSession };
  }

  // --- Fallback ---
  await sendTranslated(sender, "fallback", userLang);
  return session;
}

module.exports = { handleIncomingMessage };
