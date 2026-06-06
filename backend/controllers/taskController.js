const mongoose = require('mongoose');
const Task = require('../models/Task');

// ─── Helper ───────────────────────────────────────────────────────────────────

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// ─── Controllers ─────────────────────────────────────────────────────────────

// @desc    Create a new task
//          Auto-assigns status = 'Todo' and calculates position at bottom
// @route   POST /api/tasks
// @access  Private
const createTask = async (req, res, next) => {
  try {
    // Accept both 'board' and 'boardId' from frontend
    const { title, description, priority, dueDate, status, board, boardId } = req.body;
    const boardRef = board || boardId;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Task title is required' });
    }

    if (!boardRef || !isValidObjectId(boardRef)) {
      return res.status(400).json({ message: 'A valid board ObjectId is required' });
    }

    const taskStatus = status || 'Todo';

    // Count existing tasks in target column to determine position
    const colCount = await Task.countDocuments({ board: boardRef, status: taskStatus });

    const task = await Task.create({
      title: title.trim(),
      description: description || '',
      priority: priority || 'Medium',
      dueDate: dueDate || null,
      assignedTo: null,
      status: taskStatus,
      position: colCount,
      board: boardRef,
    });

    if (req.io) {
      req.io.to(boardRef.toString()).emit('task_created', task);
    }

    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all tasks (filterable by board and/or status)
// @route   GET /api/tasks?board=<id>&status=<status>
// @access  Private
const getAllTasks = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.board) {
      if (!isValidObjectId(req.query.board)) {
        return res.status(400).json({ message: 'Invalid board ID in query' });
      }
      filter.board = req.query.board;
    }
    if (req.query.status) filter.status = req.query.status;

    const tasks = await Task.find(filter)
      .sort({ status: 1, position: 1 });

    res.status(200).json(tasks);
  } catch (error) {
    next(error);
  }
};

// @desc    Get single task by ID
// @route   GET /api/tasks/:id
// @access  Private
const getTaskById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid task ID' });
    }

    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.status(200).json(task);
  } catch (error) {
    next(error);
  }
};

// @desc    Update task details (title, description, priority, status, position, etc.)
// @route   PUT /api/tasks/:id
// @access  Private
const updateTask = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid task ID' });
    }

    // Guard: do not allow board field to be changed via update
    const { board, ...allowedUpdates } = req.body;

    if (allowedUpdates.assignedTo && !isValidObjectId(allowedUpdates.assignedTo)) {
      return res.status(400).json({ message: 'Invalid assignedTo ObjectId' });
    }

    const task = await Task.findByIdAndUpdate(
      id,
      { $set: allowedUpdates },
      { new: true, runValidators: true }
    );

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (req.io) {
      req.io.to(task.board.toString()).emit('task_updated', task);
    }

    res.status(200).json(task);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a task
// @route   DELETE /api/tasks/:id
// @access  Private
const deleteTask = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid task ID' });
    }

    const task = await Task.findByIdAndDelete(id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (req.io) {
      req.io.to(task.board.toString()).emit('task_deleted', { taskId: id });
    }

    res.status(200).json({ message: 'Task deleted successfully', taskId: id });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTask,
  getAllTasks,
  getTaskById,
  updateTask,
  deleteTask,
};
