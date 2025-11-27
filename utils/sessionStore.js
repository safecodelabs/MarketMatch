const { db, usersRef } = require("../database/firestore");
const collection = db.collection('sessions');

async function getSession(userId) {
  const docRef = collection.doc(userId);
  const doc = await docRef.get();

  // If no session document exists, return a default and mark _isNew true
  if (!doc.exists) {
    return {
      _isNew: true,
      step: 'start',
      housingFlow: { step: 'start', data: {} }
    };
  }

  const data = doc.data() || {};
  // normalize housingFlow
  if (!data.housingFlow) data.housingFlow = { step: 'start', data: {} };

  // For existing docs, include an explicit flag to indicate not-new
  data._isNew = false;
  return data;
}

async function saveSession(userId, sessionData) {
  if (!sessionData || typeof sessionData !== 'object') throw new Error('Invalid session data');
  // ensure we don't accidentally store undefined values and handle nested objects
  const plainData = JSON.parse(JSON.stringify(sessionData));

  // Write to firestore
  await collection.doc(userId).set(plainData);
}

async function deleteSession(userId) {
  await collection.doc(userId).delete();
}

module.exports = { getSession, saveSession, deleteSession };
