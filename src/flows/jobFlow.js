// src/flows/jobFlow.js
// Intelligent job seeker & poster flows with pure intent-based extraction

const { parseJobPost, normalizeRole } = require('../../utils/jobParser');
const db = require('../../database/firestore');
const multiLanguage = require('../../utils/multiLanguage');
const { sendText } = require('../services/messageService');

module.exports = {
  handleJobPosting,
  handleJobSeekerStart,
  handleJobSeekerReply,
  formatJobResults,
  extractJobSeekerInfo
};

// ======================================================
// INTELLIGENT INFORMATION EXTRACTION
// ======================================================

// ======================================================
// INTELLIGENT NLP-BASED INFORMATION EXTRACTION
// ======================================================

/**
 * Extract job, location, and experience with fallback strategies
 * Uses context-aware extraction and intelligent fallbacks
 */
function extractJobSeekerInfo(text, previousContext = {}) {
  if (!text || typeof text !== 'string') {
    return { role: null, location: null, experience: null, extracted: false, confidence: 0 };
  }

  const lower = text.toLowerCase();
  let role = null;
  let location = null;
  let experience = null;
  let confidence = 0;
  const debugLog = [];

  // ===== STEP 1: PRIMARY JOB KEYWORD EXTRACTION =====
  const jobKeywords = [
    { terms: ['customer support', 'customer care', 'support executive', 'call center'], role: 'customer_support' },
    { terms: ['backend engineer', 'backend developer', 'backend dev'], role: 'backend_developer' },
    { terms: ['frontend engineer', 'frontend developer', 'frontend dev'], role: 'frontend_developer' },
    { terms: ['full stack developer', 'full stack'], role: 'fullstack_developer' },
    { terms: ['developer', 'engineer', 'programmer'], role: 'developer' },
    { terms: ['delivery driver', 'delivery boy', 'delivery'], role: 'delivery_driver' },
    { terms: ['driver', 'cab driver', 'taxi driver'], role: 'driver' },
    { terms: ['team lead', 'team leader', 'lead engineer'], role: 'team_lead' },
    { terms: ['electrician'], role: 'electrician' },
    { terms: ['plumber'], role: 'plumber' },
    { terms: ['carpenter'], role: 'carpenter' },
    { terms: ['painter'], role: 'painter' },
    { terms: ['maid', 'househelp', 'domestic help', 'housekeeping'], role: 'maid' },
    { terms: ['cook', 'chef'], role: 'cook' },
    { terms: ['cleaner', 'cleaning'], role: 'cleaner' },
    { terms: ['sales executive', 'sales', 'salesman'], role: 'sales' },
    { terms: ['telecaller', 'telemarketer'], role: 'telecaller' },
    { terms: ['bpo', 'bpo executive'], role: 'bpo' },
    { terms: ['data analyst', 'analyst'], role: 'data_analyst' },
    { terms: ['accountant', 'accounting'], role: 'accountant' },
    { terms: ['content writer', 'writer'], role: 'content_writer' },
    { terms: ['seo', 'marketing', 'digital marketing'], role: 'marketing' },
    { terms: ['it support', 'helpdesk', 'tech support', 'support'], role: 'it_support' },
    { terms: ['manager', 'management'], role: 'manager' },
    { terms: ['supervisor', 'supervisory'], role: 'supervisor' },
    { terms: ['coordinator'], role: 'coordinator' },
    { terms: ['nurse', 'nursing', 'healthcare'], role: 'nurse' },
    { terms: ['teacher', 'trainer', 'teaching', 'education'], role: 'teacher' },
    { terms: ['designer', 'graphic design', 'ui/ux'], role: 'designer' }
  ];

  // Try exact matches first (highest confidence)
  for (const { terms, role: jobRole } of jobKeywords) {
    for (const term of terms) {
      if (lower.includes(term)) {
        role = jobRole;
        confidence = 0.95;
        debugLog.push(`✅ Matched primary keyword: "${term}"`);
        break;
      }
    }
    if (role) break;
  }

  // ===== STEP 2: FALLBACK - GENERIC JOB INTENT =====
  if (!role) {
    // User just said "looking for a job", "need work", etc - they want ANY job
    const genericJobPatterns = [
      /looking for.*job/i,
      /need.*job/i,
      /seeking.*job/i,
      /want.*job/i,
      /job search/i,
      /looking for.*work/i,
      /need.*work/i,
      /employment/i,
      /looking for.*position/i
    ];

    if (genericJobPatterns.some(p => p.test(lower))) {
      role = 'any_job'; // Special marker for generic job search
      confidence = 0.7;
      debugLog.push(`✅ Detected generic job search intent`);
    }
  }

  // ===== STEP 3: LOCATION EXTRACTION =====
  const locationKeywords = [
    'mumbai', 'bangalore', 'hyderabad', 'delhi', 'noida', 'gurgaon',
    'pune', 'chandigarh', 'ahmedabad', 'jaipur', 'lucknow',
    'kolkata', 'chennai', 'coimbatore', 'kochi', 'indore',
    'new delhi', 'delhi ncr', 'ncr',
    'work from home', 'wfh', 'remote', 'home',
    'anywhere', 'pan india', 'all india', 'india'
  ];

  for (const keyword of locationKeywords) {
    if (lower.includes(keyword)) {
      location = keyword === 'work from home' || keyword === 'wfh' || keyword === 'remote' ? 'remote' : keyword;
      confidence = Math.max(confidence, 0.9);
      debugLog.push(`✅ Found location: "${location}"`);
      break;
    }
  }

  // Try contextual location patterns
  if (!location) {
    const locationMatch = lower.match(/(?:in|at|from|near|around|location|place)\s+([a-z\s]{2,25})/i);
    if (locationMatch) {
      location = locationMatch[1].trim();
      confidence = Math.max(confidence, 0.8);
      debugLog.push(`✅ Extracted location pattern: "${location}"`);
    }
  }

  // ===== STEP 4: EXPERIENCE EXTRACTION =====
  // Match: "2 years", "6 months", "fresher", "1 year", "0 experience"
  let expMatch = text.match(/(\d+)\s*(?:years?|yrs?|yr|ys|months?|mos?|mo)/i);
  if (!expMatch) {
    expMatch = text.match(/fresher|entry.?level|no experience|new grad|0.*experience|beginner/i);
  }

  if (expMatch) {
    if (/fresher|entry.?level|no experience|new grad|0.*experience|beginner/i.test(expMatch[0])) {
      experience = { minMonths: 0, raw: 'fresher', level: 'entry' };
      confidence = Math.max(confidence, 0.95);
      debugLog.push(`✅ Detected: Fresher/No experience`);
    } else {
      const num = parseInt(expMatch[1]);
      const isMo = /months?|mos?|mo/i.test(expMatch[0]);
      const months = isMo ? num : (num * 12);
      experience = {
        minMonths: months,
        raw: expMatch[0],
        level: months < 12 ? 'entry' : (months <= 36 ? 'mid' : 'senior')
      };
      confidence = Math.max(confidence, 0.9);
      debugLog.push(`✅ Extracted experience: ${expMatch[0]} (${months} months)`);
    }
  }

  // ===== STEP 5: USE PREVIOUS CONTEXT =====
  // Merge with previous context if not overwritten
  if (previousContext.role && !role) {
    role = previousContext.role;
    debugLog.push(`📌 Using previous role: "${role}"`);
  }
  if (previousContext.location && !location) {
    location = previousContext.location;
    debugLog.push(`📌 Using previous location: "${location}"`);
  }
  if (previousContext.experience && !experience) {
    experience = previousContext.experience;
    debugLog.push(`📌 Using previous experience: ${experience.raw}`);
  }

  const hasExtracted = !!(role || location || experience);

  return {
    role,
    location,
    experience,
    extracted: hasExtracted,
    confidence,
    debugLog
  };
}

