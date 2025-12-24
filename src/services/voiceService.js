// ========================================
// voiceService.js - ENHANCED WITH URBAN HELP SUPPORT
// ========================================
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const voiceProcessor = require('../core/ai/voiceProcessor');
const messageUtils = require('../../utils/messageUtils');
const constants = require('../../utils/constants');

// Import multi-language support
const multiLanguage = require('../../utils/multiLanguage');

// Import database functions
let firestoreDb;
try {
    firestoreDb = require('../../database/firestore');
} catch (error) {
    console.warn('[VOICE] Database functions not found, using mock data');
    firestoreDb = null;
}

class VoiceService {
    constructor() {
        this.supportedAudioFormats = ['ogg', 'opus', 'mp3', 'wav', 'm4a'];
        this.maxAudioSize = 10 * 1024 * 1024; // 10MB
        this.tempDir = path.join(__dirname, '../../temp');
        
        // Create temp directory if it doesn't exist
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
        
        // WhatsApp API Configuration
        this.whatsappAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        this.whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        this.whatsappApiVersion = process.env.WHATSAPP_API_VERSION || 'v19.0';
        
        // Log level control
        this.LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
        this.levels = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
        
        // ✅ NEW: Initialize WhatsApp credentials
        this.initializeWhatsAppCredentials();
        
        // Urban Help Categories
        this.urbanHelpCategories = {
            'electrician': { 
                name: 'Electrician',
                emoji: '🔧',
                keywords: ['electrician', 'wiring', 'electrical', 'fuse', 'light', 'switch']
            },
            'plumber': { 
                name: 'Plumber', 
                emoji: '🚰',
                keywords: ['plumber', 'pipe', 'water', 'leak', 'tap', 'bathroom', 'toilet']
            },
            'maid': { 
                name: 'Maid/Househelp', 
                emoji: '🧹',
                keywords: ['maid', 'househelp', 'cleaning', 'cook', 'naukrani', 'housekeeping']
            },
            'carpenter': { 
                name: 'Carpenter', 
                emoji: '🔨',
                keywords: ['carpenter', 'woodwork', 'furniture', 'repair', 'door', 'window']
            },
            'cleaner': { 
                name: 'Cleaner', 
                emoji: '🧼',
                keywords: ['cleaner', 'cleaning', 'deep clean', 'house cleaning']
            },
            'technician': { 
                name: 'Technician', 
                emoji: '🔩',
                keywords: ['technician', 'ac repair', 'appliance repair', 'tv repair']
            },
            'driver': { 
                name: 'Driver', 
                emoji: '🚗',
                keywords: ['driver', 'chauffeur', 'car driver', 'permanent driver']
            },
            'painter': { 
                name: 'Painter', 
                emoji: '🎨',
                keywords: ['painter', 'painting', 'wall', 'color', 'house painting']
            }
        };
        
        // AI intent descriptions - Updated with Urban Help
        this.intentDescriptions = {
            'buy_property': 'buy a property',
            'rent_property': 'rent a property', 
            'sell_property': 'sell a property',
            'post_listing': 'post a listing',
            'search_listing': 'search listings',
            'view_listing': 'view listing details',
            'contact_agent': 'contact an agent',
            'urban_help_request': 'find urban help service',
            'service_request': 'find a service provider',
            'commodity_search': 'find commodities',
            'unknown': 'get assistance'
        };
        
        console.log('🎤 [VOICE AI] Voice Service with Urban Help initialized');
        console.log(`🎤 [VOICE AI] WhatsApp Access Token: ${this.whatsappAccessToken ? '✅ Available' : '❌ Missing'}`);
    }

    /**
     * ✅ NEW: Initialize WhatsApp credentials
     */
    initializeWhatsAppCredentials() {
        // Try to get from environment if not set in constructor
        if (!this.whatsappAccessToken) {
            this.whatsappAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        }
        if (!this.whatsappPhoneNumberId) {
            this.whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        }
        if (!this.whatsappApiVersion) {
            this.whatsappApiVersion = process.env.WHATSAPP_API_VERSION || 'v19.0';
        }
        
        if (this.whatsappAccessToken) {
            console.log(`🎤 [VOICE AI] WhatsApp Phone Number ID: ${this.whatsappPhoneNumberId || 'Not configured'}`);
            console.log(`🎤 [VOICE AI] WhatsApp API Version: ${this.whatsappApiVersion}`);
        } else {
            console.warn('🎤 [VOICE AI] WhatsApp access token not configured. Voice message download may fail.');
        }
    }

    /**
     * ✅ NEW: Set WhatsApp credentials programmatically
     */
    setWhatsAppCredentials(config) {
        this.whatsappAccessToken = config.accessToken || this.whatsappAccessToken;
        this.whatsappPhoneNumberId = config.phoneNumberId || this.whatsappPhoneNumberId;
        this.whatsappApiVersion = config.apiVersion || this.whatsappApiVersion;
        
        console.log(`🎤 [VOICE AI] WhatsApp credentials updated: ${this.whatsappAccessToken ? '✅' : '❌'}`);
    }

    /**
     * Controlled logging
     */
    log(level, ...args) {
        if (this.levels[level] <= this.levels[this.LOG_LEVEL]) {
            console.log(`[${level}] VoiceService:`, ...args);
        }
    }

