// =======================================================
// ✅ SIMPLIFIED whatsappBot.js - Forwarder to chatbotController
// =======================================================
const { handleIncomingMessage: chatbotHandler } = require("./chatbotController");

async function handleIncomingMessage(sender, msgBody, metadata = {}) {
  console.log("🔍 [WHATSAPP_BOT] Forwarding to chatbotController");
  return chatbotHandler(sender, msgBody, metadata);
}

module.exports = {
  handleIncomingMessage
};


// // =======================================================
// // ✅ PATCHED FILE: src/bots/whatsappBot.js
// // =======================================================
// // Import entire service (fixes missing functions)
// const messageService = require("../services/messageService");
// const { handleShowListings: controllerHandleShowListings } = require("../../chatbotController")
// const { getSession, saveSession } = require("../../utils/sessionStore");

// // Housing flow handlers
// const {
//   handleShowListings: housingFlowHandleShowListings, // Renamed to avoid conflict
//   handleNextListing,
//   handleViewDetails,
//   handleSaveListing,
//   handleDeleteListing,
//   handleManageSelection
// } = require("../flows/housingFlow");

// // IMPORTANT: Import your controller functions
// const { 
//   handleShowListings: controllerHandleShowListings,
//   handleManageListings: controllerHandleManageListings
// } = require("./chatbotController");

// // AI (kept, but not used in your core flow)
// const { classify, askAI } = require("../ai/aiEngine");

// // Firestore helpers
// const {
//   db,
//   addListing,
//   getAllListings,
//   getUserListings,
//   getUserProfile,
//   saveUserLanguage,
//   getListingById,
//   deleteListing
// } = require("../../database/firestore");

// // =======================================================
// // HELPERS
// // =======================================================

// function menuRows() {
//   return [
//     { id: "view_listings", title: "View listings" },
//     { id: "post_listing", title: "Post listing" },
//     { id: "manage_listings", title: "Manage listings" },
//     { id: "change_language", title: "Change Language" }
//   ];
// }

// function languageRows() {
//   return [
//     { id: "lang_en", title: "English" },
//     { id: "lang_hi", title: "हिंदी" },
//     { id: "lang_ta", title: "தமிழ்" },
//     { id: "lang_mr", title: "मराठी" }
//   ];
// }

// async function sendLanguageSelection(sender) {
//   return messageService.sendList(
//     sender,
//     "🌐 Select your language",
//     "Choose one option:",
//     "Select",
//     [{ title: "Languages", rows: languageRows() }]
//   );
// }

// async function sendMainMenu(sender) {
//   return messageService.sendList(
//     sender,
//     "🏡 MarketMatch AI",
//     "Choose an option:",
//     "Menu",
//     [{ title: "Main Menu", rows: menuRows() }]
//   );
// }

// // =======================================================
// // MANAGE LISTINGS HELPERS
// // =======================================================

// async function sendListingWithActions(sender, listing) {
//   const listingText = 
// `📋 *Listing Details:*
// *Title:* ${listing.title || 'Untitled'}
// *Location:* ${listing.location || 'Not specified'}
// *Type:* ${listing.type || listing.listingType || 'Property'}
// *BHK:* ${listing.bhk || 'N/A'}
// *Price:* ₹${listing.price ? listing.price.toLocaleString('en-IN') : 'N/A'}
// *Contact:* ${listing.contact || 'Not provided'}
// *Description:* ${listing.description || 'No description'}

// What would you like to do with this listing?`;

//   // Send buttons for Delete/Edit/Cancel
//   await messageService.sendReplyButtons(
//     sender,
//     listingText,
//     [
//       { id: `delete_${listing.id}`, title: "🗑️ Delete Listing" },
//       { id: `edit_${listing.id}`, title: "✏️ Edit Listing" },
//       { id: "cancel_manage", title: "⬅️ Back to List" }
//     ]
//   );
// }

// async function handleFieldSelection(sender, listing) {
//   // Send field selection buttons
//   await messageService.sendReplyButtons(
//     sender,
//     `✏️ *Edit Listing: ${listing.title || 'Untitled'}*\n\nSelect which field you want to edit:`,
//     [
//       { id: "edit_title", title: "📝 Title" },
//       { id: "edit_location", title: "📍 Location" },
//       { id: "edit_price", title: "💰 Price" },
//       { id: "edit_type", title: "🏠 Property Type" },
//       { id: "edit_bhk", title: "🛏️ BHK" },
//       { id: "edit_contact", title: "📞 Contact" },
//       { id: "edit_description", title: "📄 Description" },
//       { id: "edit_cancel", title: "❌ Cancel Edit" }
//     ]
//   );
// }