// ======================================================
// DETERMINE MISSING INFO WITH SMART PRIORITIZATION
// ======================================================

/**
 * Check what info is missing, prioritize by importance
 * Generic job searches should ask for specifics (role first)
 */
function getMissingInfo(context) {
  const missing = [];
  
  // If they said "any_job", they MUST specify a role
  if (context.role === 'any_job' || !context.role) {
    missing.push('role'); // Always ask role first
  }
  
  // Then ask for location
  if (!context.location) {
    missing.push('location');
  }
  
  // Then ask for experience
  if (context.experience === null || context.experience === undefined) {
    missing.push('experience');
  }
  
  return missing;
}

// ======================================================
// GENERATE SMART CLARIFICATION QUESTIONS
// ======================================================

/**
 * Generate contextual questions based on what's missing
 * Asks for ONE piece of information at a time
 */
function getNextQuestion(missingInfo, userLang, context = {}) {
  if (!missingInfo || missingInfo.length === 0) return null;

  const nextField = missingInfo[0];

  switch (nextField) {
    case 'role':
      // If we know they need a role clarification (intent marker) or role confidence is low, ask for specifics
      if (context && (context.needsRoleClarity || context.role === 'any_job' || (context.roleConf && context.roleConf < 0.5) || (context.roleConfidence && context.roleConfidence < 0.5))) {
        return multiLanguage.getMessage(userLang, 'job_clarify_role') || 
               '🔍 Great! What type of job? (e.g., customer support, developer, driver, electrician, maid)';
      }
      return multiLanguage.getMessage(userLang, 'job_prompt_role') || 
             '🔍 What type of job are you looking for? (e.g., customer support, developer, driver)';
    
    case 'location':
      return multiLanguage.getMessage(userLang, 'job_prompt_location') || 
             '📍 Where are you looking for this job? (e.g., Mumbai, Bangalore, Delhi, or remote)';
    
    case 'experience':
      return multiLanguage.getMessage(userLang, 'job_prompt_experience') || 
             '📊 How much experience do you have? (e.g., 2 years, 6 months, fresher)';
    
    default:
      return null;
  }
}