    /**
     * Process incoming voice message - UPDATED: Transcription only, no intent extraction
     */
    async processVoiceMessage(message, mediaUrl, client) {
        try {
            this.log('INFO', `Processing voice from ${message.from.substring(0, 10)}...`);
            
            let audioBuffer = null;
            let transcription = "";
            
            // Try to download audio with authentication
            try {
                audioBuffer = await this.downloadAudioWithAuth(mediaUrl, message.id);
                if (!audioBuffer) {
                    // Try alternative download method
                    audioBuffer = await this.tryAlternativeDownload(mediaUrl, message.id);
                    
                    if (!audioBuffer) {
                        return {
                            success: false,
                            error: 'Could not download audio. Please send the voice message again.',
                            userMessage: message
                        };
                    }
                }
            } catch (downloadError) {
                this.log('ERROR', `Download failed: ${downloadError.message}`);
                return {
                    success: false,
                    error: 'Voice message download failed. Please try again.',
                    userMessage: message
                };
            }
            
            // Transcribe audio - NO FALLBACK TEXT
            if (audioBuffer) {
                try {
                    const convertedAudioPath = await this.convertToWav(audioBuffer, message.id);
                    transcription = await voiceProcessor.transcribeAudio(convertedAudioPath);
                    
                    // Clean up temp files
                    this.cleanupTempFiles(message.id);
                    
                    // IMPORTANT: Check if transcription is null or empty
                    if (!transcription || transcription.trim() === '' || transcription === 'null') {
                        this.log('WARN', 'No speech detected in audio');
                        return {
                            success: false,
                            error: 'No speech detected. Please speak clearly and try again.',
                            userMessage: message
                        };
                    }
                    
                    this.log('INFO', `✅ Raw Transcription: "${transcription}"`);
                    
                } catch (transcribeError) {
                    this.log('ERROR', `Transcription failed: ${transcribeError.message}`);
                    return {
                        success: false,
                        error: 'Could not transcribe voice message. Please try again or type your request.',
                        userMessage: message
                    };
                }
            } else {
                // No fallback text - ask user to try again
                return {
                    success: false,
                    error: 'Could not process voice message. Please try again.',
                    userMessage: message
                };
            }

            // IMPORTANT: Return ONLY the transcription for confirmation
            // Don't extract intent yet - wait for user confirmation
            return {
                success: true,
                transcription: transcription,  // Just the raw transcription
                userMessage: message,
                needsConfirmation: true  // Flag to indicate we need user confirmation
            };

        } catch (error) {
            this.log('ERROR', `Process failed: ${error.message}`);
            this.cleanupTempFiles(message.id);
            
            return {
                success: false,
                error: 'Voice processing error. Please try again.',
                userMessage: message
            };
        }
    }

    /**
     * ✅ UPDATED: Download audio with proper authentication - Improved error handling
     */
    async downloadAudioWithAuth(mediaUrl, messageId) {
        try {
            this.log('DEBUG', `Downloading with auth: ${messageId.substring(0, 10)}...`);
            
            // Check if access token is available
            if (!this.whatsappAccessToken) {
                this.log('ERROR', 'WhatsApp access token not configured');
                throw new Error('WhatsApp access token not configured');
            }
            
            this.log('DEBUG', `Using access token: ${this.whatsappAccessToken.substring(0, 10)}...`);
            
            const response = await axios({
                method: 'GET',
                url: mediaUrl,
                responseType: 'arraybuffer',
                timeout: 30000, // Increased timeout to 30 seconds
                maxContentLength: 15 * 1024 * 1024,
                headers: {
                    'Authorization': `Bearer ${this.whatsappAccessToken}`,
                    'User-Agent': 'MarketMatch-AI/1.0',
                    'Accept': 'audio/*'
                }
            });

            if (response.status !== 200) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const fileSizeKB = (response.data.length / 1024).toFixed(2);
            this.log('INFO', `✅ Downloaded ${fileSizeKB}KB audio`);
            
            return response.data;
        } catch (error) {
            this.log('ERROR', `Download failed: ${error.message}`);
            
            // If it's a 401/403 error, the token might be invalid
            if (error.response?.status === 401 || error.response?.status === 403) {
                this.log('ERROR', 'Access token invalid or expired');
            }
            
            throw error; // Re-throw to be handled by caller
        }
    }

    /**
     * ✅ NEW: Alternative download methods
     */
    async tryAlternativeDownload(mediaUrl, messageId) {
        this.log('INFO', 'Trying alternative download methods...');
        
        // Try 1: Direct download without auth (some URLs might work)
        try {
            const buffer = await this.downloadAudioDirect(mediaUrl, messageId);
            if (buffer) {
                this.log('INFO', '✅ Direct download successful');
                return buffer;
            }
        } catch (error) {
            this.log('WARN', `Direct download failed: ${error.message}`);
        }
        
        // Try 2: Download with different headers
        try {
            const buffer = await this.downloadAudioWithRetry(mediaUrl, messageId);
            if (buffer) {
                this.log('INFO', '✅ Retry download successful');
                return buffer;
            }
        } catch (error) {
            this.log('WARN', `Retry download failed: ${error.message}`);
        }
        
        this.log('ERROR', 'All download methods failed');
        return null;
    }

