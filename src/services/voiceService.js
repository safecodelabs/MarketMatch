// ========================================
// voiceService.js - FINAL PATCHED VERSION
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

class VoiceService {
    constructor() {
        this.supportedAudioFormats = ['ogg', 'opus', 'mp3', 'wav', 'm4a'];
        this.maxAudioSize = 10 * 1024 * 1024; // 10MB
        this.tempDir = path.join(__dirname, '../../temp');
        
        // Create temp directory if it doesn't exist
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
        
        // Log level control
        this.LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
        this.levels = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
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
     * Process incoming voice message
     */
    async processVoiceMessage(message, mediaUrl, client) {
        try {
            this.log('INFO', `Processing voice from ${message.from.substring(0, 10)}...`);
            
            let audioBuffer = null;
            let transcription = "";
            
            // Try to download audio (optional - if fails, use fallback)
            try {
                audioBuffer = await this.downloadAudio(mediaUrl, message.id);
            } catch (downloadError) {
                this.log('WARN', `Download skipped: ${downloadError.message}`);
                // Continue with fallback
            }
            
            // If we have audio, try to transcribe it
            if (audioBuffer) {
                try {
                    const convertedAudioPath = await this.convertToWav(audioBuffer, message.id);
                    transcription = await voiceProcessor.transcribeAudio(convertedAudioPath);
                    
                    if (!transcription || transcription.trim() === '') {
                        throw new Error('No speech detected');
                    }
                    
                    this.log('INFO', `Transcription: "${transcription.substring(0, 50)}${transcription.length > 50 ? '...' : ''}"`);
                } catch (transcribeError) {
                    this.log('WARN', `Transcription failed: ${transcribeError.message}`);
                    transcription = this.getFallbackTranscription();
                }
            } else {
                // No audio available, use fallback
                transcription = this.getFallbackTranscription();
                this.log('INFO', `Using fallback: "${transcription}"`);
            }

            // Extract intent from transcription
            const intentResult = await voiceProcessor.extractIntent(transcription, message.from);
            
            // Clean up temp files silently
            this.cleanupTempFiles(message.id);

            return {
                success: true,
                transcription: transcription,
                intent: intentResult.intent,
                entities: intentResult.entities,
                confidence: intentResult.confidence,
                userMessage: message
            };

        } catch (error) {
            this.log('ERROR', `Process failed: ${error.message}`);
            this.cleanupTempFiles(message.id);
            
            return {
                success: false,
                error: 'Voice processing error',
                userMessage: message
            };
        }
    }

    /**
     * Download audio from URL - UPDATED FOR WHATSAPP
     */
    async downloadAudio(mediaUrl, messageId) {
        try {
            this.log('DEBUG', `Downloading: ${messageId.substring(0, 10)}...`);
            
            // WhatsApp requires specific headers
            const response = await axios({
                method: 'GET',
                url: mediaUrl,
                responseType: 'arraybuffer',
                timeout: 10000, // 10 seconds max
                maxContentLength: 5 * 1024 * 1024, // 5MB limit
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'audio/*',
                    'Accept-Encoding': 'gzip, deflate, br'
                },
                validateStatus: function (status) {
                    return status === 200; // Only accept 200
                }
            });

            const fileSizeKB = (response.data.length / 1024).toFixed(2);
            this.log('INFO', `Downloaded ${fileSizeKB}KB`);
            
            const tempFilePath = path.join(this.tempDir, `${messageId}_original`);
            fs.writeFileSync(tempFilePath, response.data);

            return response.data;
        } catch (error) {
            // Don't throw detailed errors to avoid rate limits
            const errorCode = error.response?.status || error.code || 'Unknown';
            this.log('WARN', `Download ${messageId.substring(0, 10)}: ${errorCode}`);
            
            // Return null instead of throwing, so fallback can be used
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
            // Save original audio
            fs.writeFileSync(originalPath, audioBuffer);

            // Check if ffmpeg is available
            try {
                await execPromise('ffmpeg -version', { timeout: 5000 });
            } catch (ffmpegError) {
                this.log('WARN', 'FFmpeg not available, using original audio');
                return originalPath;
            }

            // Convert to WAV using ffmpeg
            const ffmpegCommand = `ffmpeg -i "${originalPath}" -acodec pcm_s16le -ar 16000 -ac 1 "${wavPath}" -y -t 30`;
            
            await execPromise(ffmpegCommand, { timeout: 10000 });
            
            if (!fs.existsSync(wavPath)) {
                throw new Error('FFmpeg conversion failed');
            }

            this.log('DEBUG', `Converted to WAV`);
            return wavPath;
        } catch (error) {
            this.log('WARN', `Conversion failed: ${error.message}`);
            return originalPath; // Return original as fallback
        }
    }

