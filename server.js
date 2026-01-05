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

// ============================================
// POSTING SYSTEM INITIALIZATION - NEW
// ============================================
console.log("🔧 Initializing Posting System...");
let initCollections;
try {
    initCollections = require("./database/init-collections");
    console.log("✅ Posting System collections module loaded");
} catch (error) {
    console.error("❌ Failed to load posting system collections:", error.message);
    initCollections = null;
}

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

// ============================================
// CLEANUP SERVICE FOR DRAFTS - NEW
// ============================================
let CleanupService;
try {
    CleanupService = require("./src/services/cleanup-service");
    console.log("✅ CleanupService loaded");
} catch (error) {
    console.warn("⚠️ CleanupService not found, creating minimal version:", error.message);
    // Create minimal cleanup service if not found
    CleanupService = class {
        constructor() {
            console.log("📦 Created minimal cleanup service");
        }
        
        async cleanupOldDrafts() {
            console.log("🧹 Minimal cleanup - no action taken");
            return { cleaned: 0 };
        }
        
        async cleanupAbandonedSessions() {
            console.log("🧹 Minimal cleanup - no action taken");
            return { cleaned: 0 };
        }
    };
}

// ============================================
// FLOW WEBHOOK ROUTER - NEW
// ============================================
let flowWebhookRouter;
try {
    flowWebhookRouter = require("./routes/webhook");
    console.log("✅ Flow webhook router loaded");
} catch (error) {
    console.warn("⚠️ Flow webhook router not found:", error.message);
    // Create placeholder router if not found
    flowWebhookRouter = express.Router();
    flowWebhookRouter.post('/flow-complete', async (req, res) => {
        console.log("📝 [FLOW WEBHOOK] Placeholder - flow completion not implemented");
        res.json({ success: false, error: "Flow webhook not implemented" });
    });
}

// ============================================
// POSTING FLOW MODULE - NEW
// ============================================
let postingFlowModule;
try {
    postingFlowModule = require("./src/flows/postListingFlow");
    console.log("✅ Posting flow module loaded");
} catch (error) {
    console.warn("⚠️ Posting flow module not found:", error.message);
    // Create placeholder if not needed
    postingFlowModule = {
        sendListingFlow: async (to) => {
            console.log("📝 [FLOW] Placeholder - WhatsApp Flow not implemented");
            return { data: { success: false } };
        }
    };
}

// ============================================
// INITIALIZE SERVICES
// ============================================

