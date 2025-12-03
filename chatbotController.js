// ========================================
// IMPORTS
// ========================================
const commandRouter = require("./src/bots/commandRouter");
const { getSession, saveSession } = require("./utils/sessionStore");
const { 
  getUserProfile, 
  saveUserLanguage,
  getTopListings,
  // NOTE: getUserListings must be implemented in ./database/firestore.js 
  getUserListings 
} = require("./database/firestore");

// !!! IMPORTANT: Added sendListingCard import and removed redundant button import !!!
const { 
    sendMessage, 
    sendList, 
    sendReplyButtons, 
    sendListingCard // <--- ADDED 
} = require("./src/services/messageService"); 
const { db } = require("./database/firestore");   // <-- required for flow submission


// ========================================
// FLOW SUBMISSION HANDLER (For Interactive Forms)
// ========================================
async function handleFlowSubmission(metadata, sender) {
  if (
    metadata?.type === "interactive" &&
    metadata?.interactive?.type === "flow_submission"
  ) {
    const data = metadata.interactive.data;
    
    // The user property here MUST match the sender's WA_ID for correct filtering later
    await db.collection("listings").add({
      user: sender, 
      title: data.title,
      type: data.listingType,
      bhk: data.bhk,
      location: data.location,
      price: data.price,
      contact: data.contact,
      createdAt: Date.now()
    });

    await sendMessage(sender, "🎉 Your listing has been posted successfully!");
    return true; // stop further processing
  }

  return false;
}



// ========================================
// LIST MESSAGE DATA
// ========================================
const LANG_ROWS = [
  { id: "lang_en", title: "English" },
  { id: "lang_hi", title: "हिंदी (Hindi)" },
  { id: "lang_ta", title: "தமிழ் (Tamil)" },
  { id: "lang_gu", title: "ગુજરાતી (Gujarati)" },
  { id: "lang_kn", title: "ಕನ್ನಡ (Kannada)" },
];

const MENU_ROWS = [
  { id: "view_listings", title: "View Listings" },
  { id: "post_listing", title: "Post Listing" },
  { id: "manage_listings", title: "Manage Listings" },
  { id: "change_language", title: "Change Language" },
];



// ========================================
// SEND LIST HELPERS
// ========================================
async function sendLanguageListViaService(to) {
  const sections = [{ title: "Available languages", rows: LANG_ROWS }];
  // NOTE: Simplified sendList arguments to match standard 5-argument service signature.
  return sendList(
    to,
    "🌐 Select your preferred language",
    "Choose one option from below:",
    "Select Language", // Button Text
    sections
  );
}

async function sendMainMenuViaService(to) {
  const sections = [{ title: "Menu", rows: MENU_ROWS }];
  // NOTE: Simplified sendList arguments to match standard 5-argument service signature.
  return sendList(
    to,
    "🏡 MarketMatch AI",
    "Choose an option:",
    "Select an option", // Button Text
    sections
  );
}



// ========================================
// PARSE LANGUAGE TYPED INPUT
// ========================================
function parseLangFromText(text) {
  if (!text) return null;
  const lower = text.toLowerCase().trim();

  if (lower.startsWith("lang_")) return lower.split("lang_")[1];

  if (lower.includes("english")) return "en";
  if (lower.includes("hindi") || lower === "hi") return "hi";
  if (lower.includes("tamil") || lower === "ta") return "ta";
  if (lower.includes("gujarati") || lower === "gu") return "gu";
  if (lower.includes("kannada") || lower === "kn") return "kn";

  return null;
}


