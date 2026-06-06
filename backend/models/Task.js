const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    priority: {
      type: String,
      enum: {
        values: ['Low', 'Medium', 'High'],
        message: 'Priority must be Low, Medium, or High',
      },
      default: 'Medium',
    },
    dueDate: {
      type: Date,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: ['Todo', 'In Progress', 'Review', 'Done'],
        message: 'Status must be Todo, In Progress, Review, or Done',
      },
      default: 'Todo',
    },
    position: {
      type: Number,
      required: [true, 'Task position is required'],
      default: 0,
    },
    board: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Board',
      required: [true, 'Task must belong to a board'],
    },
    // Optimistic concurrency version — incremented on every write
    version: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient ordering within a board column
taskSchema.index({ board: 1, status: 1, position: 1 });

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;
