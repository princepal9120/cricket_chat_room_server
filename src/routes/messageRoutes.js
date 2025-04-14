const express = require('express');
const router = express.Router();
const { getMessages } = require('../controllers/messageController');
const { protect, requireInterest } = require('../middleware/authMiddleware');

// Get all messages
router.get('/', protect, requireInterest, getMessages);

module.exports = router;