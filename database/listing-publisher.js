// Create a new file: listing-publisher.js
import { db } from './firebase-config.js';
import { COLLECTIONS } from './firestore-schemas.js';
import { Timestamp, runTransaction } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

class ListingPublisher {
  async publishDraft(draft, userData) {
    const listingId = `listing_${uuidv4()}`;
    const listingRef = doc(db, COLLECTIONS.LISTINGS, listingId);
    const draftRef = doc(db, COLLECTIONS.DRAFTS, draft.id);
    
    try {
      await runTransaction(db, async (transaction) => {
        // Create listing
        const listingData = {
          status: 'active',
          category: draft.category,
          subCategory: draft.data[draft.category]?.subCategory || draft.category,
          location: {
            city: draft.data.location?.city || '',
            area: draft.data.location?.area || '',
            lat: draft.data.location?.lat || null,
            lng: draft.data.location?.lng || null
          },
          [draft.category]: draft.data[draft.category],
          owner: {
            userId: userData.phone || userData.id,
            phone: userData.phone
          },
          createdAt: Timestamp.now(),
          expiresAt: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)), // 30 days
          metrics: {
            views: 0,
            contacts: 0
          }
        };

        transaction.set(listingRef, listingData);
        
        // Delete draft
        transaction.delete(draftRef);
      });
      
      return { success: true, listingId };
      
    } catch (error) {
      console.error('Transaction failed:', error);
      return { success: false, error: error.message };
    }
  }
}

export default ListingPublisher;