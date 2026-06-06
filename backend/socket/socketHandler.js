const Task = require('../models/Task');

/**
 * In-memory state per board room:
 *
 *   roomState[boardId] = {
 *     members: Map<socketId, { userId, userName }>,
 *     pendingMoves: Map<taskId, { version, timestamp, socketId }>
 *   }
 *
 * pendingMoves is the conflict-resolution window: if two move_task
 * events arrive for the same task within CONFLICT_WINDOW_MS, only
 * the one with the higher version (or later timestamp if equal) wins.
 */

const CONFLICT_WINDOW_MS = 300; // ms to wait before committing a move

const roomState = {};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRoom(boardId) {
  if (!roomState[boardId]) {
    roomState[boardId] = {
      members: new Map(),
      pendingMoves: new Map(),
    };
  }
  return roomState[boardId];
}

function cleanRoom(boardId) {
  const room = roomState[boardId];
  if (room && room.members.size === 0) {
    delete roomState[boardId];
  }
}

function broadcastMembers(io, boardId) {
  const room = roomState[boardId];
  if (!room) return;
  const members = Array.from(room.members.values());
  io.to(boardId).emit('online_members', { boardId, members });
}

// ─── Socket Handler ───────────────────────────────────────────────────────────

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ── join_board ────────────────────────────────────────────────────────────
    // Payload: { boardId, userId, userName }
    socket.on('join_board', ({ boardId, userId, userName }) => {
      if (!boardId) return;

      socket.join(boardId);
      socket.data.boardId = boardId;
      socket.data.userId  = userId;
      socket.data.userName = userName || 'Anonymous';

      const room = getRoom(boardId);
      room.members.set(socket.id, { socketId: socket.id, userId, userName: socket.data.userName });

      console.log(`👤 ${socket.data.userName} joined board [${boardId}]`);

      // Confirm join to the joiner
      socket.emit('joined_board', { boardId, userId, userName: socket.data.userName });

      // Broadcast updated member list to everyone in the room
      broadcastMembers(io, boardId);
    });

    // ── move_task ─────────────────────────────────────────────────────────────
    // Payload: { boardId, taskId, newStatus, newPosition, version, movedBy }
    //
    // Conflict resolution strategy (optimistic concurrency + timestamp window):
    //   1. Client sends the `version` it last saw for this task.
    //   2. Backend looks up the current task version in DB.
    //   3. If client version < DB version → reject (stale update).
    //   4. If two moves arrive within CONFLICT_WINDOW_MS, the one with the
    //      higher client version wins; ties go to the later timestamp.
    socket.on('move_task', async ({ boardId, taskId, newStatus, newPosition, version, movedBy }) => {
      try {
        if (!boardId || !taskId) return;

        const room = getRoom(boardId);

        // ── Conflict window check ──────────────────────────────────────────
        const existing = room.pendingMoves.get(taskId);
        const now = Date.now();

        if (existing && now - existing.timestamp < CONFLICT_WINDOW_MS) {
          // Another move arrived within the conflict window
          const incomingWins =
            version > existing.version ||
            (version === existing.version && now > existing.timestamp);

          if (!incomingWins) {
            // This move loses — notify the sender it was rejected
            socket.emit('move_rejected', {
              taskId,
              reason: 'Conflict: a more recent move is already being applied',
            });
            return;
          }
          // Incoming wins — cancel the existing pending move timer
          clearTimeout(existing.timer);
        }

        // ── Fetch current DB version ───────────────────────────────────────
        const currentTask = await Task.findById(taskId).select('version status position');
        if (!currentTask) {
          socket.emit('move_rejected', { taskId, reason: 'Task not found' });
          return;
        }

        if (version < currentTask.version) {
          socket.emit('move_rejected', {
            taskId,
            reason: `Stale update: your version (${version}) is behind the current version (${currentTask.version})`,
            currentVersion: currentTask.version,
          });
          return;
        }

        // ── Register pending move with a commit timer ──────────────────────
        const timer = setTimeout(async () => {
          try {
            const updated = await Task.findByIdAndUpdate(
              taskId,
              {
                $set:  { status: newStatus, position: newPosition },
                $inc:  { version: 1 },
              },
              { new: true, runValidators: true }
            );

            if (updated) {
              // Broadcast to everyone else in the room
              socket.to(boardId).emit('task_moved', {
                taskId,
                newStatus,
                newPosition,
                version: updated.version,
                movedBy,
              });

              // Confirm back to the sender
              socket.emit('move_confirmed', {
                taskId,
                newStatus,
                newPosition,
                version: updated.version,
              });

              console.log(`📦 Task [${taskId}] moved to ${newStatus}@${newPosition} by ${movedBy}`);
            }
          } catch (err) {
            console.error('move_task commit error:', err.message);
            socket.emit('move_rejected', { taskId, reason: 'Server error during commit' });
          } finally {
            room.pendingMoves.delete(taskId);
          }
        }, CONFLICT_WINDOW_MS);

        room.pendingMoves.set(taskId, { version, timestamp: now, socketId: socket.id, timer });

      } catch (err) {
        console.error('move_task error:', err.message);
        socket.emit('move_rejected', { taskId, reason: 'Unexpected server error' });
      }
    });

    // ── typing_indicator ──────────────────────────────────────────────────────
    // Payload: { boardId, taskId, userId, userName, isTyping }
    socket.on('typing_indicator', ({ boardId, taskId, userId, userName, isTyping }) => {
      if (!boardId) return;

      // Broadcast to everyone in the room EXCEPT the sender
      socket.to(boardId).emit('user_typing', {
        taskId,
        userId,
        userName: userName || socket.data.userName,
        isTyping,
      });
    });

    // ── disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      const { boardId, userName } = socket.data;
      console.log(`❌ Socket disconnected: ${socket.id} (${reason})`);

      if (boardId) {
        const room = roomState[boardId];
        if (room) {
          room.members.delete(socket.id);

          // Cancel any pending moves from this socket
          for (const [taskId, pending] of room.pendingMoves.entries()) {
            if (pending.socketId === socket.id) {
              clearTimeout(pending.timer);
              room.pendingMoves.delete(taskId);
            }
          }

          // Notify remaining members
          broadcastMembers(io, boardId);

          // Broadcast a typing_stopped for this user to clean up indicators
          socket.to(boardId).emit('user_typing', {
            taskId: null,
            userId: socket.data.userId,
            userName,
            isTyping: false,
          });

          cleanRoom(boardId);
        }
      }
    });
  });
}

module.exports = registerSocketHandlers;
