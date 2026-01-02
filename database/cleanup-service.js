// File: /src/services/cleanup-service.js
const { db } = require('../../database/firestore');

class CleanupService {
  constructor() {
    console.log("✅ CleanupService initialized");
  }

  async cleanupOldDrafts() {
    try {
      console.log("🧹 Cleaning up old drafts...");
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7); // 7 days old
      
      const draftsRef = db.collection('drafts');
      const snapshot = await draftsRef
        .where('updatedAt', '<', cutoffDate)
        .where('status', '==', 'draft')
        .get();
      
      let cleaned = 0;
      const batch = db.batch();
      
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
        cleaned++;
      });
      
      if (cleaned > 0) {
        await batch.commit();
        console.log(`✅ Cleaned up ${cleaned} old drafts`);
      }
      
      return { cleaned };
      
    } catch (error) {
      console.error("❌ Error cleaning drafts:", error);
      return { cleaned: 0, error: error.message };
    }
  }

  async cleanupAbandonedSessions() {
    try {
      console.log("🧹 Cleaning up abandoned sessions...");
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - 24); // 24 hours old
      
      const sessionsRef = db.collection('sessions');
      const snapshot = await sessionsRef
        .where('updatedAt', '<', cutoffDate)
        .get();
      
      let cleaned = 0;
      const batch = db.batch();
      
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
        cleaned++;
      });
      
      if (cleaned > 0) {
        await batch.commit();
        console.log(`✅ Cleaned up ${cleaned} abandoned sessions`);
      }
      
      return { cleaned };
      
    } catch (error) {
      console.error("❌ Error cleaning sessions:", error);
      return { cleaned: 0, error: error.message };
    }
  }
}

module.exports = CleanupService;