const { db } = require('../config/firebase');

const getUserById = async (userId) => {
  if (!userId) {
    throw new Error('getUserById called with invalid userId');
  }
  const doc = await db.collection('users').doc(userId).get();
  return doc.exists ? doc.data() : null;
};

const createUserIfNotExists = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    await db.collection('users').doc(userId).set({
      createdAt: Date.now(),
      userId,
    });
    return true; // new user
  }
  return false; // already exists
};

module.exports = { getUserById, createUserIfNotExists };


