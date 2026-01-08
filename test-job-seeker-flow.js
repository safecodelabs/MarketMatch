// Test job seeker flow with sample messages
const jobFlow = require('./src/flows/jobFlow');
const multiLanguage = require('./utils/multiLanguage');

// Initialize multiLanguage
multiLanguage.initialize();

async function testJobSeekerFlow() {
  console.log('\n========== TESTING JOB SEEKER FLOW ==========\n');

  // Simulate different job seeker messages
  const testMessages = [
    "looking for a customer support job",
    "I need a tech job",
    "I'm searching for employment",
    "mujhe job chahiye",
    "looking for team lead position"
  ];

  for (const msg of testMessages) {
    console.log(`\n📩 Message: "${msg}"`);
    
    let session = {};
    const sender = '919876543210';
    
    try {
      // First message - should trigger START
      console.log('   → Calling handleJobSeekerStart...');
      await jobFlow.handleJobSeekerStart(sender, session);
      console.log('   ✅ Started seeker flow');
      console.log('   Session state:', session.jobSeekerContext);
    } catch (err) {
      console.error('   ❌ Error in handleJobSeekerStart:', err.message);
    }

    // Simulate first reply (role)
    try {
      console.log('\n   → Simulating reply with role...');
      const roleReply = msg.match(/\b(customer support|tech|team lead)\b/i)?.[1] || 'customer support';
      session = await jobFlow.handleJobSeekerReply(sender, roleReply, session);
      console.log('   ✅ Role captured');
      console.log('   Session state:', session.jobSeekerContext);
    } catch (err) {
      console.error('   ❌ Error in handleJobSeekerReply (role):', err.message);
    }

    // Simulate second reply (experience)
    try {
      console.log('\n   → Simulating reply with experience...');
      session = await jobFlow.handleJobSeekerReply(sender, '2 years', session);
      console.log('   ✅ Experience captured');
      console.log('   Session state:', session.jobSeekerContext);
    } catch (err) {
      console.error('   ❌ Error in handleJobSeekerReply (experience):', err.message);
    }

    // Simulate third reply (location)
    try {
      console.log('\n   → Simulating reply with location...');
      session = await jobFlow.handleJobSeekerReply(sender, 'Mumbai', session);
      console.log('   ✅ Job request saved');
      console.log('   Session state:', session.jobSeekerContext);
    } catch (err) {
      console.error('   ❌ Error in handleJobSeekerReply (location):', err.message);
    }
  }

  console.log('\n========== TEST COMPLETE ==========\n');
}

testJobSeekerFlow().catch(console.error);
