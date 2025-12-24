// ========================================
// voiceProcessor.js - ENHANCED WITH URBAN HELP SUPPORT
// ========================================
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import constants with fallback
let constants;
try {
    constants = require('../../utils/constants');
} catch (error) {
    console.warn('[VOICE] Constants not found, using defaults');
    constants = {
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
}

class VoiceProcessor {
    constructor() {
        this.groq = new Groq({
            apiKey: process.env.GROQ_API_KEY || constants.GROQ_API_KEY
        });
        
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
        
        console.log('🤖 [VOICE AI] Voice Processor with Urban Help initialized');
    }

    /**
     * Controlled logging
     */
    log(level, ...args) {
        if (this.levels[level] <= this.levels[this.LOG_LEVEL]) {
            console.log(`[${level}] VoiceProcessor:`, ...args);
        }
    }

    /**
     * Transcribe audio using Groq Whisper
     */
    async transcribeAudio(audioFilePath) {
        try {
            this.log('INFO', `Transcribing audio: ${path.basename(audioFilePath)}`);
            
            if (!fs.existsSync(audioFilePath)) {
                this.log('ERROR', 'Audio file not found');
                return null; // Return null instead of fallback
            }

            // Check if GROQ_API_KEY is set
            if (!process.env.GROQ_API_KEY && !constants.GROQ_API_KEY) {
                this.log('WARN', 'GROQ_API_KEY not set');
                return null; // Return null instead of fallback
            }

            const audioFile = fs.createReadStream(audioFilePath);
            
            const transcription = await this.groq.audio.transcriptions.create({
                file: audioFile,
                model: "whisper-large-v3",
                response_format: "json",
                temperature: 0.0,
                language: 'hi' // Support Hindi
            });

            const text = transcription.text.trim();
            this.log('INFO', `Transcription: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
            
            return text;

        } catch (error) {
            this.log('ERROR', `Transcription failed: ${error.message}`);
            return null; // Return null instead of fallback
        }
    }

    /**
     * Extract intent and entities from transcribed text
     */
    async extractIntent(text, userId) {
        try {
            this.log('INFO', `Extracting intent from: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
            
            // First check if it's an urban help request
            if (this.isUrbanHelpRequest(text)) {
                const urbanHelpResult = await this.extractUrbanHelpIntent(text, userId);
                if (urbanHelpResult.confidence > 0.6) {
                    return urbanHelpResult;
                }
            }
            
            // Try rule-based extraction
            const ruleBasedResult = this.extractIntentRuleBased(text);
            
            // If confidence is high, return rule-based result
            if (ruleBasedResult.confidence > 0.8) {
                this.log('INFO', `Rule-based intent: ${ruleBasedResult.intent} (${ruleBasedResult.confidence})`);
                return ruleBasedResult;
            }

            // Otherwise use LLM for better understanding
            return await this.extractIntentLLM(text, userId);

        } catch (error) {
            this.log('ERROR', `Intent extraction failed: ${error.message}`);
            return this.getDefaultIntent(text);
        }
    }

    /**
     * Extract urban help specific intent
     */
    async extractUrbanHelpIntent(text, userId) {
        try {
            this.log('INFO', `Extracting urban help intent from: "${text.substring(0, 50)}..."`);
            
            // First try rule-based
            const ruleBasedResult = this.extractUrbanHelpRuleBased(text);
            
            if (ruleBasedResult.confidence > 0.7) {
                return ruleBasedResult;
            }
            
            // Use LLM for better accuracy
            return await this.extractUrbanHelpLLM(text, userId);
            
        } catch (error) {
            this.log('ERROR', `Urban help intent extraction failed: ${error.message}`);
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
        
        // Also check for service type in entities
        if (entities.service_type && !bestIntent === 'urban_help_request') {
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
            const prompt = `
            Analyze this message for urban help service requests in Indian context. 
            Extract service category, location, and other details.
            
            User Message: "${text}"
            
            Available Service Categories:
            - electrician: Electrical work, wiring, fuse, switches
            - plumber: Plumbing, pipes, leaks, water issues, bathroom fittings
            - maid: Househelp, cleaning, cooking, domestic help, naukrani
            - carpenter: Woodwork, furniture, doors, windows repair
            - cleaner: Deep cleaning, house cleaning
            - technician: Appliance repair, AC repair, TV repair
            - driver: Car driver, chauffeur
            - painter: House painting, wall painting
            
            Common Locations: Noida, Delhi, Gurgaon, Gurugram, Greater Noida, Ghaziabad, Faridabad
            
            Return JSON format:
            {
                "intent": "urban_help_request",
                "confidence": 0.0 to 1.0,
                "entities": {
                    "category": "category_name or null",
                    "location": "location or null",
                    "service_type": "service_type or null",
                    "timing": "immediate/normal or null",
                    "emergency": "true/false or null"
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
            
            // Validate result
            if (!result.intent || !result.confidence) {
                throw new Error('Invalid response from LLM');
            }
            
            this.log('INFO', `Urban Help LLM intent: ${result.intent} (${result.confidence})`);
            
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
            this.log('WARN', `Urban Help LLM extraction failed: ${error.message}`);
            return this.extractUrbanHelpRuleBased(text);
        }
    }

    /**
     * Check if text is an urban help request
     */
    isUrbanHelpRequest(text) {
        const lowerText = text.toLowerCase();
        
        // Check for urban help keywords
        const urbanHelpKeywords = [
            'electrician', 'plumber', 'maid', 'carpenter', 'cleaner', 
            'technician', 'driver', 'painter', 'naukrani', 'househelp',
            'service', 'repair', 'chahiye', 'required', 'needed', 'karwana',
            'बिजली', 'नल', 'मेड', 'बढ़ई', 'सफाई', 'ड्राइवर', 'पेंटर'
        ];
        
        return urbanHelpKeywords.some(keyword => lowerText.includes(keyword));
    }

    /**
     * Rule-based intent extraction
     */
    extractIntentRuleBased(text) {
        let bestIntent = 'unknown';
        let bestConfidence = 0;
        const entities = this.extractEntities(text);

        // Check each intent pattern
        for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
            if (intent === 'urban_help_request') continue; // Skip urban help for now
            
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
     * LLM-based intent extraction using Groq
     */
    async extractIntentLLM(text, userId) {
        try {
            // Check if GROQ_API_KEY is set
            if (!process.env.GROQ_API_KEY && !constants.GROQ_API_KEY) {
                this.log('WARN', 'GROQ_API_KEY not set, skipping LLM extraction');
                return this.extractIntentRuleBased(text);
            }

            const prompt = `
            Analyze this message and extract intent and entities. Could be about real estate or urban help services.
            User Message: "${text}"
            
            Available Intents:
            Real Estate:
            - buy_property: User wants to purchase a property
            - rent_property: User wants to rent a property
            - sell_property: User wants to sell a property
            - post_listing: User wants to post a property listing
            - search_listing: User wants to search/filter listings
            - view_listing: User wants to view specific listing details
            - contact_agent: User wants to contact an agent
            
            Urban Help Services:
            - urban_help_request: User needs a service provider (electrician, plumber, maid, carpenter, etc.)
            - service_request: General service request
            
            - unknown: Cannot determine intent
            
            Respond in JSON format:
            {
                "intent": "intent_name",
                "confidence": 0.0 to 1.0,
                "entities": {
                    "location": "string or null",
                    "bedrooms": "number or null",
                    "budget": "string or null",
                    "property_type": "string or null",
                    "service_type": "string or null",
                    "category": "string or null",
                    "timing": "string or null"
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
            
            // Validate result
            if (!result.intent || !result.confidence) {
                throw new Error('Invalid response from LLM');
            }
            
            this.log('INFO', `LLM intent: ${result.intent} (${result.confidence})`);
            
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
            this.log('WARN', `LLM extraction failed: ${error.message}`);
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
        if (!entities.category) {
            const lowerText = text.toLowerCase();
            for (const [category, data] of Object.entries(this.urbanHelpCategories)) {
                if (data.keywords.some(keyword => lowerText.includes(keyword))) {
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
        let confidence = 0.5; // Base confidence
        
        // Longer matches are more confident
        if (match && match[0]) {
            confidence += (match[0].length / text.length) * 0.3;
        }
        
        // Specific patterns get boost
        if (pattern.source.includes('noida') && text.toLowerCase().includes('noida')) {
            confidence += 0.2;
        }
        
        // Contains numbers (like 2bhk)
        if (/\d+/.test(text)) {
            confidence += 0.1;
        }
        
        // Contains Hindi words for urban help
        if (this.isUrbanHelpRequest(text)) {
            confidence += 0.1;
        }
        
        return Math.min(1.0, confidence);
    }

    /**
     * Detect language of text
     */
    detectLanguage(text) {
        const hindiWords = ['hai', 'he', 'mein', 'chahiye', 'chaahiye', 'ka', 'ki', 'ke', 'ko', 'karna', 'kar'];
        const englishWords = ['looking', 'for', 'need', 'want', 'property', 'house', 'flat', 'service', 'electrician'];
        
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
     * Fallback transcription when Groq fails - UPDATED: Return null instead of random text
     */
    fallbackTranscription() {
        // Return null to trigger proper error handling
        console.warn('[VOICE] Transcription failed - returning null');
        return null;
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

    /**
     * Validate if text contains real estate related keywords
     */
    isRealEstateRelated(text) {
        const keywords = [
            'house', 'flat', 'apartment', 'property', 'real estate',
            'buy', 'sell', 'rent', 'lease', 'bhk', 'bedroom',
            'noida', 'delhi', 'gurgaon', 'price', 'budget',
            'listing', 'agent', 'broker', 'location', 'area'
        ];
        
        return keywords.some(keyword => 
            text.toLowerCase().includes(keyword.toLowerCase())
        );
    }

    /**
     * Get user-friendly intent description
     */
    getIntentDescription(intentResult, userId) {
        const lang = intentResult.language || 'en';
        
        const descriptions = {
            en: {
                'buy_property': 'looking to buy a property',
                'rent_property': 'looking to rent a property',
                'sell_property': 'want to sell a property',
                'urban_help_request': `need ${intentResult.entities.category || 'a service'}`,
                'search_listing': 'searching for properties'
            },
            hi: {
                'buy_property': 'प्रॉपर्टी खरीदना चाहते हैं',
                'rent_property': 'प्रॉपर्टी किराए पर चाहिए',
                'urban_help_request': `${intentResult.entities.category || 'सर्विस'} चाहिए`,
                'search_listing': 'प्रॉपर्टी ढूंढ रहे हैं'
            }
        };
        
        const langDescriptions = descriptions[lang] || descriptions.en;
        return langDescriptions[intentResult.intent] || 'looking for something';
    }
}

module.exports = new VoiceProcessor();