// ========================================
// utils/multiLanguage.js - MULTI-LANGUAGE SUPPORT
// ========================================

class MultiLanguage {
    constructor() {
        this.userLanguages = {};
        this.defaultLanguage = 'en';
        
        // Language strings database
        this.languageStrings = {
            en: {
                // General Messages
                'welcome': "👋 *Welcome to MarketMatch AI!*\n\nI'm your personal assistant for:\n🏠 Rentals & Real Estate\n🔧 Urban Help Services\n👤 PG / Flatmates\n\nLet's begin by choosing your preferred language.",
                'not_understood': "I didn't quite understand that.",
                'try_again': "Please try sending your message again.",
                'type_instead': "📝 Please type your request:",
                'main_menu': "🏠 Main Menu",
                'processing': "Processing...",
                
                // Urban Help Specific
                'urban_help_welcome': "🔧 *Urban Help Services*\n\nAvailable services:\n🔧 Electrician - Wiring, switches, electrical repairs\n🚰 Plumber - Pipe leaks, bathroom fittings, water issues\n🧹 Maid/Househelp - Cleaning, cooking, domestic help\n🔨 Carpenter - Furniture, doors, windows repair\n🧼 Cleaner - Deep cleaning, house cleaning\n🔩 Technician - AC repair, appliance servicing\n🚗 Driver - Car driver, chauffeur services\n🎨 Painter - House painting, wall colors\n\nJust tell me what you need!",
                'ask_category': "What type of service do you need?",
                'ask_location': "Where do you need the {category}?",
                'searching': "🔍 Searching for {category} in {location}...",
                'search_error': "Sorry, I encountered an error while searching. Please try again.",
                'no_results_found': "❌ No {category} found in {location}.\n\nI'll notify you when one becomes available.",
                'results_found': "✅ Found {count} {category}(s) in {location}:",
                'urban_help_clarify': "Is this about finding a service provider?",
                
                // Confirmation Messages
                'confirmation_urban_help': "I understood: *{transcription}*\n\nYou need a *{category}* in *{location}*.\n\nIs this correct?",
                'confirmation_property': "I understood: *{transcription}*\n\nYou want to *{intent}* in *{location}*{with_bhk}{with_budget}.\n\nIs this correct?",
                
                // Property Related
                'ask_bhk': "How many bedrooms (BHK) are you looking for?",
                'ask_budget': "What's your budget?",
                'ask_property_type': "What type of property are you looking for?",
                
                // Button Texts
                'btn_yes': "✅ Yes",
                'btn_no': "❌ No",
                'btn_try_again': "🔄 Try Again",
                'btn_modify': "✏️ Modify",
                'btn_voice': "🎤 Voice",
                'btn_text': "📝 Text",
                'btn_menu': "🏠 Menu",
                'btn_back': "⬅️ Back",
                
                // Categories
                'category_electrician': "🔧 Electrician",
                'category_plumber': "🚰 Plumber",
                'category_maid': "🧹 Maid/Househelp",
                'category_carpenter': "🔨 Carpenter",
                'category_cleaner': "🧼 Cleaner",
                'category_technician': "🔩 Technician",
                'category_driver': "🚗 Driver",
                'category_painter': "🎨 Painter",
                
                // Locations
                'location_noida': "📍 Noida",
                'location_gurgaon': "📍 Gurgaon",
                'location_delhi': "📍 Delhi",
                'location_gurugram': "📍 Gurugram",
                'location_greater_noida': "📍 Greater Noida",
                
                // Intent Descriptions
                'intent_buy_property': "buy a property",
                'intent_rent_property': "rent a property",
                'intent_sell_property': "sell a property",
                'intent_urban_help': "find a service provider",
                
                // Voice Help
                'voice_help': "🎤 *Voice Message Help*\n\nYou can send voice messages in any language!\n\n*Examples:*\n• \"2 BHK in Noida\"\n• \"Electrician in Greater Noida\"\n• \"मुझे नोएडा में प्लंबर चाहिए\"\n• \"नौकरानी चाहिए गुड़गांव में\"\n\nI'll understand and show you the best matches!",
                
                // Error Messages
                'error_no_client': "❌ WhatsApp client not available. Please try again.",
                'error_voice_processing': "❌ Couldn't process voice. Please type your request.",
                'error_session_expired': "❌ Session expired. Please start over.",
                'error_no_results': "❌ No results found.\n\nTry:\n• Different keywords\n• Broader search area\n• Check back later",
                
                // Success Messages
                'success_listing_saved': "✅ Listing saved to your favorites! ❤️",
                'success_listing_deleted': "✅ Listing deleted successfully!",
                'success_listing_updated': "✅ Listing updated successfully!",
                'success_request_submitted': "✅ Your request has been submitted!",
                
                // Menu Options
                'menu_view_listings': "🏠 View Listings",
                'menu_post_listing': "📝 Post Listing",
                'menu_manage_listings': "⚙️ Manage Listings",
                'menu_saved_listings': "❤️ Saved Listings",
                'menu_urban_help': "🔧 Urban Help",
                'menu_change_language': "🌐 Change Language",
                'menu_voice_mode': "🎤 Voice Mode"
            },
            
            hi: {
                // General Messages
                'welcome': "👋 *मार्केटमैच एआई में आपका स्वागत है!*\n\nमैं आपका व्यक्तिगत सहायक हूं:\n🏠 किराया और रियल एस्टेट के लिए\n🔧 शहरी सहायता सेवाओं के लिए\n👤 पीजी / फ्लैटमेट्स के लिए\n\nआइए अपनी पसंदीदा भाषा चुनकर शुरू करें।",
                'not_understood': "मैं समझ नहीं पाया।",
                'try_again': "कृपया अपना संदेश फिर से भेजें।",
                'type_instead': "📝 कृपया अपना अनुरोध टाइप करें:",
                'main_menu': "🏠 मुख्य मेनू",
                'processing': "प्रोसेसिंग...",
                
                // Urban Help Specific
                'urban_help_welcome': "🔧 *शहरी सहायता सेवाएं*\n\nउपलब्ध सेवाएं:\n🔧 इलेक्ट्रीशियन - वायरिंग, स्विच, विद्युत मरम्मत\n🚰 प्लंबर - पाइप लीक, बाथरूम फिटिंग, पानी की समस्या\n🧹 नौकरानी/हाउसहेल्प - सफाई, खाना पकाना, घरेलू मदद\n🔨 बढ़ई - फर्नीचर, दरवाजे, खिड़कियों की मरम्मत\n🧼 क्लीनर - गहरी सफाई, घर की सफाई\n🔩 टेक्निशियन - एसी मरम्मत, उपकरण सर्विसिंग\n🚗 ड्राइवर - कार ड्राइवर, चालक सेवाएं\n🎨 पेंटर - घर पेंटिंग, दीवार रंग\n\nबस मुझे बताएं कि आपको क्या चाहिए!",
                'ask_category': "आपको किस प्रकार की सेवा चाहिए?",
                'ask_location': "आपको {category} कहाँ चाहिए?",
                'searching': "🔍 {location} में {category} खोज रहा हूँ...",
                'search_error': "माफ़ करें, खोजते समय त्रुटि हुई। कृपया फिर से प्रयास करें।",
                'no_results_found': "❌ {location} में कोई {category} नहीं मिला।\n\nजब कोई उपलब्ध होगा तो मैं आपको सूचित करूंगा।",
                'results_found': "✅ {location} में {count} {category} मिले:",
                'urban_help_clarify': "क्या यह सेवा प्रदाता ढूंढने के बारे में है?",
                
                // Confirmation Messages
                'confirmation_urban_help': "मैंने समझा: *{transcription}*\n\nआपको *{location}* में *{category}* चाहिए।\n\nक्या यह सही है?",
                'confirmation_property': "मैंने समझा: *{transcription}*\n\nआप *{location}* में *{intent}* चाहते हैं{with_bhk}{with_budget}।\n\nक्या यह सही है?",
                
                // Property Related
                'ask_bhk': "आप कितने बेडरूम (BHK) की तलाश में हैं?",
                'ask_budget': "आपका बजट क्या है?",
                'ask_property_type': "आप किस प्रकार की संपत्ति की तलाश में हैं?",
                
                // Button Texts
                'btn_yes': "✅ हाँ",
                'btn_no': "❌ नहीं",
                'btn_try_again': "🔄 फिर से कोशिश करें",
                'btn_modify': "✏️ संशोधित करें",
                'btn_voice': "🎤 आवाज",
                'btn_text': "📝 टेक्स्ट",
                'btn_menu': "🏠 मेनू",
                'btn_back': "⬅️ वापस",
                
                // Categories
                'category_electrician': "🔧 इलेक्ट्रीशियन",
                'category_plumber': "🚰 प्लंबर",
                'category_maid': "🧹 नौकरानी/हाउसहेल्प",
                'category_carpenter': "🔨 बढ़ई",
                'category_cleaner': "🧼 क्लीनर",
                'category_technician': "🔩 टेक्निशियन",
                'category_driver': "🚗 ड्राइवर",
                'category_painter': "🎨 पेंटर",
                
                // Locations
                'location_noida': "📍 नोएडा",
                'location_gurgaon': "📍 गुड़गांव",
                'location_delhi': "📍 दिल्ली",
                'location_gurugram': "📍 गुड़ग्राम",
                'location_greater_noida': "📍 ग्रेटर नोएडा",
                
                // Intent Descriptions
                'intent_buy_property': "संपत्ति खरीदें",
                'intent_rent_property': "संपत्ति किराए पर लें",
                'intent_sell_property': "संपत्ति बेचें",
                'intent_urban_help': "सेवा प्रदाता ढूंढें",
                
                // Voice Help
                'voice_help': "🎤 *वॉयस मैसेज सहायता*\n\nआप किसी भी भाषा में वॉयस मैसेज भेज सकते हैं!\n\n*उदाहरण:*\n• \"नोएडा में 2 BHK\"\n• \"ग्रेटर नोएडा में इलेक्ट्रीशियन\"\n• \"मुझे नोएडा में प्लंबर चाहिए\"\n• \"नौकरानी चाहिए गुड़गांव में\"\n\nमैं समझूंगा और आपको सबसे अच्छे मैच दिखाऊंगा!",
                
                // Error Messages
                'error_no_client': "❌ व्हाट्सएप क्लाइंट उपलब्ध नहीं है। कृपया फिर से कोशिश करें।",
                'error_voice_processing': "❌ आवाज प्रोसेस नहीं कर सका। कृपया अपना अनुरोध टाइप करें।",
                'error_session_expired': "❌ सत्र समाप्त हो गया। कृपया फिर से शुरू करें।",
                'error_no_results': "❌ कोई परिणाम नहीं मिला।\n\nआजमाएं:\n• विभिन्न कीवर्ड\n• व्यापक खोज क्षेत्र\n• बाद में जांचें",
                
                // Success Messages
                'success_listing_saved': "✅ लिस्टिंग आपके पसंदीदा में सहेजी गई! ❤️",
                'success_listing_deleted': "✅ लिस्टिंग सफलतापूर्वक हटाई गई!",
                'success_listing_updated': "✅ लिस्टिंग सफलतापूर्वक अपडेट की गई!",
                'success_request_submitted': "✅ आपका अनुरोध सबमिट कर दिया गया है!",
                
                // Menu Options
                'menu_view_listings': "🏠 लिस्टिंग देखें",
                'menu_post_listing': "📝 लिस्टिंग पोस्ट करें",
                'menu_manage_listings': "⚙️ लिस्टिंग प्रबंधित करें",
                'menu_saved_listings': "❤️ सेव्ड लिस्टिंग",
                'menu_urban_help': "🔧 शहरी सहायता",
                'menu_change_language': "🌐 भाषा बदलें",
                'menu_voice_mode': "🎤 वॉयस मोड"
            },
            
            ta: {
                // General Messages
                'welcome': "👋 *மார்க்கெட்மேட்ச் AI-க்கு வரவேற்கிறோம்!*\n\nநான் உங்கள் தனிப்பட்ட உதவியாளன்:\n🏠 வாடகை மற்றும் ரியல் எஸ்டேட்டுக்கு\n🔧 நகர்ப்புற உதவி சேவைகளுக்கு\n👤 பீஜி / ஃப்ளாட்மேட்டுகளுக்கு\n\nஉங்களுக்கு பிடித்த மொழியைத் தேர்ந்தெடுத்து ஆரம்பிக்கலாம்.",
                'not_understood': "நான் புரிந்து கொள்ளவில்லை.",
                'try_again': "தயவு செய்து உங்கள் செய்தியை மீண்டும் அனுப்பவும்.",
                'type_instead': "📝 உங்கள் கோரிக்கையை தட்டச்சு செய்யவும்:",
                'main_menu': "🏠 முதன்மை மெனு",
                'processing': "செயலாக்கம்...",
                
                // Urban Help Specific
                'urban_help_welcome': "🔧 *நகர்ப்புற உதவி சேவைகள்*\n\nகிடைக்கும் சேவைகள்:\n🔧 மின்தொழிலாளி - வயரிங், சுவிட்சுகள், மின் பழுதுபார்ப்பு\n🚰 குழாய்த் தொழிலாளி - குழாய் கசிவு, குளியலறை பொருத்துதல், நீர் சிக்கல்கள்\n🧹 வேலைக்காரி/வீட்டு உதவி - சுத்தம், சமையல், வீட்டு உதவி\n🔨 தச்சர் - தளபாடங்கள், கதவுகள், சன்னல்கள் பழுதுபார்ப்பு\n🧼 சுத்தம் செய்பவர் - ஆழமான சுத்தம், வீட்டு சுத்தம்\n🔩 தொழில்நுட்ப வல்லுநர் - ஏசி பழுதுபார்ப்பு, சாதன சேவை\n🚗 ஓட்டுநர் - கார் ஓட்டுநர், சாரதி சேவைகள்\n🎨 ஓவியர் - வீட்டு ஓவியம், சுவர் வண்ணம்\n\nஉங்களுக்கு என்ன தேவை என்று சொல்லுங்கள்!",
                'ask_category': "உங்களுக்கு என்ன வகை சேவை தேவை?",
                'ask_location': "எங்கே {category} தேவை?",
                'searching': "🔍 {location}-ல் {category} தேடுகிறது...",
                'search_error': "மன்னிக்கவும், தேடும்போது பிழை ஏற்பட்டது. தயவு செய்து மீண்டும் முயற்சிக்கவும்.",
                'no_results_found': "❌ {location}-ல் {category} கிடைக்கவில்லை.\n\nஒன்று கிடைக்கும் போது உங்களுக்கு தெரிவிப்பேன்.",
                'results_found': "✅ {location}-ல் {count} {category} கிடைத்தது:",
                'urban_help_clarify': "இது சேவை வழங்குநரைக் கண்டுபிடிப்பது பற்றியதா?",
                
                // Confirmation Messages
                'confirmation_urban_help': "நான் புரிந்து கொண்டேன்: *{transcription}*\n\nஉங்களுக்கு *{location}*-ல் *{category}* தேவை.\n\nஇது சரியானதா?",
                'confirmation_property': "நான் புரிந்து கொண்டேன்: *{transcription}*\n\nநீங்கள் *{location}*-ல் *{intent}* வேண்டும்{with_bhk}{with_budget}.\n\nஇது சரியானதா?",
                
                // Property Related
                'ask_bhk': "எத்தனை படுக்கையறைகள் (BHK) தேவை?",
                'ask_budget': "உங்கள் பட்ஜெட் என்ன?",
                'ask_property_type': "என்ன வகையான சொத்து தேவை?",
                
                // Button Texts
                'btn_yes': "✅ ஆம்",
                'btn_no': "❌ இல்லை",
                'btn_try_again': "🔄 மீண்டும் முயற்சிக்கவும்",
                'btn_modify': "✏️ மாற்று",
                'btn_voice': "🎤 குரல்",
                'btn_text': "📝 உரை",
                'btn_menu': "🏠 மெனு",
                'btn_back': "⬅️ பின்செல்",
                
                // Categories
                'category_electrician': "🔧 மின்தொழிலாளி",
                'category_plumber': "🚰 குழாய்த் தொழிலாளி",
                'category_maid': "🧹 வேலைக்காரி/வீட்டு உதவி",
                'category_carpenter': "🔨 தச்சர்",
                'category_cleaner': "🧼 சுத்தம் செய்பவர்",
                'category_technician': "🔩 தொழில்நுட்ப வல்லுநர்",
                'category_driver': "🚗 ஓட்டுநர்",
                'category_painter': "🎨 ஓவியர்",
                
                // Locations
                'location_noida': "📍 நொய்டா",
                'location_gurgaon': "📍 குர்காவ்",
                'location_delhi': "📍 டெல்லி",
                'location_gurugram': "📍 குருக்ராம்",
                'location_greater_noida': "📍 கிரேட்டர் நொய்டா",
                
                // Intent Descriptions
                'intent_buy_property': "சொத்து வாங்க",
                'intent_rent_property': "சொத்து வாடகைக்கு எடு",
                'intent_sell_property': "சொத்து விற்க",
                'intent_urban_help': "சேவை வழங்குநரைக் கண்டுபிடி",
                
                // Voice Help
                'voice_help': "🎤 *குரல் செய்தி உதவி*\n\nநீங்கள் எந்த மொழியிலும் குரல் செய்திகளை அனுப்பலாம்!\n\n*எடுத்துக்காட்டுகள்:*\n• \"நொய்டாவில் 2 பிஎச்கே\"\n• \"கிரேட்டர் நொய்டாவில் மின்தொழிலாளி\"\n• \"எனக்கு நொய்டாவில் குழாய்த் தொழிலாளி வேண்டும்\"\n• \"குர்காவில் வேலைக்காரி தேவை\"\n\nநான் புரிந்து கொண்டு சிறந்த பொருத்தங்களைக் காண்பிப்பேன்!",
                
                // Error Messages
                'error_no_client': "❌ வாட்ஸ்அப் கிளையண்ட் கிடைக்கவில்லை. தயவு செய்து மீண்டும் முயற்சிக்கவும்.",
                'error_voice_processing': "❌ குரலைச் செயல்படுத்த முடியவில்லை. தயவு செய்து உங்கள் கோரிக்கையை தட்டச்சு செய்யவும்.",
                'error_session_expired': "❌ அமர்வு காலாவதியானது. தயவு செய்து மீண்டும் தொடங்கவும்.",
                'error_no_results': "❌ எந்த முடிவுகளும் கிடைக்கவில்லை.\n\nமுயற்சிக்கவும்:\n• வெவ்வேறு முக்கிய சொற்கள்\n• பரந்த தேடல் பகுதி\n• பின்னர் சரிபார்க்கவும்",
                
                // Success Messages
                'success_listing_saved': "✅ பட்டியல் உங்களுக்கு பிடித்தவற்றில் சேமிக்கப்பட்டது! ❤️",
                'success_listing_deleted': "✅ பட்டியல் வெற்றிகரமாக நீக்கப்பட்டது!",
                'success_listing_updated': "✅ பட்டியல் வெற்றிகரமாக புதுப்பிக்கப்பட்டது!",
                'success_request_submitted': "✅ உங்கள் கோரிக்கை சமர்ப்பிக்கப்பட்டது!",
                
                // Menu Options
                'menu_view_listings': "🏠 பட்டியல்களைக் காண்க",
                'menu_post_listing': "📝 பட்டியலை இடுக",
                'menu_manage_listings': "⚙️ பட்டியல்களை நிர்வகிக்கவும்",
                'menu_saved_listings': "❤️ சேமித்த பட்டியல்கள்",
                'menu_urban_help': "🔧 நகர்ப்புற உதவி",
                'menu_change_language': "🌐 மொழியை மாற்றவும்",
                'menu_voice_mode': "🎤 குரல் பயன்முறை"
            },
            
            gu: {
                // Basic support for Gujarati
                'welcome': "👋 *માર્કેટમેચ AI માં સ્વાગત છે!*",
                'not_understood': "મને સમજાયું નહીં.",
                'btn_yes': "✅ હા",
                'btn_no': "❌ ના",
                'main_menu': "🏠 મુખ્ય મેનુ"
            },
            
            kn: {
                // Basic support for Kannada
                'welcome': "👋 *ಮಾರ್ಕೆಟ್ಮ್ಯಾಚ್ AI ಗೆ ಸ್ವಾಗತ!*",
                'not_understood': "ನನಗೆ ಅರ್ಥವಾಗಲಿಲ್ಲ.",
                'btn_yes': "✅ ಹೌದು",
                'btn_no': "❌ ಇಲ್ಲ",
                'main_menu': "🏠 ಮುಖ್ಯ ಮೆನು"
            }
        };
        
        console.log('🌐 MultiLanguage initialized with support for:', Object.keys(this.languageStrings).join(', '));
    }

