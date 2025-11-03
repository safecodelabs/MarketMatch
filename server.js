require('dotenv').config(); // Loads environment variables from a .env file
const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Initialize the express app
const app = express();

// Use port from environment variables or default to 3000
const port = process.env.PORT || 3000;

// --- WhatsApp Bot Initialization ---

// Use LocalAuth to persist session data
// This avoids having to scan the QR code on every restart
const client = new Client({
    authStrategy: new LocalAuth(),
    // puppeteer args are important for running in a container environment like Railway or Docker
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

client.on('qr', (qr) => {
    // Generate and display QR code in the terminal for scanning
    console.log('QR code received, please scan with your phone.');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('WhatsApp client is ready!');
});

client.on('message', message => {
	console.log(`Received message: ${message.body}`);
	if(message.body === '!ping') {
		message.reply('pong');
	} else {
        // Simple echo for testing
        message.reply(`You said: ${message.body}`);
    }
});

client.initialize();

// A simple route for the root URL
app.get('/', (req, res) => {
  res.send('Hello from the MarketMatchAI Bot server!');
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});