async function handleJobPosting(sender, text, session = {}, client = null) {
  try {
    const parsed = parseJobPost(text);

    // Save job post to DB
    const addResult = await db.addJobPost(sender, parsed);
    if (!addResult || !addResult.success) {
      await sendText(sender, "Sorry, I couldn't save your job post. Please try again later.");
      return { success: false, error: addResult && addResult.error };
    }

    const jobId = addResult.id;
    try {
      await sendText(sender, `✅ Your job has been posted. Job ID: ${jobId}`);
    } catch (err) {
      console.warn('⚠️ [JOBS] Could not send confirmation message to poster:', err && err.message || err);
    }

    // Notify pending job seekers who match
    try {
      const pending = await db.getPendingJobRequests(7);
      const notifiedUsers = new Set();

      for (const req of pending) {
        try {
              // Simple matching heuristics
          let matches = true;

          // Build a combined job text string to check for matches
          const jobText = ((parsed.title || '') + ' ' + (parsed.role || '') + ' ' + (parsed.rawText || '') + ' ' + (parsed.normalizedRole || '')).toLowerCase();

          // Match role using multiple strategies: exact includes, token overlap, normalized role equality
          if (req.desiredRole) {
            const rawQ = (req.desiredRole || '').toString();
            const q = rawQ.toLowerCase();
            const qProcessed = q.replace(/[_-]/g, ' ');
            const qNorm = normalizeRole(qProcessed) || qProcessed;

            const tokens = qProcessed.split(/\s+/).filter(Boolean);
            const tokenMatch = tokens.some(tok => jobText.includes(tok));
            const includesMatch = jobText.includes(qProcessed) || qProcessed.includes(jobText);
            const normMatch = (parsed.normalizedRole && qNorm && (parsed.normalizedRole.toLowerCase() === qNorm.toLowerCase()));

            if (!(tokenMatch || includesMatch || normMatch)) {
              matches = false;
            } else {
              console.log(`✅ [JOBS] Role match for request ${req.id} (user ${req.userId}): query="${rawQ}" matched against jobText`);
            }
          }

          // Match location if specified
          if (req.location && parsed.location) {
            if (!parsed.location.toLowerCase().includes(req.location.toLowerCase())) matches = false;
          }

          // Match experience: req.experience.minMonths is user's months of experience
          if (req.experience && req.experience.minMonths !== null && parsed.experience && parsed.experience.minMonths !== null) {
            // User experience must be >= job minMonths
            if (req.experience.minMonths < parsed.experience.minMonths) matches = false;
          }

          if (!matches) {
            console.log(`🔎 [JOBS] Request ${req.id} (user ${req.userId}) did not match. Query: "${req.desiredRole}" | jobText contains: "${((parsed.title||'') + ' ' + (parsed.role||'') + ' ' + (parsed.rawText||'')).slice(0,140)}"`);
            continue;
          }

          if (notifiedUsers.has(req.userId)) continue;

          // Get user language if available
          const userLang = multiLanguage.getUserLanguage(req.userId) || 'en';

          const message = multiLanguage.getMessage(userLang, 'new_job_available', {
            title: parsed.title || parsed.role || 'Job',
            location: parsed.location || 'your area',
            category: parsed.normalizedRole || parsed.role || 'Job',
            contact: parsed.contact || 'Contact not available'
          });

          try {
            // Attempt to send notification. Only mark a request as matched AFTER a successful send.
            await sendText(req.userId, message);

            // Update request to matched (after successful send)
            await db.updateJobRequestStatus(req.id, 'matched', [jobId]);

            notifiedUsers.add(req.userId);
            console.log(`📣 Notified job seeker ${req.userId} about job ${jobId}`);

          } catch (err) {
            console.warn('⚠️ [JOBS] Could not notify request:', err);

            // Record the failure for retry & observability
            try {
              await db.recordNotificationFailure(req.id, jobId, {
                message: err.message || '',
                status: err.status || (err.apiData && err.apiData.error && err.apiData.error.code ? 401 : null),
                apiData: err.apiData || null
              });
            } catch (recErr) {
              console.error('❌ [JOBS] Failed recording notification failure:', recErr);
            }

            // If this is an auth error, surface a clear log so ops can fix token/config
            if (err.status === 401 || (err.apiData && err.apiData.error && err.apiData.error.code === 190)) {
              console.error('❌ [JOBS] Authentication error sending message (401). Notifications will be retried when token is fixed.');
            }

            continue;
          }
        } catch (err) {
          console.warn('⚠️ [JOBS] Could not notify request (outer):', err);
        }
      }
    } catch (notifyErr) {
      console.warn('⚠️ [JOBS] Error while notifying job requests:', notifyErr);
    }

    return { success: true, id: jobId };
  } catch (error) {
    console.error('❌ [JOBS] Error handling job posting:', error);
    return { success: false, error: error.message };
  }
}