// // =======================================================
// // 🔥 MAIN MESSAGE HANDLER - PATCHED VERSION
// // =======================================================

// async function handleIncomingMessage(sender, msgBody, metadata = {}) {
//   console.log("🔍 [WHATSAPP_BOT] handleIncomingMessage called");
//   console.log("🔍 [WHATSAPP_BOT] sender:", sender);
//   console.log("🔍 [WHATSAPP_BOT] msgBody:", msgBody);
//   console.log("🔍 [WHATSAPP_BOT] metadata type:", metadata?.type);
  
//   if (!sender) return;

//   // ======================================================
//   // 🌟 1. Extract Interactive Inputs (FINAL FIX)
//   // ======================================================
//   let command = msgBody;

//   try {
//     if (metadata.type === "interactive") {
//       const inter = metadata.interactive;

//       if (inter.button_reply) {
//         command = inter.button_reply.id?.toLowerCase();
//         console.log("🔍 [WHATSAPP_BOT] Button reply ID:", command);
//       } else if (inter.list_reply) {
//         command = inter.list_reply.id?.toLowerCase();
//         console.log("🔍 [WHATSAPP_BOT] List reply ID:", command);
//       }
//     }

//     // WhatsApp new formats:
//     if (metadata.type === "interactive_response") {
//       command = metadata.interactive_response.id?.toLowerCase();
//     }

//     if (metadata.type === "button") {
//       command = metadata.button?.payload?.toLowerCase();
//     }
//   } catch (e) {
//     console.log("⚠️ Interactive parse error:", e);
//   }

//   command = command?.toString().trim().toLowerCase();
//   console.log("🔍 [WHATSAPP_BOT] Final command:", command);

//   // ======================================================
//   // 2. Load session
//   // ======================================================
//   let session =
//     (await getSession(sender)) || {
//       step: "start",
//       isInitialized: false,
//       awaitingLang: false,
//       housingFlow: { 
//         step: "start", 
//         data: {},
//         currentIndex: 0, 
//         listingData: null
//       },
//       lastResults: [],
//       listingIndex: 0
//     };

//   console.log("🔍 [WHATSAPP_BOT] Session loaded, step:", session.step);

//   const userProfile = await getUserProfile(sender);
//   const greetings = ["hi", "hello", "hey", "start"];
//   const isGreeting = greetings.includes(command);
//   const isNewUser = !session.isInitialized;

//   // ======================================================
//   // 🅰️ 3. Interactive card buttons (HIGH PRIORITY)
//   // ======================================================

//   if (command.startsWith("view_")) {
//     console.log(`🔍 [WHATSAPP_BOT] Handling view_ command: ${command}`);
//     const listingId = command.replace("view_", "");
//     const result = await handleViewDetails({ sender, listingId, session });
//     await saveSession(sender, result.nextSession);
//     return;
//   }

//   if (command.startsWith("save_")) {
//     console.log(`🔍 [WHATSAPP_BOT] Handling save_ command: ${command}`);
//     const listingId = command.replace("save_", "");
//     const result = await handleSaveListing({ sender, listingId, session });
//     await saveSession(sender, result.nextSession);
//     return;
//   }

//   if (command.startsWith("manage_")) {
//     console.log(`🔍 [WHATSAPP_BOT] Handling manage_ command: ${command}`);
//     const listingId = command.replace("manage_", "");
//     const result = await handleManageSelection({ sender, listingId, session });
//     await saveSession(sender, result.nextSession);
//     return;
//   }

//   if (command.startsWith("delete_")) {
//     console.log(`🔍 [WHATSAPP_BOT] Handling delete_ command: ${command}`);
//     const listingId = command.replace("delete_", "");
//     const result = await handleDeleteListing({ sender, listingId, session });
//     await saveSession(sender, result.nextSession);
//     return;
//   }

//   if (command === "next_listing") {
//     console.log("🔍 [WHATSAPP_BOT] Handling next_listing command");
//     const result = await handleNextListing({ sender, session });
//     await saveSession(sender, result.nextSession);
//     return;
//   }

