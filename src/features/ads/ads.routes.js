const express = require('express');
const router = express.Router();
const { getAdInfo } = require('./ads.controller');

router.post('/ad-info', getAdInfo);

module.exports = router;
