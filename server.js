// server.js
require("dotenv").config();
const express = require("express");
const app = express();
const webhookRoute = require("./routes/webhook");

// ========================================
// FIX: Custom body parser to prevent "request aborted" errors
// ========================================
const bodyParser = require('body-parser');

// Custom JSON parser that handles aborted requests gracefully
const safeJsonParser = (req, res, next) => {
    if (req._body) return next();
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        return next();
    }
    
    // Check content type
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
        return next();
    }
    
    // Read the body manually with error handling
    let data = '';
    req.setEncoding('utf8');
    
    req.on('data', (chunk) => {
        data += chunk;
    });
    
    req.on('end', () => {
        try {
            if (data) {
                req.body = JSON.parse(data);
            }
            next();
        } catch (err) {
            console.log(`[SERVER] JSON parse error for ${req.method} ${req.url}: ${err.message}`);
            req.body = {};
            next();
        }
    });
    
    req.on('error', (err) => {
        console.log(`[SERVER] Request error for ${req.method} ${req.url}: ${err.message}`);
        next();
    });
    
    req.on('aborted', () => {
        console.log(`[SERVER] Request aborted for ${req.method} ${req.url}`);
        // Don't call next() on aborted requests
    });
};

// ========================================
// ENVIRONMENT CHECK
// ========================================
console.log("🔍 Environment check:");
console.log("🔍 WHATSAPP_TOKEN exists:", !!(process.env.WHATSAPP_TOKEN));
console.log("🔍 WHATSAPP_TOKEN length:", process.env.WHATSAPP_TOKEN?.length || 0);
console.log("🔍 WHATSAPP_PHONE_ID exists:", !!(process.env.WHATSAPP_PHONE_ID));
console.log("🔍 VERIFY_TOKEN exists:", !!(process.env.VERIFY_TOKEN));

// ========================================
// SERVICE IMPORTS (with better error handling)
// ========================================
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

// ========================================
// SETUP WHATSAPP CREDENTIALS
// ========================================
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

// ========================================
// MIDDLEWARE (FIXED - No express.json() for all routes)
// ========================================
// FIX: Don't use express.json() globally - it causes "request aborted" errors
// Instead, use custom safe parser only for webhook

// Health check route WITHOUT body parsing
app.get("/health", (req, res) => {
    console.log('[HEALTH] Check received - no body parsing');
    res.status(200).json({ 
        status: "healthy",
        timestamp: new Date().toISOString(),
        services: {
            voice: !!voiceService,
            message: !!messageService,
            controller: !!controller
        }
    });
});

// Root route WITHOUT body parsing
app.get("/", (req, res) => {
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

// Test route WITHOUT body parsing
app.get("/test", (req, res) => {
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

// ========================================
// WEBHOOK ENDPOINTS (with safe parsing)
// ========================================
// FIX: Use raw body parsing only for webhook
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

// FIX: Use custom safe parser for webhook POST
app.post("/webhook", 
    // Use raw body buffer for webhook
    bodyParser.raw({ type: 'application/json', limit: '10mb' }),
    // Handle request aborted errors
    (req, res, next) => {
        req.on('aborted', () => {
            console.log('[WEBHOOK] Request aborted during parsing');
            // Don't process further if request is aborted
        });
        next();
    },
    // Route handler
    webhookRoute
);

// ========================================
// ERROR HANDLING MIDDLEWARE
// ========================================
app.use((err, req, res, next) => {
    console.error("❌ Server error:", err.message);
    
    // Don't log stack trace for common errors
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Request too large' });
    }
    
    if (err.type === 'entity.parse.failed') {
        console.error("❌ JSON parse error - likely empty or malformed request");
        return res.status(400).json({ error: 'Invalid JSON' });
    }
    
    if (err.message.includes('request aborted')) {
        console.error("❌ Request aborted - likely Railway health check");
        return res.status(400).json({ error: 'Request aborted' });
    }
    
    res.status(500).json({ 
        error: "Internal server error",
        message: err.message 
    });
});

// ========================================
// 404 HANDLER
// ========================================
app.use((req, res) => {
    console.log(`[404] ${req.method} ${req.url} - Not found`);
    res.status(404).json({ error: 'Not found' });
});

// ========================================
// START SERVER
// ========================================
const PORT = process.env.PORT || 3000;

// Create server with timeout settings
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
    📍 http://0.0.0.0:${PORT}
    📍 http://0.0.0.0:${PORT}/test
    📍 http://0.0.0.0:${PORT}/health
    📍 POST http://0.0.0.0:${PORT}/webhook
    ========================================
    `);
    
    if (voiceService) {
        console.log("🎤 VoiceService WhatsApp Status:");
        console.log(`   Access Token: ${voiceService.whatsappAccessToken ? '✅ Set' : '❌ Missing'}`);
        console.log(`   Phone Number ID: ${voiceService.whatsappPhoneNumberId || '❌ Not set'}`);
    }
});

// ========================================
// SERVER TIMEOUT CONFIGURATION
// ========================================
// FIX: Configure timeouts to prevent hanging requests
server.setTimeout(30000); // 30 second timeout
server.keepAliveTimeout = 5000; // 5 seconds
server.headersTimeout = 10000; // 10 seconds

// Handle server errors
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
    } else {
        console.error('❌ Server error:', err.message);
    }
    process.exit(1);
});

// ========================================
// GRACEFUL SHUTDOWN
// ========================================
process.on('SIGTERM', () => {
    console.log('🔄 SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
        console.log('⚠️ Forcing shutdown');
        process.exit(1);
    }, 10000);
});

process.on('SIGINT', () => {
    console.log('🔄 SIGINT received, shutting down...');
    server.close(() => {
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000);
});

// Handle uncaught errors
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err.message);
    console.error(err.stack);
    // Don't exit - let the server continue
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise);
    console.error('❌ Reason:', reason);
});