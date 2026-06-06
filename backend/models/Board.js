const mongoose = require('mongoose');

const boardSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Board name is required'],
      trim: true,
    },
    createdBy: {
      type: String,        // store as plain string (userId from frontend)
      default: 'anonymous',
    },
    members: [
      {
        type: String,      // plain string member IDs for dev simplicity
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Board = mongoose.model('Board', boardSchema);

module.exports = Board;