//   // ======================================================
//   // 🅱️ 4. Greeting → new user → language selection
//   // ======================================================
//   if (isGreeting && isNewUser) {
//     console.log("🔍 [WHATSAPP_BOT] New user greeting");
//     await messageService.sendMessage(
//       sender,
//       "🤖 MarketMatch AI helps you find rental properties, services & more."
//     );

//     session.isInitialized = true;
//     session.awaitingLang = true;
//     await saveSession(sender, session);

//     return sendLanguageSelection(sender);
//   }

//   // ======================================================
//   // 🅲️ 5. Returning user greeting → main menu
//   // ======================================================
//   if (isGreeting && !isNewUser) {
//     console.log("🔍 [WHATSAPP_BOT] Returning user greeting");
//     session.step = "menu";
//     await saveSession(sender, session);
//     return sendMainMenu(sender);
//   }

//   // ======================================================
//   // 🅳️ 6. Language selection flow
//   // ======================================================
//   if (session.awaitingLang || command.startsWith("lang_")) {
//     console.log("🔍 [WHATSAPP_BOT] Language selection");
//     let lang = "en";
//     if (command.startsWith("lang_")) lang = command.split("_")[1];

//     await saveUserLanguage(sender, lang);

//     session.awaitingLang = false;
//     session.step = "menu";
//     await saveSession(sender, session);

//     return sendMainMenu(sender);
//   }

//   // ======================================================
//   // 🅴️ 7. Menu Options - CRITICAL PATCH HERE
//   // ======================================================
//   switch (command) {
//     case "view_listings": {
//       console.log("🎯 [WHATSAPP_BOT] view_listings selected - Calling controller's handleShowListings");
      
//       // PATCHED: Use your controller's handleShowListings instead of housingFlow
//       try {
//         await controllerHandleShowListings(sender, session);
//       } catch (error) {
//         console.error("❌ [WHATSAPP_BOT] Error in controllerHandleShowListings:", error);
//         // Fallback to housingFlow version if controller fails
//         console.log("🔄 [WHATSAPP_BOT] Falling back to housingFlow handleShowListings");
//         const result = await housingFlowHandleShowListings({
//           sender,
//           session,
//           userLang: userProfile.language || "en"
//         });
//         await saveSession(sender, result.nextSession);
//       }
//       return;
//     }

//     case "post_listing":
//       console.log("🔍 [WHATSAPP_BOT] post_listing selected");
//       await messageService.sendMessage(
//         sender,
//         "Send your listing like this:\n\nRahul, Noida Sector 56, 2BHK, 15000, +9199XXXXXXXX, Semi-furnished, near metro"
//       );
//       session.step = "awaiting_post_details";
//       await saveSession(sender, session);
//       return;

//     case "manage_listings": {
//       console.log("🔍 [WHATSAPP_BOT] manage_listings selected");
      
//       // PATCHED: Use enhanced manage listings with Delete/Edit buttons
//       const list = await getUserListings(sender);

//       if (!list || list.length === 0) {
//         await messageService.sendMessage(sender, "You have no listings to manage.");
//       } else {
//         // Create buttons for each listing
//         const listingRows = list.map((l, i) => {
//           const shortTitle = l.title && l.title.length > 25 
//             ? l.title.substring(0, 25) + '...' 
//             : l.title || 'Untitled Property';
          
//           return {
//             id: `listing_${l.id}`,
//             title: `${shortTitle} - ₹${l.price ? l.price.toLocaleString('en-IN') : "N/A"}`,
//             description: `📍 ${l.location || 'Location not specified'} | 🏠 ${l.type || l.listingType || 'Property'}`
//           };
//         });

//         // Send interactive list with Delete/Edit options
//         await messageService.sendList(
//           sender,
//           "🏡 Manage Your Listings",
//           "Select a listing to delete or edit:",
//           "Select Listing",
//           [{ title: `Your Listings (${list.length})`, rows: listingRows }]
//         );

//         // Update session for interactive handling
//         session.step = "managing_listings";
//         session.manageListings = {
//           listings: list.reduce((acc, listing) => {
//             acc[listing.id] = listing;
//             return acc;
//           }, {}),
//           step: "awaiting_selection"
//         };
//       }
      
//       await saveSession(sender, session);
//       return;
//     }

