// server.js
require("dotenv").config();
const express = require("express");
const app = express();
const webhookRoute = require("./routes/webhook");

// Check environment variables
console.log("🔍 Environment check:");
console.log("🔍 WHATSAPP_TOKEN exists:", !!(process.env.WHATSAPP_TOKEN));
console.log("🔍 WHATSAPP_TOKEN length:", process.env.WHATSAPP_TOKEN?.length || 0);
console.log("🔍 WHATSAPP_PHONE_ID exists:", !!(process.env.WHATSAPP_PHONE_ID));
console.log("🔍 VERIFY_TOKEN exists:", !!(process.env.VERIFY_TOKEN));

// Import voice service
let voiceService;
try {
    voiceService = require("./src/services/voiceService");
    console.log("✅ VoiceService loaded");
} catch (error) {
    console.error("❌ Failed to load voiceService:", error.message);
    voiceService = null;
}

// Import messageService
let messageService;
try {
    messageService = require("./src/services/messageService");
    console.log("✅ MessageService loaded");
} catch (error) {
    console.error("❌ Failed to load messageService:", error.message);
    messageService = null;
}

// Import controller - YOUR FILE IS chatbotController.js
let controller;
try {
    controller = require("./chatbotController");
    console.log("✅ Controller loaded from ./chatbotController");
} catch (error) {
    console.error("❌ Failed to load chatbotController:", error.message);
    console.error("❌ Full error:", error);
    controller = {
        setWhatsAppClient: (client) => console.log("Mock: setWhatsAppClient"),
        handleIncomingMessage: async () => {
            console.log("Mock: handleIncomingMessage called");
            return { step: "menu" };
        }
    };
}

// Set WhatsApp credentials for voice service
if (voiceService) {
    // Get the token from either WHATSAPP_TOKEN or WHATSAPP_ACCESS_TOKEN
    const whatsappToken = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
    
    if (whatsappToken) {
        console.log("✅ WhatsApp token found, setting credentials...");
        
        // Try different methods to set credentials
        if (typeof voiceService.setWhatsAppCredentials === 'function') {
            voiceService.setWhatsAppCredentials({
                accessToken: whatsappToken,
                phoneNumberId: process.env.WHATSAPP_PHONE_ID, // CHANGED: WHATSAPP_PHONE_ID
                apiVersion: process.env.WHATSAPP_API_VERSION || 'v19.0'
            });
            console.log("✅ setWhatsAppCredentials() called");
        } 
        // Try direct property assignment
        else if (voiceService.whatsappAccessToken !== undefined) {
            voiceService.whatsappAccessToken = whatsappToken;
            voiceService.whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_ID; // CHANGED
            console.log("✅ Direct property assignment");
        }
        // Try initializeWithConfig if exists
        else if (typeof voiceService.initializeWithConfig === 'function') {
            voiceService.initializeWithConfig({
                accessToken: whatsappToken,
                phoneNumberId: process.env.WHATSAPP_PHONE_ID, // CHANGED
                apiVersion: process.env.WHATSAPP_API_VERSION || 'v19.0'
            });
            console.log("✅ initializeWithConfig() called");
        }
        else {
            console.log("⚠️ Could not set WhatsApp credentials - no method found");
        }
    } else {
        console.log("❌ No WhatsApp token found in environment variables");
        console.log("❌ Checked: WHATSAPP_TOKEN and WHATSAPP_ACCESS_TOKEN");
    }
}

// Set WhatsApp client in controller
if (controller && controller.setWhatsAppClient && messageService) {
    controller.setWhatsAppClient(messageService);
    console.log("✅ WhatsApp client set in controller");
} else {
    console.log("❌ Could not set WhatsApp client in controller");
    console.log("   Controller available:", !!controller);
    console.log("   Controller has setWhatsAppClient:", controller && typeof controller.setWhatsAppClient === 'function');
    console.log("   MessageService available:", !!messageService);
}

// ---------------------------------------------------------
// MIDDLEWARE
// ---------------------------------------------------------
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: false }));

// ---------------------------------------------------------
// WEBHOOK ENDPOINTS
// ---------------------------------------------------------
app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    console.log("🔐 Webhook verification attempt:", { mode, token: token ? "provided" : "missing" });

    if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
        console.log("✅ Webhook verified successfully");
        return res.status(200).send(challenge);
    }

    console.error("❌ Webhook verification failed");
    console.error("Expected VERIFY_TOKEN:", process.env.VERIFY_TOKEN);
    console.error("Received token:", token);
    return res.sendStatus(403);
});

