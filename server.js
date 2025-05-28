require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const webhookRoutes = require('./src/routes/webhook');

const app = express();
app.use(bodyParser.json({ limit: '2mb' }));

// ✅ All /webhook logic is now in webhook.js
app.use('/webhook', webhookRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
