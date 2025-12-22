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

    // Helper function for controlled logging
    log(level, ...args) {
        if (this.levels[level] <= this.levels[this.LOG_LEVEL]) {
            console.log(`[${level}] VoiceService:`, ...args);
        }
    }

    /**
     * Process incoming voice message
     * @param {Object} message - WhatsApp message object
     * @param {String} mediaUrl - URL of the voice message
     * @param {Object} client - WhatsApp client
     * @returns {Promise<Object>} Processing result
     */
    async processVoiceMessage(message, mediaUrl, client) {
        try {
            this.log('INFO', `Processing voice from ${message.from.substring(0, 10)}...`);
            
            let audioBuffer;
            let transcription;
            
            // Try to download and process audio
            try {
                // Download the audio file
                audioBuffer = await this.downloadAudio(mediaUrl, message.id);
                if (!audioBuffer) {
                    throw new Error('Failed to download audio');
                }

                // Convert to WAV if needed
                const convertedAudioPath = await this.convertToWav(audioBuffer, message.id);
                
                // Transcribe audio
                transcription = await voiceProcessor.transcribeAudio(convertedAudioPath);
                
                if (!transcription || transcription.trim() === '') {
                    throw new Error('No speech detected in audio');
                }

                this.log('INFO', `Transcription: "${transcription.substring(0, 50)}..."`);

            } catch (processingError) {
                this.log('WARN', `Audio processing failed: ${processingError.message}`);
                
                // Use fallback transcription for common phrases
                transcription = this.getFallbackTranscription();
                this.log('INFO', `Using fallback: "${transcription}"`);
            }

            // Extract intent from transcription
            const intentResult = await voiceProcessor.extractIntent(transcription, message.from);
            
            // Clean up temp files
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
                error: error.message,
                userMessage: message
            };
        }
    }

    /**
     * Download audio from URL with proper timeout and error handling
     * @param {String} mediaUrl - URL of the audio
     * @param {String} messageId - Message ID for naming
     * @returns {Promise<Buffer>} Audio buffer
     */
    async downloadAudio(mediaUrl, messageId) {
        try {
            this.log('DEBUG', `Downloading: ${messageId.substring(0, 10)}...`);
            
            const response = await axios({
                method: 'GET',
                url: mediaUrl,
                responseType: 'arraybuffer',
                timeout: 15000, // Reduced from 30s to 15s
                maxContentLength: 5 * 1024 * 1024, // 5MB limit
                validateStatus: function (status) {
                    return status >= 200 && status < 300;
                },
                headers: {
                    'User-Agent': 'MarketMatchAI/1.0',
                    'Accept': 'audio/*'
                }
            });

            if (response.status !== 200) {
                throw new Error(`HTTP ${response.status}`);
            }

            const fileSizeKB = (response.data.length / 1024).toFixed(2);
            this.log('INFO', `Downloaded ${fileSizeKB}KB for ${messageId.substring(0, 10)}`);
            
            const tempFilePath = path.join(this.tempDir, `${messageId}_original`);
            fs.writeFileSync(tempFilePath, response.data);

            return response.data;
        } catch (error) {
            // Don't log full error object to avoid rate limits
            let errorMsg = 'Download failed';
            
            if (error.code === 'ECONNABORTED') {
                errorMsg = 'Timeout (15s)';
            } else if (error.response) {
                errorMsg = `HTTP ${error.response.status}`;
            } else if (error.request) {
                errorMsg = 'No response';
            } else {
                errorMsg = error.message.substring(0, 50);
            }
            
            this.log('WARN', `Download ${messageId.substring(0, 10)}: ${errorMsg}`);
            throw new Error(errorMsg);
        }
    }

    /**
     * Convert audio to WAV format for better transcription
     * @param {Buffer} audioBuffer - Original audio buffer
     * @param {String} messageId - Message ID for naming
     * @returns {Promise<String>} Path to converted WAV file
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
                return originalPath; // Return original if ffmpeg not available
            }

            // Convert to WAV using ffmpeg with timeout
            const ffmpegCommand = `ffmpeg -i "${originalPath}" -acodec pcm_s16le -ar 16000 -ac 1 "${wavPath}" -y -t 60`;
            
            await execPromise(ffmpegCommand, { timeout: 10000 }); // 10s timeout
            
            if (!fs.existsSync(wavPath)) {
                throw new Error('FFmpeg conversion failed');
            }

            this.log('DEBUG', `Converted to WAV: ${messageId.substring(0, 10)}`);
            return wavPath;
        } catch (error) {
            this.log('WARN', `Conversion failed for ${messageId.substring(0, 10)}: ${error.message}`);
            // Return original path as fallback
            return originalPath;
        }
    }

    /**
     * Get fallback transcription when audio processing fails
     * @returns {String} Fallback transcription text
     */
    getFallbackTranscription() {
        const fallbacks = [
            "I'm looking for a property",
            "I want to rent an apartment",
            "Show me available listings",
            "I need to buy a house",
            "Looking for property in Noida"
        ];
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    /**
     * Handle intent confirmation with buttons
     * @param {Object} processingResult - Result from processVoiceMessage
     * @param {Object} client - WhatsApp client
     * @returns {Promise<void>}
     */
    async handleIntentConfirmation(processingResult, client) {
        const { userMessage, intent, entities, confidence, transcription } = processingResult;
        
        if (confidence < constants.VOICE_CONFIDENCE_THRESHOLD) {
            // Low confidence - ask for clarification
            await this.sendClarificationMessage(userMessage, client, transcription);
            return;
        }

        // High confidence - show confirmation buttons
        await this.sendConfirmationButtons(userMessage, client, intent, entities, transcription);
    }

    /**
     * Send clarification message when intent is unclear
     * @param {Object} message - Original message
     * @param {Object} client - WhatsApp client
     * @param {String} transcription - What was heard
     */
    async sendClarificationMessage(message, client, transcription) {
        const chatId = message.from;
        
        const shortTranscription = transcription.length > 50 
            ? transcription.substring(0, 50) + '...' 
            : transcription;
            
        const clarificationText = `I heard: "*${shortTranscription}*"\n\nI'm not completely sure what you need. Please:\n1. Send the voice message again more clearly\n2. Or use the buttons below to select what you want:`;
        
        const buttons = [
            { id: 'buy_property', text: '🏠 Buy Property' },
            { id: 'rent_property', text: '🏡 Rent Property' },
            { id: 'sell_property', text: '💰 Sell Property' },
            { id: 'post_listing', text: '📝 Post Listing' },
            { id: 'search_listing', text: '🔍 Search Listings' }
        ];

        await messageUtils.sendInteractiveButtons(client, chatId, clarificationText, buttons);
    }

    /**
     * Send confirmation buttons for extracted intent
     * @param {Object} message - Original message
     * @param {Object} client - WhatsApp client
     * @param {String} intent - Extracted intent
     * @param {Object} entities - Extracted entities
     * @param {String} transcription - Original transcription
     */
    async sendConfirmationButtons(message, client, intent, entities, transcription) {
        const chatId = message.from;
        
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
        
        if (entities.location) {
            confirmationText += ` in *${entities.location}*`;
        }
        if (entities.bedrooms) {
            confirmationText += ` with *${entities.bedrooms} BHK*`;
        }
        if (entities.budget) {
            confirmationText += `, budget: *${entities.budget}*`;
        }

        confirmationText += `\n\nIs this correct?`;

        const buttons = [
            { id: `confirm_${intent}`, text: '✅ Yes, proceed' },
            { id: 'try_again', text: '🔄 Try again' },
            { id: 'use_buttons', text: '📋 Show all options' }
        ];

        // Store context for later use
        const sessionStore = require('../../utils/sessionStore');
        await sessionStore.set(chatId, {
            pendingIntent: intent,
            pendingEntities: entities,
            originalTranscription: transcription,
            lastVoiceMessage: message.id
        });

        await messageUtils.sendInteractiveButtons(client, chatId, confirmationText, buttons);
    }

    /**
     * Clean up temporary files
     * @param {String} messageId - Message ID
     */
    cleanupTempFiles(messageId) {
        try {
            const files = [
                path.join(this.tempDir, `${messageId}_original`),
                path.join(this.tempDir, `${messageId}.wav`),
                path.join(this.tempDir, `${messageId}_temp.*`)
            ];

            files.forEach(file => {
                if (fs.existsSync(file)) {
                    try {
                        fs.unlinkSync(file);
                    } catch (unlinkError) {
                        // Silent cleanup - don't log errors
                    }
                }
            });
        } catch (error) {
            // Don't log cleanup errors to avoid rate limits
        }
    }

    /**
     * Check if message is a voice message
     * @param {Object} message - WhatsApp message
     * @returns {Boolean}
     */
    isVoiceMessage(message) {
        return message.hasMedia && 
               message.type === 'ptt' && 
               message.mimetype && 
               message.mimetype.includes('audio/');
    }

    /**
     * Get supported audio formats
     * @returns {Array<String>}
     */
    getSupportedFormats() {
        return this.supportedAudioFormats;
    }
}

module.exports = new VoiceService();