module.exports = async function greetingFlow(sender, sendMessage, options = {}) {
  const { newUser = false, fallback = false } = options;

  if (fallback) {
    await sendMessage("👋 Hey there! I didn’t quite get that. Are you looking to advertise or want to know what I can do?");
    return;
  }

  if (newUser) {
    await sendMessage("👋 Hi there! Welcome to MarketMatch AI. MarketMatch is a WhatsApp-powered local marketplace for buying, selling, and sharing services — trusted by your community, built by SafeCode💡");
    await sendMessage("💬 What can I do for you today?");
  } else {
    await sendMessage("👋 Hello again! How can I assist you?");
  }
};