// ========================================
// START/CONTINUE LISTING FLOW - EXTREME DEBUG VERSION
// ========================================
async function handleShowListings(sender, session) {
  console.log("🎯 [EXTREME DEBUG] handleShowListings ENTERED");
  console.log("🎯 [EXTREME DEBUG] session:", JSON.stringify(session, null, 2));
  
  try {
    // Check if we already have listings stored in the session
    let { listings, totalCount } = session.housingFlow.listingData || {};
    
    console.log("🎯 [EXTREME DEBUG] listings from session:", listings ? `${listings.length} listings` : "NONE");

    // If not, fetch the top listings
    if (!listings) {
      console.log("🎯 [EXTREME DEBUG] Fetching fresh listings...");
      const result = await getTopListings();
      listings = result.listings;
      totalCount = result.totalCount;
      
      console.log(`🎯 [EXTREME DEBUG] Fetched ${listings.length} listings`);
      
      if (!listings || listings.length === 0) {
        console.log("🎯 [EXTREME DEBUG] NO LISTINGS FOUND");
        await sendMessage(sender, "No listings available right now.");
        return;
      }

      // Initialize session
      session.step = "awaiting_listing_action";
      session.housingFlow.currentIndex = 0;
      session.housingFlow.listingData = { listings, totalCount };
      
      await saveSession(sender, session);
      console.log("🎯 [EXTREME DEBUG] Session saved");
    }
    
    // Get current listing
    const currentIndex = session.housingFlow.currentIndex || 0;
    const listing = listings[currentIndex];
    
    console.log("🎯 [EXTREME DEBUG] currentIndex:", currentIndex);
    console.log("🎯 [EXTREME DEBUG] listing:", listing ? `ID: ${listing.id}` : "NULL");

    if (!listing) {
      console.log("🎯 [EXTREME DEBUG] No listing at index");
      await sendMessage(sender, "You've seen all the available listings!");
      session.step = "menu";
      delete session.housingFlow.listingData;
      delete session.housingFlow.currentIndex;
      await saveSession(sender, session);
      return;
    }

    console.log("🎯 [EXTREME DEBUG] Calling sendListingCard NOW...");
    console.log("🎯 [EXTREME DEBUG] Listing data:", {
      id: listing.id,
      title: listing.title || listing.type,
      location: listing.location,
      price: listing.price
    });
    
    // CRITICAL: Try-catch sendListingCard
    try {
      await sendListingCard(
        sender, 
        { 
          id: listing.id,
          title: listing.title || listing.type || "Property",
          location: listing.location || "Not specified",
          price: listing.price || "N/A",
          bedrooms: listing.bhk || "N/A",
          property_type: listing.type || "Property",
          description: listing.description || "No description",
          contact: listing.contact || "Contact not provided"
        }, 
        currentIndex, 
        totalCount
      );
      console.log("🎯 [EXTREME DEBUG] sendListingCard SUCCESS!");
    } catch (cardError) {
      console.error("🎯 [EXTREME DEBUG] sendListingCard FAILED:", cardError.message);
      console.error("🎯 [EXTREME DEBUG] Error stack:", cardError.stack);
      
      // FALLBACK: Send simple text
      const fallbackText = 
`🏡 Listing ${currentIndex + 1}/${totalCount}
${listing.title || listing.type || "Property"}

📍 ${listing.location || "Location not specified"}
💰 ${listing.price || "Price on request"}
🛏️ ${listing.bhk || "N/A"} BHK

Reply "next" for next listing.`;
      
      await sendMessage(sender, fallbackText);
    }

  } catch (err) {
    console.error("🎯 [EXTREME DEBUG] FATAL ERROR in handleShowListings:", err);
    console.error("🎯 [EXTREME DEBUG] Error stack:", err.stack);
    await sendMessage(sender, "❌ Error fetching listings.");
  }
}



// ========================================
// MANAGE USER LISTINGS (Unchanged)
// ========================================
async function handleManageListings(sender) {
  try {
    const listings = await getUserListings(sender); 

    if (!listings || listings.length === 0) {
      return sendMessage(sender, "You haven't posted any listings yet. Select *Post Listing* from the menu to add one!");
    }

    let txt = "🏡 *Your Listings for Management*\n\n";
    
    listings.forEach((l, i) => {
      txt += `*---------------------- Listing ${i + 1} ----------------------*\n`;
      txt += `*ID:* ${l.id}\n`;
      txt += `*Title:* ${l.title || "Untitled"}\n`;
      txt += `*Location:* ${l.location || "Not provided"}\n`;
      txt += `*Type:* ${l.listingType || l.type || "N/A"}\n`;
      txt += `*Price:* ₹${l.price ? l.price.toLocaleString('en-IN') : "N/A"}\n\n`;
    });

    await sendMessage(sender, txt);

    await sendMessage(
      sender,
      "To *delete* a listing, reply with its *ID* (e.g., 'Delete ID-XYZ').\nTo go back, type *hi*."
    );

  } catch (err) {
    console.error("Error in handleManageListings:", err);
    await sendMessage(sender, "❌ Unable to fetch your listings right now.");
  }
}


