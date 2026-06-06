import { create } from 'zustand';

export const useBoardStore = create((set, get) => ({
  board: null,
  tasks: [],
  onlineMembers: [],
  socket: null,
  activeTaskId: null,
  typingUsers: {}, // { [taskId]: { [userId]: userName } }

  setBoard: (board) => set({ board }),
  setTasks: (tasks) => set({ tasks: tasks.sort((a, b) => a.position - b.position) }),
  setOnlineMembers: (onlineMembers) => set({ onlineMembers }),
  setSocket: (socket) => set({ socket }),
  setActiveTaskId: (activeTaskId) => set({ activeTaskId }),

  // Add or update typing status
  setTypingStatus: (taskId, userId, userName, isTyping) => {
    set((state) => {
      const typingUsers = { ...state.typingUsers };
      if (!typingUsers[taskId]) {
        typingUsers[taskId] = {};
      }
      if (isTyping) {
        typingUsers[taskId][userId] = userName;
      } else {
        delete typingUsers[taskId][userId];
        if (Object.keys(typingUsers[taskId]).length === 0) {
          delete typingUsers[taskId];
        }
      }
      return { typingUsers };
    });
  },

  // Locally move a task (optimistic update)
  moveTaskLocal: (taskId, newStatus, newPosition) => {
    const { tasks } = get();
    const taskIndex = tasks.findIndex(t => t._id === taskId);
    if (taskIndex === -1) return;

    const updatedTasks = [...tasks];
    const [movedTask] = updatedTasks.splice(taskIndex, 1);
    movedTask.status = newStatus;

    // Insert at the proposed index within the matching status column
    const inColumn = updatedTasks.filter(t => t.status === newStatus);
    inColumn.splice(newPosition, 0, movedTask);

    // Re-calculate positions for this column to match order
    let positionCounter = 0;
    const reorderedTasks = updatedTasks.map(task => {
      if (task.status === newStatus) {
        return { ...task, position: positionCounter++ };
      }
      return task;
    });

    set({ tasks: reorderedTasks.sort((a, b) => a.position - b.position) });
  },

  // Confirmed task updates from Socket/REST (handles sorting & version increment)
  updateTask: (updatedTask) => {
    set((state) => {
      const existingIndex = state.tasks.findIndex((t) => t._id === updatedTask._id);
      let newTasks = [...state.tasks];
      if (existingIndex > -1) {
        newTasks[existingIndex] = updatedTask;
      } else {
        newTasks.push(updatedTask);
      }
      return { tasks: newTasks.sort((a, b) => a.position - b.position) };
    });
  },

  removeTask: (taskId) => {
    set((state) => ({
      tasks: state.tasks.filter((t) => t._id !== taskId)
    }));
  }
}));