async function handleJobSeekerStart(sender, session = {}, client = null) {
  const userLang = multiLanguage.getUserLanguage(sender) || 'en';
  try {
    // Initialize seeker context with all required fields
    session.jobSeekerContext = {
      step: 'collecting_info',
      role: null,
      location: null,
      experience: null,
      attemptCount: 0
    };
    
    // Start by asking for the job type
    const promptMsg = multiLanguage.getMessage(userLang, 'job_prompt_role') || 
                      '🔍 What type of job are you looking for? (e.g., customer support, developer, driver)';
    
    try {
      await sendText(sender, promptMsg);
    } catch (sendErr) {
      console.warn('⚠️ [JOB SEEKER] Could not send first question:', sendErr && sendErr.message);
    }
    
    return session;
  } catch (err) {
    console.error('❌ [JOB SEEKER] Error in handleJobSeekerStart:', err);
    return session;
  }
}

async function handleJobSeekerReply(sender, text, session = {}, client = null) {
  const userLang = multiLanguage.getUserLanguage(sender) || 'en';
  
  try {
    // Ensure context exists
    if (!session.jobSeekerContext || session.jobSeekerContext.step !== 'collecting_info') {
      session.jobSeekerContext = {
        step: 'collecting_info',
        role: null,
        location: null,
        experience: null,
        attemptCount: 0
      };
    }

    console.log(`🔍 [JOB SEEKER] Received: "${text}"`);
    console.log(`🔍 [JOB SEEKER] Current context before extraction:`, session.jobSeekerContext);

    // ===== EXTRACT ALL AVAILABLE INFORMATION FROM USER'S MESSAGE =====
    const extracted = extractJobSeekerInfo(text);
    console.log(`🔍 [JOB SEEKER] Extracted info:`, extracted);

    // ===== MERGE EXTRACTED INFO INTO SESSION =====
    if (extracted.role) {
      session.jobSeekerContext.role = extracted.role;
      console.log(`✅ [JOB SEEKER] Role extracted: "${extracted.role}"`);
    }

    if (extracted.location) {
      session.jobSeekerContext.location = extracted.location;
      console.log(`✅ [JOB SEEKER] Location extracted: "${extracted.location}"`);
    }

    if (extracted.experience) {
      session.jobSeekerContext.experience = extracted.experience;
      console.log(`✅ [JOB SEEKER] Experience extracted:`, extracted.experience);
    }

    // ===== INTELLIGENT FALLBACK: Handle when extraction finds nothing =====
    if (!extracted.extracted) {
      console.log(`⚠️ [JOB SEEKER] No structured data extracted. Analyzing intent...`);
      
      // Check if this was ONLY an intent marker ("looking for a job", "i need work", etc)
      const isOnlyIntentMarker = /^\s*(looking for|i need|i want|searching|seeking)(\s+a\s+)?(job|work|employment|position)?\s*$/i.test(text.trim());
      
      if (isOnlyIntentMarker) {
        console.log(`⚠️ [JOB SEEKER] User expressed INTENT but gave NO specific role. Need clarification.`);
        session.jobSeekerContext.needsRoleClarity = true;
        // Don't save anything - fall through to ask for role
      } else {
        // User provided SOMETHING but we didn't understand it
        // Could be: typo, new job type, or poorly formatted
        console.log(`⚠️ [JOB SEEKER] Unrecognized input: "${text}". Keeping as-is for now.`);
        if (!session.jobSeekerContext.role) {
          session.jobSeekerContext.role = text; // Save for later analysis
          session.jobSeekerContext.roleConfidence = 0.3; // LOW confidence
        }
      }
    }

    // ===== DETERMINE MISSING INFORMATION =====
    const missing = getMissingInfo(session.jobSeekerContext);
    console.log(`📋 [JOB SEEKER] Missing info:`, missing);
    console.log(`📋 [JOB SEEKER] Current context after extraction:`, session.jobSeekerContext);

    // ===== ALL INFORMATION COLLECTED: SAVE AND COMPLETE =====
    if (missing.length === 0) {
      console.log(`✅ [JOB SEEKER] All information collected! Saving job request...`);

      const requestPayload = {
        desiredRole: session.jobSeekerContext.role || null,
        experience: session.jobSeekerContext.experience || null,
        location: session.jobSeekerContext.location || null,
        originalText: `${session.jobSeekerContext.role} in ${session.jobSeekerContext.location}`
      };

      try {
        const addRes = await db.addJobRequest(sender, requestPayload);
        if (addRes && addRes.success) {
          const successMsg = multiLanguage.getMessage(userLang, 'job_request_saved') || 
                            '✅ Your job request has been saved! We will notify you when a matching job appears.';
          
          try {
            await sendText(sender, successMsg);
          } catch (sendErr) {
            console.warn('⚠️ [JOB SEEKER] Could not send success message:', sendErr && sendErr.message);
          }

          // Try searching immediately for existing matches
          try {
            const matches = await db.searchJobs({ 
              role: session.jobSeekerContext.role, 
              location: session.jobSeekerContext.location 
            });
            
            if (matches && matches.length) {
              const msg = formatJobResults(matches, userLang);
              try {
                await sendText(sender, msg);
              } catch (sendErr) {
                console.warn('⚠️ [JOB SEEKER] Could not send matches:', sendErr && sendErr.message);
              }
            } else {
              const noMatchMsg = multiLanguage.getMessage(userLang, 'no_jobs_yet') || 
                                '📭 No jobs match your criteria yet. We\'ll notify you as soon as one appears!';
              try {
                await sendText(sender, noMatchMsg);
              } catch (sendErr) {
                console.warn('⚠️ [JOB SEEKER] Could not send no-match message:', sendErr && sendErr.message);
              }
            }
          } catch (searchErr) {
            console.warn('⚠️ [JOB SEEKER] Error searching for jobs:', searchErr);
          }
        } else {
          const errorMsg = multiLanguage.getMessage(userLang, 'job_request_error') || 
                          'Sorry, could not save your request. Please try again later.';
          
          try {
            await sendText(sender, errorMsg);
          } catch (sendErr) {
            console.warn('⚠️ [JOB SEEKER] Could not send error message:', sendErr && sendErr.message);
          }
        }
      } catch (err) {
        console.error('❌ [JOB SEEKER] Error saving job request:', err);
        
        const errorMsg = multiLanguage.getMessage(userLang, 'error_generic') || 
                        'Sorry, an error occurred. Please try again later.';
        
        try {
          await sendText(sender, errorMsg);
        } catch (sendErr) {
          console.warn('⚠️ [JOB SEEKER] Could not send error message:', sendErr && sendErr.message);
        }
      }

      // Clear seeker context - flow complete
      session.jobSeekerContext = null;
      await saveSessionIfAvailable(sender, session);
      return session;
    }

    // ===== ASK FOR MISSING INFORMATION =====
    const nextQuestion = getNextQuestion(missing, userLang, session.jobSeekerContext);
    
    if (nextQuestion) {
      console.log(`❓ [JOB SEEKER] Asking for missing: ${missing[0]}`);
      try {
        await sendText(sender, nextQuestion);
      } catch (sendErr) {
        console.warn(`⚠️ [JOB SEEKER] Could not send question for "${missing[0]}":`, sendErr && sendErr.message);
      }
    }

    // Save session with updated context
    await saveSessionIfAvailable(sender, session);
    return session;

  } catch (err) {
    console.error('❌ [JOB SEEKER] Unexpected error in handleJobSeekerReply:', err);
    
    const errorMsg = multiLanguage.getMessage(userLang, 'error_generic') || 
                    'Sorry, an error occurred. Please try again later.';
    
    try {
      await sendText(sender, errorMsg);
    } catch (sendErr) {
      console.warn('⚠️ [JOB SEEKER] Could not send error message:', sendErr && sendErr.message);
    }

    return session;
  }
}

function formatJobResults(results, userLang = 'en') {
  if (!results || !results.length) return multiLanguage.getMessage(userLang, 'no_results_found') || 'No jobs found.';
  let msg = `✅ Found ${results.length} job(s):\n\n`;
  results.slice(0, 5).forEach(r => {
    msg += `• ${r.title || (r.role || 'Job')} — ${r.location || 'Location not specified'}\n`;
  });
  return msg;
}

async function saveSessionIfAvailable(sender, session) {
  try {
    const { saveSession } = require('../../utils/sessionStore');
    if (typeof saveSession === 'function') await saveSession(sender, session);
  } catch (err) {
    // non-critical
  }
}