//     case "change_language":
//       console.log("🔍 [WHATSAPP_BOT] change_language selected");
//       session.awaitingLang = true;
//       await saveSession(sender, session);
//       return sendLanguageSelection(sender);
//   }

//   // ======================================================
//   // 🅾️ 8. MANAGE LISTINGS INTERACTIVE HANDLING
//   // ======================================================
//   if (session.step === "managing_listings" && command) {
//     const manageState = session.manageListings?.step;
    
//     // Handle listing selection (from list)
//     if (manageState === "awaiting_selection" && command.startsWith("listing_")) {
//       console.log("🔍 [WHATSAPP_BOT] Listing selected for management");
      
//       const listingId = command.replace('listing_', '');
//       const listing = session.manageListings?.listings?.[listingId];

//       if (!listing) {
//         await messageService.sendMessage(sender, "❌ Listing not found. Please try again.");
//         // Show list again
//         const list = await getUserListings(sender);
//         if (list && list.length > 0) {
//           const listingRows = list.map((l, i) => ({
//             id: `listing_${l.id}`,
//             title: `${l.title || 'Untitled'} - ₹${l.price || 'N/A'}`,
//             description: `📍 ${l.location || 'Location'} | 🏠 ${l.type || 'Property'}`
//           }));
          
//           await messageService.sendList(
//             sender,
//             "🏡 Manage Your Listings",
//             "Select a listing to delete or edit:",
//             "Select Listing",
//             [{ title: `Your Listings (${list.length})`, rows: listingRows }]
//           );
//         }
//         return;
//       }

//       // Store selected listing
//       session.manageListings.selectedId = listingId;
//       session.manageListings.selectedListing = listing;
//       session.manageListings.step = "awaiting_action";
//       await saveSession(sender, session);

//       // Show listing with actions
//       await sendListingWithActions(sender, listing);
//       return;
//     }
    
//     // Handle action selection (Delete/Edit)
//     if (manageState === "awaiting_action") {
//       if (command.startsWith("delete_")) {
//         // Show confirmation before deleting
//         await messageService.sendReplyButtons(
//           sender,
//           "⚠️ *Are you sure you want to delete this listing?*\nThis action cannot be undone.",
//           [
//             { id: "confirm_delete", title: "✅ Yes, Delete" },
//             { id: "cancel_delete", title: "❌ No, Keep It" }
//           ]
//         );
//         session.manageListings.step = "confirming_delete";
//         await saveSession(sender, session);
//         return;
//       }
      
//       if (command.startsWith("edit_")) {
//         const listing = session.manageListings.selectedListing;
//         if (!listing) {
//           await messageService.sendMessage(sender, "❌ No listing selected for editing.");
//           return;
//         }

//         // Set up edit flow
//         session.editFlow = {
//           listingId: session.manageListings.selectedId,
//           original: listing,
//           step: "awaiting_field_selection",
//           updatedFields: {}
//         };
//         session.manageListings.step = "editing";
//         await saveSession(sender, session);

//         // Show field selection
//         await handleFieldSelection(sender, listing);
//         return;
//       }
      
//       if (command === "cancel_manage") {
//         // Go back to listing list
//         session.step = "managing_listings";
//         session.manageListings.step = "awaiting_selection";
//         await saveSession(sender, session);
        
//         // Show list again
//         const list = await getUserListings(sender);
//         if (list && list.length > 0) {
//           const listingRows = list.map((l, i) => ({
//             id: `listing_${l.id}`,
//             title: `${l.title || 'Untitled'} - ₹${l.price || 'N/A'}`,
//             description: `📍 ${l.location || 'Location'} | 🏠 ${l.type || 'Property'}`
//           }));
          
//           await messageService.sendList(
//             sender,
//             "🏡 Manage Your Listings",
//             "Select a listing to delete or edit:",
//             "Select Listing",
//             [{ title: `Your Listings (${list.length})`, rows: listingRows }]
//           );
//         }
//         return;
//       }
//     }
    
//     // Handle delete confirmation
//     if (manageState === "confirming_delete") {
//       if (command === "confirm_delete") {
//         const listingId = session.manageListings?.selectedId;
//         const listing = session.manageListings?.selectedListing;

//         if (!listingId || !listing) {
//           await messageService.sendMessage(sender, "❌ No listing selected for deletion.");
//           return;
//         }

