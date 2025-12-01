// src/flows/housingFlow.js
const { addListing, getAllListings, getUserListings, db } = require('../../database/firestore');
const { searchListings, generateFollowUpQuestion, generatePropertyReply } = require('../ai/aiEngine');

/**
 * handleAIAction - single entrypoint for housing interactions (AI-first)
 * Inputs: { sender, message, aiResult, session, userLang }
 * Returns: { nextSession, reply, buttons?, mustSaveLanguage? }
 */
async function handleAIAction({ sender, message, aiResult = {}, session = {}, userLang = 'en' }) {
  session = session && typeof session === 'object' ? { step: 'start', data: {}, ...session } : { step: 'start', data: {} };

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

    // fetch listings from Firestore
    const all = await getAllListings(200);
    const matches = searchListings(all, entities, { maxResults: 8, scoreThreshold: 1 });

    if (!matches.length) {
      const nextSession = { ...session, step: 'results_empty' };
      return { nextSession, reply: (userLang === 'hi' ? 'कोई परिणाम नहीं मिला।' : (userLang === 'ta' ? 'பொருட்கள் கிடைக்கவில்லை.' : 'No properties found matching your request.')), buttons: null };
    }

    const summary = await generatePropertyReply({ entities, listings: matches, language: userLang, maxResults: 5 });
    const nextSession = { ...session, step: 'showing_results', lastResults: matches.slice(0,5) };
    return { nextSession, reply: summary, buttons: null };
  }

  // POST / SELL: create listing
  if (category === 'post_listing' || category === 'sell_house') {
    // try to assemble required fields from entities or the message
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
      const example = "Example: Rahul, Noida Sector 56, 2BHK, 15000, +9199XXXXXXXX, Semi-furnished, near metro";
      const nextSession = { ...session, step: 'awaiting_post_details', pending: missingFields, data: important };
      const reply = `I need a few more details: ${missingFields.join(', ')}.\nPlease send them separated by commas.\n${example}`;
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
    const reply = res.success ? '✅ Your property has been posted successfully!' : `❌ Failed to post listing: ${res.error || 'unknown error'}`;
    return { nextSession, reply, buttons: null };
  }

  // MANAGE: show user listings
  if (category === 'manage_listings' || /manage/i.test(message)) {
    const userListings = await getUserListings(sender);
    if (!userListings || userListings.length === 0) {
      return { nextSession: { ...session, step: 'no_user_listings' }, reply: 'You have no listings yet. Would you like to post one?', buttons: [{ id: 'post_listing', title: 'Post listing' }] };
    }

    const preview = userListings.slice(0, 8).map((l, idx) => `${idx+1}. ${l.title || l.property_type} in ${l.location} — ${l.price || 'N/A'} (id:${l.id})`).join('\n\n');
    const buttons = userListings.slice(0, 4).map(l => ({ id: `del_${l.id}`, title: `Delete: ${String(l.title || l.id).slice(0,18)}` }));
    buttons.push({ id: 'post_listing', title: 'Post new' });
    const nextSession = { ...session, step: 'managing', lastUserListings: userListings };
    return { nextSession, reply: `Your listings:\n\n${preview}\n\nTap a button to delete a listing.`, buttons };
  }

  // Delete command
  if (/^del_/.test(message.toLowerCase())) {
    const id = message.split('_')[1];
    try {
      await db.collection('listings').doc(id).delete();
      return { nextSession: { ...session, step: 'deleted', deletedId: id }, reply: '✅ Listing deleted.', buttons: null };
    } catch (err) {
      console.error('delete error', err);
      return { nextSession: { ...session }, reply: '❌ Failed to delete listing.', buttons: null };
    }
  }

  // If awaiting refinement (follow-up answered)
  if (session.step === 'awaiting_refinement') {
    // classify the answer to extract more entities and re-run search
    const followupClass = await require('../ai/aiEngine').classify(message);
    session.data = { ...(session.data || {}), ...(followupClass.entities || {}) };
    session.step = 'refinement_received';
    const all = await getAllListings(200);
    const matches = searchListings(all, session.data, { maxResults: 8, scoreThreshold: 1 });
    if (!matches.length) {
      const nextSession = { ...session, step: 'results_empty_after_refine' };
      return { nextSession, reply: 'No properties found after refinement. Try another area or increase budget.', buttons: null };
    }
    const summary = await generatePropertyReply({ entities: session.data, listings: matches, language: userLang, maxResults: 5 });
    const nextSession = { ...session, step: 'showing_results', lastResults: matches.slice(0,5) };
    return { nextSession, reply: summary, buttons: null };
  }

  // Awaiting post details parsing
  if (session.step === 'awaiting_post_details' && Array.isArray(session.pending) && session.pending.length > 0) {
    const parts = message.split(',').map(p => p.trim());
    const pending = session.pending.slice();
    const data = { ...(session.data || {}) };
    for (let i = 0; i < parts.length && pending.length > 0; i++) {
      const key = pending.shift();
      data[key] = parts[i];
    }
    if (pending.length > 0) {
      const nextSession = { ...session, step: 'awaiting_post_details', pending, data };
      return { nextSession, reply: `Still missing: ${pending.join(', ')}. Please provide them.`, buttons: null };
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
    const reply = res.success ? '✅ Your property has been posted successfully!' : `❌ Failed to post listing: ${res.error || 'unknown error'}`;
    return { nextSession, reply, buttons: null };
  }

  // --- Added this block for menu-selection mapping ---
  if (session?.selected === "show_listings" || message === "show_listings") {
    return handleShowListings({ sender, session });
  }
  // ----------------------------------------------------

  // Default menu fallback
  const nextSession = { ...session, step: 'start' };
  return {
    nextSession,
    reply: `Hi — what are you looking for?\n1) View listings\n2) Post listings\n3) Manage listings\n4) Change language`,
    buttons: [
      { id: '1', title: 'View listings' },
      { id: '2', title: 'Post listing' },
      { id: '3', title: 'Manage listings' },
      { id: '4', title: 'Change language' }
    ]
  };
}

module.exports = { handleAIAction };