    /**
     * Get user's preferred language
     */
    getUserLanguage(userId) {
        return this.userLanguages[userId] || this.defaultLanguage;
    }

    /**
     * Set user's preferred language
     */
    setUserLanguage(userId, language) {
        if (this.languageStrings[language]) {
            this.userLanguages[userId] = language;
            console.log(`🌐 Language set to ${language} for user: ${userId}`);
            return true;
        } else {
            console.warn(`🌐 Unsupported language: ${language} for user: ${userId}`);
            return false;
        }
    }

    /**
     * Get message in user's language with replacements
     */
    getMessage(language, key, replacements = {}) {
        // Default to English if language not found
        const lang = this.languageStrings[language] || this.languageStrings[this.defaultLanguage];
        
        // Get the message or fallback to English, then to key itself
        let message = lang[key] || this.languageStrings[this.defaultLanguage][key] || key;
        
        // Replace placeholders
        Object.keys(replacements).forEach(placeholder => {
            const regex = new RegExp(`{${placeholder}}`, 'g');
            message = message.replace(regex, replacements[placeholder]);
        });
        
        return message;
    }

    /**
     * Get message for specific user
     */
    getMessageForUser(userId, key, replacements = {}) {
        const userLang = this.getUserLanguage(userId);
        return this.getMessage(userLang, key, replacements);
    }

