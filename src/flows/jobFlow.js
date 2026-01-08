// src/flows/jobFlow.js
// Handles job poster & seeker flows (posting parsing, request saving, matching & notify)

const { parseJobPost } = require('../../utils/jobParser');
const db = require('../../database/firestore');
const multiLanguage = require('../../utils/multiLanguage');
const { sendText } = require('../services/messageService');

module.exports = {
  handleJobPosting,
  handleJobSeekerStart,
  handleJobSeekerReply,
  formatJobResults
};

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
    // Initialize seeker context
    session.jobSeekerContext = {
      step: 'ask_role'
    };
    
    const promptMsg = multiLanguage.getMessage(userLang, 'job_prompt_role') || 
                      'What type of job are you looking for? (e.g., customer support, delivery driver, electrician)';
    
    try {
      await sendText(sender, promptMsg);
    } catch (sendErr) {
      console.warn('⚠️ [JOB SEEKER] Could not send first question:', sendErr && sendErr.message);
      // Continue anyway - message is stored in session
    }
    
    return session;
  } catch (err) {
    console.error('❌ [JOB SEEKER] Error in handleJobSeekerStart:', err);
    return session; // Return session even if there's an error
  }
}

async function handleJobSeekerReply(sender, text, session = {}, client = null) {
  const userLang = multiLanguage.getUserLanguage(sender) || 'en';
  session.jobSeekerContext = session.jobSeekerContext || { step: 'ask_role' };

  try {
    if (session.jobSeekerContext.step === 'ask_role') {
      session.jobSeekerContext.role = text;
      session.jobSeekerContext.step = 'ask_experience';
      
      const expMsg = multiLanguage.getMessage(userLang, 'job_prompt_experience') || 
                     'How much experience do you have? (e.g., 2 years, 6 months, no experience)';
      
      try {
        await sendText(sender, expMsg);
      } catch (sendErr) {
        console.warn('⚠️ [JOB SEEKER] Could not send experience question:', sendErr && sendErr.message);
      }
      
      await saveSessionIfAvailable(sender, session);
      return session;
    }

    if (session.jobSeekerContext.step === 'ask_experience') {
      try {
        const { parseJobPost } = require('../../utils/jobParser');
        const parsed = parseJobPost(`Experience: ${text}`);
        session.jobSeekerContext.experience = parsed.experience;
      } catch (parseErr) {
        console.warn('⚠️ [JOB SEEKER] Could not parse experience:', parseErr);
        session.jobSeekerContext.experience = { minMonths: null, raw: text, level: null };
      }
      
      session.jobSeekerContext.step = 'ask_location';
      
      const locMsg = multiLanguage.getMessage(userLang, 'job_prompt_location') || 
                     'Where are you looking for this job? (city or area)';
      
      try {
        await sendText(sender, locMsg);
      } catch (sendErr) {
        console.warn('⚠️ [JOB SEEKER] Could not send location question:', sendErr && sendErr.message);
      }
      
      await saveSessionIfAvailable(sender, session);
      return session;
    }

    if (session.jobSeekerContext.step === 'ask_location') {
      session.jobSeekerContext.location = text;

      // Persist job request
      const requestPayload = {
        desiredRole: session.jobSeekerContext.role || null,
        experience: session.jobSeekerContext.experience || null,
        location: session.jobSeekerContext.location || null,
        originalText: `${session.jobSeekerContext.role} ${session.jobSeekerContext.location}`
      };

      try {
        const addRes = await db.addJobRequest(sender, requestPayload);
        if (addRes && addRes.success) {
          const successMsg = multiLanguage.getMessage(userLang, 'job_request_saved') || 
                            '✅ Your job request has been saved. We will notify you when a match appears.';
          
          try {
            await sendText(sender, successMsg);
          } catch (sendErr) {
            console.warn('⚠️ [JOB SEEKER] Could not send success message:', sendErr && sendErr.message);
          }

          // Try searching immediately for existing matches
          try {
            const matches = await db.searchJobs({ role: session.jobSeekerContext.role, location: session.jobSeekerContext.location });
            if (matches && matches.length) {
              const msg = formatJobResults(matches, userLang);
              try {
                await sendText(sender, msg);
              } catch (sendErr) {
                console.warn('⚠️ [JOB SEEKER] Could not send search results:', sendErr && sendErr.message);
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

      // Clear seeker context
      session.jobSeekerContext = null;
      await saveSessionIfAvailable(sender, session);
      return session;
    }

    // Fallback - shouldn't reach here
    const notUnderstandMsg = multiLanguage.getMessage(userLang, 'not_understood') || 'I did not understand that.';
    try {
      await sendText(sender, notUnderstandMsg);
    } catch (sendErr) {
      console.warn('⚠️ [JOB SEEKER] Could not send fallback message:', sendErr && sendErr.message);
    }
    
    return session;
  } catch (err) {
    console.error('❌ [JOB SEEKER] Unexpected error in handleJobSeekerReply:', err);
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
