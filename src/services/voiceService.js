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
            console.log(`Processing voice message from ${message.from}`);
            
            // Download the audio file
            const audioBuffer = await this.downloadAudio(mediaUrl, message.id);
            if (!audioBuffer) {
                throw new Error('Failed to download audio');
            }

            // Convert to WAV if needed
            const convertedAudioPath = await this.convertToWav(audioBuffer, message.id);
            
            // Transcribe audio
            const transcription = await voiceProcessor.transcribeAudio(convertedAudioPath);
            
            if (!transcription || transcription.trim() === '') {
                throw new Error('No speech detected in audio');
            }

            console.log(`Transcription: ${transcription}`);

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
            console.error('Error processing voice message:', error);
            this.cleanupTempFiles(message.id);
            
            return {
                success: false,
                error: error.message,
                userMessage: message
            };
        }
    }

    /**
     * Download audio from URL
     * @param {String} mediaUrl - URL of the audio
     * @param {String} messageId - Message ID for naming
     * @returns {Promise<Buffer>} Audio buffer
     */
    async downloadAudio(mediaUrl, messageId) {
        try {
            const response = await axios({
                method: 'GET',
                url: mediaUrl,
                responseType: 'arraybuffer',
                timeout: 30000
            });

            if (response.status !== 200) {
                throw new Error(`Failed to download audio: ${response.status}`);
            }

            const tempFilePath = path.join(this.tempDir, `${messageId}_original`);
            fs.writeFileSync(tempFilePath, response.data);

            return response.data;
        } catch (error) {
            console.error('Error downloading audio:', error);
            throw error;
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

            // Convert to WAV using ffmpeg
            const ffmpegCommand = `ffmpeg -i "${originalPath}" -acodec pcm_s16le -ar 16000 -ac 1 "${wavPath}" -y`;
            
            await execPromise(ffmpegCommand, { timeout: 30000 });
            
            if (!fs.existsSync(wavPath)) {
                throw new Error('FFmpeg conversion failed');
            }

            return wavPath;
        } catch (error) {
            console.error('Error converting audio to WAV:', error);
            throw error;
        }
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
        
        const clarificationText = `I heard: "*${transcription}*"\n\nI'm not completely sure what you need. Please:\n1. Send the voice message again more clearly\n2. Or use the buttons below to select what you want:`;
        
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
                    fs.unlinkSync(file);
                }
            });
        } catch (error) {
            console.error('Error cleaning up temp files:', error);
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