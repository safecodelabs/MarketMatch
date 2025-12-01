// src/utils/sessionStore.js
// Debug-friendly session store that uses Firestore

const { db } = require('../database/firestore'); // use db exported from your firestore init

const collection = db && db.collection ? db.collection('sessions') : null;

async function getSession(userId) {
  if (!userId) return null;
  if (!collection) {
    console.warn('⚠️ getSession: Firestore collection unavailable (db not initialized)');
    return { step: 'start', housingFlow: { step: 'start', data: {} }, isInitialized: false };
  }

  try {
    const doc = await collection.doc(userId).get();
    if (!doc.exists) return { step: 'start', housingFlow: { step: 'start', data: {} }, isInitialized: false };
    const data = doc.data() || {};
    if (!data.housingFlow) data.housingFlow = { step: 'start', data: {} };
    if (typeof data.isInitialized === 'undefined') data.isInitialized = false;
    return data;
  } catch (err) {
    console.error('❌ getSession error:', err?.message || err);
    return { step: 'start', housingFlow: { step: 'start', data: {} }, isInitialized: false };
  }
}

async function saveSession(userId, sessionData) {
  if (!userId) throw new Error('userId required');
  if (!sessionData || typeof sessionData !== 'object') throw new Error('Invalid session data');

  if (!collection) {
    console.warn('⚠️ saveSession: Firestore collection unavailable — skipping save', JSON.stringify(sessionData));
    return false;
  }

  try {
    const plainData = JSON.parse(JSON.stringify(sessionData)); // strip undefined
    await collection.doc(userId).set(plainData);
    console.log(`✅ saveSession: saved session for ${userId}`);
    return true;
  } catch (err) {
    console.error('❌ saveSession error:', err?.message || err, 'sessionData:', JSON.stringify(sessionData));
    throw err;
  }
}

async function deleteSession(userId) {
  if (!userId) throw new Error('userId required');
  if (!collection) {
    console.warn('⚠️ deleteSession: Firestore collection unavailable — skipping delete for', userId);
    return false;
  }
  try {
    await collection.doc(userId).delete();
    console.log(`✅ deleteSession: deleted session for ${userId}`);
    return true;
  } catch (err) {
    console.error('❌ deleteSession error:', err?.message || err);
    throw err;
  }
}

module.exports = { getSession, saveSession, deleteSession };