    /**
     * ✅ NEW: Direct download without authentication
     */
    async downloadAudioDirect(mediaUrl, messageId) {
        try {
            const response = await axios({
                method: 'GET',
                url: mediaUrl,
                responseType: 'arraybuffer',
                timeout: 15000,
                maxContentLength: 15 * 1024 * 1024,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'audio/*, */*',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept-Language': 'en-US,en;q=0.9'
                }
            });
            
            if (response.status === 200) {
                return response.data;
            }
            return null;
        } catch (error) {
            throw error;
        }
    }

    /**
     * ✅ NEW: Download with retry mechanism
     */
    async downloadAudioWithRetry(mediaUrl, messageId) {
        const maxRetries = 3;
        let lastError;
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await axios({
                    method: 'GET',
                    url: mediaUrl,
                    responseType: 'arraybuffer',
                    timeout: 10000,
                    maxContentLength: 15 * 1024 * 1024,
                    headers: {
                        'User-Agent': i === 0 ? 
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' :
                            'MarketMatch-AI/1.0',
                        'Accept': 'audio/*'
                    }
                });
                
                if (response.status === 200) {
                    return response.data;
                }
            } catch (error) {
                lastError = error;
                this.log('DEBUG', `Retry ${i + 1} failed: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
            }
        }
        
        throw lastError;
    }

    /**
     * NEW: Send transcription confirmation to user
     */
    async sendTranscriptionConfirmation(phoneNumber, transcription, client) {
        try {
            const userLang = multiLanguage.getUserLanguage(phoneNumber) || 'en';
            
            let confirmationMessage = '';
            if (userLang === 'hi') {
                confirmationMessage = `🎤 मैंने सुना: "*${transcription}"*\n\nक्या यह सही है?\n\nजवाब दें:\n✅ *हां* - अगर सही है\n🔄 *नहीं* - फिर से कोशिश करें\n📝 *टाइप करें* - टाइप करके भेजें`;
            } else if (userLang === 'ta') {
                confirmationMessage = `🎤 நான் கேட்டேன்: "*${transcription}"*\n\nஇது சரியானதா?\n\nபதில்:\n✅ *ஆம்* - சரியானது என்றால்\n🔄 *இல்லை* - மீண்டும் முயற்சிக்கவும்\n📝 *தட்டச்சு செய்யவும்* - தட்டச்சு செய்து அனுப்பவும்`;
            } else {
                confirmationMessage = `🎤 I heard: "*${transcription}"*\n\nIs this correct?\n\nReply with:\n✅ *Yes* - if correct\n🔄 *No* - to try again\n📝 *Type* - to type instead`;
            }
            
            await this.sendMessage(client, phoneNumber, confirmationMessage);
            return true;
            
        } catch (error) {
            this.log('ERROR', `Failed to send confirmation: ${error.message}`);
            return false;
        }
    }

    /**
     * NEW: Process confirmed transcription (after user confirms)
     */
    async processConfirmedTranscription(phoneNumber, confirmedTranscription, client) {
        try {
            this.log('INFO', `Processing confirmed transcription: "${confirmedTranscription}"`);
            
            // Now extract intent from the confirmed text
            const intentResult = await voiceProcessor.extractIntent(confirmedTranscription, phoneNumber);
            
            // Set user language
            if (intentResult.language) {
                multiLanguage.setUserLanguage(phoneNumber, intentResult.language);
            }
            
            this.log('INFO', `Intent: ${intentResult.intent}, Confidence: ${intentResult.confidence}`);
            
            // Return result for further processing
            return {
                success: true,
                transcription: confirmedTranscription,
                intent: intentResult.intent,
                entities: intentResult.entities,
                confidence: intentResult.confidence,
                language: intentResult.language,
                missingInfo: intentResult.missingInfo || [],
                method: intentResult.method,
                userMessage: { from: phoneNumber }
            };
            
        } catch (error) {
            this.log('ERROR', `Failed to process confirmed transcription: ${error.message}`);
            return {
                success: false,
                error: 'Failed to process your request. Please try again.'
            };
        }
    }

    /**
     * NEW: Extract intent after confirmation (wrapper for existing handleIntentConfirmation)
     */
    async extractIntentAfterConfirmation(phoneNumber, transcription, session, client) {
        try {
            // First, process the confirmed transcription
            const processingResult = await this.processConfirmedTranscription(phoneNumber, transcription, client);
            
            if (!processingResult.success) {
                throw new Error(processingResult.error || 'Failed to process transcription');
            }
            
            // Now use existing handleIntentConfirmation with the confirmed result
            await this.handleIntentConfirmation(
                phoneNumber,
                session,
                processingResult.transcription,
                processingResult.intent,
                processingResult.confidence,
                client
            );
            
            return processingResult;
            
        } catch (error) {
            this.log('ERROR', `Intent extraction failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Check if transcription is an urban help request
     */
    isUrbanHelpRequest(transcription) {
        const lowerText = transcription.toLowerCase();
        
        // Check for urban help keywords
        const urbanHelpKeywords = [
            'electrician', 'plumber', 'maid', 'carpenter', 'cleaner', 
            'technician', 'driver', 'painter', 'naukrani', 'househelp',
            'service', 'repair', 'chahiye', 'required', 'needed'
        ];
        
        return urbanHelpKeywords.some(keyword => lowerText.includes(keyword));
    }

    /**
     * Handle intent confirmation with AI enhancement
     */
    async handleIntentConfirmation(phoneNumber, session, transcription, intent, confidence, client) {
        this.log('INFO', `AI Confirmation for ${phoneNumber}, intent: ${intent}, confidence: ${confidence}`);
        
        try {
            // Create processingResult object
            const processingResult = {
                userMessage: { 
                    from: phoneNumber, 
                    id: session?.lastMessageId || Date.now().toString() 
                },
                intent: intent,
                entities: session?.entities || {},
                confidence: confidence,
                transcription: transcription
            };
            
            // Validate client
            if (!client) {
                this.log('ERROR', `WhatsApp client is null for ${phoneNumber}`);
                throw new Error('WhatsApp client not available');
            }
            
            // Get user language
            const userLang = multiLanguage.getUserLanguage(phoneNumber) || 'en';
            
            if (confidence < (constants.VOICE_CONFIDENCE_THRESHOLD || 0.6)) {
                // Low confidence - ask for clarification
                this.log('INFO', `Low confidence (${confidence}), asking for clarification`);
                await this.sendAIClarificationMessage(phoneNumber, client, processingResult, userLang);
                return;
            }

            // Special handling for urban help requests
            if (intent === 'urban_help_request') {
                await this.handleUrbanHelpIntent(phoneNumber, session, processingResult, client, userLang);
                return;
            }

            // Good confidence - show AI confirmation
            this.log('INFO', `Good confidence (${confidence}), sending AI confirmation`);
            await this.sendAIConfirmation(phoneNumber, client, processingResult, userLang);
            
        } catch (error) {
            this.log('ERROR', `handleIntentConfirmation failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Handle urban help intent
     */
    async handleUrbanHelpIntent(phoneNumber, session, processingResult, client, userLang) {
        const { entities, transcription, confidence } = processingResult;
        
        // Check for missing information
        const missingInfo = this.checkMissingUrbanHelpInfo(entities);
        
        if (missingInfo.length > 0) {
            // Ask for missing information
            await this.askForMissingUrbanHelpInfo(phoneNumber, client, entities, missingInfo, userLang);
            
            // Save context
            await this.saveVoiceContext(phoneNumber, {
                ...processingResult,
                missingInfo: missingInfo,
                isUrbanHelp: true
            });
            
        } else if (confidence < 0.7) {
            // Low confidence for urban help
            await this.sendUrbanHelpClarification(phoneNumber, client, processingResult, userLang);
            
            // Save context
            await this.saveVoiceContext(phoneNumber, {
                ...processingResult,
                isUrbanHelp: true,
                needsClarification: true
            });
            
        } else {
            // Good confidence - show urban help confirmation
            await this.sendUrbanHelpConfirmation(phoneNumber, client, processingResult, userLang);
            
            // Save context
            await this.saveVoiceContext(phoneNumber, {
                ...processingResult,
                isUrbanHelp: true
            });
        }
    }

    /**
     * Check for missing urban help information
     */
    checkMissingUrbanHelpInfo(entities) {
        const missing = [];
        
        // Category is always required
        if (!entities.category) {
            missing.push('category');
        }
        
        // Location is required for all services
        if (!entities.location) {
            missing.push('location');
        }
        
        return missing;
    }

    /**
     * Ask for missing urban help information
     */
    async askForMissingUrbanHelpInfo(phoneNumber, client, entities, missingInfo, userLang) {
        let message = '';
        let buttons = [];
        
        if (missingInfo.includes('category')) {
            message = multiLanguage.getMessage(userLang, 'ask_category') || 
                     "What type of service do you need?";
            
            // Show top 4 categories as buttons
            const topCategories = ['electrician', 'plumber', 'maid', 'cleaner'];
            buttons = topCategories.map(category => ({
                id: `category_${category}`,
                text: `${this.urbanHelpCategories[category].emoji} ${this.urbanHelpCategories[category].name}`
            }));
            
            buttons.push({ id: 'other_category', text: 'Other Service' });
            
        } else if (missingInfo.includes('location')) {
            const categoryName = this.urbanHelpCategories[entities.category]?.name || 'service';
            message = multiLanguage.getMessage(userLang, 'ask_location', { category: categoryName }) ||
                     `Where do you need the ${categoryName}?`;
            
            buttons = [
                { id: 'location_noida', text: '📍 Noida' },
                { id: 'location_gurgaon', text: '📍 Gurgaon' },
                { id: 'location_delhi', text: '📍 Delhi' },
                { id: 'type_location', text: '📝 Type location' }
            ];
        }
        
        this.log('INFO', `Asking for missing info: ${missingInfo.join(', ')}`);
        await messageUtils.sendInteractiveButtons(client, phoneNumber, message, buttons);
    }

    /**
     * Send urban help clarification
     */
    async sendUrbanHelpClarification(phoneNumber, client, processingResult, userLang) {
        const { transcription } = processingResult;
        
        let clarificationText = multiLanguage.getMessage(userLang, 'not_understood') + 
            `\n\nI heard: "*${transcription.substring(0, 50)}${transcription.length > 50 ? '...' : ''}*"\n\n` +
            multiLanguage.getMessage(userLang, 'urban_help_clarify') || 
            "Is this about finding a service provider?";
        
        const buttons = [
            { id: 'confirm_urban_help', text: '✅ Yes, correct' },
            { id: 'try_again_urban', text: '🔄 Try again' },
            { id: 'type_instead', text: '📝 Type instead' }
        ];
        
        this.log('INFO', `Sending urban help clarification to ${phoneNumber}`);
        await messageUtils.sendInteractiveButtons(client, phoneNumber, clarificationText, buttons);
    }

    /**
     * Send urban help confirmation
     */
    async sendUrbanHelpConfirmation(phoneNumber, client, processingResult, userLang) {
        const { entities, transcription } = processingResult;
        
        const category = entities.category || 'service';
        const categoryName = this.urbanHelpCategories[category]?.name || 'Service';
        const location = entities.location || 'your area';
        
        let confirmationText = '';
        
        if (userLang === 'hi') {
            confirmationText = `मैंने समझा: "*${transcription}"*\n\n` +
                              `आपको *${location}* में *${categoryName}* चाहिए।\n\n` +
                              `क्या यह सही है?`;
        } else if (userLang === 'ta') {
            confirmationText = `நான் புரிந்து கொண்டேன்: "*${transcription}"*\n\n` +
                              `உங்களுக்கு *${location}*-ல் *${categoryName}* தேவை.\n\n` +
                              `இது சரியானதா?`;
        } else {
            confirmationText = `I understood: "*${transcription}"*\n\n` +
                              `You need a *${categoryName}* in *${location}*.\n\n` +
                              `Is this correct?`;
        }
        
        const buttons = [
            { id: `confirm_urban_${category}`, text: '✅ Yes, find service' },
            { id: 'try_again_urban', text: '🔄 Try again' },
            { id: 'modify_details', text: '✏️ Modify details' }
        ];
        
        this.log('INFO', `Sending urban help confirmation to ${phoneNumber}`);
        await messageUtils.sendInteractiveButtons(client, phoneNumber, confirmationText, buttons);
    }

    /**
     * Send AI-enhanced confirmation message
     */
    async sendAIConfirmation(phoneNumber, client, processingResult, userLang = 'en') {
        const { intent, entities, transcription } = processingResult;
        
        // Generate confirmation message based on intent
        let confirmationText = '';
        
        // Use multi-language if available
        confirmationText = this.generateConfirmationMessage(intent, entities, transcription, userLang);
        
        // Get appropriate buttons
        const buttons = this.getConfirmationButtons(intent, userLang);
        
        // Store context for later use
        await this.saveVoiceContext(phoneNumber, processingResult);
        
        this.log('INFO', `Sending AI confirmation to ${phoneNumber}`);
        await messageUtils.sendInteractiveButtons(client, phoneNumber, confirmationText, buttons);
    }

    /**
     * Send AI clarification message
     */
    async sendAIClarificationMessage(phoneNumber, client, processingResult, userLang = 'en') {
        const { transcription } = processingResult;
        
        let clarificationText = '';
        let buttons = [];
        
        clarificationText = multiLanguage.getMessage(userLang, 'not_understood') + 
            `\n\nI heard: "*${transcription.substring(0, 50)}${transcription.length > 50 ? '...' : ''}*"\n\n` +
            multiLanguage.getMessage(userLang, 'try_again');
        
        buttons = [
            { id: 'try_voice', text: '🎤 Try voice again' },
            { id: 'use_text', text: '📝 Type instead' },
            { id: 'main_menu', text: '🏠 Main Menu' }
        ];
        
        this.log('INFO', `Sending AI clarification to ${phoneNumber}`);
        await messageUtils.sendInteractiveButtons(client, phoneNumber, clarificationText, buttons);
    }

    /**
     * Generate confirmation message (updated for urban help)
     */
    generateConfirmationMessage(intent, entities, transcription, userLang = 'en') {
        const intentText = this.intentDescriptions[intent] || intent;
        
        let confirmationText = '';
        
        if (userLang === 'hi') {
            confirmationText = `मैंने समझा: "*${transcription}"*\n\n`;
        } else if (userLang === 'ta') {
            confirmationText = `நான் புரிந்து கொண்டேன்: "*${transcription}"*\n\n`;
        } else {
            confirmationText = `I understood: "*${transcription}"*\n\n`;
        }
        
        if (intent === 'urban_help_request') {
            const category = entities.category || 'service';
            const categoryName = this.urbanHelpCategories[category]?.name || 'Service';
            const location = entities.location || 'your area';
            
            if (userLang === 'hi') {
                confirmationText += `आपको *${location}* में *${categoryName}* चाहिए।`;
            } else if (userLang === 'ta') {
                confirmationText += `உங்களுக்கு *${location}*-ல் *${categoryName}* தேவை.`;
            } else {
                confirmationText += `You want to find a *${categoryName}* in *${location}*`;
            }
            
        } else {
            if (userLang === 'hi') {
                confirmationText += `आप *${intentText}* चाहते हैं`;
            } else if (userLang === 'ta') {
                confirmationText += `நீங்கள் *${intentText}* வேண்டும்`;
            } else {
                confirmationText += `You want to *${intentText}*`;
            }
            
            // Add entity details
            if (entities.location) {
                if (userLang === 'hi') {
                    confirmationText += ` *${entities.location}* में`;
                } else if (userLang === 'ta') {
                    confirmationText += ` *${entities.location}*-ல்`;
                } else {
                    confirmationText += ` in *${entities.location}*`;
                }
            }
            if (entities.bedrooms) {
                if (userLang === 'hi') {
                    confirmationText += `, *${entities.bedrooms} BHK* के साथ`;
                } else if (userLang === 'ta') {
                    confirmationText += `, *${entities.bedrooms} BHK* உடன்`;
                } else {
                    confirmationText += ` with *${entities.bedrooms} BHK*`;
                }
            }
            if (entities.budget) {
                if (userLang === 'hi') {
                    confirmationText += `, बजट: *${entities.budget}*`;
                } else if (userLang === 'ta') {
                    confirmationText += `, பட்ஜெட்: *${entities.budget}*`;
                } else {
                    confirmationText += `, budget: *${entities.budget}*`;
                }
            }
            if (entities.service_type) {
                if (userLang === 'hi') {
                    confirmationText += `, सेवा: *${entities.service_type}*`;
                } else if (userLang === 'ta') {
                    confirmationText += `, சேவை: *${entities.service_type}*`;
                } else {
                    confirmationText += `, service: *${entities.service_type}*`;
                }
            }
        }

        if (userLang === 'hi') {
            confirmationText += `\n\nक्या यह सही है?`;
        } else if (userLang === 'ta') {
            confirmationText += `\n\nஇது சரியானதா?`;
        } else {
            confirmationText += `\n\nIs this correct?`;
        }
        
        return confirmationText;
    }

    /**
     * Get confirmation buttons based on intent
     */
    getConfirmationButtons(intent, userLang = 'en') {
        if (intent === 'urban_help_request') {
            return [
                { id: `confirm_urban_${intent}`, text: '✅ Yes, find service' },
                { id: 'try_again', text: '🔄 Try again' },
                { id: 'use_buttons', text: '📋 Show all options' }
            ];
        }
        
        // Fallback buttons for other intents
        return [
            { id: `confirm_${intent}`, text: '✅ Yes, proceed' },
            { id: 'try_again', text: '🔄 Try again' },
            { id: 'use_buttons', text: '📋 Show all options' }
        ];
    }

    /**
     * Handle confirmation response from user
     */
    async handleConfirmationResponse(phoneNumber, response, session, client) {
        const voiceContext = session.voiceContext;
        
        if (!voiceContext) {
            await this.sendMessage(client, phoneNumber, "Session expired. Please start over.");
            return;
        }
        
        const userLang = multiLanguage.getUserLanguage(phoneNumber) || 'en';
        
        // Handle urban help responses
        if (voiceContext.isUrbanHelp) {
            await this.handleUrbanHelpResponse(phoneNumber, response, voiceContext, session, client, userLang);
            return;
        }
        
        // Handle regular property-related responses
        switch(response) {
            case 'confirm_yes':
            case `confirm_${voiceContext.intent}`:
                // User confirmed - execute intent
                await this.sendMessage(client, phoneNumber, "✅ Great! Let me find that for you...");
                await this.executeAIIntent(phoneNumber, voiceContext, client, userLang);
                break;
                
            case 'try_again':
            case 'try_voice':
                // User wants to try again
                await this.sendMessage(client, phoneNumber, 
                    multiLanguage.getMessage(userLang, 'try_again') || "🔄 Please send your request again, more clearly.");
                await this.sendVoiceHelp(phoneNumber, client, userLang);
                break;
                
            case 'use_text':
            case 'use_buttons':
                // User wants to type
                await this.sendMessage(client, phoneNumber, 
                    multiLanguage.getMessage(userLang, 'type_instead') || "📝 Please type your request:");
                break;
                
            case 'main_menu':
                // Return to main menu
                await this.sendMessage(client, phoneNumber, "🏠 Returning to main menu...");
                break;
                
            default:
                await this.sendMessage(client, phoneNumber, 
                    multiLanguage.getMessage(userLang, 'not_understood') || "I didn't understand that response.");
                break;
        }
        
        // Clear voice context unless continuing
        if (response !== 'confirm_yes' && !response.startsWith('confirm_')) {
            delete session.voiceContext;
        }
    }

    /**
     * Handle urban help response
     */
    async handleUrbanHelpResponse(phoneNumber, response, voiceContext, session, client, userLang) {
        if (response.startsWith('confirm_urban_')) {
            // User confirmed - execute urban help search
            await this.sendMessage(client, phoneNumber, 
                multiLanguage.getMessage(userLang, 'searching') || "✅ Great! Finding the best service providers for you...");
            await this.executeUrbanHelpIntent(phoneNumber, voiceContext, client, userLang);
            
        } else if (response === 'try_again_urban') {
            // User wants to try again
            await this.sendMessage(client, phoneNumber, 
                "🔄 Please send your request again.");
            
        } else if (response === 'type_instead') {
            // User wants to type
            await this.sendMessage(client, phoneNumber, 
                "📝 Please type your request:");
            
        } else if (response.startsWith('category_')) {
            // User selected a category
            const category = response.replace('category_', '');
            voiceContext.entities.category = category;
            
            // Check if location is still missing
            if (!voiceContext.entities.location) {
                await this.askForMissingUrbanHelpInfo(phoneNumber, client, voiceContext.entities, ['location'], userLang);
                await this.saveVoiceContext(phoneNumber, voiceContext);
            } else {
                // Show confirmation with both category and location
                await this.sendUrbanHelpConfirmation(phoneNumber, client, voiceContext, userLang);
                await this.saveVoiceContext(phoneNumber, voiceContext);
            }
            
            return; // Don't clear context yet
            
        } else if (response.startsWith('location_')) {
            // User selected a location
            const location = response.replace('location_', '');
            voiceContext.entities.location = location.charAt(0).toUpperCase() + location.slice(1);
            
            // Show confirmation with both category and location
            await this.sendUrbanHelpConfirmation(phoneNumber, client, voiceContext, userLang);
            await this.saveVoiceContext(phoneNumber, voiceContext);
            return; // Don't clear context yet
            
        } else if (response === 'modify_details') {
            // User wants to modify
            await this.sendMessage(client, phoneNumber, 
                "✏️ What would you like to change? Please send your updated request.");
        }
        
        // Clear voice context
        delete session.voiceContext;
    }

    /**
     * Execute AI intent with domain-specific logic
     */
    async executeAIIntent(phoneNumber, voiceContext, client, userLang = 'en') {
        const { intent, entities } = voiceContext;
        
        this.log('INFO', `Executing AI intent: ${intent}`, entities);
        
        let results = [];
        let domain = '';
        
        try {
            switch(intent) {
                case 'buy_property':
                case 'rent_property':
                case 'search_listing':
                    domain = 'property';
                    const searchType = intent === 'rent_property' ? 'Rent' : 'Sale';
                    
                    if (firestoreDb && firestoreDb.searchListingsByCriteria) {
                        results = await firestoreDb.searchListingsByCriteria({
                            type: searchType,
                            location: entities.location,
                            bedrooms: entities.bhk || entities.bedrooms,
                            maxPrice: entities.budget ? this.parseBudgetToNumber(entities.budget) : null
                        });
                    } else {
                        results = this.getMockPropertyResults(entities);
                    }
                    break;
                    
                case 'urban_help_request':
                case 'service_request':
                    domain = 'urban_help';
                    if (firestoreDb && firestoreDb.searchUrbanHelp) {
                        results = await firestoreDb.searchUrbanHelp(
                            entities.category || entities.service_type,
                            entities.location,
                            entities
                        );
                    } else {
                        results = this.getMockUrbanHelpResults(entities);
                    }
                    break;
                    
                case 'commodity_search':
                    domain = 'commodity';
                    if (firestoreDb && firestoreDb.searchCommodities) {
                        results = await firestoreDb.searchCommodities(entities.commodity_item, entities.quantity);
                    } else {
                        results = this.getMockCommodityResults(entities);
                    }
                    break;
                    
                default:
                    await this.sendMessage(client, phoneNumber, 
                        "I understand your request! Let me help you find what you need.");
                    return;
            }
            
            // Send results
            if (results && results.length > 0) {
                let resultsMessage = '';
                
                if (domain === 'urban_help') {
                    resultsMessage = this.formatUrbanHelpResults(results, userLang);
                } else {
                    resultsMessage = this.formatResultsMessage(domain, results, userLang);
                }
                
                await this.sendMessage(client, phoneNumber, resultsMessage);
                
                // Ask if user needs more help
                const followUpText = "\n\nNeed more help? Send another voice message or type 'menu' for options.";
                await this.sendMessage(client, phoneNumber, followUpText);
            } else {
                let noResultsText = '';
                
                if (domain === 'urban_help') {
                    const category = entities.category || entities.service_type || 'service';
                    const categoryName = this.urbanHelpCategories[category]?.name || 'Service';
                    
                    if (userLang === 'hi') {
                        noResultsText = `❌ ${entities.location || 'आपके क्षेत्र'} में कोई ${categoryName} नहीं मिला।\n\nजब कोई उपलब्ध होगा तो मैं आपको सूचित करूंगा।`;
                    } else if (userLang === 'ta') {
                        noResultsText = `❌ ${entities.location || 'உங்கள் பகுதி'}-ல் ${categoryName} கிடைக்கவில்லை.\n\nஒன்று கிடைக்கும் போது உங்களுக்கு தெரிவிப்பேன்.`;
                    } else {
                        noResultsText = `❌ No ${categoryName} found in ${entities.location || 'your area'}.\n\nI'll notify you when one becomes available.`;
                    }
                } else {
                    noResultsText = multiLanguage.getMessage(userLang, 'no_results') ||
                        "❌ No results found for your request.\n\nTry:\n• Different keywords\n• Broader search area\n• Check back later";
                }
                
                await this.sendMessage(client, phoneNumber, noResultsText);
            }
            
        } catch (error) {
            this.log('ERROR', `Error executing intent ${intent}: ${error.message}`);
            await this.sendMessage(client, phoneNumber, 
                "❌ Sorry, I encountered an error while searching. Please try again.");
        }
    }

    /**
     * Execute urban help intent
     */
    async executeUrbanHelpIntent(phoneNumber, voiceContext, client, userLang = 'en') {
        const { entities } = voiceContext;
        
        this.log('INFO', `Executing urban help intent for ${entities.category} in ${entities.location}`);
        
        try {
            let results = [];
            
            if (firestoreDb && firestoreDb.searchUrbanHelp) {
                results = await firestoreDb.searchUrbanHelp(
                    entities.category,
                    entities.location,
                    entities
                );
            } else {
                results = this.getMockUrbanHelpResults(entities);
            }
            
            // Send results
            if (results && results.length > 0) {
                const resultsMessage = this.formatUrbanHelpResults(results, userLang);
                await this.sendMessage(client, phoneNumber, resultsMessage);
                
                // Add to user requests if database available
                if (firestoreDb && firestoreDb.addUserRequest) {
                    await firestoreDb.addUserRequest(phoneNumber, {
                        category: entities.category,
                        location: entities.location,
                        status: 'matched',
                        matchedProviders: results.map(r => r.id).slice(0, 3),
                        timestamp: Date.now()
                    });
                }
                
            } else {
                const categoryName = this.urbanHelpCategories[entities.category]?.name || 'Service';
                
                let noResultsMessage = '';
                if (userLang === 'hi') {
                    noResultsMessage = `❌ ${entities.location || 'आपके क्षेत्र'} में कोई ${categoryName} नहीं मिला।\n\nजब कोई उपलब्ध होगा तो मैं आपको सूचित करूंगा।`;
                } else if (userLang === 'ta') {
                    noResultsMessage = `❌ ${entities.location || 'உங்கள் பகுதி'}-ல் ${categoryName} கிடைக்கவில்லை.\n\nஒன்று கிடைக்கும் போது உங்களுக்கு தெரிவிப்பேன்.`;
                } else {
                    noResultsMessage = `❌ No ${categoryName} found in ${entities.location || 'your area'}.\n\nI'll notify you when one becomes available.`;
                }
                
                await this.sendMessage(client, phoneNumber, noResultsMessage);
                
                // Add to user requests as pending
                if (firestoreDb && firestoreDb.addUserRequest) {
                    await firestoreDb.addUserRequest(phoneNumber, {
                        category: entities.category,
                        location: entities.location,
                        status: 'pending',
                        timestamp: Date.now()
                    });
                }
            }
            
            // Send follow-up
            const followUpText = "\n\nNeed another service? Send another voice message or type 'menu' for options.";
            await this.sendMessage(client, phoneNumber, followUpText);
            
        } catch (error) {
            this.log('ERROR', `Error executing urban help intent: ${error.message}`);
            await this.sendMessage(client, phoneNumber, 
                "❌ Sorry, I encountered an error while searching. Please try again.");
        }
    }

    /**
     * Format urban help results
     */
    formatUrbanHelpResults(results, userLang) {
        const category = results[0]?.category || 'service';
        const categoryName = this.urbanHelpCategories[category]?.name || 'Service';
        const location = results[0]?.location || 'area';
        
        let message = '';
        
        if (userLang === 'hi') {
            message = `✅ ${location} में ${results.length} ${categoryName} मिले:\n\n`;
        } else if (userLang === 'ta') {
            message = `✅ ${location}-ல் ${results.length} ${categoryName} கிடைத்தது:\n\n`;
        } else {
            message = `✅ Found ${results.length} ${categoryName}(s) in ${location}:\n\n`;
        }
        
        results.slice(0, 5).forEach((provider, index) => {
            message += `*${index + 1}. ${provider.name || 'Service Provider'}*\n`;
            
            if (provider.rating) {
                message += `   ⭐ ${provider.rating}/5\n`;
            }
            
            if (provider.experience) {
                if (userLang === 'hi') {
                    message += `   📅 ${provider.experience} का अनुभव\n`;
                } else if (userLang === 'ta') {
                    message += `   📅 ${provider.experience} அனுபவம்\n`;
                } else {
                    message += `   📅 ${provider.experience} experience\n`;
                }
            }
            
            if (provider.contact) {
                message += `   📞 ${provider.contact}\n`;
            }
            
            if (provider.availability) {
                message += `   🕒 ${provider.availability}\n`;
            }
            
            if (provider.rate) {
                message += `   💰 ${provider.rate}\n`;
            }
            
            message += '\n';
        });
        
        if (results.length > 5) {
            if (userLang === 'hi') {
                message += `... और ${results.length - 5} और ${categoryName} उपलब्ध हैं।\n`;
            } else if (userLang === 'ta') {
                message += `... மேலும் ${results.length - 5} ${categoryName} கிடைக்கின்றன.\n`;
            } else {
                message += `... and ${results.length - 5} more ${categoryName}(s) available.\n`;
            }
        }
        
        return message;
    }

    /**
     * Send voice help message
     */
    async sendVoiceHelp(phoneNumber, client, userLang = 'en') {
        let helpMessage = '';
        
        if (userLang === 'hi') {
            helpMessage = `🎤 *वॉयस मैसेज सहायता*\n\n` +
                `आप हिंदी या अंग्रेजी में वॉयस मैसेज भेज सकते हैं!\n\n` +
                `*उदाहरण:*\n` +
                `• "नोएडा में 2 BHK"\n` +
                `• "ग्रेटर नोएडा में इलेक्ट्रीशियन"\n` +
                `• "प्लंबर चाहिए"\n` +
                `• "नौकरानी चाहिए गुड़गांव में"\n\n` +
                `मैं समझूंगा और आपको सबसे अच्छे मैच दिखाऊंगा!`;
        } else if (userLang === 'ta') {
            helpMessage = `🎤 *குரல் செய்தி உதவி*\n\n` +
                `நீங்கள் தமிழ் அல்லது ஆங்கிலத்தில் குரல் செய்திகளை அனுப்பலாம்!\n\n` +
                `*எடுத்துக்காட்டுகள்:*\n` +
                `• "நொய்டாவில் 2 பிஎச்கே"\n` +
                `• "கிரேட்டர் நொய்டாவில் மின்தொழிலாளி"\n` +
                `• "குழாய்த் தொழிலாளி தேவை"\n` +
                `• "குர்காவில் வேலைக்காரி தேவை"\n\n` +
                `நான் புரிந்து கொண்டு சிறந்த பொருத்தங்களைக் காண்பிப்பேன்!`;
        } else {
            helpMessage = `🎤 *Voice Message Help*\n\n` +
                `You can send voice messages in Hindi or English!\n\n` +
                `*Examples:*\n` +
                `• "2 BHK in Noida"\n` +
                `• "Electrician in Greater Noida"\n` +
                `• "Plumber chahiye"\n` +
                `• "Need maid in Gurgaon"\n\n` +
                `I'll understand and show you the best matches!`;
        }
        
        await this.sendMessage(client, phoneNumber, helpMessage);
    }

    /**
     * Save voice context to session
     */
    async saveVoiceContext(phoneNumber, processingResult) {
        try {
            const sessionStore = require('../../utils/sessionStore');
            const session = await sessionStore.get(phoneNumber) || {};
            
            session.voiceContext = {
                originalTranscription: processingResult.transcription,
                intent: processingResult.intent,
                entities: processingResult.entities,
                confidence: processingResult.confidence,
                missingInfo: processingResult.missingInfo,
                isUrbanHelp: processingResult.isUrbanHelp,
                timestamp: Date.now(),
                awaitingConfirmation: true
            };
            
            await sessionStore.set(phoneNumber, session);
            this.log('DEBUG', `Saved voice context for ${phoneNumber}`);
        } catch (error) {
            this.log('WARN', `Could not save session: ${error.message}`);
        }
    }

    /**
     * Helper: Send message
     */
    async sendMessage(client, phoneNumber, text) {
        if (client && client.sendMessage) {
            try {
                await client.sendMessage(phoneNumber, { text: text });
            } catch (error) {
                this.log('ERROR', `Failed to send message: ${error.message}`);
            }
        }
    }

    /**
     * Format results message (fallback)
     */
    formatResultsMessage(domain, results, userLang) {
        const domainTitles = {
            'property': '🏡 Property Results',
            'urban_help': '🔧 Service Providers',
            'commodity': '📦 Commodity Market'
        };
        
        let message = `*${domainTitles[domain] || 'Search Results'}*\n\n`;
        
        if (userLang === 'hi') {
            message += `${results.length} परिणाम मिले:\n\n`;
        } else if (userLang === 'ta') {
            message += `${results.length} முடிவுகள் கிடைத்தன:\n\n`;
        } else {
            message += `Found ${results.length} results:\n\n`;
        }
        
        results.forEach((item, index) => {
            message += `*${index + 1}. ${item.title || item.name || 'Item'}*\n`;
            
            if (item.price) {
                message += `   Price: ₹${item.price.toLocaleString('en-IN')}\n`;
            }
            
            if (item.location) {
                message += `   Location: ${item.location}\n`;
            }
            
            if (item.contact) {
                message += `   Contact: ${item.contact}\n`;
            }
            
            if (item.rating) {
                message += `   Rating: ${item.rating}/5\n`;
            }
            
            message += '\n';
        });
        
        return message;
    }

    /**
     * Parse budget string to number
     */
    parseBudgetToNumber(budget) {
        if (!budget) return null;
        
        const budgetStr = budget.toString().toLowerCase();
        const numberMatch = budgetStr.match(/(\d+(?:\.\d+)?)/);
        if (!numberMatch) return null;
        
        const number = parseFloat(numberMatch[1]);
        
        if (budgetStr.includes('lakh') || budgetStr.includes('lac')) {
            return number * 100000;
        } else if (budgetStr.includes('crore') || budgetStr.includes('cr')) {
            return number * 10000000;
        }
        
        return number;
    }

    /**
     * Mock data for urban help
     */
    getMockUrbanHelpResults(entities) {
        const category = entities.category || 'electrician';
        const location = entities.location || 'Noida';
        const categoryName = this.urbanHelpCategories[category]?.name || 'Service Provider';
        
        return [
            {
                id: 'mock_1',
                name: `Expert ${categoryName}`,
                category: category,
                location: location,
                rating: 4.5,
                experience: '8 years',
                contact: '+91 98765 43210',
                availability: 'Available now',
                rate: '₹500 per hour',
                verified: true
            },
            {
                id: 'mock_2',
                name: `Reliable ${categoryName}`,
                category: category,
                location: location,
                rating: 4.2,
                experience: '5 years',
                contact: '+91 98765 43211',
                availability: 'Available in 2 hours',
                rate: '₹400 per hour',
                verified: true
            },
            {
                id: 'mock_3',
                name: `Local ${categoryName}`,
                category: category,
                location: location,
                rating: 4.0,
                experience: '3 years',
                contact: '+91 98765 43212',
                availability: 'Available tomorrow',
                rate: '₹350 per hour',
                verified: false
            }
        ];
    }

    /**
     * Mock data for testing
     */
    getMockPropertyResults(entities) {
        return [
            {
                title: `2 BHK Apartment in ${entities.location || 'Noida'}`,
                location: entities.location || 'Noida Sector 62',
                price: 7500000,
                bhk: 2,
                contact: '+91 98765 43210',
                description: 'Fully furnished apartment with modern amenities'
            },
            {
                title: `3 BHK Flat in ${entities.location || 'Greater Noida'}`,
                location: entities.location || 'Greater Noida',
                price: 9500000,
                bhk: 3,
                contact: '+91 98765 43211',
                description: 'Spacious flat with balcony and parking'
            }
        ];
    }

    getMockServiceResults(entities) {
        return [
            {
                name: `Expert ${entities.service_type || 'Electrician'}`,
                service_type: entities.service_type || 'electrician',
                location: entities.location || 'Noida',
                rating: 4.5,
                experience: '8 years',
                contact: '+91 98765 43212',
                available: true
            }
        ];
    }

    getMockCommodityResults(entities) {
        return [
            {
                item: entities.commodity_item || 'Steel',
                quantity: '10 tons available',
                price: 65000,
                seller: 'Reliable Suppliers',
                location: 'Delhi',
                contact: '+91 98765 43213',
                quality: 'A-Grade'
            }
        ];
    }

    /**
     * Get fallback transcription - UPDATED: Return null instead of random text
     */
    getFallbackTranscription() {
        // Return null to trigger proper error handling
        console.warn('[VOICE] Transcription failed - returning null');
        return null;
    }

    /**
     * Download audio from URL - KEPT FOR BACKWARD COMPATIBILITY
     */
    async downloadAudio(mediaUrl, messageId) {
        try {
            this.log('DEBUG', `Downloading: ${messageId.substring(0, 10)}...`);
            
            const response = await axios({
                method: 'GET',
                url: mediaUrl,
                responseType: 'arraybuffer',
                timeout: 10000,
                maxContentLength: 5 * 1024 * 1024,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'audio/*',
                    'Accept-Encoding': 'gzip, deflate, br'
                },
                validateStatus: function (status) {
                    return status === 200;
                }
            });

            const fileSizeKB = (response.data.length / 1024).toFixed(2);
            this.log('INFO', `Downloaded ${fileSizeKB}KB`);
            
            const tempFilePath = path.join(this.tempDir, `${messageId}_original`);
            fs.writeFileSync(tempFilePath, response.data);

            return response.data;
        } catch (error) {
            const errorCode = error.response?.status || error.code || 'Unknown';
            this.log('WARN', `Download ${messageId.substring(0, 10)}: ${errorCode}`);
            return null;
        }
    }

    /**
     * Convert audio to WAV format
     */
    async convertToWav(audioBuffer, messageId) {
        const originalPath = path.join(this.tempDir, `${messageId}_original`);
        const wavPath = path.join(this.tempDir, `${messageId}.wav`);

        try {
            fs.writeFileSync(originalPath, audioBuffer);

            try {
                await execPromise('ffmpeg -version', { timeout: 5000 });
            } catch (ffmpegError) {
                this.log('WARN', 'FFmpeg not available, using original audio');
                return originalPath;
            }

            const ffmpegCommand = `ffmpeg -i "${originalPath}" -acodec pcm_s16le -ar 16000 -ac 1 "${wavPath}" -y -t 30`;
            await execPromise(ffmpegCommand, { timeout: 10000 });
            
            if (!fs.existsSync(wavPath)) {
                throw new Error('FFmpeg conversion failed');
            }

            this.log('DEBUG', `Converted to WAV`);
            return wavPath;
        } catch (error) {
            this.log('WARN', `Conversion failed: ${error.message}`);
            return originalPath;
        }
    }

    /**
     * Clean up temporary files
     */
    cleanupTempFiles(messageId) {
        try {
            const files = [
                path.join(this.tempDir, `${messageId}_original`),
                path.join(this.tempDir, `${messageId}.wav`),
                path.join(this.tempDir, `${messageId}_temp.*`)
            ];

            files.forEach(file => {
                try {
                    if (fs.existsSync(file)) {
                        fs.unlinkSync(file);
                    }
                } catch (unlinkError) {
                    // Silent cleanup
                }
            });
        } catch (error) {
            // Silent cleanup
        }
    }

    /**
     * Check if message is a voice message
     */
    isVoiceMessage(message) {
        return (message.hasMedia && message.type === 'ptt') || 
               (message.type === 'audio' && message.audio?.voice) ||
               (message.type === 'voice');
    }

    /**
     * Get supported audio formats
     */
    getSupportedFormats() {
        return this.supportedAudioFormats;
    }

    /**
     * Send confirmation buttons for property intents
     */
    async sendConfirmationButtons(message, client, intent, entities, transcription) {
        const phoneNumber = message.from;
        const userLang = multiLanguage.getUserLanguage(phoneNumber) || 'en';
        
        const confirmationText = this.generateConfirmationMessage(intent, entities, transcription, userLang);
        const buttons = this.getConfirmationButtons(intent, userLang);
        
        await messageUtils.sendInteractiveButtons(client, phoneNumber, confirmationText, buttons);
    }
}

module.exports = new VoiceService();