// ========================================
// IMPORTS
// ========================================
const { getSession, saveSession } = require("./utils/sessionStore");
const { 
  getUserProfile, 
  saveUserLanguage,
  getTopListings,
  // NOTE: getUserListings must be implemented in ./database/firestore.js 
  getUserListings 
} = require("./database/firestore");

// !!! IMPORTANT: Added sendReplyButtons import !!!
const { sendMessage, sendList, sendReplyButtons } = require("./src/services/messageService");
const { db } = require("./database/firestore");   // <-- required for flow submission


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
  return sendList(
    to,
    "🌐 Select your preferred language",
    "Choose one option from below:",
    "MarketMatch AI",
    "Select Language",
    sections
  );
}

async function sendMainMenuViaService(to) {
  const sections = [{ title: "Menu", rows: MENU_ROWS }];
  return sendList(
    to,
    "🏡 MarketMatch AI",
    "Choose an option:",
    "MarketMatch AI",
    "Select an option",
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
// DISPLAY INTERACTIVE LISTING
// ========================================
async function displaySingleListing(sender, listing, totalCount, currentIndex) {
  // Use mock data for missing fields to ensure the message is robust
  const bhk = listing.bhk || listing.listingType || "2BHK";
  const location = listing.location || "Greater Noida";
  const price = listing.price ? listing.price.toLocaleString('en-IN') : "18,500";
  const contactName = listing.contactName || "Rahul";
  const area = listing.area || "980 sq ft";
  const furnished = listing.furnished || "Semi-Furnished";
  const detailsTitle = listing.title || `${bhk} in ${location}`;

  const text = 
    `🏡 *${detailsTitle}* (Listing ${currentIndex + 1} of ${totalCount})\n` +
    `💰 Rent: *₹${price}*\n` +
    `📍 Location: ${location}\n` +
    `📏 Area: ${area}\n` +
    `🛋 Status: ${furnished}\n` +
    `🏷 Posted by: ${contactName}\n\n` +
    `_Tap a button below to proceed._`;

  const buttons = [
    { id: `VIEW_DETAILS_${listing.id}`, title: "View Details" },
    { id: `SAVE_LISTING_${listing.id}`, title: "Save❤️" },
    { id: "NEXT_LISTING", title: "Next ➡️" },
  ];

  // This function must be implemented in messageService.js
  await sendReplyButtons(sender, text, buttons); 
}


// ========================================
// START/CONTINUE LISTING FLOW
// ========================================
async function handleShowListings(sender, session) {
  try {
    // Check if we already have listings stored in the session
    let { listings, totalCount } = session.housingFlow.listingData || {};

    // If not, fetch the top listings (this happens on the first 'View Listings' click)
    if (!listings) {
      const result = await getTopListings();
      listings = result.listings;
      totalCount = result.totalCount;

      if (!listings.length) {
        return sendMessage(sender, "No listings available right now.");
      }

      // Initialize session for the new interactive flow
      session.step = "awaiting_listing_action";
      session.housingFlow.currentIndex = 0;
      session.housingFlow.listingData = { listings, totalCount };
    }
    
    const currentIndex = session.housingFlow.currentIndex;
    const listing = listings[currentIndex];

    if (!listing) {
      // Should not happen if totalCount is correct, but handles flow completion
      await sendMessage(sender, "You've seen all the available listings! Type *hi* to return to the main menu.");
      session.step = "menu";
      delete session.housingFlow.listingData;
      delete session.housingFlow.currentIndex;
      return;
    }

    // Display the current listing interactively
    await displaySingleListing(sender, listing, totalCount, currentIndex);

  } catch (err) {
    console.error("Error in handleShowListings:", err);
    await sendMessage(sender, "❌ Unable to fetch listings right now.");
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
// MAIN CONTROLLER
// ========================================
async function handleIncomingMessage(sender, text = "", metadata = {}) {
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
  
  // Use replyId if present, otherwise use raw text
  const msg = String(replyId || text || "").trim();
  const lower = msg.toLowerCase();

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
      "👋 *Welcome to MarketMatch AI!* \n\nI’m your personal assistant for:\n🏠 Rentals\n🏢 Real Estate\n👤 PG / Flatmates\n🧹 Home Services\n\nLet's begin by choosing your preferred language."
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
    const listingData = session.housingFlow.listingData;
    const currentIndex = session.housingFlow.currentIndex;
    const currentListing = listingData?.listings?.[currentIndex];
    
    // 5.1 Handle NEXT button
    if (msg === "NEXT_LISTING") {
      session.housingFlow.currentIndex++;
      if (session.housingFlow.currentIndex >= listingData.totalCount) {
        // Wrap around or end the flow
        session.housingFlow.currentIndex = 0; // Wrap around for infinite browsing
        // If you want to end the flow:
        // await sendMessage(sender, "You've reached the end of the list!");
        // session.step = "menu"; 
      }
      await saveSession(sender, session);
      await handleShowListings(sender, session); // Display the next listing
      return session;
    } 
    
    // 5.2 Handle VIEW DETAILS button
    if (msg.startsWith("VIEW_DETAILS_")) {
      await sendMessage(
        sender, 
        `*Full Details for Listing ID ${currentListing.id}:*\n\n` +
        `*Description:*\n${currentListing.description || "No full description provided."}\n\n` +
        `*Contact:* ${currentListing.contact || "N/A"}`
      );
      // Re-display the listing view after showing details
      await displaySingleListing(sender, currentListing, listingData.totalCount, currentIndex);
      return session;
    }
    
    // 5.3 Handle SAVE button
    if (msg.startsWith("SAVE_LISTING_")) {
        // NOTE: Implement logic to save listing ID (e.g., currentListing.id) to a 'savedListings' collection for the user.
        await sendMessage(sender, `Listing *${currentListing.title}* saved to your favorites! ❤️`);
        // Re-display the listing view after saving
        await displaySingleListing(sender, currentListing, listingData.totalCount, currentIndex);
        return session;
    }
  }


  // ===========================
  // 6) MENU COMMAND HANDLING
  // ===========================
  switch (lower) {
    case "view_listings":
      await handleShowListings(sender, session); // Now accepts session
      session.step = "awaiting_listing_action"; // New state for interactive flow
      break;

    case "post_listing":
      await sendMessage(
        sender,
        "Please send the listing details in this exact format:\nExample: *Rahul, Noida Sector 56, 2BHK, 15000, +9199XXXXXXXX, Semi-furnished, near metro*"
      );
      session.step = "awaiting_post_details";
      break;

    case "manage_listings":
      await handleManageListings(sender);
      session.step = "managing";
      break;

    case "change_language":
      session.housingFlow.awaitingLangSelection = true;
      session.step = "awaiting_language";
      await saveSession(sender, session);
      await sendLanguageListViaService(sender);
      break;

    default:
      // Check for delete command only if in 'managing' state (to be implemented later)
      if (session.step === "managing" && lower.startsWith("delete")) {
          // To be implemented: logic to parse ID and delete listing
          await sendMessage(sender, "Received delete command. Deletion logic is not yet implemented.");
          await handleManageListings(sender); // Show list again
          return session;
      }
      
      // Default: show menu
      await sendMessage(sender, "I didn't understand that. Choose an option or type *hi* to restart.");
      await sendMainMenuViaService(sender);
      session.step = "menu";
      break;
  }

  await saveSession(sender, session);
  return session;
}



// ========================================
module.exports = {
  handleIncomingMessage,
};