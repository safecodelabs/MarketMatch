const { mainFlow } = require('../flows/main.flow');

// Dummy function simulating WhatsApp message received
async function onMessageReceived(message) {
  const sendMessage = (reply) => {
    console.log(`Bot: ${reply}`);
    // replace this with WhatsApp API send logic
  };

  await mainFlow(message, sendMessage);
}

module.exports = { onMessageReceived };
