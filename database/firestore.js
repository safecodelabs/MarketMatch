// database/firestore.js - ENHANCED WITH URBAN HELP SUPPORT
const admin = require("firebase-admin");
const path = require("path");

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  let serviceAccount;
  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    } else {
      serviceAccount = require(path.join(__dirname, "..", "credentials", "firebase-credentials.json"));
    }
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log("✅ Firestore initialized:", serviceAccount.project_id || "local");
  } catch (err) {
    console.error("❌ Firestore initialization failed:", err.message || err);
  }
}

const db = admin.firestore();

const listingsRef = db.collection("listings");
const usersRef = db.collection("users");
const savedRef = db.collection("saved");
const urbanHelpProvidersRef = db.collection("urban_help_providers");
const userRequestsRef = db.collection("user_requests");

// ✅ ADDED: Reference to urban_services collection
const urbanServicesRef = db.collection("urban_services");

// -----------------------------------------------
// ✅ ADDED: SEARCH URBAN SERVICES FUNCTION - FIXED
// -----------------------------------------------

/**
 * Search for urban services by category and location
 * @param {String} category - Service category (electrician, plumber, tailor, etc.)
 * @param {String} location - Location to search in
 * @returns {Promise<Array>} Array of service providers
 */
async function searchUrbanServices(category, location) {
  try {
    console.log(`🔍 [URBAN SERVICES] Searching for "${category}" in "${location}"`);
    
    let query = urbanServicesRef;
    
    // Apply category filter if provided
    if (category && category.trim()) {
      const normalizedCategory = category.toLowerCase().trim();
      query = query.where('category', '==', normalizedCategory);
    }
    
    // Apply location filter if provided
    if (location && location.trim()) {
      const normalizedLocation = location.toLowerCase().trim();
      query = query.where('location', '==', normalizedLocation);
    }
    
    // Get results with a limit
    const snapshot = await query.limit(10).get();
    
    // If we found exact matches, return them
    if (!snapshot.empty) {
      const results = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        results.push({
          id: doc.id,
          name: data.name || 'Service Provider',
          category: data.category || 'service',
          location: data.location || 'Not specified',
          phone: data.phone || 'Contact not available',
          createdAt: data.createdAt || null
        });
      });
      
      console.log(`✅ [URBAN SERVICES] Found ${results.length} exact matches`);
      return results;
    }
    
    // No exact matches found - try smarter searching
    console.log(`📭 [URBAN SERVICES] No exact matches for ${category} in ${location}`);
    console.log(`🔍 [URBAN SERVICES] Performing smarter search...`);
    
    // Get all services and filter client-side
    const allSnapshot = await urbanServicesRef.limit(30).get();
    
    if (allSnapshot.empty) {
      console.log(`📭 [URBAN SERVICES] No services in database`);
      return [];
    }
    
    const allServices = [];
    allSnapshot.forEach(doc => {
      const data = doc.data();
      allServices.push({
        id: doc.id,
        name: data.name || 'Service Provider',
        category: data.category || 'service',
        location: data.location || 'Not specified',
        phone: data.phone || 'Contact not available',
        createdAt: data.createdAt || null
      });
    });
    
    // Filter based on search criteria
    const searchCategory = category ? category.toLowerCase().trim() : '';
    const searchLocation = location ? location.toLowerCase().trim() : '';
    
    const filteredResults = allServices.filter(service => {
      const serviceCategory = (service.category || '').toLowerCase();
      const serviceLocation = (service.location || '').toLowerCase();
      const serviceName = (service.name || '').toLowerCase();
      
      let matches = true;
      
      // If category specified, check for match in category or name
      if (searchCategory) {
        matches = matches && (
          serviceCategory.includes(searchCategory) ||
          serviceName.includes(searchCategory) ||
          searchCategory.includes(serviceCategory)
        );
      }
      
      // If location specified, check for match
      if (searchLocation) {
        matches = matches && (
          serviceLocation.includes(searchLocation) ||
          searchLocation.includes(serviceLocation)
        );
      }
      
      return matches;
    });
    
    console.log(`✅ [URBAN SERVICES] Found ${filteredResults.length} smart matches`);
    
    // If we have matches, return them
    if (filteredResults.length > 0) {
      return filteredResults.slice(0, 5); // Return top 5 matches
    }
    
    // No relevant matches found — do NOT return unrelated nearby or top services.
    // We prefer being strict: return empty so caller can persist the user's request for future notification.
    console.log(`📭 [URBAN SERVICES] No relevant matches found for ${category} in ${location}; returning empty results`);
    return [];
    
  } catch (error) {
    console.error("❌ [URBAN SERVICES] Error searching urban services:", error);
    console.error("Error details:", error.code, error.message);
    
    // Return empty array instead of throwing error
    return [];
  }
}

