const strings = {
  en: {
    welcome: "Welcome! Please select your language:",
    menu: "Menu:\n• Buy → find properties\n• Sell → post a listing\n• Explore → see listings\n• Change Language",
    chooseLanguage: "Choose your preferred language:",
    postListingPrompt: "⚠️ Provide details in this format:\nName, Location, Type, Price, Contact, Description",
    listingSuccess: "✅ Your property has been posted successfully!",
    noListings: "⚠️ No properties match your criteria.",
    restart: "Session restarted. What do you want to do?\nBuy / Sell / Explore",
    changeLanguage: "Please select your new language:"
  },
  hi: {
    welcome: "स्वागत है! कृपया अपनी भाषा चुनें:",
    menu: "मेनू:\n• खरीदें → संपत्तियाँ खोजें\n• बेचें → लिस्टिंग पोस्ट करें\n• देखें → लिस्टिंग देखें\n• भाषा बदलें",
    chooseLanguage: "अपनी पसंदीदा भाषा चुनें:",
    postListingPrompt: "⚠️ विवरण इस फॉर्मेट में दें:\nनाम, स्थान, प्रकार, मूल्य, संपर्क, विवरण",
    listingSuccess: "✅ आपकी संपत्ति सफलतापूर्वक पोस्ट की गई!",
    noListings: "⚠️ आपकी खोज के अनुसार कोई संपत्ति नहीं मिली।",
    restart: "सेशन पुनः शुरू किया गया। आप क्या करना चाहते हैं?\nखरीदें / बेचें / देखें",
    changeLanguage: "कृपया अपनी नई भाषा चुनें:"
  },
  mr: {
    welcome: "स्वागत आहे! कृपया आपली भाषा निवडा:",
    menu: "मेनू:\n• खरेदी → मालमत्ता शोधा\n• विक्री → लिस्टिंग पोस्ट करा\n• एक्सप्लोर → लिस्टिंग पहा\n• भाषा बदला",
    chooseLanguage: "आपली पसंतीची भाषा निवडा:",
    postListingPrompt: "⚠️ तपशील या स्वरूपात द्या:\nनाव, स्थान, प्रकार, किंमत, संपर्क, वर्णन",
    listingSuccess: "✅ आपली मालमत्ता यशस्वीरित्या पोस्ट झाली आहे!",
    noListings: "⚠️ आपल्याला कोणतीही मालमत्ता मिळाली नाही.",
    restart: "सेशन पुन्हा सुरू झाले. आपण काय कराल?\nखरेदी / विक्री / एक्सप्लोर",
    changeLanguage: "कृपया आपली नवीन भाषा निवडा:"
  }
};

function getString(lang = "en", key = "") {
  return strings[lang]?.[key] || strings["en"][key] || key;
}

module.exports = { getString };
