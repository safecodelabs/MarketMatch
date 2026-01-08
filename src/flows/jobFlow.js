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

/**
 * Extract job, location, and experience from user text
 * Returns: { role, location, experience, extracted }
 */
function extractJobSeekerInfo(text) {
  if (!text || typeof text !== 'string') {
    return { role: null, location: null, experience: null, extracted: false };
  }

  const lower = text.toLowerCase();
  let role = null;
  let location = null;
  let experience = null;

  // ===== EXTRACT JOB ROLE =====
  const jobKeywords = [
    'customer support', 'customer care', 'support executive',
    'backend engineer', 'backend developer', 'frontend engineer', 'frontend developer',
    'full stack developer', 'developer', 'engineer',
    'delivery driver', 'driver', 'cab driver',
    'team lead', 'team leader', 'lead',
    'electrician', 'plumber', 'carpenter', 'painter',
    'maid', 'househelp', 'cook', 'cleaner',
    'sales executive', 'telecaller', 'bpo',
    'data analyst', 'accountant', 'finance',
    'content writer', 'seo', 'marketing',
    'it support', 'helpdesk', 'tech support',
    'manager', 'supervisor', 'coordinator'
  ];

  for (const keyword of jobKeywords) {
    if (lower.includes(keyword)) {
      role = keyword;
      break; // Take the first match
    }
  }

  // ===== EXTRACT LOCATION =====
  const locationKeywords = [
    'mumbai', 'bangalore', 'hyderabad', 'delhi', 'noida', 'gurgaon',
    'pune', 'chandigarh', 'ahmedabad', 'jaipur', 'lucknow',
    'kolkata', 'chennai', 'coimbatore', 'kochi', 'indore',
    'new delhi', 'delhi ncr', 'ncr', 'delhi',
    'work from home', 'wfh', 'remote'
  ];

  for (const keyword of locationKeywords) {
    if (lower.includes(keyword)) {
      location = keyword;
      break;
    }
  }

  // Also try generic location extraction (after "in", "at", "from")
  if (!location) {
    const locationMatch = lower.match(/(?:in|at|from|near)\s+([a-z\s]{2,20})/i);
    if (locationMatch) {
      location = locationMatch[1].trim();
    }
  }

  // ===== EXTRACT EXPERIENCE =====
  // Try to parse experience (e.g., "2 years", "6 months", "fresher")
  const expMatch = text.match(/(\d+)\s*(?:years?|yrs?|months?|mos?)/i) || 
                   text.match(/fresher|no experience|0 experience/i);
  
  if (expMatch) {
    if (/fresher|no experience|0 experience/i.test(expMatch[0])) {
      experience = { minMonths: 0, raw: 'fresher', level: 'none' };
    } else {
      const num = parseInt(expMatch[1]);
      const isMo = /months?|mos?/i.test(expMatch[0]);
      const months = isMo ? num : (num * 12);
      experience = {
        minMonths: months,
        raw: expMatch[0],
        level: months <= 12 ? 'junior' : (months <= 36 ? 'mid' : 'senior')
      };
    }
  }

  const hasExtracted = !!(role || location || experience);
  
  return { role, location, experience, extracted: hasExtracted };
}

// ======================================================
// DETERMINE WHAT INFORMATION IS MISSING
// ======================================================

function getMissingInfo(context) {
  const missing = [];
  
  if (!context.role) missing.push('role');
  if (!context.location) missing.push('location');
  if (context.experience === null || context.experience === undefined) missing.push('experience');
  
  return missing;
}

// ======================================================
// GET NEXT QUESTION BASED ON MISSING INFO
// ======================================================

function getNextQuestion(missingInfo, userLang) {
  if (missingInfo.length === 0) return null;

  const nextField = missingInfo[0];

  switch (nextField) {
    case 'role':
      return multiLanguage.getMessage(userLang, 'job_prompt_role') || 
             '🔍 What type of job are you looking for? (e.g., customer support, developer, driver)';
    
    case 'location':
      return multiLanguage.getMessage(userLang, 'job_prompt_location') || 
             '📍 Where are you looking for this job? (city or area)';
    
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

          // Match role
          if (req.desiredRole) {
            const r1 = (req.desiredRole || '').toLowerCase();
            const r2 = (parsed.normalizedRole || parsed.role || '').toString().toLowerCase();
            if (r1 && r2 && !(r1.includes(r2) || r2.includes(r1))) matches = false;
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

          if (!matches) continue;

          if (notifiedUsers.has(req.userId)) continue;

          // Update request to matched
          await db.updateJobRequestStatus(req.id, 'matched', [jobId]);

          // Get user language if available
          const userLang = multiLanguage.getUserLanguage(req.userId) || 'en';

          const message = multiLanguage.getMessage(userLang, 'new_job_available', {
            title: parsed.title || parsed.role || 'Job',
            location: parsed.location || 'your area',
            category: parsed.normalizedRole || parsed.role || 'Job',
            contact: parsed.contact || 'Contact not available'
          });

          await sendText(req.userId, message);
          notifiedUsers.add(req.userId);
          console.log(`📣 Notified job seeker ${req.userId} about job ${jobId}`);
        } catch (err) {
          console.warn('⚠️ [JOBS] Could not notify request:', err);
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

    // If nothing was extracted, save the raw text as role
    if (!extracted.extracted && !session.jobSeekerContext.role) {
      session.jobSeekerContext.role = text;
      console.log(`✅ [JOB SEEKER] No structured data found, using text as role: "${text}"`);
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
    const nextQuestion = getNextQuestion(missing, userLang);
    
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