/**
 * Get fallback services for testing when database is empty
 */
function getFallbackServices(category, location) {
  const categoryName = category || 'service';
  const locationName = location || 'area';
  
  return [
    {
      id: 'fallback_1',
      name: `Sample ${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)} 1`,
      category: categoryName,
      location: locationName,
      phone: '+91 98765 43210'
    },
    {
      id: 'fallback_2',
      name: `Reliable ${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)}`,
      category: categoryName,
      location: locationName,
      phone: '+91 98765 43211'
    }
  ];
}

// -----------------------------------------------
// URBAN HELP FUNCTIONS (ORIGINAL)
// -----------------------------------------------

/**
 * Search urban help service providers
 */
async function searchUrbanHelp(category, location, filters = {}) {
  try {
    console.log(`🔍 [URBAN HELP] Searching for ${category} in ${location}`);

    const results = [];

    // 1) Search registered urban_help providers first
    let providerQuery = urbanHelpProvidersRef;
    if (category) providerQuery = providerQuery.where('category', '==', category);
    if (filters.isActive !== undefined) providerQuery = providerQuery.where('isActive', '==', filters.isActive);

    const providerSnap = await providerQuery.limit(10).get();
    if (!providerSnap.empty) {
      providerSnap.forEach(doc => {
        const data = doc.data();
        results.push({
          id: doc.id,
          source: 'provider',
          name: data.name || 'Service Provider',
          category: data.category || 'service',
          location: data.location || 'Not specified',
          phone: data.phone || data.contact || 'Contact not available',
          rating: data.rating || 0,
          isActive: data.isActive !== false,
          createdAt: data.createdAt || null
        });
      });
    } else {
      console.log(`📭 [URBAN HELP] No providers found for ${category} in ${location} (providers collection)`);
    }

    // 2) Also search listings with category 'urban_help' so user-posted service listings appear
    try {
      let listingsQuery = listingsRef.where('category', '==', 'urban_help').where('status', '==', 'active');

      if (location) {
        // Try to match by location.area or location fields inside listing data
        listingsQuery = listingsQuery.where('data.location.area', '==', location);
      }

      // Limit and get results
      const listingSnap = await listingsQuery.limit(10).get();
      if (!listingSnap.empty) {
        listingSnap.forEach(doc => {
          const data = doc.data();
          // Map listing to provider-like result
          results.push({
            id: doc.id,
            source: 'listing',
            name: data.title || (data.data?.['urban_help']?.serviceType || 'Service Listing'),
            category: data.category || 'urban_help',
            location: data.data?.location?.area || data.data?.location || 'Not specified',
            phone: data.owner?.phone || data.owner?.userId || 'Contact not available',
            rating: 0,
            isActive: data.status === 'active',
            createdAt: data.createdAt || null
          });
        });
      } else {
        console.log(`📭 [URBAN HELP] No listings found for urban_help in ${location}`);
      }
    } catch (err) {
      console.error('❌ [URBAN HELP] Error searching listings for urban help:', err);
    }

    // 3) Filter/score results (simple approach: unique by id)
    const unique = {};
    const final = [];
    for (const r of results) {
      if (!unique[r.id]) {
        unique[r.id] = true;
        final.push(r);
      }
    }

    console.log(`✅ [URBAN HELP] Found ${final.length} results (providers + listings)`);
    return final.slice(0, 10);

  } catch (error) {
    console.error('❌ [URBAN HELP] Error searching urban help:', error);
    return [];
  }
}

/**
 * Add new urban help provider to urban_services collection
 */