    /**
     * Get confirmation message based on intent
     */
    getConfirmationMessage(language, params) {
        const { intent, transcription, entities } = params;
        
        if (intent === 'urban_help_request' || intent === 'service_request') {
            const category = entities.category || entities.service_type || 'service';
            const location = entities.location || 'your area';
            
            return this.getMessage(language, 'confirmation_urban_help', {
                transcription: transcription || '',
                category: this.getCategoryName(language, category),
                location: location
            });
        } else {
            // Property related confirmation
            const intentText = this.getMessage(language, `intent_${intent}`) || intent;
            const location = entities.location || 'your area';
            
            let withBhk = '';
            if (entities.bedrooms) {
                withBhk = ` with ${entities.bedrooms} BHK`;
            }
            
            let withBudget = '';
            if (entities.budget) {
                withBudget = `, budget: ${entities.budget}`;
            }
            
            return this.getMessage(language, 'confirmation_property', {
                transcription: transcription || '',
                intent: intentText,
                location: location,
                with_bhk: withBhk,
                with_budget: withBudget
            });
        }
    }

    /**
     * Get category name in user's language
     */
    getCategoryName(language, category) {
        const key = `category_${category}`;
        return this.getMessage(language, key) || category;
    }

    /**
     * Get location name in user's language
     */
    getLocationName(language, location) {
        const key = `location_${location.toLowerCase().replace(/\s+/g, '_')}`;
        return this.getMessage(language, key) || location;
    }

