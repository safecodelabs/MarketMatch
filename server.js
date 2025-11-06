require('dotenv').config();
const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const intents = require('./intents');
const { detectIntent, getMissingInfo } = require('./utils/messageUtils');

// --- EXPRESS SETUP ---
const app = express();
const port = process.env.PORT || 3000;

// --- WHATSAPP CLIENT ---
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process']
  }
});

// --- QR CODE HANDLER ---
client.on('qr', qr => {
  console.log('📱 Scan the QR code below with WhatsApp:');
  qrcode.generate(qr, { small: true });
});

// --- READY HANDLER ---
client.on('ready', () => {
  console.log('✅ WhatsApp bot is ready and connected!');
});

// --- MESSAGE HANDLER ---
client.on('message', async (message) => {
  try {
    const userMsg = message.body?.trim();
    if (!userMsg) return;

    console.log(`🟢 Message from ${message.from}: ${userMsg}`);

    const intent = detectIntent(userMsg);

    if (!intent) {
      await message.reply("👋 Hey there! What are you looking for today? (e.g., 1BHK in Noida, marketing job, or 500 education leads)");
      return;
    }

    const missing = getMissingInfo(intent, userMsg);

    if (missing.length > 0) {
      await message.reply(`I got that you're looking for *${intent}*. Could you please share: ${missing.join(", ")}?`);
      return;
    }

    await message.reply(`✅ Great! You're looking for ${intent}. Let me find the best options for you...`);

    // 🔹 Later: fetch actual data from Google Sheets
    setTimeout(async () => {
      await message.reply("Here are some matching listings (demo):\n🏠 1BHK in Noida – ₹12,000\n🏠 2BHK in Sector 62 – ₹15,500\n📞 Contact: 9876543210");
    }, 1500);

  } catch (err) {
    console.error("❌ Error handling message:", err);
    await message.reply("Sorry, something went wrong while processing your request 😔");
  }
});

// --- START SERVER ---
client.initialize();
app.get('/', (_, res) => res.send('🚀 MarketMatchAI WhatsApp Bot is running...'));
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
