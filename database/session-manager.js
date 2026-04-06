// File: /database/session-manager.js - FIXED VERSION
const { db } = require('./firestore');
const admin = require('firebase-admin'); // ADD THIS

class SessionManager {
  constructor(userId) {
    this.userId = userId;
    this.collection = 'sessions';
  }

  async getOrCreateSession() {
    try {
      const sessionRef = db.collection(this.collection).doc(this.userId);
      const sessionDoc = await sessionRef.get();
      
      if (sessionDoc.exists) {
        return { id: sessionDoc.id, ...sessionDoc.data() };
      }
      
      // Create new session
      const defaultSession = {
        mode: 'idle',
        category: null,
        draftId: null,
        expectedField: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(), // ✅ FIXED
        createdAt: admin.firestore.FieldValue.serverTimestamp()  // ✅ FIXED
      };
      
      await sessionRef.set(defaultSession);
      return { id: this.userId, ...defaultSession };
      
    } catch (error) {
      console.error('Session Manager Error:', error);
      throw error;
    }
  }

  async updateSession(updates) {
    try {
      const sessionRef = db.collection(this.collection).doc(this.userId);
      updates.updatedAt = admin.firestore.FieldValue.serverTimestamp(); // ✅ FIXED
      await sessionRef.set(updates, { merge: true });
      return true;
    } catch (error) {
      console.error('Update Session Error:', error);
      return false;
    }
  }

  async clearSession() {
    try {
      const sessionRef = db.collection(this.collection).doc(this.userId);
      await sessionRef.update({
        mode: 'idle',
        category: null,
        draftId: null,
        expectedField: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() // ✅ FIXED
      });
    } catch (error) {
      console.error('Clear Session Error:', error);
    }
  }
}

module.exports = SessionManager;