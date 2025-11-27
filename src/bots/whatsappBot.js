const { sendMessage } = require('../services/messageService');
const { startOrContinue } = require('../flows/housingFlow');
const { getSession, saveSession } = require('../utils/sessionStore');
const { classify, generateFollowUpQuestion } = require('../ai/aiEngine');
const { getAllListings } = require('../../database/firestore');

/**
 * Main entry for incoming WhatsApp messages
 */
async function handleIncomingMessage(sender, msgBody) {
  if (!sender || !msgBody) return;

  // Load session
  let session = await getSession(sender) || { housingFlow: { step: "start" } };
  console.log("📨 Incoming:", msgBody);
  console.log("📌 Current Session:", session);

  // Step 1 — AI classification
  const ai = await classify(msgBody);
  console.log("🤖 AI classify:", ai);

  // Map category → flow action
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

    // Missing fields → ask follow-up
    if (nextSession.missing?.length > 0) {
      const question = await generateFollowUpQuestion({
        missing: nextSession.missing,
        entities: nextSession.data,
        language: nextSession.language || "en"
      });
      await sendMessage(sender, question || "Can you provide more details?");
    }
    // Buying → fetch listings
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
        await sendMessage(sender, "⚠️ No properties match your criteria.");
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

  // Fallback
  await sendMessage(
    sender,
    "Hi! I can help you with properties. Try:\n• 2BHK in Mumbai under 20k\n• Flat in Delhi\n• 1BHK Noida"
  );

  return session;
}

module.exports = { handleIncomingMessage };