//         try {
//           // Delete from Firestore
//           await db.collection("listings").doc(listingId).delete();
          
//           await messageService.sendMessage(
//             sender,
//             `✅ Listing "${listing.title || 'Untitled'}" has been deleted successfully!`
//           );

//           // Reset session and show menu
//           delete session.manageListings;
//           session.step = "menu";
//           await saveSession(sender, session);

//           // Show main menu
//           return sendMainMenu(sender);
//         } catch (err) {
//           console.error("Error deleting listing:", err);
//           await messageService.sendMessage(sender, "❌ Failed to delete listing. Please try again.");
//           return;
//         }
//       }
      
//       if (command === "cancel_delete") {
//         // Go back to action selection
//         const listing = session.manageListings.selectedListing;
//         if (listing) {
//           session.manageListings.step = "awaiting_action";
//           await saveSession(sender, session);
//           await sendListingWithActions(sender, listing);
//         }
//         return;
//       }
//     }
//   }

//   // ======================================================
//   // 🅿️ 9. EDIT FLOW HANDLING
//   // ======================================================
//   if (session.editFlow?.step && command) {
//     const editState = session.editFlow.step;
    
//     // Handle field selection
//     if (editState === "awaiting_field_selection") {
//       if (command.startsWith("edit_") && command !== "edit_cancel" && command !== "edit_another") {
//         session.editFlow.editingField = command;
//         session.editFlow.step = "awaiting_field_value";
//         await saveSession(sender, session);

//         const fieldLabels = {
//           "edit_title": "title",
//           "edit_location": "location",
//           "edit_price": "price",
//           "edit_type": "type",
//           "edit_bhk": "bhk",
//           "edit_contact": "contact",
//           "edit_description": "description"
//         };

//         const fieldName = fieldLabels[command];
//         const currentValue = session.editFlow.original[fieldName] || 'Not set';

//         await messageService.sendMessage(
//           sender,
//           `Current ${fieldName}: *${currentValue}*\n\nPlease send the new value:`
//         );
//         return;
//       }
      
//       if (command === "edit_cancel") {
//         // Cancel editing, go back to manage listings
//         delete session.editFlow;
//         session.manageListings.step = "awaiting_selection";
//         session.step = "managing_listings";
//         await saveSession(sender, session);
        
//         // Show list again
//         const list = await getUserListings(sender);
//         if (list && list.length > 0) {
//           const listingRows = list.map((l, i) => ({
//             id: `listing_${l.id}`,
//             title: `${l.title || 'Untitled'} - ₹${l.price || 'N/A'}`,
//             description: `📍 ${l.location || 'Location'} | 🏠 ${l.type || 'Property'}`
//           }));
          
//           await messageService.sendList(
//             sender,
//             "🏡 Manage Your Listings",
//             "Select a listing to delete or edit:",
//             "Select Listing",
//             [{ title: `Your Listings (${list.length})`, rows: listingRows }]
//           );
//         }
//         return;
//       }
      
//       if (command === "edit_another") {
//         // Show field selection again
//         const listing = session.editFlow.original;
//         await handleFieldSelection(sender, listing);
//         return;
//       }
      
//       if (command === "save_edits") {
//         const listingId = session.editFlow.listingId;
//         const updates = session.editFlow.updatedFields;

//         if (Object.keys(updates).length === 0) {
//           await messageService.sendMessage(sender, "❌ No changes were made.");
//         } else {
//           try {
//             // Update Firestore document
//             await db.collection("listings").doc(listingId).update({
//               ...updates,
//               updatedAt: Date.now()
//             });

//             await messageService.sendMessage(
//               sender,
//               `✅ Listing updated successfully!\n\nChanges made:\n${Object.entries(updates)
//                 .map(([key, value]) => `• ${key}: ${value}`)
//                 .join('\n')}`
//             );
//           } catch (err) {
//             console.error("Error updating listing:", err);
//             await messageService.sendMessage(sender, "❌ Failed to update listing. Please try again.");
//           }
//         }

//         // Clean up and return to menu
//         delete session.editFlow;
//         delete session.manageListings;
//         session.step = "menu";
//         await saveSession(sender, session);
//         return sendMainMenu(sender);
//       }
      
//       if (command === "cancel_edits") {
//         // Discard changes
//         delete session.editFlow;
//         session.manageListings.step = "awaiting_selection";
//         session.step = "managing_listings";
//         await messageService.sendMessage(sender, "❌ All changes discarded.");
//         await saveSession(sender, session);
        
