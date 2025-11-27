const axios = require("axios");
const { getSession, saveSession } = require("./utils/sessionStore");
const { getAllListings } = require("./database/firestore"); // replaced Sheets
const { classify, searchListings, generateFollowUpQuestion, generatePropertyReply } = require("./src/ai/aiEngine");
const { startOrContinue } = require("./src/flows/housingFlow");

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

/* ---------------------------------------------------
   📤 UNIVERSAL SEND MESSAGE
   - Detects text vs interactive/object messages
-----------------------------------------------------*/
async function sendMessage(to, message, phone_number_id = PHONE_NUMBER_ID) {
  console.log(`✉️ Sending message to ${to}:`, message);

  const url = `https://graph.facebook.com/v19.0/${phone_number_id}/messages`;

  let payload = { messaging_product: "whatsapp", to: to };

  if (typeof message === "string") {
    payload.type = "text";
    payload.text = { body: message };
  } else if (typeof message === "object" && message !== null) {
    // Use the object as the payload (interactive message, etc.)
    payload = { ...payload, ...message };
  } else {
    console.error("❌ Invalid message type. Must be string or object.");
    return;
  }

  try {
    await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    console.log("✅ Message sent");
  } catch (err) {
    console.error("❌ Send error:", err.response?.data || err.message);
  }
}

/* ---------------------------------------------------
   🧠 MAIN HANDLER
-----------------------------------------------------*/
async function handleIncomingMessage(sender, msg, session) {
  console.log(`📩 Incoming from ${sender}: ${msg}`);
  console.log("Session now:", session);

  // Step 1 → AI classification
  const ai = await classify(msg);
  console.log("AI classify:", ai);

  // Step 2 → Determine flow
  if (["browse_housing", "buy_house", "sell_house", "post_listing"].includes(ai.category)) {
    const action = mapCategoryToAction(ai.category); // buy/sell/post
    const nextSession = await startOrContinue(action, msg, session?.housingFlow, ai.entities, sender);

    // Check if flow has missing info → generate follow-up
    if (nextSession?.missing?.length > 0) {
      const question = await generateFollowUpQuestion({
        missing: nextSession.missing,
        entities: nextSession.data,
        language: nextSession.language,
      });
      await sendMessage(sender, question);
    } else if (ai.category === "buy_house" || ai.category === "browse_housing") {
      // Fetch listings from Firestore and generate AI reply
      const listings = await getAllListings(200); // 200 = max listings
      const filtered = searchListings(listings, nextSession.data);

      if (filtered.length === 0) {
        await sendMessage(sender, "⚠️ No properties match your criteria.");
      } else {
        const reply = await generatePropertyReply({
          entities: nextSession.data,
          listings: filtered,
          language: nextSession.language,
        });
        await sendMessage(sender, reply);
      }
    }

    await saveSession(sender, { ...session, housingFlow: nextSession });
    return { ...session, housingFlow: nextSession };
  }

  // fallback for unknown intents
  await sendMessage(
    sender,
    "Hi! I can help you with properties. Try typing examples like:\n• 2BHK in Mumbai under 25k\n• Flat in Delhi\n• 1BHK Noida"
  );

  return session;
}

/* ---------------------------------------------------
   🗂 Helper: map category to flow action
-----------------------------------------------------*/
function mapCategoryToAction(category) {
  switch (category) {
    case "buy_house":
    case "browse_housing":
      return "buy";
    case "sell_house":
      return "sell";
    case "post_listing":
      return "post";
    default:
      return "buy";
  }
}

module.exports = { sendMessage, handleIncomingMessage };