    /**
     * Get button text
     */
    getButtonText(language, buttonType) {
        return this.getMessage(language, `btn_${buttonType}`) || buttonType;
    }

    /**
     * Get menu option text
     */
    getMenuOption(language, option) {
        return this.getMessage(language, `menu_${option}`) || option;
    }

    /**
     * Get urban help categories for buttons
     */
    getUrbanHelpCategories(language) {
        const categories = ['electrician', 'plumber', 'maid', 'carpenter', 'cleaner', 'technician', 'driver', 'painter'];
        
        return categories.map(category => ({
            id: `category_${category}`,
            text: this.getCategoryName(language, category)
        }));
    }

    /**
     * Get location options for buttons
     */
    getLocationOptions(language) {
        const locations = ['noida', 'gurgaon', 'delhi', 'gurugram', 'greater_noida'];
        
        return locations.map(location => ({
            id: `location_${location}`,
            text: this.getLocationName(language, location)
        }));
    }

    /**
     * Get confirmation buttons based on intent
     */
    getConfirmationButtons(language, intent) {
        if (intent === 'urban_help_request' || intent === 'service_request') {
            return [
                { id: `confirm_urban_${intent}`, text: this.getButtonText(language, 'yes') },
                { id: 'try_again', text: this.getButtonText(language, 'try_again') },
                { id: 'modify_details', text: this.getButtonText(language, 'modify') }
            ];
        }
        
        return [
            { id: `confirm_${intent}`, text: this.getButtonText(language, 'yes') },
            { id: 'try_again', text: this.getButtonText(language, 'try_again') },
            { id: 'use_buttons', text: this.getButtonText(language, 'text') }
        ];
    }