// Webhook handler
app.post("/webhook", 
    express.raw({ type: "application/json" }),
    webhookRoute
);

// ---------------------------------------------------------
// TEST ROUTES
// ---------------------------------------------------------
app.get("/test", (_, res) => {
    const whatsappToken = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
    
    res.json({
        status: "online",
        timestamp: new Date().toISOString(),
        services: {
            voice: !!voiceService,
            message: !!messageService,
            controller: !!controller
        },
        whatsapp: {
            tokenExists: !!whatsappToken,
            tokenLength: whatsappToken?.length || 0,
            phoneNumberId: process.env.WHATSAPP_PHONE_ID || "Not set", // CHANGED
            verifyToken: process.env.VERIFY_TOKEN ? "Set" : "Not set"
        },
        voiceService: voiceService ? {
            hasAccessToken: !!voiceService.whatsappAccessToken,
            hasProcessVoiceMessage: typeof voiceService.processVoiceMessage === 'function',
            methods: Object.keys(voiceService).filter(k => typeof voiceService[k] === 'function')
        } : null,
        controller: controller ? {
            methods: Object.keys(controller).filter(k => typeof controller[k] === 'function')
        } : null
    });
});

// Health check for Railway
app.get("/health", (_, res) => {
    res.json({ 
        status: "healthy",
        timestamp: new Date().toISOString() 
    });
});

// ---------------------------------------------------------
app.get("/", (_, res) => {
    res.send(`
        <h1>MarketMatch AI WhatsApp Bot</h1>
        <p>Status: ✅ Running</p>
        <ul>
            <li><a href="/test">Service Status</a></li>
            <li><a href="/health">Health Check</a></li>
            <li>Webhook: POST /webhook</li>
            <li>Verify: GET /webhook?hub.mode=subscribe&hub.verify_token=...</li>
        </ul>
    `);
});

// ---------------------------------------------------------
// ERROR HANDLING
// ---------------------------------------------------------
app.use((err, req, res, next) => {
    console.error("❌ Server error:", err.message);
    console.error("❌ Stack:", err.stack);
    res.status(500).json({ 
        error: "Internal server error",
        message: err.message 
    });
});

// ---------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ========================================
    🚀 MarketMatch AI Server Started
    ========================================
    📍 Port: ${PORT}
    🌐 Host: 0.0.0.0
    ========================================
    ENVIRONMENT CHECK:
    🔑 WHATSAPP_TOKEN: ${process.env.WHATSAPP_TOKEN ? '✅ Found' : '❌ Missing'}
    📱 PHONE_ID: ${process.env.WHATSAPP_PHONE_ID || '❌ Missing'}
    🔐 VERIFY_TOKEN: ${process.env.VERIFY_TOKEN ? '✅ Set' : '❌ Missing'}
    ========================================
    SERVICES:
    🎤 Voice Service: ${voiceService ? '✅ Loaded' : '❌ Failed'}
    📱 Message Service: ${messageService ? '✅ Loaded' : '❌ Failed'}
    🤖 Controller: ${controller ? '✅ Loaded' : '❌ Failed'}
    ========================================
    ENDPOINTS:
    📍 http://localhost:${PORT}
    📍 http://localhost:${PORT}/test
    📍 http://localhost:${PORT}/health
    📍 POST http://localhost:${PORT}/webhook
    ========================================
    `);
    
    // Verify voice service setup
    if (voiceService) {
        console.log("🎤 VoiceService WhatsApp Status:");
        console.log(`   Access Token: ${voiceService.whatsappAccessToken ? '✅ Set' : '❌ Missing'}`);
        console.log(`   Phone Number ID: ${voiceService.whatsappPhoneNumberId || '❌ Not set'}`);
        console.log(`   Can process voice: ${typeof voiceService.processVoiceMessage === 'function' ? '✅ Yes' : '❌ No'}`);
    }
    
    // Verify controller setup
    if (controller) {
        console.log("🤖 Controller Methods:");
        const methods = Object.keys(controller).filter(k => typeof controller[k] === 'function');
        methods.forEach(method => {
            console.log(`   ${method}`);
        });
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🔄 SIGTERM received, shutting down...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🔄 SIGINT received, shutting down...');
    process.exit(0);
});