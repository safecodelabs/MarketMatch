// src/core/requestHandler.js
const { getSession, saveSession } = require("../../utils/sessionStore");
const flowManager = require("../flows/flowManager");
const { sendMessageWhatsapp } = require("../../utils/messageUtils"); // adapt name if different

/**
 * requestHandler handles incoming webhook payload (whatsapp)
 * expects an object with { from, text }
 */
async function requestHandler(payload) {
  try {
    const { from, text } = payload; // adapt based on how your webhook sends data
    if (!from || !text) {
      console.warn("Invalid payload:", payload);
      return false;
    }

    // load session
    const session = (await getSession(from)) || { step: "start" };

    // route message
    const { reply, nextSession } = await flowManager.processMessage(text, session, from);

    // save session (defensive)
    if (nextSession && typeof nextSession === "object") {
      await saveSession(from, nextSession);
    }

    // send reply
    if (reply) {
      // unify reply shape: if text string is passed, convert to object
      let out = reply;
      if (typeof reply === "string") {
        out = { type: "text", text: { body: reply } };
      }

      await sendMessageWhatsapp(from, out);
    }

    return true;
  } catch (err) {
    console.error("requestHandler error:", err?.message || err);
    return false;
  }
}

module.exports = { requestHandler };
