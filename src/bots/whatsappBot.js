const { sendMessage } = require('../services/messageService');
const flowManager = require('../flows/flowManager');
const { getSession, saveSession } = require('../utils/sessionStore');

// 🔥 NEW — Import AI
const { detectAIIntent } = require('../templates/messageParser');

async function handleIncomingMessage(sender, msgBody) {
  if (!sender || !msgBody) return;

  // 🟢 Load session
  let session = await getSession(sender) || { step: "start" };

  console.log("📨 Incoming:", msgBody);
  console.log("📌 Current Session:", session);

  // ---------------------------------------------------
  // 🔥 STEP 1 — AI INTENT DETECTION
  // ---------------------------------------------------
  const ai = await detectAIIntent(msgBody);
  console.log("🤖 AI Intent:", ai);

  // If AI detects a real housing intent → bypass flow menus
  if (ai.intent !== "unknown") {
    session.intent = ai.intent;
    session.entities = ai.entities;
    session.step = "ai_detected";

    // Short-circuit before flow manager
    if (ai.intent === "buy") {
      return await handleBuyIntent(sender, session);
    }

    if (ai.intent === "sell") {
      return await handleSellIntent(sender, session);
    }

    if (ai.intent === "post") {
      return await handlePostIntent(sender, session);
    }
  }

  // ---------------------------------------------------
  // 🔥 STEP 2 — If AI did not handle it → normal flow manager
  // ---------------------------------------------------
  const { reply, nextSession } = await flowManager.processMessage(msgBody, session, sender);

  if (!nextSession) {
    console.error('❌ Skipping save — invalid session:', nextSession);
    return;
  }

  await saveSession(sender, nextSession);

  if (!reply || !reply.type) {
    console.error('❌ Invalid reply format:', reply);
    return;
  }

  await sendMessage(sender, reply);
}

// ---------------------------------------------------
// 🔥 BUY / SELL / POST HOUSING HANDLERS
// ---------------------------------------------------

async function handleBuyIntent(sender, session) {
  await sendMessage(sender, {
    type: "text",
    text: { body: `🏠 You're looking to *buy*.\n\nWhat location or budget do you prefer?` }
  });

  await saveSession(sender, session);
}

async function handleSellIntent(sender, session) {
  await sendMessage(sender, {
    type: "text",
    text: { body: `📤 You want to *sell/rent out* a property.\n\nPlease share property type, location and rent/price.` }
  });

  await saveSession(sender, session);
}

async function handlePostIntent(sender, session) {
  await sendMessage(sender, {
    type: "text",
    text: { body: `📝 Please send your complete listing:\n\nExample:\n"2BHK in Noida sector 62, Rent 15k, Contact 9876543210"` }
  });

  await saveSession(sender, session);
}

module.exports = { handleIncomingMessage, sendMessage };
