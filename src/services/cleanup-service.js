const { db } = require('../../database/firestore');
const admin = require('firebase-admin');

class CleanupService {
  constructor() {
    this.draftsCollection = 'drafts';
    console.log('🧹 CleanupService initialized');
  }
  
  async cleanupOldDrafts() {
    try {
      console.log('🧹 Starting draft cleanup (no composite index needed)...');
      
      // Get ALL drafts without any filters
      const allDrafts = await db.collection(this.draftsCollection).get();
      
      if (allDrafts.empty) {
        console.log('✅ No drafts to clean up');
        return { cleaned: 0 };
      }
      
      console.log(`🧹 Checking ${allDrafts.size} total drafts`);
      
      const batch = db.batch();
      let count = 0;
      const deletedDraftIds = [];
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - 24);
      
      allDrafts.docs.forEach(doc => {
        const draft = doc.data();
        
        // Only delete drafts with status 'draft'
        if (draft.status === 'draft') {
          const updatedAt = draft.updatedAt;
          let updatedDate;
          
          // Convert Firestore Timestamp to Date
          if (updatedAt && updatedAt.toDate) {
            updatedDate = updatedAt.toDate();
          } else if (updatedAt && updatedAt._seconds) {
            updatedDate = new Date(updatedAt._seconds * 1000);
          } else if (updatedAt) {
            updatedDate = new Date(updatedAt);
          }
          
          // Check if older than 24 hours
          if (updatedDate && updatedDate < cutoff) {
            batch.delete(doc.ref);
            count++;
            deletedDraftIds.push(doc.id);
            console.log(`🗑️ Deleting draft ${doc.id} from ${updatedDate}`);
          }
        }
      });
      
      if (count > 0) {
        await batch.commit();
        console.log(`✅ Successfully cleaned up ${count} old drafts`);

        // Reconcile sessions referencing deleted drafts
        let totalSessionsReset = 0;
        try {
          if (deletedDraftIds.length > 0) {
            console.log(`🔁 Reconciling sessions referencing ${deletedDraftIds.length} deleted drafts...`);

            // Firestore 'in' supports up to 10 values - split into chunks
            for (let i = 0; i < deletedDraftIds.length; i += 10) {
              const chunk = deletedDraftIds.slice(i, i + 10);
              const sessionsSnap = await db.collection('sessions')
                .where('draftId', 'in', chunk)
                .get();

              if (!sessionsSnap.empty) {
                const sessionBatch = db.batch();
                let resetCount = 0;
                sessionsSnap.forEach(sDoc => {
                  sessionBatch.update(sDoc.ref, {
                    draftId: null,
                    mode: 'idle',
                    expectedField: null,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                  });
                  resetCount++;
                  console.log(`🔄 Resetting session ${sDoc.id} which referenced deleted draft`);
                });
                await sessionBatch.commit();
                totalSessionsReset += resetCount;
                console.log(`✅ Reset ${resetCount} sessions for draft chunk`);
              }
            }

            console.log(`✅ Completed session reconciliation for deleted drafts. Total sessions reset: ${totalSessionsReset}`);
          }
        } catch (reconError) {
          console.error('❌ Error reconciling sessions for deleted drafts:', reconError);
        }

        return { cleaned: count, deletedDrafts: deletedDraftIds.length, sessionsReset: totalSessionsReset };
      } else {
        console.log('✅ No drafts older than 24 hours');
        return { cleaned: 0, deletedDrafts: 0, sessionsReset: 0 };
      }
      
    } catch (error) {
      console.error('❌ Draft cleanup error:', error.message);
      return { cleaned: 0, error: error.message };
    }
  }
  
  async cleanupAbandonedSessions() {
    try {
      console.log('🧹 Starting session cleanup...');
      
      // Get ALL sessions without filters
      const allSessions = await db.collection('sessions').get();
      
      if (allSessions.empty) {
        console.log('✅ No sessions to clean up');
        return { cleaned: 0 };
      }
      
      console.log(`🧹 Checking ${allSessions.size} total sessions`);
      
      const batch = db.batch();
      let count = 0;
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - 1); // 1 hour ago
      
      allSessions.docs.forEach(doc => {
        const session = doc.data();
        
        // Only reset sessions in 'posting' mode
        if (session.mode === 'posting') {
          const updatedAt = session.updatedAt;
          let updatedDate;
          
          // Convert Firestore Timestamp to Date
          if (updatedAt && updatedAt.toDate) {
            updatedDate = updatedAt.toDate();
          } else if (updatedAt && updatedAt._seconds) {
            updatedDate = new Date(updatedAt._seconds * 1000);
          } else if (updatedAt) {
            updatedDate = new Date(updatedAt);
          }
          
          // Reset if older than 1 hour
          if (updatedDate && updatedDate < cutoff) {
            batch.update(doc.ref, {
              mode: 'idle',
              category: null,
              draftId: null,
              expectedField: null,
              updatedAt: new Date()
            });
            count++;
            console.log(`🔄 Resetting abandoned session ${doc.id}`);
          }
        }
      });
      
      if (count > 0) {
        await batch.commit();
        console.log(`✅ Successfully reset ${count} abandoned sessions`);
      } else {
        console.log('✅ No abandoned sessions found');
      }
      
      return { cleaned: count };
      
    } catch (error) {
      console.error('❌ Session cleanup error:', error.message);
      return { cleaned: 0, error: error.message };
    }
  }
  
  async runAllCleanups() {
    console.log('🧹 Running all cleanup tasks...');
    
    const draftResult = await this.cleanupOldDrafts();
    const sessionResult = await this.cleanupAbandonedSessions();
    
    console.log('🧹 Cleanup summary:', {
      drafts: draftResult.cleaned,
      deletedDrafts: draftResult.deletedDrafts || 0,
      sessions: sessionResult.cleaned
    });
    
    return {
      drafts: draftResult,
      sessions: sessionResult
    };
  }
}

module.exports = CleanupService;