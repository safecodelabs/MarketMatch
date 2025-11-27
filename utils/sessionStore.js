// sessionStore.js
const { db } = require('../database/firestore'); // correct import

const collection = db.collection('sessions');

async function getSession(userId) {
  const doc = await collection.doc(userId).get();
  return doc.exists ? doc.data() : { step: 'chooseService' };
}

async function saveSession(userId, sessionData) {
  if (!sessionData || typeof sessionData !== 'object') {
    console.error('❌ Invalid session data:', sessionData);
    throw new Error('Invalid session data passed to saveSession');
  }

  try {
    const plainData = JSON.parse(JSON.stringify(sessionData)); // removes undefined values
    await collection.doc(userId).set(plainData);
  } catch (error) {
    console.error('❌ Failed to save session:', error.message);
    throw error;
  }
}

module.exports = {
  getSession,
  saveSession,
};