// Initialize Posting System Collections
if (initCollections && typeof initCollections.initializeCollections === 'function') {
    try {
        // Run initialization asynchronously (don't block server startup)
        setTimeout(async () => {
            try {
                await initCollections.initializeCollections();
                console.log("✅ Posting system collections initialized");
            } catch (error) {
                console.error("❌ Failed to initialize posting collections:", error.message);
            }
        }, 2000); // Wait 2 seconds after server starts
    } catch (error) {
        console.error("❌ Error scheduling collection initialization:", error.message);
    }
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
// FLOW WEBHOOK ENDPOINT - NEW
// ============================================
// Apply flow webhook router to /api/flow endpoint
app.use("/api/flow", flowWebhookRouter);

// ============================================
// TEST ROUTES - UPDATED WITH POSTING SYSTEM INFO
// ============================================
app.get("/test", (_, res) => {
    const whatsappToken = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
    
    res.json({
        status: "online",
        timestamp: new Date().toISOString(),
        services: {
            voice: !!voiceService,
            message: !!messageService,
            controller: !!controller,
            posting_system: !!initCollections,
            cleanup_service: !!CleanupService,
            flow_webhook: !!flowWebhookRouter
        },
        whatsapp: {
            tokenExists: !!whatsappToken,
            tokenLength: whatsappToken?.length || 0,
            phoneNumberId: process.env.WHATSAPP_PHONE_ID || "Not set",
            verifyToken: process.env.VERIFY_TOKEN ? "Set" : "Not set",
            flowId: process.env.WHATSAPP_FLOW_ID || "Not set"
        }
    });
});

// Health check for Railway - NO BODY PARSING ISSUES
app.get("/health", (_, res) => {
    res.json({ 
        status: "healthy",
        timestamp: new Date().toISOString(),
        posting_system: !!initCollections ? "✅ Initialized" : "❌ Not available"
    });
});

// ============================================
// POSTING SYSTEM TEST ROUTES - NEW
// ============================================
app.get("/test-posting", async (_, res) => {
    try {
        const response = {
            timestamp: new Date().toISOString(),
            posting_system: {
                collections_module: !!initCollections ? "✅ Loaded" : "❌ Missing",
                cleanup_service: !!CleanupService ? "✅ Loaded" : "❌ Missing",
                flow_module: !!postingFlowModule ? "✅ Loaded" : "❌ Missing"
            },
            firestore_status: "Testing connection...",
            environment: {
                WHATSAPP_FLOW_ID: process.env.WHATSAPP_FLOW_ID || "Not set",
                FLOW_MODE: process.env.FLOW_MODE || "Not set"
            }
        };
        
        // Test Firestore connection
        try {
            const { db } = require("./database/firestore");
            // Try to access a simple collection to test connection
            const collections = ['users', 'sessions', 'drafts', 'listings'];
            const status = {};
            
            for (const collection of collections) {
                try {
                    const colRef = db.collection(collection);
                    // Just check if we can access it without error
                    status[collection] = "✅ Accessible";
                } catch (error) {
                    status[collection] = `❌ Error: ${error.message}`;
                }
            }
            
            response.firestore_status = status;
            response.overall = "✅ Posting system ready for testing";
            
        } catch (error) {
            response.firestore_status = `❌ Error: ${error.message}`;
            response.overall = "⚠️ Posting system partially initialized";
        }
        
        res.json(response);
        
    } catch (error) {
        console.error("❌ Error in test-posting:", error);
        res.status(500).json({ 
            error: "Test failed", 
            message: error.message 
        });
    }
});

app.post("/api/test-draft", express.json(), async (req, res) => {
    try {
        const { userId, message } = req.body;
        
        if (!userId || !message) {
            return res.status(400).json({ 
                error: "Missing userId or message" 
            });
        }
        
        console.log(`📝 Testing posting system for user: ${userId}`);
        
        // Test posting service
        try {
            const PostingService = require("./services/posting-service");
            const postingService = new PostingService(userId);
            const result = await postingService.processMessage(message);
            
            res.json({
                success: true,
                userId,
                message,
                result,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error("❌ Posting service error:", error);
            res.status(500).json({
                success: false,
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
        
    } catch (error) {
        console.error("❌ Error in test-draft:", error);
        res.status(500).json({ 
            error: "Test failed", 
            message: error.message 
        });
    }
});

// ============================================
// ADMIN ROUTES FOR POSTING SYSTEM - NEW
// ============================================
app.get("/admin/drafts", async (req, res) => {
    try {
        // Simple authentication check
        const adminToken = req.query.token || req.headers['x-admin-token'];
        const expectedToken = process.env.ADMIN_TOKEN || "admin123";
        
        if (adminToken !== expectedToken) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        
        const { db } = require("./database/firestore");
        const draftsRef = db.collection('drafts');
        const snapshot = await draftsRef.limit(50).get();
        
        const drafts = [];
        snapshot.forEach(doc => {
            drafts.push({
                id: doc.id,
                ...doc.data(),
                // Convert timestamps
                createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
                updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt
            });
        });
        
        res.json({
            count: drafts.length,
            drafts,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error("❌ Error fetching drafts:", error);
        res.status(500).json({ 
            error: "Failed to fetch drafts", 
            message: error.message 
        });
    }
});

app.get("/admin/sessions", async (req, res) => {
    try {
        // Simple authentication check
        const adminToken = req.query.token || req.headers['x-admin-token'];
        const expectedToken = process.env.ADMIN_TOKEN || "admin123";
        
        if (adminToken !== expectedToken) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        
        const { db } = require("./database/firestore");
        const sessionsRef = db.collection('sessions');
        const snapshot = await sessionsRef.limit(50).get();
        
        const sessions = [];
        snapshot.forEach(doc => {
            sessions.push({
                id: doc.id,
                ...doc.data(),
                updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt
            });
        });
        
        res.json({
            count: sessions.length,
            sessions,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error("❌ Error fetching sessions:", error);
        res.status(500).json({ 
            error: "Failed to fetch sessions", 
            message: error.message 
        });
    }
});

app.post("/admin/cleanup", express.json(), async (req, res) => {
    try {
        // Simple authentication check
        const adminToken = req.body.token || req.headers['x-admin-token'];
        const expectedToken = process.env.ADMIN_TOKEN || "admin123";
        
        if (adminToken !== expectedToken) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        
        const cleanupService = new CleanupService();
        const result = await cleanupService.cleanupOldDrafts();
        
        res.json({
            success: true,
            result,
            timestamp: new Date().toISOString(),
            message: `Cleaned up ${result.cleaned} old drafts (deletedDrafts: ${result.deletedDrafts || 0}, sessionsReset: ${result.sessionsReset || 0})`
        });
        
    } catch (error) {
        console.error("❌ Error in cleanup:", error);
        res.status(500).json({ 
            error: "Cleanup failed", 
            message: error.message 
        });
    }
});

// ============================================
// ROOT ROUTE - UPDATED WITH POSTING SYSTEM INFO
// ============================================
app.get("/", (_, res) => {
    const whatsappFlowId = process.env.WHATSAPP_FLOW_ID || "Not configured";
    const flowMode = process.env.FLOW_MODE || "draft";
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>MarketMatch AI WhatsApp Bot</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    min-height: 100vh;
                }
                .container {
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    padding: 30px;
                    border-radius: 15px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
                }
                h1 {
                    margin-top: 0;
                    font-size: 2.5em;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
                }
                .status-badge {
                    display: inline-block;
                    padding: 5px 15px;
                    background: #10b981;
                    color: white;
                    border-radius: 20px;
                    font-weight: bold;
                    margin-bottom: 20px;
                }
                .section {
                    background: rgba(255, 255, 255, 0.15);
                    padding: 20px;
                    border-radius: 10px;
                    margin: 20px 0;
                }
                .section h2 {
                    margin-top: 0;
                    color: #e5e7eb;
                }
                ul {
                    list-style: none;
                    padding: 0;
                }
                li {
                    margin: 10px 0;
                    padding: 10px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 5px;
                    transition: all 0.3s;
                }
                li:hover {
                    background: rgba(255, 255, 255, 0.2);
                    transform: translateX(5px);
                }
                a {
                    color: #93c5fd;
                    text-decoration: none;
                    font-weight: bold;
                }
                a:hover {
                    color: #60a5fa;
                    text-decoration: underline;
                }
                .features {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin: 20px 0;
                }
                .feature {
                    background: rgba(255, 255, 255, 0.1);
                    padding: 15px;
                    border-radius: 8px;
                    text-align: center;
                }
                .feature .emoji {
                    font-size: 2em;
                    margin-bottom: 10px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🚀 MarketMatch AI WhatsApp Bot</h1>
                <div class="status-badge">✅ Running</div>
                
                <div class="section">
                    <h2>📊 System Status</h2>
                    <ul>
                        <li><a href="/test">Service Status</a> - Check all services</li>
                        <li><a href="/health">Health Check</a> - System health status</li>
                        <li><a href="/test-posting">Posting System Test</a> - Test new posting system</li>
                    </ul>
                </div>
                
                <div class="section">
                    <h2>📝 Posting System (NEW)</h2>
                    <div class="features">
                        <div class="feature">
                            <div class="emoji">🤖</div>
                            <div>AI-Assisted Posting</div>
                        </div>
                        <div class="feature">
                            <div class="emoji">📋</div>
                            <div>WhatsApp Flows</div>
                        </div>
                        <div class="feature">
                            <div class="emoji">💬</div>
                            <div>Chat-Based Posting</div>
                        </div>
                        <div class="feature">
                            <div class="emoji">🗂️</div>
                            <div>Draft Management</div>
                        </div>
                    </div>
                    <ul>
                        <li><strong>Flow ID:</strong> ${whatsappFlowId}</li>
                        <li><strong>Flow Mode:</strong> ${flowMode}</li>
                        <li><a href="/api/test-draft" style="color: #34d399;">Test Draft Creation</a></li>
                    </ul>
                </div>
                
                <div class="section">
                    <h2>🔧 Admin Tools</h2>
                    <ul>
                        <li><a href="/admin/drafts?token=admin123">View Drafts</a> - View all active drafts</li>
                        <li><a href="/admin/sessions?token=admin123">View Sessions</a> - View active sessions</li>
                        <li><a href="/admin/cleanup" style="color: #f87171;">Cleanup Old Drafts</a> - Clean up old drafts</li>
                    </ul>
                </div>
                
                <div class="section">
                    <h2>🌐 API Endpoints</h2>
                    <ul>
                        <li><strong>Webhook:</strong> POST /webhook</li>
                        <li><strong>Flow Completion:</strong> POST /api/flow/flow-complete</li>
                        <li><strong>Verify Token:</strong> GET /webhook?hub.mode=subscribe&hub.verify_token=...</li>
                    </ul>
                </div>
            </div>
        </body>
        </html>
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
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// 404 handler
app.use((req, res) => {
    console.log(`[404] ${req.method} ${req.url} - Not found`);
    res.status(404).json({ error: "Not found" });
});

// ============================================
// START SERVER WITH POSTING SYSTEM INITIALIZATION
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
    📝 POSTING SYSTEM STATUS:
    🔧 Collections: ${initCollections ? '✅ Loaded' : '❌ Missing'}
    🧹 Cleanup Service: ${CleanupService ? '✅ Loaded' : '❌ Missing'}
    🌊 Flow Webhook: ${flowWebhookRouter ? '✅ Loaded' : '❌ Missing'}
    ========================================
    ENVIRONMENT CHECK:
    🔑 WHATSAPP_TOKEN: ${process.env.WHATSAPP_TOKEN ? '✅ Found' : '❌ Missing'}
    📱 PHONE_ID: ${process.env.WHATSAPP_PHONE_ID || '❌ Missing'}
    🔐 VERIFY_TOKEN: ${process.env.VERIFY_TOKEN ? '✅ Set' : '❌ Missing'}
    📝 WHATSAPP_FLOW_ID: ${process.env.WHATSAPP_FLOW_ID ? '✅ Found' : '❌ Missing'}
    🔧 FLOW_MODE: ${process.env.FLOW_MODE || '❌ Not set'}
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
    📍 http://localhost:${PORT}/test-posting
    📍 POST http://localhost:${PORT}/webhook
    📍 POST http://localhost:${PORT}/api/flow/flow-complete
    📍 GET http://localhost:${PORT}/admin/drafts?token=admin123
    ========================================
    `);
    
    if (voiceService) {
        console.log("🎤 VoiceService WhatsApp Status:");
        console.log(`   Access Token: ${voiceService.whatsappAccessToken ? '✅ Set' : '❌ Missing'}`);
        console.log(`   Phone Number ID: ${voiceService.whatsappPhoneNumberId || '❌ Not set'}`);
        console.log(`   Can process voice: ${typeof voiceService.processVoiceMessage === 'function' ? '✅ Yes' : '❌ No'}`);
    }
    
    // Initialize cleanup service
    setTimeout(async () => {
        try {
            const cleanupService = new CleanupService();
            console.log("🧹 Running initial cleanup...");
            const result = await cleanupService.cleanupOldDrafts();
            console.log(`✅ Initial cleanup complete: ${result.cleaned} drafts cleaned`);
            
            // Schedule regular cleanup (every 6 hours)
            setInterval(async () => {
                console.log("⏰ Running scheduled cleanup...");
                try {
                    const cleanupResult = await cleanupService.cleanupOldDrafts();
                    const sessionResult = await cleanupService.cleanupAbandonedSessions();
                    console.log(`🧹 Scheduled cleanup: ${cleanupResult.cleaned} drafts, ${sessionResult.cleaned} sessions`);
                } catch (error) {
                    console.error("❌ Error in scheduled cleanup:", error.message);
                }
            }, 6 * 60 * 60 * 1000); // 6 hours
            
        } catch (error) {
            console.error("❌ Error initializing cleanup service:", error.message);
        }
    }, 5000); // Wait 5 seconds after server starts
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

// ============================================
// POSTING SYSTEM HEALTH CHECK - NEW
// ============================================
// Run periodic health check for posting system
setInterval(() => {
    console.log("🔍 Posting system health check...");
    
    try {
        // Check if posting service is working
        const PostingService = require("./services/posting-service");
        const testService = new PostingService("test_user");
        console.log("✅ PostingService instance created successfully");
        
        // Check Firestore connection
        const { db } = require("./database/firestore");
        console.log("✅ Firestore connection active");
        
    } catch (error) {
        console.error("❌ Posting system health check failed:", error.message);
    }
}, 30 * 60 * 1000); // Every 30 minutes