const express = require('express');
const router = express.Router();

const {
  createTask,
  getAllTasks,
  getTaskById,
  updateTask,
  deleteTask,
} = require('../controllers/taskController');

const { protect } = require('../middleware/authMiddleware');

// Protect all task routes
router.use(protect);

// POST   /api/tasks          → create a task
// GET    /api/tasks          → get all tasks (supports ?board=<id> & ?status=<status>)
router.route('/').post(createTask).get(getAllTasks);

// GET    /api/tasks/:id      → get single task
// PUT    /api/tasks/:id      → update task (details or drag-drop reorder)
// DELETE /api/tasks/:id      → delete task
router.route('/:id').get(getTaskById).put(updateTask).delete(deleteTask);

module.exports = router;