// ========================================
// MAIN CONTROLLER - FIXED VERSION
// ========================================
async function handleIncomingMessage(sender, text = "", metadata = {}) {
  console.log("🔍 [CONTROLLER DEBUG] === START handleIncomingMessage ===");
  console.log("🔍 [CONTROLLER DEBUG] Input - sender:", sender);
  console.log("🔍 [CONTROLLER DEBUG] Input - text:", text);
  console.log("🔍 [CONTROLLER DEBUG] Input - metadata type:", metadata?.type);
  
  if (!sender) return;

  // ===========================
  // 0) PRIORITY: CHECK FLOW SUBMISSION
  // ===========================
  const flowHandled = await handleFlowSubmission(metadata, sender);
  if (flowHandled) return; // stop further logic, flow form already handled

  let replyId = null;
  
  // Prefer interactive reply IDs over raw text
  if (metadata?.interactive?.type === "list_reply") {
    replyId = metadata.interactive.list_reply.id;
  } else if (metadata?.interactive?.type === "button_reply") { // New: Handle button reply
    replyId = metadata.interactive.button_reply.id;
  }
  
  console.log("🔍 [CONTROLLER DEBUG] replyId:", replyId);
  
  // Use replyId if present, otherwise use raw text
  const msg = String(replyId || text || "").trim();
  const lower = msg.toLowerCase();
  
  console.log("🔍 [CONTROLLER DEBUG] processed msg:", msg);
  console.log("🔍 [CONTROLLER DEBUG] processed lower:", lower);

  // session
  let session = (await getSession(sender)) || { 
    step: "start",
    housingFlow: { 
      step: "start", 
      data: {},
      // New state variables for interactive listing flow
      currentIndex: 0, 
      listingData: null
    },
    isInitialized: false
  };

  const user = await getUserProfile(sender);

  const greetings = ["hi", "hello", "hey", "start"];
  const isGreeting = greetings.includes(lower);
  const isNewUser = !user && !session.isInitialized;



  // ===========================
  // 1) NEW USER INTRO
  // ===========================
  if (isGreeting && isNewUser) {
    await sendMessage(
      sender,
      "👋 *Welcome to MarketMatch AI!* \n\nI'm your personal assistant for:\n🏠 Rentals\n🏢 Real Estate\n👤 PG / Flatmates\n🧹 Home Services\n\nLet's begin by choosing your preferred language."
    );

    await sendLanguageListViaService(sender);

    session.isInitialized = true;
    session.housingFlow.awaitingLangSelection = true;
    session.step = "awaiting_language";
    await saveSession(sender, session);
    return session;
  }



  // ===========================
  // 2) EXISTING USER GREETING
  // ===========================
  if (isGreeting && !isNewUser) {
    // Reset any active flow on greeting
    session.housingFlow.listingData = null;
    session.housingFlow.currentIndex = 0;
    session.step = "menu";
    await saveSession(sender, session);
    await sendMainMenuViaService(sender);
    return session;
  }



  // ===========================
  // 3) LANGUAGE SELECTION
  // ===========================
  if (session.housingFlow?.awaitingLangSelection) {
    const parsed = parseLangFromText(msg);

    if (parsed) {
      try {
        await saveUserLanguage(sender, parsed);
      } catch (err) {
        console.warn("saveUserLanguage error:", err);
      }

      session.housingFlow.awaitingLangSelection = false;
      session.step = "menu";
      await saveSession(sender, session);

      await sendMainMenuViaService(sender);
      return session;
    } else {
      await sendMessage(sender, "Please select a language 👇");
      await sendLanguageListViaService(sender);
      return session;
    }
  }
  
  // ==========================================
  // 4) AWAITING LISTING DETAILS (TEXT-BASED POST)
  // ==========================================
  if (session.step === "awaiting_post_details") {
    try {
      // Split the incoming message by comma and trim whitespace
      const parts = msg.split(",").map(p => p.trim());
      
      // We need at least 5 main fields (Name, Location, Type, Price, Contact)
      if (parts.length < 5) {
        throw new Error("Missing required details.");
      }

      // Parsing based on the expected format: 
      // [0] Name, [1] Location, [2] Type/BHK, [3] Price, [4] Contact, [5+] Description
      
      const rawPrice = parts[3].replace(/[^\d]/g, ''); // Remove non-digits
      const price = parseInt(rawPrice);

      const listing = {
        user: sender,
        title: `${parts[0]} - ${parts[2]} Listing`, 
        listingType: parts[2], // e.g., 2BHK
        location: parts[1], 
        price: isNaN(price) ? rawPrice : price, // Save as number if parsed, otherwise keep raw string
        contact: parts[4],
        description: parts.slice(5).join(", ") || "No additional details provided.",
        createdAt: Date.now()
      };

      await db.collection("listings").add(listing);
      
      await sendMessage(sender, "🎉 Your property listing has been posted successfully and is now visible to others!");
      
      // Reset state and show menu
      session.step = "menu";
      await saveSession(sender, session);
      await sendMainMenuViaService(sender);
      return session;

    } catch (err) {
      console.error("Error processing listing details:", err);
      // Reprompt the user with the correct format
      await sendMessage(
        sender,
        "❌ I had trouble parsing those details. Please ensure you use the exact format:\nExample: *Rahul, Noida Sector 56, 2BHK, 15000, +9199XXXXXXXX, Semi-furnished, near metro*"
      );
      return session; // Remain in the current state to allow the user to retry
    }
  }
  
  // ==========================================
  // 5) INTERACTIVE LISTING ACTIONS (NEW)
  // ==========================================
  if (session.step === "awaiting_listing_action" && replyId) {
    console.log(`🔄 Handling listing action: ${msg}`); // Debug
    
    const listingData = session.housingFlow.listingData;
    const currentIndex = session.housingFlow.currentIndex;
    const currentListing = listingData?.listings?.[currentIndex];
    
    // Check if we have a current listing before proceeding
    if (!currentListing) {
      console.log("❌ Lost track of current listing, resetting to menu");
      await sendMessage(sender, "Sorry, I lost track of the current listing. Please try searching again.");
      session.step = "menu";
      await saveSession(sender, session);
      return session;
    }
    
    // 5.1 Handle NEXT button
if (msg === "NEXT_LISTING") {
  console.log("⏭️ Next button clicked");
  
  // Get the current listings data
  const listingData = session.housingFlow.listingData;
  if (!listingData || !listingData.listings) {
    await sendMessage(sender, "No listings data found. Please search again.");
    session.step = "menu";
    await saveSession(sender, session);
    return session;
  }
  
  const totalListings = listingData.listings.length;
  let currentIndex = session.housingFlow.currentIndex || 0;
  
  // Move to next listing
  currentIndex++;
  
  // Check if we've reached the end
  if (currentIndex >= totalListings) {
    currentIndex = 0; // Loop back to start
    await sendMessage(sender, "🔄 You've seen all listings! Starting from the first one again.");
  }
  
  // Update session
  session.housingFlow.currentIndex = currentIndex;
  await saveSession(sender, session);
  
  // Show the next listing
  await handleShowListings(sender, session);
  return session;
}
    
    // 5.2 Handle VIEW DETAILS button (ID format: VIEW_DETAILS_CLEAN_ID)
    if (msg.startsWith("VIEW_DETAILS_")) {
      console.log("📄 View details button clicked");
      // The ID from the button payload is the clean Firestore ID
      await sendMessage(
        sender, 
        `*Full Details for ${currentListing.title || 'Property'}*\n\n` +
        `*Description:*\n${currentListing.description || "No full description provided."}\n\n` +
        `*Contact:* ${currentListing.contact || "N/A"}\n` +
        `*Location:* ${currentListing.location || "N/A"}\n` +
        `*Price:* ${currentListing.price || "Price on request"}`
      );
      // Re-display the listing view after showing details
      await handleShowListings(sender, session); 
      return session;
    }
    
    // 5.3 Handle SAVE button (ID format: SAVE_LISTING_CLEAN_ID)
    if (msg.startsWith("SAVE_LISTING_")) {
      console.log("💾 Save button clicked");
      // NOTE: Implement logic to save listing ID (e.g., currentListing.id) to a 'savedListings' collection for the user.
      await sendMessage(sender, `Listing *${currentListing.title || 'Property'}* saved to your favorites! ❤️`);
      // Re-display the listing view after saving
      await handleShowListings(sender, session);
      return session;
    }
    
    // Fallback if an interactive button was pressed but not handled above
    await sendMessage(sender, "Action unrecognized. Please select a button from the card.");
    await handleShowListings(sender, session); 
    return session;
  }


  // ===========================
  // 6) MENU COMMAND HANDLING
  // ===========================

  // =======================================================
  // OLD MENU SYSTEM — REACHED ONLY IF ROUTER DIDN'T MATCH
  // =======================================================

  switch (lower) {
    case "view_listings":
      console.log("🏠 Menu: View Listings selected");
      session.step = "awaiting_listing_action"; 
      await saveSession(sender, session); // Save session BEFORE calling handleShowListings
      await handleShowListings(sender, session); 
      return session; // Return early

    case "post_listing":
      console.log("📝 Menu: Post Listing selected");
      await sendMessage(
        sender,
        "Please send the listing details in this exact format:\nExample: *Rahul, Noida Sector 56, 2BHK, 15000, +9199XXXXXXXX, Semi-furnished, near metro*"
      );
      session.step = "awaiting_post_details";
      break;

    case "manage_listings":
      console.log("⚙️ Menu: Manage Listings selected");
      await handleManageListings(sender);
      session.step = "managing";
      break;

    case "change_language":
      console.log("🌐 Menu: Change Language selected");
      session.housingFlow.awaitingLangSelection = true;
      session.step = "awaiting_language";
      await saveSession(sender, session);
      await sendLanguageListViaService(sender);
      return session; // Return early

    default:
      // Check for delete command only if in 'managing' state (to be implemented later)
      if (session.step === "managing" && lower.startsWith("delete")) {
        // To be implemented: logic to parse ID and delete listing
        await sendMessage(sender, "Received delete command. Deletion logic is not yet implemented.");
        await handleManageListings(sender); // Show list again
        return session;
      }
      
      // Default: show menu
      console.log(`❓ Unknown command: ${lower}, showing menu`);
      await sendMessage(sender, "I didn't understand that. Choose an option or type *hi* to restart.");
      await sendMainMenuViaService(sender);
      session.step = "menu";
      break;
  }

  await saveSession(sender, session);


//   // ===========================================
//   // 🚀 NEW: ROUTER-BASED COMMAND PROCESSING
//   // ===========================================

//   // Parse using the new command router
//   const cmd = commandRouter.parseCommand(lower);

//   // If command recognized by router, route it
//   if (cmd) {
//     console.log(`🤖 Router handling command: ${cmd}`);
//     const result = await commandRouter.handle(
//       cmd,
//       session,
//       sender,
//       "en",
//       {}
//     );

//     // send card / text
//     if (result.reply) {
//       await sendMessage(sender, result.reply);
//     }

//     // store new session
//     await saveSession(sender, result.nextSession);

//     return result.nextSession;
//   }
  
  return session;
}



// ========================================
module.exports = {
  handleIncomingMessage,
  handleShowListings,
  handleManageListings
};