async function addUrbanHelpProvider(providerData) {
  try {
    // Check if we should add to urban_services collection
    if (providerData.category && providerData.location) {
      const docRef = await urbanServicesRef.add({
        category: providerData.category,
        name: providerData.name || 'Service Provider',
        phone: providerData.phone || '',
        location: providerData.location,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`✅ [URBAN SERVICES] Added provider: ${docRef.id}`);
      
      return {
        success: true,
        id: docRef.id,
        collection: 'urban_services'
      };
    }
    
    // Fallback to urban_help_providers collection
    const docRef = await urbanHelpProvidersRef.add({
      ...providerData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isActive: true
    });
    
    return {
      success: true,
      id: docRef.id,
      collection: 'urban_help_providers'
    };
  } catch (error) {
    console.error('❌ [URBAN HELP] Error adding provider:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get urban help provider by ID
 */
async function getProviderById(providerId) {
  try {
    const doc = await urbanHelpProvidersRef.doc(providerId).get();
    
    if (!doc.exists) {
      return null;
    }
    
    return {
      id: doc.id,
      ...doc.data()
    };
  } catch (error) {
    console.error('❌ [URBAN HELP] Error getting provider:', error);
    return null;
  }
}

/**
 * Update provider availability
 */
async function updateProviderAvailability(providerId, available) {
  try {
    await urbanHelpProvidersRef.doc(providerId).update({
      availableNow: available,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('❌ [URBAN HELP] Error updating availability:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Add user request to queue
 */
async function addUserRequest(userId, requestData) {
  try {
    const requestRef = await userRequestsRef.add({
      userId,
      ...requestData,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`✅ [URBAN HELP] User request added: ${requestRef.id}`);
    
    return {
      success: true,
      requestId: requestRef.id
    };
  } catch (error) {
    console.error('❌ [URBAN HELP] Error adding user request:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user's pending requests
 */
async function getUserPendingRequests(userId) {
  try {
    const snapshot = await userRequestsRef
      .where("userId", "==", userId)
      .where("status", "==", "pending")
      .orderBy("createdAt", "desc")
      .get();
    
    if (snapshot.empty) {
      return [];
    }
    
    const requests = [];
    snapshot.forEach(doc => {
      requests.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return requests;
  } catch (error) {
    console.error('❌ [URBAN HELP] Error getting user requests:', error);
    return [];
  }
}

/**
 * Update request status
 */
async function updateRequestStatus(requestId, status, matchedProviders = []) {
  try {
    const updateData = {
      status: status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (matchedProviders.length > 0) {
      updateData.matchedProviders = matchedProviders;
      updateData.matchedAt = admin.firestore.FieldValue.serverTimestamp();
    }
    
    await userRequestsRef.doc(requestId).update(updateData);
    
    return { success: true };
  } catch (error) {
    console.error('❌ [URBAN HELP] Error updating request status:', error);
    return { success: false, error: error.message };
  }
}

// -----------------------------------------------
// SEARCH LISTINGS BY CRITERIA
// -----------------------------------------------
async function searchListingsByCriteria(criteria) {
  try {
    console.log("🔍 [DB] Searching listings with criteria:", criteria);
    
    let query = listingsRef;
    
    // Apply filters
    if (criteria.type) {
      query = query.where("type", "==", criteria.type);
    }
    
    if (criteria.location) {
      query = query.where("location", "==", criteria.location);
    }
    
    if (criteria.bedrooms) {
      query = query.where("bhk", "==", criteria.bedrooms);
    }
    
    if (criteria.maxPrice) {
      query = query.where("price", "<=", criteria.maxPrice);
    }
    
    const snapshot = await query
      .orderBy(criteria.maxPrice ? "price" : "timestamp", criteria.maxPrice ? "asc" : "desc")
      .limit(20)
      .get();
    
    if (snapshot.empty) {
      console.log("📭 [DB] No listings found with given criteria");
      return [];
    }
    
    const listings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`✅ [DB] Found ${listings.length} listings matching criteria`);
    return listings;
    
  } catch (error) {
    console.error("❌ [DB] Error searching listings:", error);
    return [];
  }
}

// -----------------------------------------------
// GET TOP LISTINGS (for chatbotController.js)
// -----------------------------------------------
async function getTopListings(limit = 10) {
  console.log("🔍 [DB] getTopListings called, limit:", limit);
  try {
    // Get listings ordered by timestamp (newest first)
    const snapshot = await listingsRef
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();
    
    if (snapshot.empty) {
      console.log("📭 [DB] No listings found");
      return { listings: [], totalCount: 0 };
    }
    
    const listings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`✅ [DB] Found ${listings.length} listings`);
    return { listings, totalCount: listings.length };
  } catch (err) {
    console.error("❌ [DB] Error in getTopListings:", err);
    return { listings: [], totalCount: 0 };
  }
}

// -----------------------------------------------
// ADD NEW LISTING
// -----------------------------------------------
async function addListing(listingData) {
  try {
    const payload = {
      ...listingData,
      timestamp: admin.firestore.Timestamp.now(),
      createdAt: Date.now()
    };
    const docRef = await listingsRef.add(payload);
    return { success: true, id: docRef.id };
  } catch (err) {
    console.error("🔥 Error adding listing:", err);
    return { success: false, error: err.message || err };
  }
}

// -----------------------------------------------
// FETCH ALL LISTINGS
// -----------------------------------------------
async function getAllListings() {
  try {
    const snapshot = await listingsRef.get();
    
    if (snapshot.empty) return [];

    let items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`[DB] Fetched ${items.length} listings successfully.`);
    return items; 
  } catch (err) {
    console.error("🔥 Error fetching all listings:", err);
    return [];
  }
}

// -----------------------------------------------
// FETCH USER-SPECIFIC LISTINGS
// -----------------------------------------------
async function getUserListings(userId) {
  try {
    // New listings use nested owner.userId, older ones may use top-level 'user' field.
    // Query both and merge results to be backward compatible.
    const results = [];

    // Query by owner.userId
    const byOwner = await listingsRef.where('owner.userId', '==', userId).get();
    if (!byOwner.empty) {
      byOwner.forEach(d => results.push({ id: d.id, ...d.data() }));
    }

    // Query by legacy 'user' field
    const byUser = await listingsRef.where('user', '==', userId).get();
    if (!byUser.empty) {
      byUser.forEach(d => {
        // Avoid duplicates
        if (!results.find(r => r.id === d.id)) results.push({ id: d.id, ...d.data() });
      });
    }

    return results;
  } catch (err) {
    console.error("🔥 Error fetching user listings:", err);
    return [];
  }
}

// -----------------------------------------------------
// GET SINGLE LISTING BY ID
// -----------------------------------------------------
async function getListingById(listingId) {
  try {
    const doc = await listingsRef.doc(listingId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  } catch (err) {
    console.error("🔥 Error fetching listing by ID:", err);
    return null;
  }
}

// -----------------------------------------------------
// DELETE LISTING BY ID - ENHANCED DEBUG VERSION
// -----------------------------------------------------
async function deleteListing(listingId) {
  console.log(`🔍 [FIRESTORE] deleteListing called for ID: ${listingId}`);
  
  try {
    // Validate and clean listingId
    if (!listingId) {
      console.error(`❌ [FIRESTORE] Empty listing ID`);
      return { 
        success: false, 
        error: "Empty listing ID",
        listingId: listingId 
      };
    }
    
    const cleanListingId = String(listingId).trim();
    
    // Get document reference
    const docRef = listingsRef.doc(cleanListingId);
    
    // Check if document exists
    const doc = await docRef.get();
    
    if (!doc.exists) {
      console.warn(`⚠️ [FIRESTORE] Document ${cleanListingId} does not exist`);
      return { 
        success: false, 
        error: "Document not found",
        listingId: cleanListingId,
        exists: false
      };
    }
    
    // Delete the document
    await docRef.delete();
    
    console.log(`✅ [FIRESTORE] Document ${cleanListingId} deleted successfully`);
    
    return { 
      success: true, 
      listingId: cleanListingId,
      message: "Listing deleted successfully",
      deletedAt: Date.now(),
      existed: true
    };
    
  } catch (err) {
    console.error("🔥 [FIRESTORE] Error in deleteListing:", err);
    
    return { 
      success: false, 
      error: err.message || "Unknown error",
      listingId: listingId,
      code: err.code,
      name: err.name
    };
  }
}

// -----------------------------------------------------
// UPDATE LISTING BY ID
// -----------------------------------------------------
async function updateListing(listingId, updates) {
  try {
    const listingRef = listingsRef.doc(listingId);
    const listingDoc = await listingRef.get();
    
    if (!listingDoc.exists) {
      console.error(`❌ Listing ${listingId} not found for update`);
      return { success: false, error: "Listing not found" };
    }
    
    // Add updatedAt timestamp
    const updateData = {
      ...updates,
      updatedAt: Date.now()
    };
    
    await listingRef.update(updateData);
    console.log(`✅ Listing ${listingId} updated successfully`);
    return { success: true, listingId, updates: updateData };
  } catch (error) {
    console.error("❌ Error updating listing:", error);
    return { success: false, error: error.message || error };
  }
}

// -----------------------------------------------------
// SAVE LISTING TO USER FAVORITES/SAVED
// -----------------------------------------------------
async function saveSavedListing(userId, listingId) {
  try {
    // Use a composite ID for uniqueness and easy lookup/deletion
    const docId = `${String(userId)}_${String(listingId)}`;
    
    const data = {
      userId,
      listingId,
      savedAt: admin.firestore.Timestamp.now()
    };
    await savedRef.doc(docId).set(data, { merge: true });
    return { success: true };
  } catch (err) {
    console.error("🔥 Error saving listing to favorites:", err);
    return { success: false, error: err.message };
  }
}

// -----------------------------------------------------
// REMOVE SAVED LISTING FROM USER FAVORITES
// -----------------------------------------------------
async function removeSavedListing(userId, listingId) {
  try {
    // Use the same composite ID format for lookup
    const docId = `${String(userId)}_${String(listingId)}`;
    
    const savedDoc = await savedRef.doc(docId).get();
    
    if (!savedDoc.exists) {
      console.log(`⚠️ Saved listing ${docId} not found for removal`);
      return { success: false, error: "Saved listing not found" };
    }
    
    await savedRef.doc(docId).delete();
    console.log(`✅ Saved listing ${docId} removed successfully`);
    return { success: true };
  } catch (err) {
    console.error("🔥 Error removing saved listing:", err);
    return { success: false, error: err.message };
  }
}

// -----------------------------------------------------
// GET USER'S SAVED LISTINGS - FIXED VERSION
// -----------------------------------------------------
async function getUserSavedListings(userId) {
  try {
    console.log(`🔍 [FIRESTORE] Getting saved listings for user: ${userId}`);
    
    // METHOD 1: Try the optimized query first
    try {
      const snapshot = await savedRef
        .where("userId", "==", userId)
        .orderBy("savedAt", "desc")
        .get();
      
      if (snapshot.empty) {
        console.log(`📭 [FIRESTORE] No saved listings found for user ${userId} (Method 1)`);
        return [];
      }
      
      console.log(`✅ [FIRESTORE] Found ${snapshot.docs.length} saved items using optimized query`);
      return await processSavedItems(snapshot);
      
    } catch (queryError) {
      // If the optimized query fails (likely due to missing index), use fallback
      console.log(`⚠️ [FIRESTORE] Optimized query failed, using fallback: ${queryError.message}`);
      
      // METHOD 2: Fallback - Get all documents and filter client-side
      const allSnapshot = await savedRef.get();
      const userSavedItems = [];
      
      allSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.userId === userId) {
          userSavedItems.push({
            savedId: doc.id,
            ...data
          });
        }
      });
      
      if (userSavedItems.length === 0) {
        console.log(`📭 [FIRESTORE] No saved listings found for user ${userId} (Method 2)`);
        return [];
      }
      
      console.log(`✅ [FIRESTORE] Found ${userSavedItems.length} saved items using fallback query`);
      
      // Sort manually by savedAt (newest first)
      userSavedItems.sort((a, b) => {
        const timeA = a.savedAt?.toDate?.().getTime() || 0;
        const timeB = b.savedAt?.toDate?.().getTime() || 0;
        return timeB - timeA; // Descending
      });
      
      return await processSavedItemsFromArray(userSavedItems);
    }
    
  } catch (err) {
    console.error("🔥 [FIRESTORE] Critical error in getUserSavedListings:", err);
    return [];
  }
}

// Helper function to process snapshot
async function processSavedItems(snapshot) {
  const savedItems = snapshot.docs.map(doc => ({
    savedId: doc.id,
    ...doc.data()
  }));
  
  const listingIds = savedItems.map(item => item.listingId).filter(id => id);
  
  if (listingIds.length === 0) {
    return [];
  }
  
  // Fetch all listings in parallel
  const listingPromises = listingIds.map(async (listingId, index) => {
    try {
      const listingDoc = await listingsRef.doc(listingId).get();
      if (listingDoc.exists) {
        const listingData = listingDoc.data();
        return {
          id: listingId,
          ...listingData,
          savedAt: savedItems[index]?.savedAt?.toDate?.() || null
        };
      }
      return null;
    } catch (error) {
      console.error(`Error fetching listing ${listingId}:`, error);
      return null;
    }
  });
  
  const listings = await Promise.all(listingPromises);
  return listings.filter(listing => listing !== null);
}

// Helper function to process array of saved items
async function processSavedItemsFromArray(savedItems) {
  const listingIds = savedItems.map(item => item.listingId).filter(id => id);
  
  if (listingIds.length === 0) {
    return [];
  }
  
  // Fetch all listings in parallel
  const listingPromises = listingIds.map(async (listingId, index) => {
    try {
      const listingDoc = await listingsRef.doc(listingId).get();
      if (listingDoc.exists) {
        const listingData = listingDoc.data();
        return {
          id: listingId,
          ...listingData,
          savedAt: savedItems[index]?.savedAt?.toDate?.() || null
        };
      }
      return null;
    } catch (error) {
      console.error(`Error fetching listing ${listingId}:`, error);
      return null;
    }
  });
  
  const listings = await Promise.all(listingPromises);
  return listings.filter(listing => listing !== null);
}

// -----------------------------------------------------
// CHECK IF LISTING IS ALREADY SAVED BY USER
// -----------------------------------------------------
async function isListingSaved(userId, listingId) {
  try {
    const docId = `${String(userId)}_${String(listingId)}`;
    const savedDoc = await savedRef.doc(docId).get();
    return savedDoc.exists;
  } catch (err) {
    console.error("🔥 Error checking if listing is saved:", err);
    return false;
  }
}

// -----------------------------------------------------
// GET SAVED COUNT FOR A LISTING
// -----------------------------------------------------
async function getSavedCount(listingId) {
  try {
    const snapshot = await savedRef.where("listingId", "==", listingId).get();
    return snapshot.size;
  } catch (err) {
    console.error("🔥 Error getting saved count:", err);
    return 0;
  }
}

// -----------------------------------------------------
// USER PROFILE & LANGUAGE
// -----------------------------------------------------
async function getUserProfile(userId) {
  try {
    const doc = await usersRef.doc(userId).get();
    return doc.exists ? doc.data() : null;
  } catch (err) {
    console.error("🔥 Error fetching user profile:", err);
    return null;
  }
}

async function saveUserLanguage(userId, lang) {
  try {
    await usersRef.doc(userId).set({ 
      preferredLanguage: lang,
      lastUpdated: Date.now()
    }, { merge: true });
    return true;
  } catch (err) {
    console.error("🔥 Error saving user language:", err);
    return false;
  }
}

// -----------------------------------------------------
// UPDATE USER PROFILE WITH SAVED LISTINGS (LEGACY SUPPORT)
// -----------------------------------------------------
async function saveListingToUser(userId, listingId) {
  try {
    // This is for backward compatibility with the earlier implementation
    return await saveSavedListing(userId, listingId);
  } catch (err) {
    console.error("🔥 Error in saveListingToUser:", err);
    return { success: false, error: err.message };
  }
}

// -----------------------------------------------------
// SEARCH SERVICE PROVIDERS (LEGACY COMPATIBILITY)
// -----------------------------------------------------
async function searchServiceProviders(serviceType, location) {
  try {
    console.log(`🔍 [LEGACY] Searching for ${serviceType} in ${location}`);
    
    // Use the new urban help search function
    return await searchUrbanHelp(serviceType, location);
    
  } catch (error) {
    console.error('❌ [LEGACY] Error searching service providers:', error);
    return [];
  }
}

// -----------------------------------------------------
// SEARCH COMMODITIES (LEGACY COMPATIBILITY)
// -----------------------------------------------------
async function searchCommodities(item, quantity) {
  try {
    console.log(`🔍 [LEGACY] Searching for ${quantity} of ${item}`);
    
    // Return mock data for backward compatibility
    return [
      {
        item: item || 'Steel',
        quantity: quantity || '10 tons available',
        price: 65000,
        seller: 'Reliable Suppliers',
        location: 'Delhi',
        contact: '+91 98765 43213',
        quality: 'A-Grade'
      }
    ];
    
  } catch (error) {
    console.error('❌ [LEGACY] Error searching commodities:', error);
    return [];
  }
}

// Export all functions
module.exports = {
  db,
  admin,
  // ✅ ADDED: Urban Services Functions
  searchUrbanServices,
  // Urban Help Functions
  searchUrbanHelp,
  addUrbanHelpProvider,
  getProviderById,
  updateProviderAvailability,
  addUserRequest,
  getUserPendingRequests,
  updateRequestStatus,
  // Property Listing Functions
  addListing,
  getAllListings,
  getTopListings,
  getUserListings,
  getListingById,
  saveSavedListing,
  saveListingToUser, // For backward compatibility
  removeSavedListing,
  getUserSavedListings,
  isListingSaved,
  getSavedCount,
  deleteListing,
  updateListing,
  searchListingsByCriteria,
  // User Functions
  getUserProfile,
  saveUserLanguage,
  // Legacy Functions for Backward Compatibility
  searchServiceProviders,
  searchCommodities
};