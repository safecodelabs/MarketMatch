const { sendMessage } = require('../services/messageService');
const { startOrContinue } = require('../flows/housingFlow');
const { getSession, saveSession } = require('../utils/sessionStore');
const { classify, generateFollowUpQuestion, getHousingData, searchListings, generatePropertyReply } = require('../src/ai/aiEngine');

/**
 * Main entry for incoming WhatsApp messages
 */
async function handleIncomingMessage(sender, msgBody) {
  if (!sender || !msgBody) return;

  // Load or initialize session
  let session = await getSession(sender) || { housingFlow: { step: "start" } };
  console.log("📨 Incoming:", msgBody);
  console.log("📌 Current Session:", session);

  // Step 1 — AI classification
  const ai = await classify(msgBody);
  console.log("🤖 AI classify:", ai);

  // Map category to action for housingFlow
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
    // Step 2 — Start or continue AI housing flow
    const nextSession = await startOrContinue(action, msgBody, session.housingFlow, ai.entities, sender);

    // Step 3 — Check for missing fields → ask follow-up
    if (nextSession.missing?.length > 0) {
      const question = await generateFollowUpQuestion({
        missing: nextSession.missing,
        entities: nextSession.data,
        language: nextSession.language
      });
      await sendMessage(sender, question || "Can you provide more details?");
    } else if (action === "buy") {
      // Fetch listings and generate AI reply
      const listings = await getHousingData();
      const filtered = searchListings(listings, nextSession.data);
      if (filtered.length === 0) {
        await sendMessage(sender, "⚠️ No properties match your criteria.");
      } else {
        const reply = await generatePropertyReply({
          entities: nextSession.data,
          listings: filtered,
          language: nextSession.language
        });
        await sendMessage(sender, reply);
      }
    }

    // Save updated session
    await saveSession(sender, { ...session, housingFlow: nextSession });
    return { ...session, housingFlow: nextSession };
  }

  // Fallback for unknown intents
  await sendMessage(sender, "Hi! I can help you with properties. Try:\n• 2BHK in Mumbai under 20k\n• Flat in Delhi\n• 1BHK Noida");
  return session;
}

module.exports = { handleIncomingMessage, sendMessage };
