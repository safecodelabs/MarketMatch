// ========================================
// voiceProcessor.js - ENHANCED WITH URBAN HELP SUPPORT & IMPROVED AUDIO CONVERSION
// ========================================
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
require('dotenv').config();

// Create DEFAULT_CONSTANTS to avoid circular dependencies
const DEFAULT_CONSTANTS = {
    VOICE_CONFIDENCE_THRESHOLD: 0.7,
    INTENTS: {
        BUY_PROPERTY: 'buy_property',
        RENT_PROPERTY: 'rent_property',
        SELL_PROPERTY: 'sell_property',
        POST_LISTING: 'post_listing',
        SEARCH_LISTING: 'search_listing',
        VIEW_LISTING: 'view_listing',
        CONTACT_AGENT: 'contact_agent',
        URBAN_HELP_REQUEST: 'urban_help_request',
        SERVICE_REQUEST: 'service_request',
        UNKNOWN: 'unknown'
    }
};

class VoiceProcessor {
    constructor() {
        console.log('[VOICE PROCESSOR] Initializing...');
        
        try {
            // Try to load constants safely
            let constants;
            try {
                constants = require('../../utils/constants');
                console.log('[VOICE PROCESSOR] Constants loaded');
            } catch (error) {
                console.warn('[VOICE PROCESSOR] Using default constants');
                constants = DEFAULT_CONSTANTS;
            }
            
            // Initialize Groq with safe error handling
            try {
                const apiKey = process.env.GROQ_API_KEY;
                if (!apiKey) {
                    console.warn('[VOICE PROCESSOR] GROQ_API_KEY not found in environment');
                    this.groq = null;
                } else {
                    this.groq = new Groq({ apiKey });
                    console.log('[VOICE PROCESSOR] Groq initialized successfully');
                }
            } catch (groqError) {
                console.error('[VOICE PROCESSOR] Failed to initialize Groq:', groqError.message);
                this.groq = null;
            }
            
            // Urban Help Categories
            this.urbanHelpCategories = {
                'electrician': { 
                    name: 'Electrician',
                    keywords: ['electrician', 'wiring', 'electrical', 'fuse', 'light', 'switch']
                },
                'plumber': { 
                    name: 'Plumber',
                    keywords: ['plumber', 'pipe', 'water', 'leak', 'tap', 'bathroom', 'toilet']
                },
                'maid': { 
                    name: 'Maid/Househelp',
                    keywords: ['maid', 'househelp', 'cleaning', 'cook', 'naukrani', 'housekeeping']
                },
                'carpenter': { 
                    name: 'Carpenter',
                    keywords: ['carpenter', 'woodwork', 'furniture', 'repair', 'door', 'window']
                },
                'cleaner': { 
                    name: 'Cleaner',
                    keywords: ['cleaner', 'cleaning', 'deep clean', 'house cleaning']
                },
                'technician': { 
                    name: 'Technician',
                    keywords: ['technician', 'ac repair', 'appliance repair', 'tv repair']
                },
                'driver': { 
                    name: 'Driver',
                    keywords: ['driver', 'chauffeur', 'car driver', 'permanent driver']
                },
                'painter': { 
                    name: 'Painter',
                    keywords: ['painter', 'painting', 'wall', 'color', 'house painting']
                }
            };
            
            this.intentPatterns = {
                'buy_property': [
                    /looking for.*(\d+)\s*(?:bhk|bedroom|bed).*noida/i,
                    /want to buy.*property/i,
                    /i need.*house.*buy/i,
                    /buy.*flat/i,
                    /purchase.*property/i,
                    /interested in buying/i,
                    /i want to buy/i,
                    /show me.*to buy/i
                ],
                'rent_property': [
                    /looking for.*rent/i,
                    /want to rent/i,
                    /need.*on rent/i,
                    /rent.*house|flat|apartment/i,
                    /looking.*rental/i,
                    /rent a.*property/i
                ],
                'sell_property': [
                    /want to sell/i,
                    /sell.*property/i,
                    /selling my.*house|flat/i,
                    /have.*property.*sell/i,
                    /list.*property.*sell/i
                ],
                'post_listing': [
                    /post.*listing/i,
                    /list.*property/i,
                    /add.*property/i,
                    /create.*listing/i,
                    /i want to list/i,
                    /put.*for sale/i
                ],
                'search_listing': [
                    /search.*property/i,
                    /find.*property/i,
                    /show.*listings/i,
                    /available.*properties/i,
                    /looking for.*property/i,
                    /show me.*available/i,
                    /what.*available/i,
                    /see.*listings/i
                ],
                'urban_help_request': [
                    /electrician.*chahiye/i,
                    /plumber.*needed/i,
                    /carpenter.*required/i,
                    /maid.*chahiye/i,
                    /service.*karwana.*hai/i,
                    /technician.*chahiye/i,
                    /repair.*needed/i,
                    /need.*electrician|plumber|carpenter|maid/i,
                    /looking for.*service/i
                ]
            };

            this.entityPatterns = {
                'location': {
                    pattern: /(noida|delhi|gurgaon|greater noida|ghaziabad|faridabad|bangalore|mumbai|chennai|hyderabad|pune|kolkata|sector \d+|dlf phase|phase \d+)/i,
                    keywords: ['in', 'at', 'near', 'around', 'location', 'area', 'mein', 'me']
                },
                'bedrooms': {
                    pattern: /(\d+)\s*(?:bhk|bedroom|bed|bed rooms|b\.h\.k)/i,
                    keywords: ['bhk', 'bedroom', 'bed', 'room']
                },
                'budget': {
                    pattern: /(?:budget|price|cost)\s*(?:of|is|around|approximately)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:lakh|lac|crore|cr)?/i,
                    keywords: ['budget', 'price', 'cost', 'rs', '₹']
                },
                'property_type': {
                    pattern: /(apartment|flat|house|villa|penthouse|studio|duplex)/i,
                    keywords: ['apartment', 'flat', 'house']
                },
                'service_type': {
                    pattern: /(electrician|plumber|carpenter|maid|cleaner|technician|driver|painter)/i,
                    keywords: ['electrician', 'plumber', 'carpenter', 'maid', 'service']
                },
                'timing': {
                    pattern: /(now|immediate|urgent|asap|today|tomorrow|next week)/i,
                    keywords: ['now', 'immediate', 'urgent', 'asap']
                }
            };
            
            // Log level control
            this.LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
            this.levels = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
            
            console.log('🤖 [VOICE AI] Voice Processor initialized');
            
        } catch (error) {
            console.error('[VOICE PROCESSOR] Constructor failed:', error);
            // Don't throw - create a functional mock instead
            this.createFallbackMethods();
        }
    }

    /**
     * Create fallback methods if initialization fails
     */
    createFallbackMethods() {
        console.warn('[VOICE PROCESSOR] Creating fallback methods');
        
        this.groq = null;
        this.urbanHelpCategories = {};
        this.intentPatterns = {};
        this.entityPatterns = {};
        
        // Safe fallback methods
        this.transcribeAudio = async () => {
            console.warn('[VOICE PROCESSOR FALLBACK] Transcription not available');
            return null;
        };
        
        this.extractIntent = async () => ({
            intent: 'unknown',
            confidence: 0,
            entities: {},
            method: 'fallback'
        });
        
        this.isUrbanHelpRequest = () => false;
    }

    /**
     * Transcribe audio using Groq Whisper - IMPROVED for OGG files
     */
    async transcribeAudio(audioFilePath) {
        try {
            console.log('[VOICE PROCESSOR] Transcribing audio:', path.basename(audioFilePath));
            
            if (!fs.existsSync(audioFilePath)) {
                console.error('[VOICE PROCESSOR] Audio file not found');
                return null;
            }

            // Check if GROQ_API_KEY is set
            if (!process.env.GROQ_API_KEY) {
                console.warn('[VOICE PROCESSOR] GROQ_API_KEY not set');
                return null;
            }

            if (!this.groq) {
                console.warn('[VOICE PROCESSOR] Groq not available');
                return null;
            }

            // Check file extension and convert if needed
            const fileExt = path.extname(audioFilePath).toLowerCase();
            const supportedFormats = ['.wav', '.mp3', '.mp4', '.m4a', '.flac', '.ogg', '.opus'];
            
            if (!supportedFormats.includes(fileExt)) {
                console.error('[VOICE PROCESSOR] Unsupported file format:', fileExt);
                return null;
            }

            // If it's .ogg, try to convert it first
            if (fileExt === '.ogg') {
                console.log('[VOICE PROCESSOR] OGG file detected, attempting conversion...');
                const convertedPath = await this.convertOggToWav(audioFilePath);
                if (convertedPath) {
                    audioFilePath = convertedPath;
                }
            }

            const audioFile = fs.createReadStream(audioFilePath);
            
            try {
                const transcription = await this.groq.audio.transcriptions.create({
                    file: audioFile,
                    model: "whisper-large-v3",
                    response_format: "json",
                    temperature: 0.0,
                    language: 'hi' // Support Hindi
                });

                const text = transcription.text.trim();
                console.log('[VOICE PROCESSOR] Transcription:', text.substring(0, 50));
                
                return text;

            } catch (groqError) {
                console.error('[VOICE PROCESSOR] Groq API error:', groqError.message);
                
                // If it's a format error, try to convert
                if (groqError.message.includes('file must be one of the following types')) {
                    console.log('[VOICE PROCESSOR] Trying to convert to MP3...');
                    const mp3Path = await this.convertToMp3(audioFilePath);
                    if (mp3Path) {
                        const audioFile2 = fs.createReadStream(mp3Path);
                        const transcription2 = await this.groq.audio.transcriptions.create({
                            file: audioFile2,
                            model: "whisper-large-v3",
                            response_format: "json",
                            temperature: 0.0
                        });
                        return transcription2.text.trim();
                    }
                }
                
                throw groqError;
            }

        } catch (error) {
            console.error('[VOICE PROCESSOR] Transcription failed:', error.message);
            return null;
        }
    }

