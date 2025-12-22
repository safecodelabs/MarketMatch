// ========================================
// voiceProcessor.js - FINAL PATCHED VERSION
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
            UNKNOWN: 'unknown'
        }
    };
}

const languageStrings = require('../../../utils/languageStrings');

class VoiceProcessor {
    constructor() {
        this.groq = new Groq({
            apiKey: process.env.GROQ_API_KEY || constants.GROQ_API_KEY
        });
        
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
            ]
        };

        this.entityPatterns = {
            'location': {
                pattern: /(noida|delhi|gurgaon|greater noida|ghaziabad|faridabad|bangalore|mumbai|chennai|hyderabad|pune|kolkata)/i,
                keywords: ['in', 'at', 'near', 'around', 'location', 'area']
            },
            'bedrooms': {
                pattern: /(\d+)\s*(?:bhk|bedroom|bed|bed rooms|b\.h\.k)/i,
                keywords: ['bhk', 'bedroom', 'bed']
            },
            'budget': {
                pattern: /(?:budget|price|cost)\s*(?:of|is|around|approximately)?\s*(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:lakh|lac|crore|cr)?/i,
                keywords: ['budget', 'price', 'cost', 'rs', '₹']
            },
            'property_type': {
                pattern: /(apartment|flat|house|villa|penthouse|studio|duplex)/i,
                keywords: ['apartment', 'flat', 'house']
            }
        };
        
        // Log level control
        this.LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
        this.levels = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
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
                return this.fallbackTranscription();
            }

            // Check if GROQ_API_KEY is set
            if (!process.env.GROQ_API_KEY && !constants.GROQ_API_KEY) {
                this.log('WARN', 'GROQ_API_KEY not set, using fallback');
                return this.fallbackTranscription();
            }

            const audioFile = fs.createReadStream(audioFilePath);
            
            const transcription = await this.groq.audio.transcriptions.create({
                file: audioFile,
                model: "whisper-large-v3",
                response_format: "json",
                temperature: 0.0
            });

            const text = transcription.text.trim();
            this.log('INFO', `Transcription: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
            
            return text;

        } catch (error) {
            this.log('ERROR', `Transcription failed: ${error.message}`);
            return this.fallbackTranscription();
        }
    }

    /**
     * Extract intent and entities from transcribed text
     */
    async extractIntent(text, userId) {
        try {
            this.log('INFO', `Extracting intent from: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
            
            // First try rule-based extraction
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
            return this.getDefaultIntent();
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
        for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
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
            method: 'rule_based'
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
            Analyze this real estate message and extract intent and entities.
            User Message: "${text}"
            
            Available Intents:
            - buy_property: User wants to purchase a property
            - rent_property: User wants to rent a property
            - sell_property: User wants to sell a property
            - post_listing: User wants to post a property listing
            - search_listing: User wants to search/filter listings
            - view_listing: User wants to view specific listing details
            - contact_agent: User wants to contact an agent
            - unknown: Cannot determine intent
            
            Respond in JSON format:
            {
                "intent": "intent_name",
                "confidence": 0.0 to 1.0,
                "entities": {
                    "location": "string or null",
                    "bedrooms": "number or null",
                    "budget": "string or null",
                    "property_type": "string or null"
                }
            }`;

            const response = await this.groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "You are a real estate intent extraction assistant. Return valid JSON only."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                model: "llama-3.3-70b-versatile", // Updated model
                temperature: 0.1,
                max_tokens: 300,
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
                method: 'llm'
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
            property_type: null
        };

        // Extract location
        for (const [entityName, config] of Object.entries(this.entityPatterns)) {
            const match = text.match(config.pattern);
            if (match) {
                if (entityName === 'bedrooms') {
                    entities[entityName] = parseInt(match[1]);
                } else if (entityName === 'budget') {
                    entities[entityName] = this.parseBudget(match[1], text);
                } else {
                    entities[entityName] = match[1].toLowerCase();
                }
            }
        }

        return entities;
    }

    /**
     * Parse budget string to consistent format
     */
    parseBudget(amount, fullText) {
        amount = amount.replace(/,/g, '');
        
        // Check for lakh/crore indicators
        if (fullText.toLowerCase().includes('lakh') || fullText.toLowerCase().includes('lac')) {
            return `₹${amount} Lakh`;
        } else if (fullText.toLowerCase().includes('crore') || fullText.toLowerCase().includes('cr')) {
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
        
        return Math.min(1.0, confidence);
    }

    /**
     * Fallback transcription when Groq fails
     */
    fallbackTranscription() {
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
     * Default intent when extraction fails
     */
    getDefaultIntent() {
        return {
            intent: 'search_listing',
            entities: {},
            confidence: 0.5,
            method: 'fallback'
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
}

module.exports = new VoiceProcessor();