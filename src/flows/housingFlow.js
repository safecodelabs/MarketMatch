// src/flows/housingFlow.js (AI-first handler)
const {
  addListing,
  getAllListings,
  getUserListings,
  db
} = require("../../database/firestore");

const {
  searchListings,
  generateFollowUpQuestion,
  generatePropertyReply,
  parseBudget,
  extractPhone,
  detectLanguageByScript
} = require("../ai/aiEngine");

/**
 * AI-first handler:
 * Inputs:
 *  - sender: whatsapp id
 *  - message: raw message text
 *  - aiResult: output of aiEngine.classify(message)
 *  - session: current housingFlow session object
 *  - userLang: detected/stored language code
 *
 * Returns:
 *  { nextSession, reply, buttons?, mustSaveLanguage? }
 */
async function handleAIAction({ sender, message, aiResult, session = {}, userLang = 'en' }) {
  session = session && typeof session === 'object' ? { step: 'start', intent: null, data: {}, ...session } : { step: 'start', data: {} };

  // If aiResult suggests language but user hasn't saved prefererence, propose saving
  if (aiResult && aiResult.language && !userLang) {
    // ask the user to confirm language (but we'll just return a buttons flow from whatsappBot)
    return {
      nextSession: { ...session, step: 'awaiting_language_confirmation' },
      reply: `I detected your language as ${aiResult.language}. Would you like to use this language?`,
      buttons: [
        { id: `lang_${aiResult.language}`, title: aiResult.language },
        { id: 'lang_en', title: 'English' }
      ],
      mustSaveLanguage: null
    };
  }

  // Main routing by aiResult.category
  const category = aiResult?.category || 'unknown';
  const entities = aiResult?.entities || {};
  const missing = aiResult?.missing || [];

  // normalize budget to numeric if present
  if (entities.budget && typeof entities.budget === 'string') {
    entities.budget = parseBudget(entities.budget);
  }

  // Merge detected entities into session.data
  session.data = { ...(session.data || {}), ...(entities || {}) };
  session.intent = category;

  // If category is buy_house / browse_housing -> search listings
  if (category === 'buy_house' || category === 'browse_housing') {
    // If LLM suggests missing optional refinements, ask ONE follow-up question (optional phrasing)
    if (missing && missing.length > 0) {
      const q = await generateFollowUpQuestion({ missing, entities: session.data, language: userLang });
      // mark session waiting for follow-up answer to incorporate into entities
      const nextSession = { ...session, step: 'awaiting_refinement', missing };
      return { nextSession, reply: q || "Any specific area or budget?", buttons: null };
    }

    // fetch listings (AI-first uses AI searchListings for scoring)
    const all = await getAllListings(200);
    const matches = searchListings(all, session.data, { maxResults: 8, scoreThreshold: 1 });

    if (!matches || matches.length === 0) {
      const nextSession = { ...session, step: 'results_empty' };
      return { nextSession, reply: `No properties found matching your request. Do you want me to broaden the search? Reply 'more' or type another query.`, buttons: null };
    }

    // use LLM to compose a friendly reply in user's language (safe: we pass exact listings)
    const summary = await generatePropertyReply({ entities: session.data, listings: matches, language: userLang, maxResults: 5 });
    const nextSession = { ...session, step: 'showing_results', lastResults: matches.slice(0,5) };
    return { nextSession, reply: summary, buttons: null };
  }

  // If category is post_listing or sell_house -> create listing pipeline
  if (category === 'post_listing' || category === 'sell_house') {
    // If LLM extracted full enough entities (we treat name/location/type/price/contact as important)
    const important = {};
    important.title = entities.name || entities.title || (message.length < 80 ? message : '');
    important.location = entities.city || entities.location || entities.locality || '';
    important.property_type = entities.property_type || entities.type || '';
    important.price = entities.budget || entities.price || '';
    important.contact = entities.contact || extractPhone(message) || '';
    important.description = entities.details || entities.description || '';

    const missingFields = [];
    if (!important.title) missingFields.push('title');
    if (!important.location) missingFields.push('location');
    if (!important.property_type) missingFields.push('property_type');
    if (!important.price) missingFields.push('price');
    if (!important.contact) missingFields.push('contact');

    // If required fields missing, ask for the missing fields only (compose friendly text)
    if (missingFields.length > 0) {
      // create a short instruction with example
      const fieldList = missingFields.join(', ');
      const example = "Example: Rahul, Noida Sector 56, 2BHK, 15000, +9199XXXXXXXX, Semi-furnished, near metro";
      const nextSession = { ...session, step: 'awaiting_post_details', pending: missingFields, data: important };
      const reply = `Thanks — I need a few more details: ${fieldList}.\nPlease send them separated by commas.\n${example}`;
      return { nextSession, reply, buttons: null };
    }

    // All required fields present -> save listing
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

  // Manage listings: show user's listings and allow delete
  if (category === 'manage_listings' || message.toLowerCase().includes('manage')) {
    const userListings = await getUserListings(sender);
    if (!userListings || userListings.length === 0) {
      return { nextSession: { ...session, step: 'no_user_listings' }, reply: 'You have no listings yet. Would you like to post one?', buttons: [{ id: 'post_listing', title: 'Post listing' }] };
    }

    // Build reply with simple indexed list and delete buttons (we'll use button ids like del_{id})
    const preview = userListings.slice(0, 8).map((l, idx) => `${idx+1}. ${l.title || (l.property_type || 'Property')} in ${l.location} — ${l.price || 'N/A'} (id:${l.id})`).join('\n\n');
    const buttons = userListings.slice(0, 4).map(l => ({ id: `del_${l.id}`, title: `Delete: ${l.title?.slice(0,18) || l.id}` }));
    buttons.push({ id: 'post_listing', title: 'Post new' });
    const nextSession = { ...session, step: 'managing', lastUserListings: userListings };
    return { nextSession, reply: `Your listings:\n\n${preview}\n\nTap a button to delete a listing.`, buttons };
  }

  // If message looks like a delete command (del_<id>) or user pressed that button
  if (/^del_/.test(message.toLowerCase())) {
    const id = message.split('_')[1];
    try {
      await db.collection('listings').doc(id).delete();
      const nextSession = { ...session, step: 'deleted', deletedId: id };
      return { nextSession, reply: '✅ Listing deleted.', buttons: null };
    } catch (err) {
      console.error('delete error', err);
      return { nextSession: { ...session }, reply: '❌ Failed to delete listing.', buttons: null };
    }
  }

  // If session was awaiting a refinement answer (user answered the follow-up), merge answer then search
  if (session.step === 'awaiting_refinement') {
    // Try to classify the short answer to extract e.g., locality/budget and merge into session.data
    const followupClass = await (require('../ai/aiEngine').classify)(message);
    session.data = { ...(session.data || {}), ...(followupClass.entities || {}) };
    session.step = 'refinement_received';
    // Re-run search now:
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

  // If session was awaiting_post_details and user sent a CSV-like details string
  if (session.step === 'awaiting_post_details' && Array.isArray(session.pending) && session.pending.length > 0) {
    // attempt to parse comma separated values that user sends
    const parts = message.split(',').map(p => p.trim());
    // Fill missing fields from parts in order
    const pending = session.pending.slice();
    const data = { ...(session.data || {}) };
    for (let i = 0; i < parts.length && pending.length > 0; i++) {
      const key = pending.shift();
      data[key] = parts[i];
    }
    // If still missing, ask again
    if (pending.length > 0) {
      const nextSession = { ...session, step: 'awaiting_post_details', pending, data };
      return { nextSession, reply: `Still missing: ${pending.join(', ')}. Please provide them.`, buttons: null };
    }
    // otherwise save listing
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

  // Generic fallback: present main menu
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