//         // Show list again
//         const list = await getUserListings(sender);
//         if (list && list.length > 0) {
//           const listingRows = list.map((l, i) => ({
//             id: `listing_${l.id}`,
//             title: `${l.title || 'Untitled'} - ₹${l.price || 'N/A'}`,
//             description: `📍 ${l.location || 'Location'} | 🏠 ${l.type || 'Property'}`
//           }));
          
//           await messageService.sendList(
//             sender,
//             "🏡 Manage Your Listings",
//             "Select a listing to delete or edit:",
//             "Select Listing",
//             [{ title: `Your Listings (${list.length})`, rows: listingRows }]
//           );
//         }
//         return;
//       }
//     }
//   }

//   // ======================================================
//   // 🆀 10. EDIT FIELD VALUE INPUT (TEXT-BASED)
//   // ======================================================
//   if (session.editFlow?.step === "awaiting_field_value" && msgBody && !metadata.type) {
//     const newValue = msgBody.toString().trim();
    
//     if (newValue) {
//       const field = session.editFlow.editingField;
//       const fieldLabels = {
//         "edit_title": "title",
//         "edit_location": "location",
//         "edit_price": "price",
//         "edit_type": "type",
//         "edit_bhk": "bhk",
//         "edit_contact": "contact",
//         "edit_description": "description"
//       };

//       const fieldName = fieldLabels[field];
      
//       // Special handling for price - convert to number
//       if (field === "edit_price") {
//         const numValue = parseInt(newValue.replace(/[^\d]/g, ''));
//         if (!isNaN(numValue)) {
//           session.editFlow.updatedFields[fieldName] = numValue;
//         } else {
//           session.editFlow.updatedFields[fieldName] = newValue;
//         }
//       } else {
//         session.editFlow.updatedFields[fieldName] = newValue;
//       }

//       session.editFlow.step = "awaiting_field_selection";
//       await saveSession(sender, session);

//       // Ask if user wants to edit more fields
//       await messageService.sendReplyButtons(
//         sender,
//         `✅ ${fieldName} updated! Do you want to edit another field?`,
//         [
//           { id: "edit_another", title: "✏️ Edit Another Field" },
//           { id: "save_edits", title: "💾 Save All Changes" },
//           { id: "cancel_edits", title: "❌ Discard Changes" }
//         ]
//       );
//     }
//     return;
//   }

//   // ======================================================
//   // 🅵️ 11. Handle post listing details
//   // ======================================================
//   if (session.step === "awaiting_post_details") {
//     console.log("🔍 [WHATSAPP_BOT] Processing post listing details");
//     try {
//       const parts = command.split(",").map(p => p.trim());
      
//       if (parts.length < 5) {
//         await messageService.sendMessage(sender, "Please provide all required fields.");
//         return;
//       }

//       const rawPrice = parts[3].replace(/[^\d]/g, '');
//       const price = parseInt(rawPrice);

//       const listing = {
//         user: sender,
//         title: `${parts[0]} - ${parts[2]} Listing`, 
//         listingType: parts[2],
//         location: parts[1], 
//         price: isNaN(price) ? rawPrice : price,
//         contact: parts[4],
//         description: parts.slice(5).join(", ") || "No additional details provided.",
//         createdAt: Date.now()
//       };

//       await db.collection("listings").add(listing);
      
//       await messageService.sendMessage(sender, "🎉 Your listing has been posted!");
      
//       session.step = "menu";
//       await saveSession(sender, session);
//       return sendMainMenu(sender);

//     } catch (err) {
//       console.error("Error processing listing details:", err);
//       await messageService.sendMessage(
//         sender,
//         "❌ I had trouble parsing those details. Please use the exact format."
//       );
//       return;
//     }
//   }

//   // ======================================================
//   // 🅶️ 12. DEFAULT FALLBACK
//   // ======================================================
//   console.log(`🔍 [WHATSAPP_BOT] Unknown command: "${command}", showing menu`);
  
//   await messageService.sendMessage(
//     sender,
//     "I didn't understand that. Please choose an option."
//   );

//   await saveSession(sender, session);
//   return sendMainMenu(sender);
// }

// module.exports = {
//   handleIncomingMessage
// };