const flowSteps = {
  chooseService: {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: 'How can I help you today? Please choose one of the options below.',
      },
      action: {
        buttons: [
          {
            type: 'reply',
            reply: { id: 'housing', title: '🏠 Housing' },
          },
          {
            type: 'reply',
            reply: { id: 'jobs', title: '💼 Jobs' },
          },
          { type: 'reply', reply: { id: 'leads', title: '📈 Leads' } },
        ],
      },
    },
  },
};

module.exports = { flowSteps };