const { getSession, saveSession } = require("../../utils/sessionStore");
const flowManager = require("../flows/flowManager");
const { sendMessage } = require("../../services/messageService"); // Use the same sendMessage as other files

/**
 * requestHandler handles incoming webhook payload (whatsapp)
 * expects an object with { from, text }
 */
async function requestHandler(payload) {
  try {
    const { from, text } = payload; 
    if (!from || !text) {
      console.warn("Invalid payload:", payload);
      return false;
    }

    // Load session
    let session = (await getSession(from)) || { housingFlow: { step: "start" } };

    // Route message through AI / flow manager
    const { reply, nextSession } = await flowManager.processMessage(text, session, from);

    // Save session defensively
    if (nextSession && typeof nextSession === "object") {
      await saveSession(from, nextSession);
    }

    // Send reply
    if (reply) {
      let out = typeof reply === "string"
        ? { type: "text", text: { body: reply } }
        : reply;

      await sendMessage(from, out);
    }

    return true;
  } catch (err) {
    console.error("requestHandler error:", err?.message || err);
    return false;
  }
}

module.exports = { requestHandler };
