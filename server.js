require('dotenv').config(); // Loads environment variables from a .env file
const express = require('express');

// Initialize the express app
const app = express();

// Use port from environment variables or default to 3000
const port = process.env.PORT || 3000;

// A simple route for the root URL
app.get('/', (req, res) => {
  res.send('Hello from the MarketMatchAI Bot server!');
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});