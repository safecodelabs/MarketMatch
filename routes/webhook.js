const chatbotController = require('../chatbotController');
const { flowSteps } = require('../utils/constants');
const express = require('express');
const router = express.Router();
const axios = require('axios'); // Required for API call to WhatsApp

const { getSession, saveSession } = require('../utils/sessionStore');


function getGreetingByIST() {
  const date = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffset);
  const hour = istDate.getUTCHours();

  let greeting;
  
  if (hour < 12) return 'Good Morning ☀️';
  else if (hour < 17) return 'Good Afternoon 🌤️';
  else return 'Good Evening 🌙';
}

router.post('/', async (req, res) => {
  try {
    console.log('🔔 Incoming webhook:', JSON.stringify(req.body, null, 2));

    const body = req.body;
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (messages && messages.length > 0) {
      const message = messages[0];
      const sender = message.from;

      let msg = '';

      if (message.type === 'interactive') {
        const interactive = message.interactive;
        if (interactive.type === 'button_reply') {
          msg = interactive.button_reply.id;
        } else if (interactive.type === 'list_reply') {
          msg = interactive.list_reply.id;
        }
      } else if (message.type === 'text') {
        msg = message.text.body.trim().toLowerCase();
      }

      let session = await getSession(sender);
      if (!session) {
        session = { step: null, data: {} };
      }
      
      if (!session.step) {
        session.step = 'chooseService';
      }
      
      const greetings = ['hi', 'hello', 'hey', 'start'];
      if (greetings.includes(msg.toLowerCase())) {
        session.step = 'chooseService';
      
        const greetingText = getGreetingByIST();
        const welcomeMessage = `${greetingText}!`;
      
        await chatbotController.sendMessage(sender, welcomeMessage); // This now works
        await chatbotController.sendMessage(sender, flowSteps.chooseService);
      
        await saveSession(sender, session);
        return res.sendStatus(200); // 🛑 stops further execution
      }
      
      if (msg) {
        const newSession = await chatbotController.handleIncomingMessage(sender, msg, session);
      
        if (newSession && typeof newSession === 'object') {
          await saveSession(sender, newSession);
        } else {
          console.error('❌ Skipping save — invalid session:', newSession);
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Error in webhook handler:', err);
    res.sendStatus(500);
  }
});

module.exports = router;
