// src/utils/sessionStore.js
const { db } = require('../database/firestore');

const collection = db.collection('sessions');

async function getSession(userId) {
  if (!userId) return null;
  const doc = await collection.doc(userId).get();
  if (!doc.exists) return { step: 'start', housingFlow: { step: 'start', data: {} } };
  const data = doc.data();
  if (!data.housingFlow) data.housingFlow = { step: 'start', data: {} };
  return data;
}

async function saveSession(userId, sessionData) {
  if (!userId) throw new Error('userId required');
  if (!sessionData || typeof sessionData !== 'object') throw new Error('Invalid session data');
  const plainData = JSON.parse(JSON.stringify(sessionData));
  await collection.doc(userId).set(plainData);
}

async function deleteSession(userId) {
  if (!userId) throw new Error('userId required');
  await collection.doc(userId).delete();
}

module.exports = { getSession, saveSession, deleteSession };
