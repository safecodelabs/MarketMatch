const greetingFlow = async (userId, sendMessage) => {
  const greetingText = `👋 Hi there! Welcome to MarketMatch AI.

MarketMatch is a WhatsApp-powered local marketplace for buying, selling, and sharing services — trusted by your community, built by SafeCode💡`;

  await sendMessage(userId, greetingText);
};

module.exports = greetingFlow;
