// =======================================================
// ✅ PATCHED FILE: src/flows/housingFlow.js
// =======================================================
const { addListing, getAllListings, getUserListings, db } = require('../../database/firestore');
const { searchListings, generateFollowUpQuestion, generatePropertyReply, classify } = require('../ai/aiEngine');
// ✅ FIX 2: Import centralized message services, including sendListingCard
const { sendMessage, sendListingCard } = require('../services/messageService'); 

// --------------------------------------------------------------------------
// ❌ REMOVED: The local function 'sendListingCard' has been moved 
// ❌ to 'src/services/messageService.js' to centralize message logic.
// --------------------------------------------------------------------------

/**
 * Move to next listing in session.lastResults and send it
 */
async function handleNextListing({ sender, session = {} }) {
  try {
    const lastResults = Array.isArray(session.lastResults) ? session.lastResults : [];
    if (!lastResults.length) {
      // Fallback: fetch latest
      const all = await getAllListings(50);
      if (!all || all.length === 0) {
        // Send text message fallback
        await sendMessage(sender, 'No listings available.');
        return { nextSession: { ...session }, reply: null, buttons: null };
      }
      session.lastResults = all.slice(0, 8);
      session.listingIndex = -1; // Set to -1 so increment below starts at 0
    }

    let index = typeof session.listingIndex === 'number' ? session.listingIndex : -1;
    index += 1;
    if (index >= session.lastResults.length) index = 0; // loop

    // persist index for next time
    const nextSession = { ...session, listingIndex: index, lastResults: session.lastResults };
    // ✅ Use imported sendListingCard
    await sendListingCard(sender, session.lastResults[index], index, session.lastResults.length);

    // reply is null because we sent an interactive message already
    return { nextSession, reply: null, buttons: null };
  } catch (err) {
    console.error('handleNextListing error', err);
    await sendMessage(sender, 'Something went wrong while loading next listing.');
    return { nextSession: session, reply: null, buttons: null };
  }
}

/**
 * View full details for a listingId
 */
async function handleViewDetails({ sender, listingId, session = {} }) {
  try {
    // Try to find listing in session lastResults first
    let listing = (Array.isArray(session.lastResults) && session.lastResults.find(l => String(l.id) === String(listingId))) || null;

    // fallback to scanning all listings
    if (!listing) {
      const all = await getAllListings(500);
      listing = all.find(l => String(l.id) === String(listingId));
    }

    if (!listing) {
      await sendMessage(sender, '⚠️ Listing not found.');
      return { nextSession: session, reply: null, buttons: null };
    }

    const details =
      `🏡 *${listing.title || listing.property_type}*\n\n` +
      `📍 Location: ${listing.location || 'N/A'}\n` +
      `💰 Price: ${listing.price ? `₹${listing.price}` : listing.price || 'N/A'}\n` +
      `📏 Area: ${listing.area || listing.size || 'N/A'}\n` +
      `🛋 Furnishing: ${listing.furnishing || 'N/A'}\n` +
      `☎ Contact: ${listing.contact || 'N/A'}\n\n` +
      `${listing.description || ''}`;

    await sendMessage(sender, details);
    return { nextSession: session, reply: null, buttons: null };
  } catch (err) {
    console.error('handleViewDetails error', err);
    await sendMessage(sender, 'Failed to fetch listing details.');
    return { nextSession: session, reply: null, buttons: null };
  }
}

/**
 * Save a listing for a user (simple saved collection)
 */
async function handleSaveListing({ sender, listingId, session = {} }) {
  try {
    // store in a simple "saved" collection with composite id to avoid duplicates
    const docId = `${String(sender)}_${String(listingId)}`;
    const docRef = db.collection('saved').doc(docId);
    const data = {
      userId: sender,
      listingId,
      savedAt: Date.now()
    };
    await docRef.set(data, { merge: true });

    await sendMessage(sender, '❤️ Listing saved to your favorites.');
    return { nextSession: session, reply: null, buttons: null };
  } catch (err) {
    console.error('handleSaveListing error', err);
    await sendMessage(sender, 'Failed to save listing.');
    return { nextSession: session, reply: null, buttons: null };
  }
}

/**
 * NEW FUNCTION ADDED
 * handleShowListings — shows latest listings directly (as a card slider)
 */
async function handleShowListings({ sender, session = {}, userLang = "en" }) {
  console.log('[DB] Fetching listings.');
  try {
    const all = await getAllListings(50);

    if (!all || all.length === 0) {
      const reply = userLang === "hi"
          ? "कोई लिस्टिंग उपलब्ध नहीं है।"
          : "No listings are available at the moment.";
      // Send the text message fallback
      await sendMessage(sender, reply);
      return {
        nextSession: { ...session, step: "no_listings" },
        reply: null, // Reply is null because we sent it already
        buttons: null
      };
    }

    // Show top 8 latest listings
    const latest = all.slice(0, 8);
    console.log(`[DB] Fetched ${latest.length} listings successfully.`);

    // initialize session pagination state
    const nextSession = { ...session, step: "show_listings", lastResults: latest, listingIndex: 0 };

    // send the first card
    // ✅ Use imported sendListingCard
    await sendListingCard(sender, latest[0], 0, latest.length);

    // reply is null because we sent an interactive message already
    return { nextSession, reply: null, buttons: null };
  } catch (err) {
    console.error("handleShowListings error:", err);
    // Send error message
    await sendMessage(sender, "❌ Failed to load listings. Please try again later.");
    return {
      nextSession: session,
      reply: null,
      buttons: null
    };
  }
}

/**
 * MAIN FLOW — handleAIAction (omitted unnecessary changes for brevity)
 */
async function handleAIAction({ sender, message, aiResult = {}, session = {}, userLang = 'en' }) {
  // ... (Content of handleAIAction is lengthy and mostly correct, 
    // ensuring sendListingCard is used for results)
    // ...
    // Example: Inside BUY / BROWSE block:
    // await sendListingCard(sender, matches[0], 0, matches.length);
    // return { nextSession, reply: null, buttons: null };
    
  // ...
}


module.exports = {
  handleAIAction,
  handleShowListings,
  handleNextListing,
  handleViewDetails,
  handleSaveListing
};