/**
 * Convert OGG to WAV using FFmpeg - UPDATED
 */
async convertOggToWav(oggPath) {
    try {
        const wavPath = oggPath.replace('.ogg', '_converted.wav');
        
        // Updated command with proper flags for Groq Whisper
        const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
        const command = `"${ffmpegPath}" -i "${oggPath}" -acodec pcm_s16le -ar 16000 -ac 1 "${wavPath}" -y`;
        
        await execPromise(command, { timeout: 15000 });
        
        if (fs.existsSync(wavPath)) {
            console.log('[VOICE PROCESSOR] OGG to WAV conversion successful');
            return wavPath;
        }
    } catch (error) {
        console.log('[VOICE PROCESSOR] OGG conversion failed:', error.message);
        
        // Try simple conversion as fallback
        try {
            const simpleWavPath = oggPath.replace('.ogg', '_simple.wav');
            const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
            const simpleCommand = `"${ffmpegPath}" -i "${oggPath}" -f wav "${simpleWavPath}" -y`;
            
            await execPromise(simpleCommand, { timeout: 15000 });
            
            if (fs.existsSync(simpleWavPath)) {
                console.log('[VOICE PROCESSOR] Simple WAV conversion successful');
                return simpleWavPath;
            }
        } catch (fallbackError) {
            console.log('[VOICE PROCESSOR] Fallback conversion also failed:', fallbackError.message);
        }
    }
    return null;
}

