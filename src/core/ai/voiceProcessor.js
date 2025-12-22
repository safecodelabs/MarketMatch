const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const constants = require('../../utils/constants');
const languageStrings = require('../../utils/languageStrings');

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
                /interested in buying/i
            ],
            'rent_property': [
                /looking for.*rent/i,
                /want to rent/i,
                /need.*on rent/i,
                /rent.*house|flat|apartment/i
            ],
            'sell_property': [
                /want to sell/i,
                /sell.*property/i,
                /selling my.*house|flat/i,
                /have.*property.*sell/i
            ],
            'post_listing': [
                /post.*listing/i,
                /list.*property/i,
                /add.*property/i,
                /create.*listing/i
            ],
            'search_listing': [
                /search.*property/i,
                /find.*property/i,
                /show.*listings/i,
                /available.*properties/i
            ]
        };

        this.entityPatterns = {
            'location': {
                pattern: /(noida|delhi|gurgaon|greater noida|ghaziabad|faridabad)/i,
                keywords: ['in', 'at', 'near', 'around', 'location']
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
    }

    /**
     * Transcribe audio using Groq Whisper
     * @param {String} audioFilePath - Path to audio file
     * @returns {Promise<String>} Transcription text
     */
    async transcribeAudio(audioFilePath) {
        try {
            console.log(`Transcribing audio: ${audioFilePath}`);
            
            // Check if file exists
            if (!fs.existsSync(audioFilePath)) {
                throw new Error('Audio file not found');
            }

            // Read audio file
            const audioFile = fs.createReadStream(audioFilePath);
            
            // Transcribe using Groq
            const transcription = await this.groq.audio.transcriptions.create({
                file: audioFile,
                model: "whisper-large-v3",
                language: "en", // Auto-detect, but can specify
                response_format: "json",
                temperature: 0.0
            });

            return transcription.text.trim();

        } catch (error) {
            console.error('Error transcribing audio:', error);
            
            // Fallback to basic regex extraction if Groq fails
            return this.fallbackTranscription();
        }
    }

    /**
     * Extract intent and entities from transcribed text
     * @param {String} text - Transcribed text
     * @param {String} userId - User ID for context
     * @returns {Promise<Object>} Intent and entities
     */
    async extractIntent(text, userId) {
        try {
            // First try rule-based extraction
            const ruleBasedResult = this.extractIntentRuleBased(text);
            
            // If confidence is high, return rule-based result
            if (ruleBasedResult.confidence > 0.8) {
                return ruleBasedResult;
            }

            // Otherwise use LLM for better understanding
            return await this.extractIntentLLM(text, userId);

        } catch (error) {
            console.error('Error extracting intent:', error);
            return this.getDefaultIntent();
        }
    }

    /**
     * Rule-based intent extraction
     * @param {String} text - Input text
     * @returns {Object} Intent result
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
     * @param {String} text - Input text
     * @param {String} userId - User ID
     * @returns {Promise<Object>} Intent result
     */
    async extractIntentLLM(text, userId) {
        try {
            const prompt = `
            Analyze the following user message from a real estate context and extract:
            1. Primary intent
            2. Key entities (location, bedrooms, budget, property type)
            
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
                    "location": "extracted location or null",
                    "bedrooms": "number or null",
                    "budget": "amount or null",
                    "property_type": "type or null"
                },
                "reasoning": "brief explanation"
            }
            `;

            const response = await this.groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "You are a real estate intent extraction assistant. Extract intent and entities accurately."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                model: "mixtral-8x7b-32768", // or "llama2-70b-4096", "gemma-7b-it"
                temperature: 0.1,
                max_tokens: 500,
                response_format: { type: "json_object" }
            });

            const result = JSON.parse(response.choices[0].message.content);
            
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
            console.error('LLM intent extraction failed:', error);
            return this.extractIntentRuleBased(text);
        }
    }

    /**
     * Extract entities using regex patterns
     * @param {String} text - Input text
     * @returns {Object} Extracted entities
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
     * @param {String} amount - Amount string
     * @param {String} fullText - Full text for context
     * @returns {String} Formatted budget
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
     * @param {String} text - Full text
     * @param {RegExp} pattern - Matched pattern
     * @param {Array} match - Match result
     * @returns {Number} Confidence score
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
     * @returns {String} Placeholder text
     */
    fallbackTranscription() {
        return "Could not transcribe audio. Please try again or type your message.";
    }

    /**
     * Default intent when extraction fails
     * @returns {Object} Default intent
     */
    getDefaultIntent() {
        return {
            intent: 'unknown',
            entities: {},
            confidence: 0.0,
            method: 'fallback'
        };
    }

    /**
     * Validate if text contains real estate related keywords
     * @param {String} text - Input text
     * @returns {Boolean}
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