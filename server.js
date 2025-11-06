require('dotenv').config();
const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const intents = require('./intents');

// --- EXPRESS SETUP ---
const app = express();
const port = process.env.PORT || 3000;

// --- WHATSAPP CLIENT ---
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

// Display QR Code
client.on('qr', (qr) => {
  console.log('QR code received, please scan with your phone.');
  qrcode.generate(qr, { small: true });
});

// When WhatsApp is ready
client.on('ready', () => {
  console.log('✅ WhatsApp client is ready!');
});

// --- Simple Intent Parser ---
function detectIntent(messageText) {
  messageText = messageText.toLowerCase();
  for (const [intent, data] of Object.entries(intents)) {
    if (data.keywords.some(k => messageText.includes(k))) {
      return intent;
    }
  }
  return null;
}

// --- Missing Info Extractor (Simple AI Behavior) ---
function getMissingInfo(intent, messageText) {
  const needed = intents[intent]?.requiredInfo || [];
  const missing = [];

  if (intent === "housing") {
    if (!messageText.match(/noida|gurgaon|delhi|bangalore|mumbai|pune/)) missing.push("city");
    if (!messageText.match(/\d\s?bhk|1bhk|2bhk|3bhk|flat|room/)) missing.push("property type");
    if (!messageText.match(/\d{4,6}/)) missing.push("budget");
  }

  if (intent === "jobs") {
    if (!messageText.match(/developer|sales|marketing|designer|teacher|driver/)) missing.push("job type");
    if (!messageText.match(/\d+\s?(yrs|years)/)) missing.push("experience");
    if (!messageText.match(/noida|delhi|gurgaon|remote|mumbai|pune/)) missing.push("location");
  }

  if (intent === "leads") {
    if (!messageText.match(/education|real estate|finance|insurance|retail/)) missing.push("category");
    if (!messageText.match(/\d+/)) missing.push("quantity");
  }

  return missing;
}

// --- MAIN MESSAGE HANDLER ---
client.on('message', async (message) => {
  const userMsg = message.body.trim();
  console.log(`🟢 Received: ${userMsg}`);

  // Detect the user's intent
  const intent = detectIntent(userMsg);

  if (!intent) {
    await message.reply("👋 Hey there! What are you looking for today? (e.g. 1BHK in Noida, job in marketing, or 500 education leads)");
    return;
  }

  // Identify missing details
  const missing = getMissingInfo(intent, userMsg);

  if (missing.length > 0) {
    await message.reply(`I got that you're looking for *${intent}*. Can you please share: ${missing.join(", ")}?`);
    return;
  }

  // Once we have enough info
  await message.reply(`✅ Great! I understood you are looking for ${intent} related info. Let me fetch the best options for you...`);

  // Later: Connect here with Google Sheets API
  // e.g. fetch from housing sheet and filter results
  setTimeout(async () => {
    await message.reply("Here are some matching listings (demo data):\n\n🏠 1BHK in Noida - ₹12,000\n🏠 2BHK in Sector 62 - ₹15,500\n📞 Contact: 9876543210");
  }, 1500);
});

// --- START SERVER ---
client.initialize();
app.get('/', (_, res) => res.send('MarketMatchAI WhatsApp Bot running...'));
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