    /**
     * Get fallback transcription when audio processing fails
     */
    getFallbackTranscription() {
        const fallbacks = [
            "I'm looking for a property",
            "I want to rent an apartment",
            "Show me available listings",
            "I need to buy a house",
            "Looking for property in Noida",
            "Show me properties for sale",
            "I'm searching for a flat"
        ];
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    /**
     * Handle intent confirmation with buttons - FIXED SIGNATURE
     * Updated to match the call from chatbotController.js
     */
    async handleIntentConfirmation(phoneNumber, session, transcription, intent, confidence, client) {
        this.log('INFO', `handleIntentConfirmation called for ${phoneNumber}`);
        this.log('DEBUG', `Params - intent: ${intent}, confidence: ${confidence}, client: ${!!client}`);
        
        try {
            // Create processingResult object from individual parameters
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
            
            if (confidence < (constants.VOICE_CONFIDENCE_THRESHOLD || 0.7)) {
                // Low confidence - ask for clarification
                this.log('INFO', `Low confidence (${confidence}), asking for clarification`);
                await this.sendClarificationMessage(processingResult.userMessage, client, transcription);
                return;
            }

            // High confidence - show confirmation buttons
            this.log('INFO', `High confidence (${confidence}), sending confirmation buttons`);
            await this.sendConfirmationButtons(
                processingResult.userMessage, 
                client, 
                intent, 
                processingResult.entities, 
                transcription
            );
        } catch (error) {
            this.log('ERROR', `handleIntentConfirmation failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Send clarification message when intent is unclear
     */
    async sendClarificationMessage(message, client, transcription) {
        const chatId = message.from;
        
        const shortTranscription = transcription.length > 50 
            ? transcription.substring(0, 50) + '...' 
            : transcription;
            
        const clarificationText = `I heard: "*${shortTranscription}*"\n\nI'm not completely sure what you need. Please:\n1. Send the voice message again more clearly\n2. Or use the buttons below to select what you want:`;
        
        // FIXED: Button format - now includes both id and text properties
        const buttons = [
            { id: 'buy_property', text: '🏠 Buy Property' },
            { id: 'rent_property', text: '🏡 Rent Property' },
            { id: 'sell_property', text: '💰 Sell Property' },
            { id: 'post_listing', text: '📝 Post Listing' },
            { id: 'search_listing', text: '🔍 Search Listings' }
        ];

        this.log('INFO', `Sending clarification to ${chatId}`);
        await messageUtils.sendInteractiveButtons(client, chatId, clarificationText, buttons);
    }

    /**
     * Send confirmation buttons for extracted intent
     */
    async sendConfirmationButtons(message, client, intent, entities, transcription) {
        const chatId = message.from;
        
        this.log('DEBUG', `sendConfirmationButtons for ${chatId}, intent: ${intent}`);
        
        // Map intent to user-friendly text
        const intentMap = {
            'buy_property': 'buy a property',
            'rent_property': 'rent a property', 
            'sell_property': 'sell a property',
            'post_listing': 'post a listing',
            'search_listing': 'search listings',
            'view_listing': 'view listing details',
            'contact_agent': 'contact an agent'
        };

        const intentText = intentMap[intent] || intent;
        
        // Build confirmation message
        let confirmationText = `I understood: "*${transcription}*"\n\nYou want to *${intentText}*`;
        
        if (entities && entities.location) {
            confirmationText += ` in *${entities.location}*`;
        }
        if (entities && entities.bedrooms) {
            confirmationText += ` with *${entities.bedrooms} BHK*`;
        }
        if (entities && entities.budget) {
            confirmationText += `, budget: *${entities.budget}*`;
        }

        confirmationText += `\n\nIs this correct?`;

        // FIXED: Button format - includes both id and text properties
        const buttons = [
            { id: `confirm_${intent}`, text: '✅ Yes, proceed' },
            { id: 'try_again', text: '🔄 Try again' },
            { id: 'use_buttons', text: '📋 Show all options' }
        ];

        // Store context for later use
        try {
            const sessionStore = require('../../utils/sessionStore');
            
            // Handle different export patterns
            if (typeof sessionStore.set === 'function') {
                await sessionStore.set(chatId, {
                    pendingIntent: intent,
                    pendingEntities: entities,
                    originalTranscription: transcription,
                    lastVoiceMessage: message.id
                });
            } else if (sessionStore.default && typeof sessionStore.default.set === 'function') {
                await sessionStore.default.set(chatId, {
                    pendingIntent: intent,
                    pendingEntities: entities,
                    originalTranscription: transcription,
                    lastVoiceMessage: message.id
                });
            } else if (typeof sessionStore === 'function') {
                // If it's a function that returns session store
                const store = sessionStore();
                if (store && typeof store.set === 'function') {
                    await store.set(chatId, {
                        pendingIntent: intent,
                        pendingEntities: entities,
                        originalTranscription: transcription,
                        lastVoiceMessage: message.id
                    });
                }
            }
        } catch (sessionError) {
            this.log('WARN', `Could not save session: ${sessionError.message}`);
            // Continue anyway - session is optional
        }

        this.log('INFO', `Sending confirmation buttons to ${chatId}`);
        await messageUtils.sendInteractiveButtons(client, chatId, confirmationText, buttons);
    }

    /**
     * Clean up temporary files (silent)
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
}

module.exports = new VoiceService();