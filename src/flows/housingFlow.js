// src/flows/housingFlow.js
// NOTE: sendListingCard is now imported from messageService
const { addListing, getAllListings, getUserListings, db } = require('../../database/firestore');
const { searchListings, generateFollowUpQuestion, generatePropertyReply, classify } = require('../ai/aiEngine');
const { sendMessage, sendListingCard } = require('../services/messageService'); // ✅ IMPORTED

// --- The local sendListingCard function was REMOVED to use the one from messageService ---

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
        return { nextSession: { ...session }, reply: 'No listings available.', buttons: null };
      }
      session.lastResults = all.slice(0, 8);
      session.listingIndex = 0;
    }

    let index = typeof session.listingIndex === 'number' ? session.listingIndex : 0;
    index += 1;
    if (index >= session.lastResults.length) index = 0; // loop

    // persist index for next time
    const nextSession = { ...session, listingIndex: index, lastResults: session.lastResults };
    // ✅ Correct call signature: (sender, listing, index, total)
    await sendListingCard(sender, session.lastResults[index], index, session.lastResults.length);

    return { nextSession, reply: null, buttons: null };
  } catch (err) {
    console.error('handleNextListing error', err);
    return { nextSession: session, reply: 'Something went wrong while loading next listing.', buttons: null };
  }
}

/**
 * View full details for a listingId
 */
async function handleViewDetails({ sender, listingId, session = {} }) {
  try {
    let listing = (Array.isArray(session.lastResults) && session.lastResults.find(l => String(l.id) === String(listingId))) || null;

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
    return { nextSession: session, reply: 'Failed to fetch listing details.', buttons: null };
  }
}

/**
 * Save a listing for a user (simple saved collection)
 */
async function handleSaveListing({ sender, listingId, session = {} }) {
  try {
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
    return { nextSession: session, reply: 'Failed to save listing.', buttons: null };
  }
}

/**
 * handleShowListings — shows latest listings directly (as a card slider)
 */
async function handleShowListings({ sender, session = {}, userLang = "en" }) {
  try {
    const all = await getAllListings(50);

    if (!all || all.length === 0) {
      return {
        nextSession: { ...session, step: "no_listings" },
        reply: userLang === "hi"
          ? "कोई लिस्टिंग उपलब्ध नहीं है।"
          : "No listings are available at the moment.",
        buttons: null
      };
    }

    // Show top 8 latest listings
    const latest = all.slice(0, 8);

    // initialize session pagination state
    const nextSession = { ...session, step: "show_listings", lastResults: latest, listingIndex: 0 };

    // send the first card
    // ✅ Correct call signature: (sender, listing, index, total)
    await sendListingCard(sender, latest[0], nextSession.listingIndex, latest.length);

    // reply is null because we sent an interactive message already
    return { nextSession, reply: null, buttons: null };
  } catch (err) {
    console.error("handleShowListings error:", err);
    return {
      nextSession: session,
      reply: "❌ Failed to load listings. Please try again later.",
      buttons: null
    };
  }
}

/**
 * MAIN FLOW — handleAIAction
 */