    /**
     * Get retry buttons
     */
    getRetryButtons(language) {
        return [
            { id: 'try_voice', text: this.getButtonText(language, 'voice') },
            { id: 'use_text', text: this.getButtonText(language, 'text') },
            { id: 'main_menu', text: this.getButtonText(language, 'menu') }
        ];
    }

    /**
     * Get language selection rows
     */
    getLanguageRows() {
        return [
            { id: "lang_en", title: "English" },
            { id: "lang_hi", title: "हिंदी (Hindi)" },
            { id: "lang_ta", title: "தமிழ் (Tamil)" },
            { id: "lang_gu", title: "ગુજરાતી (Gujarati)" },
            { id: "lang_kn", title: "ಕನ್ನಡ (Kannada)" }
        ];
    }

    /**
     * Get main menu rows
     */
    getMainMenuRows(language) {
        const menuOptions = [
            'view_listings',
            'post_listing', 
            'manage_listings',
            'saved_listings',
            'urban_help',
            'change_language'
        ];
        
        return menuOptions.map(option => ({
            id: option,
            title: this.getMenuOption(language, option),
            description: this.getMessage(language, `menu_${option}_desc`) || ''
        }));
    }

    /**
     * Get urban help results message
     */
    getUrbanHelpResultsMessage(language, results, category, location) {
        const categoryName = this.getCategoryName(language, category);
        
        return this.getMessage(language, 'results_found', {
            count: results.length,
            category: categoryName,
            location: location
        });
    }

