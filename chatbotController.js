// ========================================
// IMPORTS
// ========================================
const commandRouter = require("./src/bots/commandRouter");
const { getSession, saveSession, clearFlowData } = require("./utils/sessionStore");
const { 
  getUserProfile, 
  saveUserLanguage,
  getTopListings,
  getUserListings,
  getListingById,
  deleteListing,
  updateListing
} = require("./database/firestore");

const { 
    sendMessage, 
    sendList, 
    sendReplyButtons, 
    sendListingCard
} = require("./src/services/messageService"); 
const { db } = require("./database/firestore");


// ========================================
// FLOW SUBMISSION HANDLER (For Interactive Forms)
// ========================================
async function handleFlowSubmission(metadata, sender) {
  if (
    metadata?.type === "interactive" &&
    metadata?.interactive?.type === "flow_submission"
  ) {
    const data = metadata.interactive.data;
    
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
    return true;
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
  { 
    id: "view_listings", 
    title: "View Listings", 
    description: "Browse available homes, apartments, or properties for rent or sale." 
  },
  { 
    id: "post_listing", 
    title: "Post Listing", 
    description: "Publish your home or property to attract potential buyers or renters." 
  },
  { 
    id: "manage_listings", 
    title: "Manage Listings", 
    description: "Edit, update, or remove your property listings." 
  },
  { 
    id: "change_language", 
    title: "Change Language", 
    description: "Switch the app's interface to your preferred language." 
  },
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
// START/CONTINUE LISTING FLOW - EXTREME DEBUG VERSION
// ========================================
async function handleShowListings(sender, session) {
  console.log("🎯 [EXTREME DEBUG] handleShowListings ENTERED");
  
  try {
    let { listings, totalCount } = session.housingFlow.listingData || {};

    if (!listings) {
      console.log("🎯 [EXTREME DEBUG] Fetching fresh listings...");
      const result = await getTopListings();
      listings = result.listings;
      totalCount = result.totalCount;
      
      if (!listings || listings.length === 0) {
        console.log("🎯 [EXTREME DEBUG] NO LISTINGS FOUND");
        await sendMessage(sender, "No listings available right now.");
        return;
      }

      session.step = "awaiting_listing_action";
      session.housingFlow.currentIndex = 0;
      session.housingFlow.listingData = { listings, totalCount };
      await saveSession(sender, session);
    }
    
    const currentIndex = session.housingFlow.currentIndex || 0;
    const listing = listings[currentIndex];
    
    if (!listing) {
      await sendMessage(sender, "You've seen all the available listings!");
      session.step = "menu";
      delete session.housingFlow.listingData;
      delete session.housingFlow.currentIndex;
      await saveSession(sender, session);
      return;
    }

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
    } catch (cardError) {
      console.error("🎯 [EXTREME DEBUG] sendListingCard FAILED:", cardError.message);
      
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
    await sendMessage(sender, "❌ Error fetching listings.");
  }
}



// ========================================
// MANAGE USER LISTINGS
// ========================================
async function handleManageListings(sender) {
  try {
    const listings = await getUserListings(sender); 

    if (!listings || listings.length === 0) {
      return sendMessage(sender, "You haven't posted any listings yet. Select *Post Listing* from the menu to add one!");
    }

    const listingRows = listings.map((l, i) => {
      const shortTitle = l.title && l.title.length > 25 
        ? l.title.substring(0, 25) + '...' 
        : l.title || 'Untitled Property';
      
      return {
        id: `listing_${l.id}`,
        title: `${shortTitle} - ₹${l.price ? l.price.toLocaleString('en-IN') : "N/A"}`,
        description: `📍 ${l.location || 'Location not specified'} | 🏠 ${l.type || l.listingType || 'Property'}`
      };
    });

    const sections = [{
      title: `Your Listings (${listings.length})`,
      rows: listingRows
    }];

    await sendList(
      sender,
      "🏡 Manage Your Listings",
      "Select a listing to delete or edit:",
      "Select Listing",
      sections
    );

    const session = await getSession(sender);
    session.step = "managing_listings";
    session.manageListings = {
      listings: listings.reduce((acc, listing) => {
        acc[listing.id] = listing;
        return acc;
      }, {}),
      step: "awaiting_selection"
    };
    await saveSession(sender, session);

  } catch (err) {
    console.error("Error in handleManageListings:", err);
    await sendMessage(sender, "❌ Unable to fetch your listings right now.");
  }
}

// ========================================
// HANDLE LISTING SELECTION FOR DELETE/EDIT
// ========================================
async function handleListingSelection(sender, selectedId, session) {
  const listingId = selectedId.replace('listing_', '');
  const listing = session.manageListings?.listings?.[listingId];

  if (!listing) {
    await sendMessage(sender, "❌ Listing not found. Please try again.");
    await handleManageListings(sender);
    return;
  }

  session.manageListings.selectedId = listingId;
  session.manageListings.selectedListing = listing;
  session.manageListings.step = "awaiting_action";

  const listingText = 
`📋 Listing Details:
*Title:* ${listing.title || 'Untitled'}
*Location:* ${listing.location || 'Not specified'}
*Type:* ${listing.type || listing.listingType || 'Property'}
*BHK:* ${listing.bhk || 'N/A'}
*Price:* ₹${listing.price ? listing.price.toLocaleString('en-IN') : 'N/A'}
*Contact:* ${listing.contact || 'Not provided'}
*Description:* ${listing.description || 'No description'}

What would you like to do with this listing?`;

  await sendReplyButtons(
    sender,
    listingText,
    [
      { id: `delete_${listingId}`, title: "🗑️ Delete Listing" },
      { id: `edit_${listingId}`, title: "✏️ Edit Listing" },
      { id: "cancel_manage", title: "⬅️ Back to List" }
    ],
    "Listing Details"
  );

  await saveSession(sender, session);
}

// ========================================
// HANDLE DELETE CONFIRMATION
// ========================================
async function handleDeleteListing(sender, session) {
  const listingId = session.manageListings?.selectedId;
  const listing = session.manageListings?.selectedListing;

  if (!listingId || !listing) {
    await sendMessage(sender, "❌ No listing selected for deletion.");
    await handleManageListings(sender);
    return;
  }

  console.log(`🔍 [CONTROLLER] Deleting listing: ${listingId}`);
  console.log(`🔍 [CONTROLLER] Listing title: ${listing.title || 'Untitled'}`);

  try {
    const result = await deleteListing(listingId);
    
    console.log(`🔍 [CONTROLLER] Delete result:`, result);
    
    if (result && result.success === true) {
      await sendMessage(
        sender,
        `✅ Listing "${listing.title || 'Untitled'}" has been deleted successfully!`
      );

      // Clear flow data
      await clearFlowData(sender);
      
      // Get fresh session and reset to menu
      const newSession = await getSession(sender);
      if (newSession) {
        newSession.step = "menu";
        delete newSession.manageListings;
        delete newSession.editFlow;
        await saveSession(sender, newSession);
      }

      // Show main menu
      await sendMainMenuViaService(sender);
    } else {
      console.error(`❌ [CONTROLLER] Delete failed, result:`, result);
      await sendMessage(sender, `❌ Failed to delete listing: ${result?.error || 'Unknown error'}`);
    }
  } catch (err) {
    console.error("❌ [CONTROLLER] Error in delete operation:", err);
    await sendMessage(sender, "❌ Error deleting listing. Please try again.");
  }
}

// ========================================
// HANDLE EDIT LISTING
// ========================================
async function handleEditListing(sender, session) {
  const listing = session.manageListings?.selectedListing;

  if (!listing) {
    await sendMessage(sender, "❌ No listing selected for editing.");
    await handleManageListings(sender);
    return;
  }

  session.editFlow = {
    listingId: session.manageListings.selectedId,
    original: listing,
    step: "awaiting_field_selection",
    updatedFields: {}
  };

  await sendReplyButtons(
    sender,
    `✏️ Edit Listing: ${listing.title || 'Untitled'}\n\nSelect which field you want to edit:`,
    [
      { id: "edit_title", title: "📝 Title" },
      { id: "edit_location", title: "📍 Location" },
      { id: "edit_price", title: "💰 Price" },
      { id: "edit_type", title: "🏠 Property Type" },
      { id: "edit_bhk", title: "🛏️ BHK" },
      { id: "edit_contact", title: "📞 Contact" },
      { id: "edit_description", title: "📄 Description" },
      { id: "edit_cancel", title: "❌ Cancel Edit" }
    ],
    "Edit Listing"
  );

  await saveSession(sender, session);
}

// ========================================
// HANDLE FIELD EDITING
// ========================================
async function handleFieldEdit(sender, field, session) {
  session.editFlow.editingField = field;
  session.editFlow.step = "awaiting_field_value";
  
  const fieldLabels = {
    "edit_title": "title",
    "edit_location": "location",
    "edit_price": "price",
    "edit_type": "type",
    "edit_bhk": "bhk",
    "edit_contact": "contact",
    "edit_description": "description"
  };

  const fieldName = fieldLabels[field];
  const currentValue = session.editFlow.original[fieldName] || 'Not set';

  await sendMessage(
    sender,
    `Current ${fieldName}: *${currentValue}*\n\nPlease send the new value:`
  );

  await saveSession(sender, session);
}

// ========================================
// UPDATE EDITED FIELD
// ========================================
async function updateFieldValue(sender, newValue, session) {
  const field = session.editFlow.editingField;
  const fieldLabels = {
    "edit_title": "title",
    "edit_location": "location",
    "edit_price": "price",
    "edit_type": "type",
    "edit_bhk": "bhk",
    "edit_contact": "contact",
    "edit_description": "description"
  };

  const fieldName = fieldLabels[field];
  
  if (field === "edit_price") {
    const numValue = parseInt(newValue.replace(/[^\d]/g, ''));
    if (!isNaN(numValue)) {
      session.editFlow.updatedFields[fieldName] = numValue;
    } else {
      session.editFlow.updatedFields[fieldName] = newValue;
    }
  } else {
    session.editFlow.updatedFields[fieldName] = newValue;
  }

  session.editFlow.step = "awaiting_field_selection";

  await sendReplyButtons(
    sender,
    `✅ ${fieldName} updated! Do you want to edit another field?`,
    [
      { id: "edit_another", title: "✏️ Edit Another Field" },
      { id: "save_edits", title: "💾 Save All Changes" },
      { id: "cancel_edits", title: "❌ Discard Changes" }
    ],
    "Edit Field"
  );

  await saveSession(sender, session);
}

// ========================================
// SAVE ALL EDITS
// ========================================
async function saveAllEdits(sender, session) {
  const listingId = session.editFlow.listingId;
  const updates = session.editFlow.updatedFields;

  if (Object.keys(updates).length === 0) {
    await sendMessage(sender, "❌ No changes were made.");
    await handleManageListings(sender);
    return;
  }

  try {
    const result = await updateListing(listingId, updates);
    
    if (result.success) {
      await sendMessage(
        sender,
        `✅ Listing updated successfully!\n\nChanges made:\n${Object.entries(updates)
          .map(([key, value]) => `• ${key}: ${value}`)
          .join('\n')}`
      );

      await clearFlowData(sender);
      const newSession = await getSession(sender);
      newSession.step = "menu";
      await saveSession(sender, newSession);

      await sendMainMenuViaService(sender);
    } else {
      await sendMessage(sender, "❌ Failed to update listing. Please try again.");
    }
  } catch (err) {
    console.error("Error updating listing:", err);
    await sendMessage(sender, "❌ Failed to update listing. Please try again.");
  }
}


// ========================================
// MAIN CONTROLLER - COMPLETELY FIXED VERSION
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
  if (flowHandled) return;

  let replyId = null;
  
  if (metadata?.interactive?.type === "list_reply") {
    replyId = metadata.interactive.list_reply.id;
  } else if (metadata?.interactive?.type === "button_reply") {
    replyId = metadata.interactive.button_reply.id;
  }
  
  console.log("🔍 [CONTROLLER DEBUG] replyId:", replyId);
  
  const msg = String(replyId || text || "").trim();
  const lower = msg.toLowerCase();
  
  console.log("🔍 [CONTROLLER DEBUG] processed msg:", msg);
  console.log("🔍 [CONTROLLER DEBUG] processed lower:", lower);

  // Get session
  let session = (await getSession(sender)) || { 
    step: "start",
    housingFlow: { 
      step: "start", 
      data: {},
      currentIndex: 0, 
      listingData: null
    },
    isInitialized: false
  };

  console.log("🔍 [CONTROLLER DEBUG] Session state:", JSON.stringify(session, null, 2));
  console.log("🔍 [CONTROLLER DEBUG] Session step:", session.step);
  console.log("🔍 [CONTROLLER DEBUG] Manage listings step:", session.manageListings?.step);
  console.log("🔍 [CONTROLLER DEBUG] Edit flow step:", session.editFlow?.step);

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
  // 4) MANAGE LISTINGS INTERACTIVE HANDLING
  // ==========================================
  
  // Handle listing selection from manage listings
  if (msg.startsWith("listing_") && (session.step === "managing_listings" || session.manageListings)) {
    console.log("🔍 [CONTROLLER] Listing selected for management:", msg);
    await handleListingSelection(sender, msg, session);
    return session;
  }
  
  // ==========================================
  // 5) DELETE FLOW HANDLING
  // ==========================================
  
  // Handle delete button click (shows confirmation)
  if (msg.startsWith("delete_") && session.manageListings?.step === "awaiting_action") {
    console.log("🔍 [CONTROLLER] Delete button clicked:", msg);
    
    // Show confirmation before deleting
    await sendReplyButtons(
      sender,
      "⚠️ Are you sure you want to delete this listing?\nThis action cannot be undone.",
      [
        { id: "confirm_delete", title: "✅ Yes, Delete" },
        { id: "cancel_delete", title: "❌ No, Keep It" }
      ],
      "Confirm Delete"
    );
    
    session.manageListings.step = "confirming_delete";
    await saveSession(sender, session);
    return session;
  }
  
  // Handle delete confirmation (YES button)
  if (msg === "confirm_delete" && session.manageListings?.step === "confirming_delete") {
    console.log("🔍 [CONTROLLER] Confirm delete action");
    await handleDeleteListing(sender, session);
    return session;
  }
  
  // Handle delete cancellation (NO button)
  if (msg === "cancel_delete" && session.manageListings?.step === "confirming_delete") {
    console.log("🔍 [CONTROLLER] Cancel delete action");
    
    const listingId = session.manageListings?.selectedId;
    const listing = session.manageListings?.selectedListing;
    
    if (listing) {
      session.manageListings.step = "awaiting_action";
      await saveSession(sender, session);
      
      const listingText = 
`📋 Listing Details:
*Title:* ${listing.title || 'Untitled'}
*Location:* ${listing.location || 'Not specified'}
*Type:* ${listing.type || listing.listingType || 'Property'}
*BHK:* ${listing.bhk || 'N/A'}
*Price:* ₹${listing.price ? listing.price.toLocaleString('en-IN') : 'N/A'}
*Contact:* ${listing.contact || 'Not provided'}
*Description:* ${listing.description || 'No description'}

What would you like to do with this listing?`;

      await sendReplyButtons(
        sender,
        listingText,
        [
          { id: `delete_${listingId}`, title: "🗑️ Delete Listing" },
          { id: `edit_${listingId}`, title: "✏️ Edit Listing" },
          { id: "cancel_manage", title: "⬅️ Back to List" }
        ],
        "Listing Details"
      );
    }
    return session;
  }
  
  // ==========================================
  // 6) EDIT FLOW HANDLING
  // ==========================================
  
  // Handle edit button click (starts edit flow)
  if (msg.startsWith("edit_") && session.manageListings?.step === "awaiting_action") {
    console.log("🔍 [CONTROLLER] Edit button clicked:", msg);
    
    const listingId = msg.replace('edit_', '');
    console.log("🔍 [CONTROLLER] Extracted listing ID:", listingId);
    console.log("🔍 [CONTROLLER] Selected listing ID:", session.manageListings?.selectedId);
    
    // Verify this is the correct listing
    if (listingId === session.manageListings?.selectedId) {
      console.log("🔍 [CONTROLLER] Starting edit flow for listing:", listingId);
      
      session.editFlow = {
        listingId: session.manageListings.selectedId,
        original: session.manageListings.selectedListing,
        step: "awaiting_field_selection",
        updatedFields: {}
      };
      session.manageListings.step = "editing";
      await saveSession(sender, session);

      await sendReplyButtons(
        sender,
        `✏️ Edit Listing: ${session.manageListings.selectedListing.title || 'Untitled'}\n\nSelect which field you want to edit:`,
        [
          { id: "edit_title", title: "📝 Title" },
          { id: "edit_location", title: "📍 Location" },
          { id: "edit_price", title: "💰 Price" },
          { id: "edit_type", title: "🏠 Property Type" },
          { id: "edit_bhk", title: "🛏️ BHK" },
          { id: "edit_contact", title: "📞 Contact" },
          { id: "edit_description", title: "📄 Description" },
          { id: "edit_cancel", title: "❌ Cancel Edit" }
        ],
        "Edit Listing"
      );
    } else {
      console.error("❌ [CONTROLLER] Listing ID mismatch");
      await sendMessage(sender, "❌ Unable to edit listing. Please try again.");
    }
    return session;
  }
  
  // ==========================================
  // 7) EDIT FIELD SELECTION HANDLING
  // ==========================================
  
  // Handle edit flow field selection
  if (session.editFlow?.step === "awaiting_field_selection") {
    console.log("🔍 [CONTROLLER] In edit flow field selection");
    
    if (msg.startsWith("edit_") && msg !== "edit_cancel" && msg !== "edit_another") {
      console.log("🔍 [CONTROLLER] Field selected for editing:", msg);
      await handleFieldEdit(sender, msg, session);
      return session;
    }
    
    if (msg === "edit_cancel") {
      console.log("🔍 [CONTROLLER] Edit cancelled");
      delete session.editFlow;
      session.manageListings.step = "awaiting_action";
      await saveSession(sender, session);
      
      const listing = session.manageListings.selectedListing;
      if (listing) {
        const listingText = 
`📋 Listing Details:
*Title:* ${listing.title || 'Untitled'}
*Location:* ${listing.location || 'Not specified'}
*Type:* ${listing.type || listing.listingType || 'Property'}
*BHK:* ${listing.bhk || 'N/A'}
*Price:* ₹${listing.price ? listing.price.toLocaleString('en-IN') : 'N/A'}
*Contact:* ${listing.contact || 'Not provided'}
*Description:* ${listing.description || 'No description'}

What would you like to do with this listing?`;

        await sendReplyButtons(
          sender,
          listingText,
          [
            { id: `delete_${session.manageListings.selectedId}`, title: "🗑️ Delete Listing" },
            { id: `edit_${session.manageListings.selectedId}`, title: "✏️ Edit Listing" },
            { id: "cancel_manage", title: "⬅️ Back to List" }
          ],
          "Listing Details"
        );
      }
      return session;
    }
    
    if (msg === "edit_another") {
      console.log("🔍 [CONTROLLER] Edit another field");
      const listing = session.manageListings.selectedListing;
      await sendReplyButtons(
        sender,
        `✏️ Edit Listing: ${listing.title || 'Untitled'}\n\nSelect which field you want to edit:`,
        [
          { id: "edit_title", title: "📝 Title" },
          { id: "edit_location", title: "📍 Location" },
          { id: "edit_price", title: "💰 Price" },
          { id: "edit_type", title: "🏠 Property Type" },
          { id: "edit_bhk", title: "🛏️ BHK" },
          { id: "edit_contact", title: "📞 Contact" },
          { id: "edit_description", title: "📄 Description" },
          { id: "edit_cancel", title: "❌ Cancel Edit" }
        ],
        "Edit Listing"
      );
      return session;
    }
    
    if (msg === "save_edits") {
      console.log("🔍 [CONTROLLER] Saving edits");
      await saveAllEdits(sender, session);
      return session;
    }
    
    if (msg === "cancel_edits") {
      console.log("🔍 [CONTROLLER] Discarding edits");
      delete session.editFlow;
      session.manageListings.step = "awaiting_action";
      await saveSession(sender, session);
      
      const listing = session.manageListings.selectedListing;
      if (listing) {
        const listingText = 
`📋 Listing Details:
*Title:* ${listing.title || 'Untitled'}
*Location:* ${listing.location || 'Not specified'}
*Type:* ${listing.type || listing.listingType || 'Property'}
*BHK:* ${listing.bhk || 'N/A'}
*Price:* ₹${listing.price ? listing.price.toLocaleString('en-IN') : 'N/A'}
*Contact:* ${listing.contact || 'Not provided'}
*Description:* ${listing.description || 'No description'}

What would you like to do with this listing?`;

        await sendReplyButtons(
          sender,
          listingText,
          [
            { id: `delete_${session.manageListings.selectedId}`, title: "🗑️ Delete Listing" },
            { id: `edit_${session.manageListings.selectedId}`, title: "✏️ Edit Listing" },
            { id: "cancel_manage", title: "⬅️ Back to List" }
          ],
          "Listing Details"
        );
      }
      return session;
    }
  }
  
  // ==========================================
  // 8) EDIT FIELD VALUE INPUT (TEXT-BASED)
  // ==========================================
  if (session.editFlow?.step === "awaiting_field_value" && text) {
    console.log("🔍 [CONTROLLER] Field value received:", text);
    await updateFieldValue(sender, text, session);
    return session;
  }
  
  // ==========================================
  // 9) CANCEL MANAGE (Back button)
  // ==========================================
  if (msg === "cancel_manage" && session.manageListings?.step === "awaiting_action") {
    console.log("🔍 [CONTROLLER] Back to listing list");
    await handleManageListings(sender);
    return session;
  }
  
  // ==========================================
  // 10) AWAITING LISTING DETAILS (TEXT-BASED POST)
  // ==========================================
  if (session.step === "awaiting_post_details") {
    try {
      const parts = msg.split(",").map(p => p.trim());
      
      if (parts.length < 5) {
        throw new Error("Missing required details.");
      }

      const rawPrice = parts[3].replace(/[^\d]/g, '');
      const price = parseInt(rawPrice);

      const listing = {
        user: sender,
        title: `${parts[0]} - ${parts[2]} Listing`, 
        listingType: parts[2],
        location: parts[1], 
        price: isNaN(price) ? rawPrice : price,
        contact: parts[4],
        description: parts.slice(5).join(", ") || "No additional details provided.",
        createdAt: Date.now()
      };

      await db.collection("listings").add(listing);
      
      await sendMessage(sender, "🎉 Your property listing has been posted successfully and is now visible to others!");
      
      session.step = "menu";
      await saveSession(sender, session);
      await sendMainMenuViaService(sender);
      return session;

    } catch (err) {
      console.error("Error processing listing details:", err);
      await sendMessage(
        sender,
        "❌ I had trouble parsing those details. Please ensure you use the exact format:\nExample: *Rahul, Noida Sector 56, 2BHK, 15000, +9199XXXXXXXX, Semi-furnished, near metro*"
      );
      return session;
    }
  }
  
  // ==========================================
  // 11) INTERACTIVE LISTING ACTIONS
  // ==========================================
  if (session.step === "awaiting_listing_action" && replyId) {
    console.log(`🔄 Handling listing action: ${msg}`);
    
    const listingData = session.housingFlow.listingData;
    const currentIndex = session.housingFlow.currentIndex;
    const currentListing = listingData?.listings?.[currentIndex];
    
    if (!currentListing) {
      console.log("❌ Lost track of current listing, resetting to menu");
      await sendMessage(sender, "Sorry, I lost track of the current listing. Please try searching again.");
      session.step = "menu";
      await saveSession(sender, session);
      return session;
    }
    
    if (msg === "NEXT_LISTING") {
      console.log("⏭️ Next button clicked");
      
      const listingData = session.housingFlow.listingData;
      if (!listingData || !listingData.listings) {
        await sendMessage(sender, "No listings data found. Please search again.");
        session.step = "menu";
        await saveSession(sender, session);
        return session;
      }
      
      const totalListings = listingData.listings.length;
      let currentIndex = session.housingFlow.currentIndex || 0;
      
      currentIndex++;
      
      if (currentIndex >= totalListings) {
        currentIndex = 0;
        await sendMessage(sender, "🔄 You've seen all listings! Starting from the first one again.");
      }
      
      session.housingFlow.currentIndex = currentIndex;
      await saveSession(sender, session);
      
      await handleShowListings(sender, session);
      return session;
    }
    
    if (msg.startsWith("VIEW_DETAILS_")) {
      console.log("📄 View details button clicked");
      await sendMessage(
        sender, 
        `*Full Details for ${currentListing.title || 'Property'}*\n\n` +
        `*Description:*\n${currentListing.description || "No full description provided."}\n\n` +
        `*Contact:* ${currentListing.contact || "N/A"}\n` +
        `*Location:* ${currentListing.location || "N/A"}\n` +
        `*Price:* ${currentListing.price || "Price on request"}`
      );
      await handleShowListings(sender, session); 
      return session;
    }
    
    if (msg.startsWith("SAVE_LISTING_")) {
      console.log("💾 Save button clicked");
      await sendMessage(sender, `Listing *${currentListing.title || 'Property'}* saved to your favorites! ❤️`);
      await handleShowListings(sender, session);
      return session;
    }
    
    await sendMessage(sender, "Action unrecognized. Please select a button from the card.");
    await handleShowListings(sender, session); 
    return session;
  }

  // ===========================
  // 12) MENU COMMAND HANDLING
  // ===========================
  switch (lower) {
    case "view_listings":
      console.log("🏠 Menu: View Listings selected");
      session.step = "awaiting_listing_action"; 
      await saveSession(sender, session);
      await handleShowListings(sender, session); 
      return session;

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
      return session; // Return early since handleManageListings handles session

    case "change_language":
      console.log("🌐 Menu: Change Language selected");
      session.housingFlow.awaitingLangSelection = true;
      session.step = "awaiting_language";
      await saveSession(sender, session);
      await sendLanguageListViaService(sender);
      return session;

    default:
      // Default: show menu
      console.log(`❓ Unknown command: ${lower}, showing menu`);
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
  handleShowListings,
  handleManageListings
};