/**
 * Convert to MP3 using FFmpeg - UPDATED
 */
async convertToMp3(inputPath) {
    try {
        const mp3Path = inputPath.replace(path.extname(inputPath), '_converted.mp3');
        
        const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
        const command = `"${ffmpegPath}" -i "${inputPath}" -codec:a libmp3lame -qscale:a 2 -ar 16000 -ac 1 "${mp3Path}" -y`;
        
        await execPromise(command, { timeout: 15000 });
        
        if (fs.existsSync(mp3Path)) {
            console.log('[VOICE PROCESSOR] MP3 conversion successful');
            return mp3Path;
        }
    } catch (error) {
        console.log('[VOICE PROCESSOR] MP3 conversion failed:', error.message);
    }
    return null;
}

    /**
     * Extract intent and entities from transcribed text
     */
    async extractIntent(text, userId) {
        try {
            console.log('[VOICE PROCESSOR] Extracting intent from:', text.substring(0, 50));
            
            if (!this.groq) {
                console.warn('[VOICE PROCESSOR] Groq not available, using fallback');
                return this.getDefaultIntent(text);
            }
            
            // First check if it's an urban help request
            if (this.isUrbanHelpRequest(text)) {
                const urbanHelpResult = await this.extractUrbanHelpIntent(text, userId);
                if (urbanHelpResult.confidence > 0.6) {
                    return urbanHelpResult;
                }
            }
            
            // Try rule-based extraction
            const ruleBasedResult = this.extractIntentRuleBased(text);
            
            if (ruleBasedResult.confidence > 0.8) {
                console.log('[VOICE PROCESSOR] Rule-based intent:', ruleBasedResult.intent);
                return ruleBasedResult;
            }

            // Otherwise use LLM
            return await this.extractIntentLLM(text, userId);

        } catch (error) {
            console.error('[VOICE PROCESSOR] Intent extraction failed:', error.message);
            return this.getDefaultIntent(text);
        }
    }

    /**
     * Check if text is an urban help request
     */
    isUrbanHelpRequest(text) {
        if (!text) return false;
        
        const lowerText = text.toLowerCase();
        const urbanHelpKeywords = [
            'electrician', 'plumber', 'maid', 'carpenter', 'cleaner', 
            'technician', 'driver', 'painter', 'naukrani', 'househelp',
            'service', 'repair', 'chahiye', 'required', 'needed', 'karwana'
        ];
        
        return urbanHelpKeywords.some(keyword => lowerText.includes(keyword));
    }

    /**
     * Extract urban help specific intent
     */
    async extractUrbanHelpIntent(text, userId) {
        try {
            console.log('[VOICE PROCESSOR] Extracting urban help intent');
            
            // First try rule-based
            const ruleBasedResult = this.extractUrbanHelpRuleBased(text);
            
            if (ruleBasedResult.confidence > 0.7) {
                return ruleBasedResult;
            }
            
            // Use LLM for better accuracy
            return await this.extractUrbanHelpLLM(text, userId);
            
        } catch (error) {
            console.error('[VOICE PROCESSOR] Urban help intent extraction failed:', error.message);
            return this.getUrbanHelpDefaultIntent(text);
        }
    }

    /**
     * Rule-based urban help intent extraction
     */
    extractUrbanHelpRuleBased(text) {
        const lowerText = text.toLowerCase();
        let bestIntent = 'unknown';
        let bestConfidence = 0;
        const entities = this.extractEntities(text);
        
        // Check for urban help patterns
        if (this.intentPatterns.urban_help_request) {
            for (const pattern of this.intentPatterns.urban_help_request) {
                if (pattern.test(lowerText)) {
                    const match = lowerText.match(pattern);
                    const confidence = this.calculateConfidence(lowerText, pattern, match);
                    
                    if (confidence > bestConfidence) {
                        bestIntent = 'urban_help_request';
                        bestConfidence = confidence;
                    }
                }
            }
        }
        
        // Also check for service type in entities
        if (entities.service_type && bestIntent !== 'urban_help_request') {
            bestIntent = 'urban_help_request';
            bestConfidence = 0.7;
        }
        
        // Boost confidence if we found relevant entities
        if (entities.service_type || entities.location) {
            bestConfidence = Math.min(1.0, bestConfidence + 0.2);
        }
        
        // Determine missing info
        const missingInfo = [];
        if (!entities.service_type && !entities.category) missingInfo.push('category');
        if (!entities.location) missingInfo.push('location');
        
        return {
            intent: bestIntent,
            entities: entities,
            confidence: bestConfidence,
            missingInfo: missingInfo,
            method: 'urban_help_rule_based',
            language: this.detectLanguage(text)
        };
    }

    /**
     * LLM-based urban help intent extraction
     */
    async extractUrbanHelpLLM(text, userId) {
        try {
            if (!this.groq) {
                throw new Error('Groq not available');
            }

            const prompt = `Analyze this message for urban help service requests in Indian context. Extract service category, location, and other details.
            
            User Message: "${text}"
            
            Return JSON format:
            {
                "intent": "urban_help_request",
                "confidence": 0.0 to 1.0,
                "entities": {
                    "category": "category_name or null",
                    "location": "location or null",
                    "service_type": "service_type or null",
                    "timing": "immediate/normal or null"
                },
                "missingInfo": ["field1", "field2"],
                "language": "en/hi/mixed"
            }`;

            const response = await this.groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "You are an urban help service intent extractor for Indian users. Understand Hindi-English mix. Return valid JSON."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                model: "llama-3.3-70b-versatile",
                temperature: 0.1,
                max_tokens: 400,
                response_format: { type: "json_object" }
            });

            const result = JSON.parse(response.choices[0].message.content);
            
            if (!result.intent || !result.confidence) {
                throw new Error('Invalid response from LLM');
            }
            
            console.log('[VOICE PROCESSOR] Urban Help LLM intent:', result.intent);
            
            // Enhance with rule-based entities
            const ruleBasedEntities = this.extractEntities(text);
            result.entities = { ...ruleBasedEntities, ...result.entities };
            
            // Ensure category is set from service_type if needed
            if (!result.entities.category && result.entities.service_type) {
                result.entities.category = result.entities.service_type;
            }
            
            // Update missing info based on actual data
            const missing = [];
            if (!result.entities.category && !result.entities.service_type) missing.push('category');
            if (!result.entities.location) missing.push('location');
            result.missingInfo = missing;
            
            return {
                intent: result.intent,
                entities: result.entities,
                confidence: result.confidence,
                missingInfo: result.missingInfo,
                method: 'urban_help_llm',
                language: result.language || this.detectLanguage(text)
            };

        } catch (error) {
            console.warn('[VOICE PROCESSOR] Urban Help LLM extraction failed:', error.message);
            return this.extractUrbanHelpRuleBased(text);
        }
    }

    /**
     * Rule-based intent extraction
     */
    extractIntentRuleBased(text) {
        let bestIntent = 'unknown';
        let bestConfidence = 0;
        const entities = this.extractEntities(text);

        // Check each intent pattern
        if (this.intentPatterns) {
            for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
                if (intent === 'urban_help_request') continue;
                
                if (patterns) {
                    for (const pattern of patterns) {
                        if (pattern.test(text)) {
                            const match = text.match(pattern);
                            const confidence = this.calculateConfidence(text, pattern, match);
                            
                            if (confidence > bestConfidence) {
                                bestIntent = intent;
                                bestConfidence = confidence;
                            }
                        }
                    }
                }
            }
        }

        // Boost confidence if we found relevant entities
        if (entities.location || entities.bedrooms) {
            bestConfidence = Math.min(1.0, bestConfidence + 0.2);
        }

        return {
            intent: bestIntent,
            entities: entities,
            confidence: bestConfidence,
            method: 'rule_based',
            language: this.detectLanguage(text)
        };
    }

    /**
     * LLM-based intent extraction
     */
    async extractIntentLLM(text, userId) {
        try {
            if (!this.groq) {
                console.warn('[VOICE PROCESSOR] Groq not available');
                return this.extractIntentRuleBased(text);
            }

            const prompt = `Analyze this message and extract intent and entities. Could be about real estate or urban help services.
            User Message: "${text}"
            
            Return JSON format:
            {
                "intent": "intent_name",
                "confidence": 0.0 to 1.0,
                "entities": {
                    "location": "string or null",
                    "bedrooms": "number or null",
                    "budget": "string or null",
                    "property_type": "string or null",
                    "service_type": "string or null",
                    "category": "string or null"
                },
                "language": "en/hi/mixed"
            }`;

            const response = await this.groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "You are a multilingual intent extraction assistant for Indian users. Understand Hindi-English mix. Return valid JSON."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                model: "llama-3.3-70b-versatile",
                temperature: 0.1,
                max_tokens: 400,
                response_format: { type: "json_object" }
            });

            const result = JSON.parse(response.choices[0].message.content);
            
            if (!result.intent || !result.confidence) {
                throw new Error('Invalid response from LLM');
            }
            
            console.log('[VOICE PROCESSOR] LLM intent:', result.intent);
            
            // Add fallback entities from rule-based if LLM missed them
            if (!result.entities || Object.values(result.entities).every(v => !v)) {
                const ruleBasedEntities = this.extractEntities(text);
                result.entities = { ...ruleBasedEntities, ...result.entities };
            }

            return {
                intent: result.intent,
                entities: result.entities,
                confidence: result.confidence,
                method: 'llm',
                language: result.language || this.detectLanguage(text)
            };

        } catch (error) {
            console.warn('[VOICE PROCESSOR] LLM extraction failed:', error.message);
            return this.extractIntentRuleBased(text);
        }
    }

    /**
     * Extract entities using regex patterns
     */
    extractEntities(text) {
        const entities = {
            location: null,
            bedrooms: null,
            budget: null,
            property_type: null,
            service_type: null,
            category: null,
            timing: null
        };

        if (!text || !this.entityPatterns) return entities;

        // Extract all entity types
        for (const [entityName, config] of Object.entries(this.entityPatterns)) {
            const match = text.match(config.pattern);
            if (match) {
                if (entityName === 'bedrooms') {
                    entities[entityName] = parseInt(match[1]);
                } else if (entityName === 'budget') {
                    entities[entityName] = this.parseBudget(match[1], text);
                } else {
                    entities[entityName] = match[1] ? match[1].toLowerCase() : match[0].toLowerCase();
                }
            }
        }

        // Map service_type to category for urban help
        if (entities.service_type && !entities.category) {
            entities.category = entities.service_type;
        }
        
        // Check for category from urban help categories
        if (!entities.category && this.urbanHelpCategories) {
            const lowerText = text.toLowerCase();
            for (const [category, data] of Object.entries(this.urbanHelpCategories)) {
                if (data.keywords && data.keywords.some(keyword => lowerText.includes(keyword))) {
                    entities.category = category;
                    entities.service_type = category;
                    break;
                }
            }
        }

        return entities;
    }

    /**
     * Parse budget string to consistent format
     */
    parseBudget(amount, fullText) {
        if (!amount) return null;
        
        amount = amount.replace(/,/g, '');
        
        // Check for lakh/crore indicators
        const lowerText = fullText.toLowerCase();
        if (lowerText.includes('lakh') || lowerText.includes('lac')) {
            return `₹${amount} Lakh`;
        } else if (lowerText.includes('crore') || lowerText.includes('cr')) {
            return `₹${amount} Crore`;
        }
        
        // Assume lakh if number is less than 100
        const numAmount = parseFloat(amount);
        if (numAmount < 100) {
            return `₹${amount} Lakh`;
        }
        
        return `₹${amount}`;
    }

    /**
     * Calculate confidence score for pattern match
     */
    calculateConfidence(text, pattern, match) {
        let confidence = 0.5;
        
        if (match && match[0]) {
            confidence += (match[0].length / text.length) * 0.3;
        }
        
        if (pattern.source.includes('noida') && text.toLowerCase().includes('noida')) {
            confidence += 0.2;
        }
        
        if (/\d+/.test(text)) {
            confidence += 0.1;
        }
        
        if (this.isUrbanHelpRequest(text)) {
            confidence += 0.1;
        }
        
        return Math.min(1.0, confidence);
    }

    /**
     * Detect language of text
     */
    detectLanguage(text) {
        if (!text) return 'en';
        
        const hindiWords = ['hai', 'he', 'mein', 'chahiye', 'chaahiye', 'ka', 'ki', 'ke', 'ko'];
        const englishWords = ['looking', 'for', 'need', 'want', 'property', 'house', 'flat'];
        
        const words = text.toLowerCase().split(/\s+/);
        
        let hindiCount = 0;
        let englishCount = 0;
        
        words.forEach(word => {
            if (hindiWords.includes(word)) hindiCount++;
            if (englishWords.includes(word)) englishCount++;
        });
        
        if (hindiCount > englishCount && hindiCount > 1) return 'hi';
        if (englishCount > hindiCount && englishCount > 1) return 'en';
        return 'mixed';
    }

    /**
     * Default intent when extraction fails
     */
    getDefaultIntent(text) {
        // Check if it might be an urban help request
        if (this.isUrbanHelpRequest(text)) {
            return this.getUrbanHelpDefaultIntent(text);
        }
        
        return {
            intent: 'search_listing',
            entities: {},
            confidence: 0.5,
            method: 'fallback',
            language: this.detectLanguage(text)
        };
    }

    /**
     * Default urban help intent
     */
    getUrbanHelpDefaultIntent(text) {
        const entities = this.extractEntities(text);
        const missingInfo = [];
        
        if (!entities.category && !entities.service_type) missingInfo.push('category');
        if (!entities.location) missingInfo.push('location');
        
        return {
            intent: 'urban_help_request',
            entities: entities,
            confidence: 0.6,
            missingInfo: missingInfo,
            method: 'urban_help_fallback',
            language: this.detectLanguage(text)
        };
    }
}

module.exports = new VoiceProcessor();