const mongoose = require('mongoose');
const Board = require('../models/Board');
const Task = require('../models/Task');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// @desc    Create a new board
// @route   POST /api/boards
const createBoard = async (req, res, next) => {
  try {
    const { name, title, createdBy } = req.body;
    const boardName = name || title;

    if (!boardName || !boardName.trim()) {
      return res.status(400).json({ message: 'Board name is required' });
    }

    const board = await Board.create({
      name: boardName.trim(),
      createdBy: createdBy || 'anonymous',
      members: [],
    });

    res.status(201).json(board);
  } catch (error) {
    next(error);
  }
};

// @desc    Add a member to a board
// @route   POST /api/boards/:id/invite
const inviteMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { memberId } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid board ID' });
    }
    if (!memberId) {
      return res.status(400).json({ message: 'memberId is required' });
    }

    const board = await Board.findById(id);
    if (!board) return res.status(404).json({ message: 'Board not found' });

    if (board.members.includes(memberId)) {
      return res.status(409).json({ message: 'User is already a member' });
    }

    board.members.push(memberId);
    await board.save();

    res.status(200).json({ message: 'Member added successfully', members: board.members });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single board with all its tasks
// @route   GET /api/boards/:id
const getBoardById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid board ID' });
    }

    const board = await Board.findById(id).lean();
    if (!board) return res.status(404).json({ message: 'Board not found' });

    const tasks = await Task.find({ board: id })
      .sort({ status: 1, position: 1 })
      .lean();

    board.tasks = tasks;
    res.status(200).json(board);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all boards
// @route   GET /api/boards
const getAllBoards = async (req, res, next) => {
  try {
    const boards = await Board.find().sort({ createdAt: -1 }).lean();
    res.status(200).json(boards);
  } catch (error) {
    next(error);
  }
};

// @desc    Update a board
// @route   PUT /api/boards/:id
const updateBoard = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid board ID' });
    }
    const board = await Board.findByIdAndUpdate(id, { $set: req.body }, { new: true, runValidators: true });
    if (!board) return res.status(404).json({ message: 'Board not found' });
    res.status(200).json(board);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a board and its tasks
// @route   DELETE /api/boards/:id
const deleteBoard = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid board ID' });
    }
    const board = await Board.findByIdAndDelete(id);
    if (!board) return res.status(404).json({ message: 'Board not found' });
    await Task.deleteMany({ board: id });
    res.status(200).json({ message: 'Board and its tasks deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { createBoard, inviteMember, getBoardById, getAllBoards, updateBoard, deleteBoard };
