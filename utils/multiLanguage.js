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
                'welcome': "👋 *Welcome to MarketMatch AI!*\n\nI'm your personal assistant for:\n🏠 Rentals & Real Estate\n\nLet's begin by choosing your preferred language.",
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
                'error_voice_context_lost': "❌ Voice context lost. Please start over.",
                'error_session_expired': "❌ Session expired. Please start over.",
                'error_no_results': "❌ No results found.\n\nTry:\n• Different keywords\n• Broader search area\n• Check back later",
                
                // Success Messages
                'success_listing_saved': "✅ Listing saved to your favorites! ❤️",
                'success_listing_deleted': "✅ Listing deleted successfully!",
                'success_listing_updated': "✅ Listing updated successfully!",
                'success_request_submitted': "✅ Your request has been submitted!",
                'draft_cleared': "✅ Draft cleared! You can now start a new listing.",
                'no_active_draft': "✅ No active draft found. You can start a new listing.",
                'confirm_typed_instructions': "Okay — please type \"Yes\" to confirm, \"No\" to cancel, or type a field update like \"rent 12000\" to edit.",
                'processing_voice': "🎤 Processing your voice message... Please wait a moment.",
                'error_voice_access': "❌ Could not access the voice message. Please try sending it again.",
                'ask_send_updated_request': "✏️ What would you like to change? Please send your updated request.",

                // Menu Options
                'menu_view_listings': "🏠 View Listings",
                'menu_view_listings_desc': "Browse homes, apartments, and properties for rent or sale.",
                'menu_post_listing': "📝 Post Listing",
                'menu_post_listing_desc': "Publish your property to attract buyers or renters.",
                'menu_manage_listings': "⚙️ Manage Listings",
                'menu_manage_listings_desc': "Edit, update, or remove your listings.",
                'menu_saved_listings': "❤️ Saved Listings",
                'menu_saved_listings_desc': "View and manage properties you've saved.",
                'menu_urban_help': "🔧 Urban Help",
                'menu_urban_help_desc': "Find local electricians, plumbers, carpenters and more.",
                'menu_change_language': "🌐 Change Language",
                'menu_change_language_desc': "Switch the app interface to a different language.",
                'menu_voice_mode': "🎤 Voice Mode",
                'prompt_provide_listing_details': "Please provide listing details: title, location, type, price, and contact.",
                'no_previous_request': "❌ No previous request found. Please start over.",
                'no_transcription': "❌ No transcription found. Please try again.",
                'prompt_type_what_looking': "📝 Please type what you're looking for:",
                'showing_menu_options': "📋 Showing menu options...",
                'starting_new_listing': "🆕 Starting new listing...",
                'draft_conflict_cancelled': "❌ Draft conflict cancelled. Returning to menu.",
                'error_load_form': "❌ Could not load the form. Please try the chat option instead.",
                'not_sure_try_menu': "🤔 I'm not sure what you're looking for. Please use the menu options below.",
                'error_unable_edit_listing': "❌ Unable to edit listing. Please try again.",
                'fetching_listings': "🔍 Fetching available listings...",
                'no_listings_available': "📭 No listings available at the moment.\n\nTry posting a listing or check back later!",
                'listings_end_of_results': "🎉 That's all the listings matching your criteria!",
                'contact_info_unavailable': "❌ Contact information is not available for this listing.",
                'listing_lost': "Sorry, I lost track of the current listing. Please try searching again.",
                'no_listings_data': "No listings data found. Please search again.",
                'listings_cycled': "🔄 You've seen all listings! Starting from the first one again.",
                'action_unrecognized': "Action unrecognized. Please select a button from the card.",
                'error_load_listing': "❌ Could not load listing details. Please try again.",
                'error_load_listings': "❌ Sorry, I couldn't load the listings. Please try again.",
                'fetching_your_listings': "📋 Fetching your listings...",
                'error_load_your_listings': "❌ Sorry, I couldn't load your listings. Please try again.",
                'restart_prompt': "I didn't understand that. Choose an option or type *hi* to restart.",
                'offer_post_listing_prompt': "I understand you're offering services. Please use the '📝 Post Listing' option from the menu.",
                'voice_listing_switch': "🎤 Voice listing post detected. Switching to listing form...",
                'voice_view_listing_instruction': "🎤 To view listing details, please use 'View Listings' from the menu.",
                'contact_agent_instruction': "🎤 To contact an agent, use the contact info in the listing.",
                'processing_voice': "🎤 Processing your voice message... Please wait a moment.",
                'error_voice_access': "❌ Could not access the voice message. Please try sending it again.",
                'ask_send_updated_request': "✏️ What would you like to change? Please send your updated request.",

                
                // Job-Related Messages
                'job_prompt_role': "🔍 What type of job are you looking for? (e.g., customer support, delivery driver, team lead, electrician)",
                'job_prompt_experience': "📊 How much experience do you have? (e.g., 2 years, 6 months, no experience)",
                'job_prompt_location': "📍 Where are you looking for this job? (city or area)",
                'job_request_saved': "✅ Your job request has been saved! We'll notify you when a matching job appears.",
                'job_request_error': "❌ Sorry, I couldn't save your request. Please try again later.",
                'no_jobs_yet': "📭 No jobs match your criteria yet. We'll notify you as soon as one appears!",
                'error_generic': "❌ Sorry, an error occurred. Please try again later.",
                
                // Language selection confirmation
                'language_set': "🌐 Language set to {lang}.",
                'select_language_prompt': "Please select a language 👇",
                'language_unsupported': "Unsupported language selected. Please choose from the list.",
                'new_listing_available': "🔔 A new {category} is available in {location}: {title}",
                'new_job_available': "🔔 New job: {title} in {location} ({category}) — Contact: {contact}"
            },
            
            hi: {
                // General Messages
                'welcome': "👋 *मार्केटमैच एआई में आपका स्वागत है!*\n\nमैं आपका व्यक्तिगत सहायक हूं:\n🏠 किराया और रियल एस्टेट के लिए\n\nआइए अपनी पसंदीदा भाषा चुनकर शुरू करें।",
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
                'error_voice_context_lost': "❌ वॉइस संदर्भ खो गया है। कृपया फिर से शुरू करें।",
                'error_session_expired': "❌ सत्र समाप्त हो गया। कृपया फिर से शुरू करें।",
                'error_no_results': "❌ कोई परिणाम नहीं मिला।\n\nआजमाएं:\n• विभिन्न कीवर्ड\n• व्यापक खोज क्षेत्र\n• बाद में जांचें",
                
                // Success Messages
                'success_listing_saved': "✅ लिस्टिंग आपके पसंदीदा में सहेजी गई! ❤️",
                'success_listing_deleted': "✅ लिस्टिंग सफलतापूर्वक हटाई गई!",
                'success_listing_updated': "✅ लिस्टिंग सफलतापूर्वक अपडेट की गई!",
                'success_request_submitted': "✅ आपका अनुरोध सबमिट कर दिया गया है!",
                'draft_cleared': "✅ ड्राफ्ट साफ़ कर दिया गया! अब आप एक नई लिस्टिंग शुरू कर सकते हैं।",
                'no_active_draft': "✅ कोई सक्रिय ड्राफ्ट नहीं मिला। आप एक नई लिस्टिंग शुरू कर सकते हैं।",
                'confirm_typed_instructions': "ठीक है — पुष्टि के लिए \"Yes\" टाइप करें, रद्द करने के लिए \"No\" टाइप करें, या संपादन के लिए \"rent 12000\" जैसे फ़ील्ड अपडेट टाइप करें।",
                'processing_voice': "🎤 आपकी वॉयस संदेश संसाधित किया जा रहा है... कृपया प्रतीक्षा करें।",
                'error_voice_access': "❌ वॉयस संदेश तक पहुंच नहीं हुई। कृपया इसे फिर से भेजें।",
                'ask_send_updated_request': "✏️ आप क्या बदलना चाहेंगे? कृपया अपना अपडेटेड अनुरोध भेजें।",
                
                // Menu Options
                'menu_view_listings_desc': "घरों, अपार्टमेंट्स और किराये/बिक्री के लिए उपलब्ध संपत्तियों को ब्राउज़ करें।",
                'menu_post_listing_desc': "अपनी संपत्ति पोस्ट कर खरीददारों या किरायेदारों को आकर्षित करें।",
                'menu_manage_listings_desc': "अपनी लिस्टिंग संपादित, अपडेट, या हटाएँ।",
                'menu_saved_listings_desc': "आपने जिन संपत्तियों को सेव किया है उन्हें देखें और प्रबंधित करें।",
                'menu_urban_help_desc': "इलेक्ट्रीशियन, प्लंबर, बढ़ई और अन्य सेवाएँ ढूँढें।",
                'menu_change_language_desc': "ऐप की इंटरफ़ेस भाषा बदलें।",
                'fetching_listings': "🔍 उपलब्ध लिस्टिंग खोज रहा हूँ...",
                'no_listings_available': "📭 वर्तमान में कोई लिस्टिंग उपलब्ध नहीं है।\n\nलिस्टिंग पोस्ट करने का प्रयास करें या बाद में पुनः जाँच करें!",
                'listings_end_of_results': "🎉 आपकी खोज के लिए सभी लिस्टिंग दिखा दिए गए!",
                'contact_info_unavailable': "❌ इस लिस्टिंग के लिए संपर्क जानकारी उपलब्ध नहीं है।",
                'listing_lost': "माफ़ करें, मैं वर्तमान लिस्टिंग का ट्रैक खो दिया। कृपया पुनः खोजें।",
                'no_listings_data': "कोई लिस्टिंग डेटा नहीं मिला। कृपया फिर से खोजें।",
                'listings_cycled': "🔄 आपने सभी लिस्टिंग देख लिए हैं! शुरुआत से फिर दिखाऊँ?",
                'action_unrecognized': "कार्रवाई पहचान नहीं हुई। कृपया कार्ड से एक बटन चुनें।",
                'error_load_listing': "❌ लिस्टिंग विवरण लोड नहीं कर सका। कृपया पुनः प्रयास करें।",
                'error_load_listings': "❌ माफ़ करें, मैं लिस्टिंग लोड नहीं कर सका। कृपया पुनः प्रयास करें।",
                'fetching_your_listings': "📋 आपकी लिस्टिंग लोड कर रहा हूँ...",
                'error_load_your_listings': "❌ माफ़ करें, आपकी लिस्टिंग लोड नहीं कर सका। कृपया पुनः प्रयास करें।",
                'restart_prompt': "मुझे समझ नहीं आया। विकल्प चुनें या फिर से शुरू करने के लिए *hi* टाइप करें।",
                'offer_post_listing_prompt': "मैं समझता हूँ कि आप सेवाएँ ऑफ़र कर रहे हैं। कृपया '📝 Post Listing' का उपयोग करें।",
                'voice_listing_switch': "🎤 वॉयस लिस्टिंग पोस्ट पहचाना गया। लिस्टिंग फ़ॉर्म पर जा रहा हूँ...",
                'voice_view_listing_instruction': "🎤 सूची विवरण देखने के लिए मेन्यू से 'View Listings' चुनें।",
                'contact_agent_instruction': "🎤 किसी एजेंट से संपर्क करने के लिए लिस्टिंग में संपर्क जानकारी देखें।",
                'menu_view_listings': "🏠 लिस्टिंग देखें",
                'menu_post_listing': "📝 लिस्टिंग पोस्ट करें",
                'menu_manage_listings': "⚙️ लिस्टिंग प्रबंधित करें",
                'menu_saved_listings': "❤️ सेव्ड लिस्टिंग",
                'menu_urban_help': "🔧 शहरी सहायता",
                'menu_change_language': "🌐 भाषा बदलें",
                'menu_voice_mode': "🎤 वॉयस मोड",
                'prompt_provide_listing_details': "कृपया लिस्टिंग विवरण दें: शीर्षक, स्थान, प्रकार, कीमत, और संपर्क।",
                'no_previous_request': "❌ कोई पिछला अनुरोध नहीं मिला। कृपया फिर से शुरू करें।",
                'no_transcription': "❌ कोई ट्रांसक्रिप्शन नहीं मिला। कृपया फिर से प्रयास करें।",
                'prompt_type_what_looking': "📝 कृपया आप क्या खोज रहे हैं उसे टाइप करें:",
                'showing_menu_options': "📋 मेन्यू विकल्प दिखा रहा हूँ...",
                'starting_new_listing': "🆕 नई लिस्टिंग शुरू कर रहा हूँ...",
                'draft_conflict_cancelled': "❌ ड्राफ्ट संघर्ष रद्द किया गया। मेन्यू पर लौट रहे हैं।",
                'error_load_form': "❌ फ़ॉर्म लोड नहीं कर सका। कृपया चैट विकल्प आज़माएँ.",
                'not_sure_try_menu': "🤔 मुझे यकीन नहीं है कि आप क्या खोज रहे हैं। कृपया नीचे मेन्यू विकल्पों का उपयोग करें।",
                'error_unable_edit_listing': "❌ लिस्टिंग संपादित करने में असमर्थ। कृपया फिर से प्रयास करें।",
                'language_set': "🌐 भाषा {lang} सेट कर दी गई है।",
                'select_language_prompt': "कृपया अपनी भाषा चुनें 👇",
                'language_unsupported': "असमर्थित भाषा चुनी गई। कृपया सूची से चुनें।",
                
                // Job-Related Messages (Hindi)
                'job_prompt_role': "🔍 आप किस तरह की नौकरी खोज रहे हैं? (जैसे: कस्टमर सपोर्ट, डिलीवरी ड्राइवर, टीम लीड)",
                'job_prompt_experience': "📊 आपके पास कितना अनुभव है? (जैसे: 2 साल, 6 महीने, कोई अनुभव नहीं)",
                'job_prompt_location': "📍 आप यह नौकरी कहाँ खोज रहे हैं? (शहर या इलाका)",
                'job_request_saved': "✅ आपकी नौकरी की खोज सहेज दी गई है! जब कोई मेल खाने वाली नौकरी मिले तो हम आपको सूचित करेंगे।",
                'job_request_error': "❌ माफ कीजिए, मैं आपकी खोज को सहेज नहीं सका। कृपया बाद में फिर से प्रयास करें।",
                'no_jobs_yet': "📭 अभी आपके मानदंड से मेल खाने वाली कोई नौकरी नहीं है। जैसे ही कोई नौकरी दिखेगी, हम आपको सूचित करेंगे!",
                'error_generic': "❌ माफ कीजिए, एक त्रुटि हुई। कृपया बाद में फिर से प्रयास करें।",
                
                'new_listing_available': "🔔 एक नया {category} अब {location} में उपलब्ध है: {title}",
                'new_job_available': "🔔 नई नौकरी: {title} - {location} ({category}) — संपर्क: {contact}"
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
                'draft_cleared': "✅ டிராஃப்ட் அழிக்கப்பட்டது! நீங்கள் இப்போது புதிய பட்டியலை தொடக்கலாம்.",
                'no_active_draft': "✅ செயல்பாட்டிலில்லை என்ற டிராஃப்ட் இல்லை. நீங்கள் ஒரு புதிய பட்டியலை தொடங்கலாம்.",
                'confirm_typed_instructions': "சரி — உறுதிப்படுத்த \"Yes\" என தட்டச்சு செய்க, ரத்துசெய்ய \"No\" என தட்டச்சு செய்க, அல்லது மாற்றம் செய்ய \"rent 12000\" போன்ற புலம் புதுப்பிப்பு தட்டச்சு செய்க.",
                'processing_voice': "🎤 உங்கள் குரல் செய்தி செயலாக்கப்படுகிறது... காத்திருக்கவும்.",
                'error_voice_access': "❌ குரல் செய்தியை அணுக முடியாது. தயவு செய்து அதை மீண்டும் அனுப்பவும்.",
                'ask_send_updated_request': "✏️ நீங்கள் என்ன மாற்ற நினைக்கிறீர்கள்? தயவு செய்து உங்கள் புதுப்பிக்கப்பட்ட கோரிக்கையை அனுப்பவும்.",

                // Menu Options
                'menu_view_listings': "🏠 பட்டியல்களைக் காண்க",
                'menu_post_listing': "📝 பட்டியலை இடுக",
                'menu_manage_listings': "⚙️ பட்டியல்களை நிர்வகிக்கவும்",
                'menu_saved_listings': "❤️ சேமித்த பட்டியல்கள்",
                'menu_urban_help': "🔧 நகர்ப்புற உதவி",
                'menu_change_language': "🌐 மொழியை மாற்றவும்",
                'menu_voice_mode': "🎤 குரல் பயன்முறை",
                'new_listing_available': "🔔 புதிய {category} {location}-இல் கிடைக்கும்: {title}",
                'prompt_provide_listing_details': "தயவுசெய்து பட்டியல் விவரங்களை வழங்கவும்: தலைப்பு, இடம், வகை, விலை மற்றும் தொடர்பு.",
                'no_previous_request': "❌ முந்தைய கோரிக்கை கிடைக்கவில்லை. தயவு செய்து மீண்டும் தொடங்கவும்.",
                'no_transcription': "❌ எந்த வகை மொழிபெயர்பும் இல்லை. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.",
                'prompt_type_what_looking': "📝 நீங்கள் என்ன தேடுகிறீர்கள் என்பதை தட்டச்சு செய்யவும்:",
                'showing_menu_options': "📋 மெனு விருப்பங்கள் காண்பிக்கப்பட்டு வருகின்றன...",
                'starting_new_listing': "🆕 புதிய பட்டியல் துவங்குகிறேன்...",
                'draft_conflict_cancelled': "❌ டிராஃப்ட் மோதல் ரத்துசெய்யப்பட்டது. மெனுவிற்கு திரும்புகிறேன்.",
                'error_load_form': "❌ படிவத்தை ஏற்ற முடியவில்லை. தயவுசெய்து அரட்டை விருப்பத்தை பயன்படுத்தவும்.",
                'not_sure_try_menu': "🤔 உங்கள் தேடல் தெளிவில்லை. கீழ்காணும் மெனு விருப்பங்களை பயன்படுத்தவும்.",
                'error_unable_edit_listing': "❌ பட்டியலைத் திருத்த முடியவில்லை. தயவுசெய்து முயற்சிக்கவும்.",
                'fetching_listings': "🔍 கிடைக்கும் பட்டியல்களை தேடுகிறது...",
                'no_listings_available': "📭 இப்போது எந்தப் பட்டியலும் கிடைக்கவில்லை.\n\nஒரு பட்டியலைப் பதிப்பிக்க முயற்சிக்க அல்லது பின்னர் மீண்டும் சரிபார்க்கவும்!",
                'listings_end_of_results': "🎉 உங்கள் தேடலுக்கு பொருந்தும் அனைத்து பட்டியல்களும் இவை!",
                'contact_info_unavailable': "❌ இந்த பட்டியலுக்கு தொடர்பு தகவல் இல்லை.",
                'listing_lost': "மன்னிக்கவும், தற்போதைய பட்டியலை கண்டுபிடிக்கப்படவில்லை. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.",
                'no_listings_data': "பட்டியல் தரவு கிடைக்கவில்லை. மீண்டும் தேடவும்.",
                'listings_cycled': "🔄 நீங்கள் எல்லா பட்டியல்களையும் பார்த்துவிட்டீர்கள்! பிறமுதல் பட்டியலைத் தொடங்குகிறேன்.",
                'action_unrecognized': "செயல் புரியவில்லை. கார்டில் ஒன்றைத் தேர்ந்தெடுக்கவும்.",
                'error_load_listing': "❌ பட்டியல் விவரங்களைப் பெற முடியவில்லை. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.",
                'error_load_listings': "❌ மன்னிக்கவும், பட்டியல்களை ஏற்ற முடியவில்லை. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.",
                'fetching_your_listings': "📋 உங்கள் பட்டியல்களை ஏற்றுகிறது...",
                'error_load_your_listings': "❌ உங்கள் பட்டியல்களை ஏற்ற முடியவில்லை. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.",
                'restart_prompt': "புரியவில்லை. ஒரு விருப்பத்தைத் தேர்ந்தெடுக்கவும் அல்லது *hi* என்று தட்டச்சு செய்து மீண்டும் தொடங்கவும்.",
                'offer_post_listing_prompt': "நான் புரிந்துகொள்கிறேன் நீங்கள் சேவைகளை வழங்குகிறீர்கள். தயவுசெய்து '📝 Post Listing' ஐப் பயன்படுத்தவும்.",
                'voice_listing_switch': "🎤 குரல் பட்டியல் பதிவேற்றம் கண்டறிக்கப்பட்டது. பட்டியல் படிவத்துக்கு மாறுகிறேன்...",
                'voice_view_listing_instruction': "🎤 பட்டியல் விவரங்களைப் பார்க்க, மெனுவில் 'View Listings' ஐ தேர்வு செய்யவும்.",
                'contact_agent_instruction': "🎤 முகவரியை தொடர்பு கொள்ள பட்டியலில் உள்ள தொடர்பு விவரங்களைப் பயன்படுத்தவும்.",
                'processing_voice': "🎤 உங்கள் குரல் செய்தி செயலாக்கப்படுகிறது... காத்திருக்கவும்.",
                'error_voice_access': "❌ குரல் செய்திக்கு அணுக முடியவில்லை. தயவுசெய்து மீண்டும் அனுப்பவும்.",
                'ask_send_updated_request': "✏️ நீங்கள் என்ன மாற்ற விரும்புகிறீர்கள்? உங்கள் புதுப்பிக்கப்பட்ட கோரிக்கையை அனுப்பவும்.",
                
                // Job-Related Messages (Tamil)
                'job_prompt_role': "🔍 நீங்கள் எந்த வகையான வேலை தேடுகிறீர்கள்? (உ.ம்: கொள்ளுதல் ஆதரவு, டெலிவரி ஓட்டுநர், குழு தலைவர்)",
                'job_prompt_experience': "📊 உங்களுக்கு எவ்வளவு அனுபவம் உள்ளது? (உ.ம்: 2 ஆண்டுகள், 6 மாதங்கள், அனுபவம் இல்லை)",
                'job_prompt_location': "📍 இந்த வேலையை நீங்கள் எங்கு தேடுகிறீர்கள்? (நகரம் அல்லது பகுதி)",
                'job_request_saved': "✅ உங்கள் வேலை தேடுதல் சேமிக்கப்பட்டுவிட்டது! பொருந்தக்கூடிய வேலை கிடைக்கும்போது நாங்கள் உங்களுக்குத் தெரிப்பிப்போம்.",
                'job_request_error': "❌ மன்னிக்கவும், உங்கள் தேடுதலைச் சேமிக்க முடியவில்லை. தயவுசெய்து பின்னர் முயற்சிக்கவும்.",
                'no_jobs_yet': "📭 இப்போது உங்கள் அளவுகோல்களுடன் பொருந்தக்கூடிய வேலைகள் இல்லை. ஒன்று தோன்றியவுடன் நாங்கள் உங்களுக்குத் தெரிப்பிப்போம்!",
                'error_generic': "❌ மன்னிக்கவும், ஒரு பிழை ஏற்பட்டது. தயவுசெய்து பின்னர் முயற்சிக்கவும்."
            },
            
            gu: {
                // Basic support for Gujarati
                'welcome': "👋 *માર્કેટમેચ AI માં સ્વાગત છે!*",
                'not_understood': "મને સમજાયું નહીં.",
                'btn_yes': "✅ હા",
                'btn_no': "❌ ના",
                'main_menu': "🏠 મુખ્ય મેનુ",
                'language_set': "🌐 ભાષા {lang} સેટ કરવામાં આવી છે."
            },
            
            kn: {
                // Basic support for Kannada
                'welcome': "👋 *ಮಾರ್ಕೆಟ್ಮ್ಯಾಚ್ AI ಗೆ ಸ್ವಾಗತ!*",
                'not_understood': "ನನಗೆ ಅರ್ಥವಾಗಲಿಲ್ಲ.",
                'btn_yes': "✅ ಹೌದು",
                'btn_no': "❌ ಇಲ್ಲ",
                'main_menu': "🏠 ಮುಖ್ಯ ಮೆನು",
                'language_set': "🌐 ಭಾಷೆ {lang} ಗೆ ಸೆಟ್ ಮಾಡಲಾಗಿದೆ."
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