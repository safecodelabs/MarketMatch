// server.js
require("dotenv").config();
const express = require("express");
const app = express();
const bodyParser = require('body-parser');

// Check environment variables
console.log("🔍 Environment check:");
console.log("🔍 WHATSAPP_TOKEN exists:", !!(process.env.WHATSAPP_TOKEN));
console.log("🔍 WHATSAPP_TOKEN length:", process.env.WHATSAPP_TOKEN?.length || 0);
console.log("🔍 WHATSAPP_PHONE_ID exists:", !!(process.env.WHATSAPP_PHONE_ID));
console.log("🔍 VERIFY_TOKEN exists:", !!(process.env.VERIFY_TOKEN));

// Import services
let voiceService;
try {
    voiceService = require("./src/services/voiceService");
    console.log("✅ VoiceService loaded");
} catch (error) {
    console.error("❌ Failed to load voiceService:", error.message);
    voiceService = null;
}

let messageService;
try {
    messageService = require("./src/services/messageService");
    console.log("✅ MessageService loaded");
} catch (error) {
    console.error("❌ Failed to load messageService:", error.message);
    messageService = null;
}

let controller;
try {
    controller = require("./chatbotController");
    console.log("✅ Controller loaded from ./chatbotController");
} catch (error) {
    console.error("❌ Failed to load chatbotController:", error.message);
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
    const whatsappToken = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
    
    if (whatsappToken) {
        console.log("✅ WhatsApp token found, setting credentials...");
        
        if (typeof voiceService.setWhatsAppCredentials === 'function') {
            voiceService.setWhatsAppCredentials({
                accessToken: whatsappToken,
                phoneNumberId: process.env.WHATSAPP_PHONE_ID,
                apiVersion: process.env.WHATSAPP_API_VERSION || 'v19.0'
            });
            console.log("✅ setWhatsAppCredentials() called");
        } 
        else if (voiceService.whatsappAccessToken !== undefined) {
            voiceService.whatsappAccessToken = whatsappToken;
            voiceService.whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_ID;
            console.log("✅ Direct property assignment");
        }
        else if (typeof voiceService.initializeWithConfig === 'function') {
            voiceService.initializeWithConfig({
                accessToken: whatsappToken,
                phoneNumberId: process.env.WHATSAPP_PHONE_ID,
                apiVersion: process.env.WHATSAPP_API_VERSION || 'v19.0'
            });
            console.log("✅ initializeWithConfig() called");
        }
        else {
            console.log("⚠️ Could not set WhatsApp credentials - no method found");
        }
    } else {
        console.log("❌ No WhatsApp token found in environment variables");
    }
}

// Set WhatsApp client in controller
if (controller && controller.setWhatsAppClient && messageService) {
    controller.setWhatsAppClient(messageService);
    console.log("✅ WhatsApp client set in controller");
} else {
    console.log("❌ Could not set WhatsApp client in controller");
}

// ============================================
// MIDDLEWARE - FIX: Add request timeout handling
// ============================================
app.use((req, res, next) => {
    // Set timeout for all requests
    req.setTimeout(30000, () => {
        console.log(`[TIMEOUT] ${req.method} ${req.url}`);
    });
    
    // Handle aborted requests
    req.on('aborted', () => {
        console.log(`[ABORTED] ${req.method} ${req.url}`);
    });
    
    next();
});

// Use bodyParser ONLY for webhook endpoint
// Don't use express.json() globally to avoid "request aborted" errors
app.use("/webhook", bodyParser.raw({ 
    type: 'application/json', 
    limit: '10mb' 
}));

// For all other routes, use regular JSON parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

// ============================================
// WEBHOOK ENDPOINTS - FIX: Use webhook.js router
// ============================================
// Import the webhook router
const webhookRoute = require("./routes/webhook");

// Apply webhook route to /webhook endpoint
app.use("/webhook", webhookRoute);

// ============================================
// TEST ROUTES
// ============================================
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
            phoneNumberId: process.env.WHATSAPP_PHONE_ID || "Not set",
            verifyToken: process.env.VERIFY_TOKEN ? "Set" : "Not set"
        }
    });
});

// Health check for Railway - NO BODY PARSING ISSUES
app.get("/health", (_, res) => {
    res.json({ 
        status: "healthy",
        timestamp: new Date().toISOString() 
    });
});

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

// ============================================
// ERROR HANDLING - FIX: Better error handling
// ============================================
app.use((err, req, res, next) => {
    console.error("❌ Server error:", err.message);
    
    // Handle "request aborted" errors gracefully
    if (err.message.includes('request aborted')) {
        console.log("[INFO] Request was aborted - likely a health check");
        return res.status(200).json({ status: "ok" });
    }
    
    // Handle JSON parse errors
    if (err.type === 'entity.parse.failed') {
        console.log("[INFO] JSON parse failed - empty or malformed request");
        return res.status(400).json({ error: "Invalid JSON" });
    }
    
    res.status(500).json({ 
        error: "Internal server error",
        message: err.message 
    });
});

// 404 handler
app.use((req, res) => {
    console.log(`[404] ${req.method} ${req.url} - Not found`);
    res.status(404).json({ error: "Not found" });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, '0.0.0.0', () => {
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
    
    if (voiceService) {
        console.log("🎤 VoiceService WhatsApp Status:");
        console.log(`   Access Token: ${voiceService.whatsappAccessToken ? '✅ Set' : '❌ Missing'}`);
        console.log(`   Phone Number ID: ${voiceService.whatsappPhoneNumberId || '❌ Not set'}`);
        console.log(`   Can process voice: ${typeof voiceService.processVoiceMessage === 'function' ? '✅ Yes' : '❌ No'}`);
    }
});

// Server timeout configuration
server.setTimeout(30000);
server.keepAliveTimeout = 5000;
server.headersTimeout = 10000;

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🔄 SIGTERM received, shutting down...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🔄 SIGINT received, shutting down...');
    server.close(() => {
        process.exit(0);
    });
});