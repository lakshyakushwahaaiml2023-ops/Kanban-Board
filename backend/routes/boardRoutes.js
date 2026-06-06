const express = require('express');
const router = express.Router();

const {
  createBoard,
  inviteMember,
  getBoardById,
  getAllBoards,
  updateBoard,
  deleteBoard,
} = require('../controllers/boardController');

const { protect } = require('../middleware/authMiddleware');

// Protect all board routes
router.use(protect);

// POST   /api/boards       → create a board
// GET    /api/boards       → get all boards
router.route('/').post(createBoard).get(getAllBoards);

// POST   /api/boards/:id/invite  → add a member to a board
router.post('/:id/invite', inviteMember);

// GET    /api/boards/:id   → get board + all its tasks
// PUT    /api/boards/:id   → update board
// DELETE /api/boards/:id   → delete board (cascades tasks)
router.route('/:id').get(getBoardById).put(updateBoard).delete(deleteBoard);

module.exports = router;