async function handleAIAction({ sender, message, aiResult = {}, session = {}, userLang = 'en' }) {
  session = session && typeof session === 'object'
    ? { step: 'start', data: {}, ...session }
    : { step: 'start', data: {} };

  const category = aiResult?.category || 'unknown';
  const entities = { ...(session.data || {}), ...(aiResult.entities || {}) };
  const missing = aiResult?.missing || [];

  session.data = entities;
  session.intent = category;

  // BUY / BROWSE: search listings
  if (category === 'buy_house' || category === 'browse_housing') {
    if (missing && missing.length > 0) {
      const q = await generateFollowUpQuestion({ missing, entities, language: userLang });
      const nextSession = { ...session, step: 'awaiting_refinement', missing };
      return { nextSession, reply: q || "Any specific area or budget?", buttons: null };
    }

    const all = await getAllListings(200);
    const matches = searchListings(all, entities, { maxResults: 8, scoreThreshold: 1 });

    if (!matches.length) {
      const nextSession = { ...session, step: 'results_empty' };
      return {
        nextSession,
        reply:
          userLang === 'hi'
            ? 'कोई परिणाम नहीं मिला।'
            : userLang === 'ta'
            ? 'பொருட்கள் கிடைக்கவில்லை.'
            : 'No properties found matching your request.',
        buttons: null
      };
    }

    // Instead of returning text summary, send the first match as a card and store session
    const nextSession = { ...session, step: 'showing_results', lastResults: matches.slice(0, 8), listingIndex: 0 };
    await sendListingCard(sender, matches[0], 0, matches.length);
    return { nextSession, reply: null, buttons: null };
  }

  // POST / SELL: create listing
  if (category === 'post_listing' || category === 'sell_house') {
    const important = {
      title: entities.name || entities.title || (message.length < 100 ? message : ''),
      location: entities.city || entities.location || entities.locality || '',
      property_type: entities.property_type || entities.type || '',
      price: entities.budget || entities.price || '',
      contact: entities.contact || '',
      description: entities.details || ''
    };

    const missingFields = [];
    if (!important.title) missingFields.push('title');
    if (!important.location) missingFields.push('location');
    if (!important.property_type) missingFields.push('property_type');
    if (!important.price) missingFields.push('price');
    if (!important.contact) missingFields.push('contact');

    if (missingFields.length > 0) {
      const example =
        "Example: Rahul, Noida Sector 56, 2BHK, 15000, +9199XXXXXXXX, Semi-furnished, near metro";
      const nextSession = {
        ...session,
        step: 'awaiting_post_details',
        pending: missingFields,
        data: important
      };
      const reply = `I need a few more details: ${missingFields.join(
        ', '
      )}.\nPlease send them separated by commas.\n${example}`;
      return { nextSession, reply, buttons: null };
    }

    const toSave = {
      title: important.title,
      location: important.location,
      property_type: important.property_type,
      price: important.price,
      contact: important.contact,
      description: important.description,
      userId: sender,
      timestamp: Date.now()
    };

    const res = await addListing(toSave);
    const nextSession = { ...session, step: 'posted', lastPostedId: res.id, data: {} };
    const reply = res.success
      ? '✅ Your property has been posted successfully!'
      : `❌ Failed to post listing: ${res.error || 'unknown error'}`;
    return { nextSession, reply, buttons: null };
  }

  // MANAGE user listings
  if (category === 'manage_listings' || /manage/i.test(message)) {
    const userListings = await getUserListings(sender);
    if (!userListings || userListings.length === 0) {
      return {
        nextSession: { ...session, step: 'no_user_listings' },
        reply: 'You have no listings yet. Would you like to post one?',
        buttons: [{ id: 'post_listing', title: 'Post listing' }]
      };
    }

    const preview = userListings
      .slice(0, 8)
      .map(
        (l, idx) =>
          `${idx + 1}. ${l.title || l.property_type} in ${l.location} — ${
            l.price || 'N/A'
          } (id:${l.id})`
      )
      .join('\n\n');

    const buttons = userListings
      .slice(0, 4)
      .map(l => ({ id: `del_${l.id}`, title: `Delete: ${String(l.title || l.id).slice(0, 18)}` }));

    buttons.push({ id: 'post_listing', title: 'Post new' });

    const nextSession = { ...session, step: 'managing', lastUserListings: userListings };
    return {
      nextSession,
      reply: `Your listings:\n\n${preview}\n\nTap a button to delete a listing.`,
      buttons
    };
  }

  // DELETE Listing
  if (/^del_/.test(message.toLowerCase())) {
    const id = message.split('_')[1];
    try {
      await db.collection('listings').doc(id).delete();
      return {
        nextSession: { ...session, step: 'deleted', deletedId: id },
        reply: '✅ Listing deleted.',
        buttons: null
      };
    } catch (err) {
      console.error('delete error', err);
      return { nextSession: { ...session }, reply: '❌ Failed to delete listing.', buttons: null };
    }
  }

  // AI refinement
  if (session.step === 'awaiting_refinement') {
    const followupClass = await classify(message);
    session.data = { ...(session.data || {}), ...(followupClass.entities || {}) };
    session.step = 'refinement_received';

    const all = await getAllListings(200);
    const matches = searchListings(all, session.data, { maxResults: 8, scoreThreshold: 1 });

    if (!matches.length) {
      const nextSession = { ...session, step: 'results_empty_after_refine' };
      return {
        nextSession,
        reply:
          'No properties found after refinement. Try another area or increase budget.',
        buttons: null
      };
    }

    // send first matched card instead of text summary
    const nextSession = { ...session, step: 'showing_results', lastResults: matches.slice(0, 8), listingIndex: 0 };
    await sendListingCard(sender, matches[0], 0, matches.length);
    return { nextSession, reply: null, buttons: null };
  }

  // POST DETAILS (manual)
  if (
    session.step === 'awaiting_post_details' &&
    Array.isArray(session.pending) &&
    session.pending.length > 0
  ) {
    const parts = message.split(',').map(p => p.trim());
    const pending = session.pending.slice();
    const data = { ...(session.data || {}) };

    for (let i = 0; i < parts.length && pending.length > 0; i++) {
      const key = pending.shift();
      data[key] = parts[i];
    }

    if (pending.length > 0) {
      const nextSession = { ...session, step: 'awaiting_post_details', pending, data };
      return {
        nextSession,
        reply: `Still missing: ${pending.join(', ')}. Please provide them.`,
        buttons: null
      };
    }

    const toSave = {
      title: data.title || data.name || 'Listing',
      location: data.location,
      property_type: data.property_type,
      price: data.price,
      contact: data.contact,
      description: data.description || '',
      userId: sender,
      timestamp: Date.now()
    };

    const res = await addListing(toSave);
    const nextSession = { ...session, step: 'posted', lastPostedId: res.id, data: {} };
    const reply = res.success
      ? '✅ Your property has been posted successfully!'
      : `❌ Failed to post listing: ${res.error || 'unknown error'}`;
    return { nextSession, reply, buttons: null };
  }

  // NEW MENU MAPPING ADDED
  // Handles user clicking the "View listings" button from the menu
  if (message === "show_listings" || message === "view_listings" || session?.selected === "show_listings") {
    return handleShowListings({ sender, session, userLang });
  }

  // DEFAULT MENU
  const nextSession = { ...session, step: 'start' };
  return {
    nextSession,
    reply: `Hi — what are you looking for?
1) View listings
2) Post listings
3) Manage listings
4) Change language`,
    buttons: [
      { id: 'show_listings', title: 'View listings' },
      { id: 'post_listing', title: 'Post listing' },
      { id: 'manage_listings', title: 'Manage listings' },
      { id: '4', title: 'Change language' }
    ]
  };
}

module.exports = {
  handleAIAction,
  handleShowListings,
  handleNextListing,
  handleViewDetails,
  handleSaveListing
};