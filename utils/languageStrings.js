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
  ta: {
    welcome: "வரவேற்கிறோம்! தயவுசெய்து உங்கள் மொழியை தேர்ந்தெடுக்கவும்:",
    menu: "மெனு:\n• வாங்க → சொத்துகளைப் பாருங்கள்\n• விற்க → பட்டியலைச் சேர்க்கவும்\n• ஆராய → பட்டியல்கள்\n• மொழியை மாற்றவும்",
    chooseLanguage: "உங்கள் விருப்பமான மொழியைத் தேர்ந்தெடுக்கவும்:",
    postListingPrompt: "⚠️ விவரங்களை இவ்வாறு கொடுக்கவும்:\nபெயர், இடம், வகை, விலை, தொடர்பு, விவரம்",
    listingSuccess: "✅ உங்கள் சொத்து வெற்றிகரமாக பதிவுசெய்யப்பட்டது!",
    noListings: "⚠️ உங்கள் தேடலுக்கேற்ப எந்த சொத்துகளும் கிடைக்கவில்லை.",
    restart: "அமர்வு மீண்டும் தொடங்கப்பட்டது. நீங்கள் என்ன செய்ய விரும்புகிறீர்கள்?\nவாங்க / விற்க / ஆராய",
    changeLanguage: "தயவுசெய்து உங்கள் புதிய மொழியைத் தேர்ந்தெடுக்கவும்:"
  }
};

function getString(lang = "en", key = "") {
  return strings[lang]?.[key] || strings["en"][key] || key;
}

module.exports = { getString };