    /**
     * Format urban help provider details
     */
    formatUrbanHelpProvider(provider, language, index) {
        const lines = [];
        
        lines.push(`*${index + 1}. ${provider.name || 'Service Provider'}*`);
        
        if (provider.rating) {
            lines.push(`   ⭐ ${provider.rating}/5`);
        }
        
        if (provider.experience) {
            lines.push(`   📅 ${provider.experience} ${this.getMessage(language, 'experience') || 'experience'}`);
        }
        
        if (provider.contact) {
            lines.push(`   📞 ${provider.contact}`);
        }
        
        if (provider.availability) {
            lines.push(`   🕒 ${provider.availability}`);
        }
        
        if (provider.rate) {
            lines.push(`   💰 ${provider.rate}`);
        }
        
        return lines.join('\n');
    }

    /**
     * Get voice help message
     */
    getVoiceHelpMessage(language) {
        return this.getMessage(language, 'voice_help');
    }

    /**
     * Get urban help welcome message
     */
    getUrbanHelpWelcomeMessage(language) {
        return this.getMessage(language, 'urban_help_welcome');
    }
    
    /**
     * Get supported languages
     */
    getSupportedLanguages() {
        return Object.keys(this.languageStrings);
    }
    
    /**
     * Check if language is supported
     */
    isLanguageSupported(language) {
        return this.languageStrings.hasOwnProperty(language);
    }
}

// Create singleton instance
const multiLanguage = new MultiLanguage();

module.exports = multiLanguage;