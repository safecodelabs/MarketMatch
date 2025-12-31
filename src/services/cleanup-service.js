const { db } = require('../database/firestore');
const { Timestamp } = require('firebase/firestore');

class CleanupService {
  constructor() {
    this.draftsCollection = 'drafts';
  }
  
  async cleanupOldDrafts() {
    try {
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - 24);
      
      console.log("🧹 Cleaning up drafts older than:", cutoff);
      
      const oldDrafts = await db.collection(this.draftsCollection)
        .where('updatedAt', '<', Timestamp.fromDate(cutoff))
        .where('status', '==', 'draft')
        .get();
      
      if (oldDrafts.empty) {
        console.log("✅ No old drafts to clean up");
        return { cleaned: 0 };
      }
      
      const batch = db.batch();
      let count = 0;
      
      oldDrafts.forEach(doc => {
        batch.delete(doc.ref);
        count++;
      });
      
      await batch.commit();
      console.log(`✅ Cleaned up ${count} old drafts`);
      
      return { cleaned: count };
      
    } catch (error) {
      console.error("❌ Cleanup error:", error);
      return { cleaned: 0, error: error.message };
    }
  }
  
  async cleanupAbandonedSessions() {
    try {
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - 1);
      
      const oldSessions = await db.collection('sessions')
        .where('updatedAt', '<', Timestamp.fromDate(cutoff))
        .where('mode', '==', 'posting')
        .get();
      
      if (oldSessions.empty) {
        console.log("✅ No abandoned sessions to clean up");
        return { cleaned: 0 };
      }
      
      const batch = db.batch();
      let count = 0;
      
      oldSessions.forEach(doc => {
        batch.update(doc.ref, {
          mode: 'idle',
          category: null,
          draftId: null,
          expectedField: null,
          updatedAt: Timestamp.now()
        });
        count++;
      });
      
      await batch.commit();
      console.log(`✅ Reset ${count} abandoned sessions`);
      
      return { cleaned: count };
    } catch (error) {
      console.error("❌ Session cleanup error:", error);
      return { cleaned: 0, error: error.message };
    }
  }
}

module.exports = CleanupService;