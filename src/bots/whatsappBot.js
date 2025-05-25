const { sendMessage } = require('../services/messageService');
const flowManager = require('../flows/flowManager');
const { getSession, saveSession } = require('../utils/sessionStore'); // Firebase session store

async function handleIncomingMessage(sender, msgBody) {
  if (!sender || !msgBody) return;

  const session = await getSession(sender); // 🟢 Fetch from Firebase
  const { reply, nextSession } = await flowManager.processMessage(msgBody, session, sender);

  if (!nextSession) {
    console.error('❌ Skipping save — invalid session:', nextSession);
    return;
  }

  await saveSession(sender, nextSession); // 🟢 Save back to Firebase

  if (!reply || !reply.type) {
    console.error('❌ Invalid reply format:', reply);
    return;
  }

  await sendMessage(sender, reply);
}

module.exports = { handleIncomingMessage, sendMessage };
