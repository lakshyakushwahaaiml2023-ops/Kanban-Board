const express = require('express');
const router = express.Router();
const { handleChat } = require('../controllers/aiController');

const { protect } = require('../middleware/authMiddleware');

router.use(protect);

// Route: POST /api/ai/chat
router.post('/chat', handleChat);

module.exports = router;
