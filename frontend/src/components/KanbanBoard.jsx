import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCorners, defaultDropAnimationSideEffects, useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { io } from 'socket.io-client';
import axios from 'axios';
import {
  Users, Plus, Trash2, Edit3, Clock, AlertCircle,
  CheckCircle2, Loader2, UserPlus, HelpCircle, GripVertical, X,
  MessageSquare, Activity, Send, ChevronRight,
} from 'lucide-react';
import AiAgentButton from './AiAgentButton';

const API  = 'http://localhost:5000/api';
const SOCK = 'http://localhost:5000';

// Axios token interceptor
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('kb_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const COLS = [
  { id: 'Todo',        label: 'To Do',       Icon: AlertCircle,  border: 'border-t-sky-500',     bg: 'bg-sky-500/5',     text: 'text-sky-400',     badge: 'bg-sky-500/10 text-sky-300' },
  { id: 'In Progress', label: 'In Progress',  Icon: Clock,        border: 'border-t-amber-500',   bg: 'bg-amber-500/5',   text: 'text-amber-400',   badge: 'bg-amber-500/10 text-amber-300' },
  { id: 'Review',      label: 'In Review',    Icon: HelpCircle,   border: 'border-t-indigo-400',  bg: 'bg-indigo-500/5',  text: 'text-indigo-400',  badge: 'bg-indigo-500/10 text-indigo-300' },
  { id: 'Done',        label: 'Completed',    Icon: CheckCircle2, border: 'border-t-emerald-500', bg: 'bg-emerald-500/5', text: 'text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-300' },
];

const PRI = {
  High:   'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  Medium: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  Low:    'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
};

// ── helpers ───────────────────────────────────────────────────────────────────
const boardName  = (b) => b?.name || b?.title || 'Untitled Board';
const colOfTask  = (tasks, id) => tasks.find(t => t._id === id)?.status ?? null;

const FALLBACK_MEMBERS = {
  '6659f1a2c8e4a2b3d4e5f6a1': 'Alice',
  '6659f1a2c8e4a2b3d4e5f6a2': 'Bob',
  '6659f1a2c8e4a2b3d4e5f6a3': 'Carol',
};

const getDueDateLabel = (dueDateStr) => {
  if (!dueDateStr) return null;
  const d = new Date(dueDateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const getDueDateStatus = (dueDateStr, status) => {
  if (!dueDateStr || status === 'Done') return 'normal';
  const d = new Date(dueDateStr);
  const now = new Date();
  
  const dZero = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nowZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const diffTime = dZero.getTime() - nowZero.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 3) return 'soon';
  return 'normal';
};

const getISODateOnly = (dateVal) => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
};

const findContainer = (id, tasksList) => {
  if (COLS.some(c => c.id === id)) return id;
  const task = tasksList.find(t => t._id === id);
  return task ? task.status : null;
};

function TaskCard({ task, onEdit, onDelete, typing = [], overlay = false, memberNames = {} }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task._id, data: { type: 'task', task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    touchAction: 'none'
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => {
        if (!overlay) onEdit(task);
      }}
      className={`group relative bg-slate-950/90 border rounded-xl p-4 shadow-sm transition-all duration-150 cursor-pointer
        ${overlay ? 'border-indigo-500/60 shadow-xl shadow-indigo-500/10 rotate-1 scale-105'
                  : 'border-slate-800 hover:border-slate-700'}
      `}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <div
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="p-1 -ml-1 text-slate-600 hover:text-slate-400 hover:bg-slate-800 rounded cursor-grab active:cursor-grabbing transition-colors shrink-0"
          >
            <GripVertical size={14} />
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${PRI[task.priority] || PRI.Medium}`}>
            {task.priority}
          </span>
        </div>
        {!overlay && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onEdit(task); }}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors">
              <Edit3 size={12} />
            </button>
            <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onDelete(task._id); }}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400 transition-colors">
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      <h4 className="font-semibold text-slate-100 text-sm leading-snug mb-1">{task.title}</h4>
      {task.description && (
        <p className="text-slate-500 text-xs line-clamp-2 mb-2 leading-relaxed">{task.description}</p>
      )}

      {/* Assignee & Due Date UI */}
      {(task.assignedTo || task.dueDate) && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2 mb-1">
          {task.assignedTo && (
            <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded-full flex items-center gap-1 select-none">
              👤 {memberNames[task.assignedTo] || 'Assignee'}
            </span>
          )}
          {task.dueDate && (() => {
            const dueStatus = getDueDateStatus(task.dueDate, task.status);
            const label = getDueDateLabel(task.dueDate);
            const cls = dueStatus === 'overdue' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : dueStatus === 'soon' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-slate-900/50 text-slate-400 border border-slate-800';
            return (
              <span className={`text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 select-none ${cls}`}>
                📅 {dueStatus === 'overdue' ? 'Overdue: ' : dueStatus === 'soon' ? 'Soon: ' : ''}{label}
              </span>
            );
          })()}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-slate-800/50 mt-1.5">
        <span className="text-[10px] text-slate-600 font-mono">v{task.version ?? 0}</span>
        {typing.length > 0 && (
          <span className="text-[10px] text-indigo-400 flex items-center gap-1 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
            {typing.slice(0, 2).join(', ')} typing…
          </span>
        )}
      </div>
    </div>
  );
}

// ── KanbanColumn ──────────────────────────────────────────────────────────────
function KanbanColumn({ col, tasks, onAdd, onEdit, onDelete, typingUsers, memberNames }) {
  const { setNodeRef } = useDroppable({ id: col.id });

  return (
    <div ref={setNodeRef} className={`flex flex-col rounded-2xl border border-slate-800/80 border-t-4 ${col.border} ${col.bg} min-h-[500px]`}>
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-800/40">
        <div className="flex items-center gap-2">
          <col.Icon size={14} className={col.text} />
          <h3 className="font-bold text-white text-sm">{col.label}</h3>
          <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${col.badge}`}>{tasks.length}</span>
        </div>
        <button onClick={() => onAdd(col.id)}
          className="text-slate-500 hover:text-white p-1 hover:bg-slate-800/80 rounded-lg transition-all">
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 p-3 flex flex-col gap-2.5 overflow-y-auto">
        <SortableContext items={tasks.map(t => t._id)} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <div className="flex-1 flex items-center justify-center border border-dashed border-slate-800/50 rounded-xl py-10">
              <p className="text-xs text-slate-700 italic select-none">Drop tasks here</p>
            </div>
          ) : tasks.map(task => (
            <TaskCard
              key={task._id}
              task={task}
              onEdit={onEdit}
              onDelete={onDelete}
              typing={Object.values(typingUsers[task._id] || {})}
              memberNames={memberNames}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
const inputCls = 'w-full bg-slate-950 border border-slate-800 text-white placeholder-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors">
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Wide two-panel modal for edit task
function WideModal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors">
            <X size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({ onCancel, label }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button type="button" onClick={onCancel}
        className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg px-4 py-2 text-sm transition-all">
        Cancel
      </button>
      <button type="submit"
        className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all">
        {label}
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function KanbanBoard({ onLogout }) {
  // ── state ─────────────────────────────────────────────────────────────────
  const [boardsList,    setBoardsList]    = useState([]);
  const [selectedId,    setSelectedId]    = useState('');
  const [board,         setBoard]         = useState(null);
  const [tasks,         setTasks]         = useState([]);
  const [memberNames,   setMemberNames]   = useState(FALLBACK_MEMBERS);
  const [onlineMembers, setOnlineMembers] = useState([]);
  const [typingUsers,   setTypingUsers]   = useState({});   // { [taskId]: { [userId]: userName } }
  const [loading,       setLoading]       = useState(false);
  const [activeTask,    setActiveTask]    = useState(null);
  const [dragStartCol,  setDragStartCol]  = useState(null);

  // Filter States
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterAssignee, setFilterAssignee] = useState('All');
  const [filterDueDate,  setFilterDueDate]  = useState('All');

  // Comment & modal tab state
  const [commentInput, setCommentInput] = useState('');
  const [modalTab,     setModalTab]     = useState('comments'); // 'comments' | 'activity'

  const [newBoardName, setNewBoardName] = useState('');
  const [addToCol,     setAddToCol]     = useState(null);   // column id
  const [editTask,     setEditTask]     = useState(null);
  const [newTask,      setNewTask]      = useState({ title: '', description: '', priority: 'Medium', dueDate: '', assignedTo: '' });

  // ── refs (for use inside socket/drag handlers without stale closures) ───────
  const socketRef   = useRef(null);
  const tasksRef    = useRef(tasks);
  const selectedRef = useRef(selectedId);

  useEffect(() => { tasksRef.current    = tasks;      }, [tasks]);
  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);

  // ── stable user identity ───────────────────────────────────────────────────
  const [me] = useState(() => {
    const s = localStorage.getItem('kb_user');
    return s ? JSON.parse(s) : { userId: 'anonymous', userName: 'Anonymous' };
  });

  // Load members dynamically from backend to resolve usernames
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data } = await axios.get(`${API}/auth/users`);
        const mapping = { ...FALLBACK_MEMBERS };
        data.forEach(u => {
          mapping[u._id] = u.name;
        });
        setMemberNames(mapping);
      } catch (err) {
        console.error('Error fetching users:', err.message);
      }
    };
    fetchUsers();
  }, []);

  // ── dnd sensors ────────────────────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // ── filter tasks ──────────────────────────────────────────────────────────
  const filteredTasks = tasks.filter(task => {
    if (filterPriority !== 'All' && task.priority !== filterPriority) return false;
    if (filterAssignee !== 'All') {
      if (filterAssignee === 'Unassigned') {
        if (task.assignedTo) return false;
      } else {
        if (task.assignedTo !== filterAssignee) return false;
      }
    }
    if (filterDueDate !== 'All') {
      const dueStatus = getDueDateStatus(task.dueDate, task.status);
      if (filterDueDate === 'Overdue' && dueStatus !== 'overdue') return false;
      if (filterDueDate === 'Due Soon' && dueStatus !== 'soon') return false;
    }
    return true;
  });

  const sortedColTasks = (colId) =>
    filteredTasks.filter(t => t.status === colId).sort((a, b) => a.position - b.position);

  const getBoardMembers = () => {
    if (!board) return [];
    const membersList = [];
    if (board.createdBy) membersList.push(board.createdBy);
    if (board.members && Array.isArray(board.members)) {
      board.members.forEach(m => {
        if (m && !membersList.includes(m)) membersList.push(m);
      });
    }
    return membersList;
  };

  // ── fetch boards list ──────────────────────────────────────────────────────
  const loadBoards = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/boards`);
      setBoardsList(data);
      // Auto-select first board only if nothing is selected yet
      setSelectedId(prev => {
        if (!prev && data.length > 0) return data[0]._id;
        return prev;
      });
    } catch (e) {
      console.error('loadBoards:', e.message);
    }
  }, []);

  useEffect(() => { loadBoards(); }, [loadBoards]);

  // ── load board + tasks when selectedId changes ─────────────────────────────
  const loadBoard = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/boards/${selectedId}`);
      setBoard(data);
      setTasks((data.tasks || []).sort((a, b) => a.position - b.position));
    } catch (e) {
      console.error('loadBoard:', e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    loadBoard();
  }, [selectedId, loadBoard]);

  // ── socket connection ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId) return;

    const sock = io(SOCK, { transports: ['websocket', 'polling'] });
    socketRef.current = sock;

    sock.on('connect', () => {
      sock.emit('join_board', { boardId: selectedId, userId: me.userId, userName: me.userName });
    });

    sock.on('online_members', (data) => {
      setOnlineMembers(data?.members || []);
    });

    sock.on('task_created', (newTask) => {
      setTasks(prev => {
        if (prev.some(t => t._id === newTask._id)) return prev;
        return [...prev, newTask].sort((a, b) => a.position - b.position);
      });
    });

    sock.on('task_updated', (updatedTask) => {
      setTasks(prev => prev.map(t => t._id === updatedTask._id ? updatedTask : t).sort((a, b) => a.position - b.position));
    });

    sock.on('task_deleted', ({ taskId }) => {
      setTasks(prev => prev.filter(t => t._id !== taskId));
    });

    // Another user moved a task → merge into our local tasks list
    sock.on('task_moved', ({ taskId, newStatus, newPosition, version }) => {
      setTasks(prev => {
        return prev.map(t => {
          if (t._id === taskId) {
            return { ...t, status: newStatus, position: newPosition, version };
          }
          return t;
        }).sort((a, b) => a.position - b.position);
      });
    });

    // Our own confirmed move (backend echo after persist)
    sock.on('move_confirmed', ({ taskId, newStatus, newPosition, version }) => {
      setTasks(prev => {
        return prev.map(t => {
          if (t._id === taskId) {
            return { ...t, status: newStatus, position: newPosition, version };
          }
          return t;
        }).sort((a, b) => a.position - b.position);
      });
    });

    sock.on('move_rejected', ({ taskId, reason }) => {
      console.warn(`Move rejected for task ${taskId}: ${reason}`);
      loadBoard();
    });

    sock.on('user_typing', ({ taskId, userId, userName, isTyping }) => {
      if (userId === me.userId) return;
      setTypingUsers(prev => {
        const copy = { ...prev };
        if (!taskId) {
          // Remove this user from all tasks typing indicator
          Object.keys(copy).forEach(tId => {
            if (copy[tId]?.[userId]) {
              const { [userId]: _, ...rest } = copy[tId];
              if (Object.keys(rest).length > 0) {
                copy[tId] = rest;
              } else {
                delete copy[tId];
              }
            }
          });
          return copy;
        }

        if (isTyping) {
          if (!copy[taskId]) copy[taskId] = {};
          copy[taskId] = { ...copy[taskId], [userId]: userName };
        } else {
          if (copy[taskId]) {
            const { [userId]: _, ...rest } = copy[taskId];
            if (Object.keys(rest).length > 0) {
              copy[taskId] = rest;
            } else {
              delete copy[taskId];
            }
          }
        }
        return copy;
      });
    });

    return () => {
      sock.disconnect();
      socketRef.current = null;
    };
  }, [selectedId, me, loadBoard]);

  // ── emit helpers ───────────────────────────────────────────────────────────
  const emitMove = useCallback((taskId, newStatus, newPosition, version) => {
    socketRef.current?.emit('move_task', {
      boardId: selectedId, taskId, newStatus, newPosition,
      version, movedBy: me.userName,
    });
  }, [selectedId, me.userName]);

  const emitTyping = useCallback((taskId, isTyping) => {
    socketRef.current?.emit('typing_indicator', {
      boardId: selectedId, taskId,
      userId: me.userId, userName: me.userName, isTyping,
    });
  }, [selectedId, me.userId, me.userName]);

  // ── DnD ────────────────────────────────────────────────────────────────────
  const onDragStart = ({ active }) => {
    const task = tasks.find(t => t._id === active.id);
    setActiveTask(task ?? null);
    setDragStartCol(task ? task.status : null);
  };

  // Cross-column drag: move task to new column optimistically
  const onDragOver = useCallback(({ active, over }) => {
    if (!over) return;
    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    setTasks(prev => {
      const activeContainer = findContainer(activeId, prev);
      const overContainer = findContainer(overId, prev);

      if (!activeContainer || !overContainer) return prev;

      const activeItems = prev.filter(t => t.status === activeContainer).sort((a, b) => a.position - b.position);
      const overItems = prev.filter(t => t.status === overContainer).sort((a, b) => a.position - b.position);

      const activeIndex = activeItems.findIndex(t => t._id === activeId);
      if (activeIndex === -1) return prev;

      // ── Same column sorting ────────────────────────────────────────────────
      if (activeContainer === overContainer) {
        const overIndex = activeItems.findIndex(t => t._id === overId);
        if (overIndex === -1 || activeIndex === overIndex) return prev;

        const reordered = arrayMove(activeItems, activeIndex, overIndex).map((t, i) => ({ ...t, position: i }));
        const others = prev.filter(t => t.status !== activeContainer);
        return [...others, ...reordered];
      }

      // ── Cross column moving ────────────────────────────────────────────────
      const taskToMove = activeItems[activeIndex];

      let newIndex;
      if (COLS.some(c => c.id === overId)) {
        newIndex = overItems.length;
      } else {
        const overIndex = overItems.findIndex(t => t._id === overId);
        newIndex = overIndex >= 0 ? overIndex : overItems.length;
      }

      const newActiveItems = activeItems.filter(t => t._id !== activeId).map((t, i) => ({ ...t, position: i }));
      const newOverItems = [...overItems];
      const updatedTask = { ...taskToMove, status: overContainer };
      newOverItems.splice(newIndex, 0, updatedTask);
      const reorderedOverItems = newOverItems.map((t, i) => ({ ...t, position: i }));

      const others = prev.filter(t => t.status !== activeContainer && t.status !== overContainer);

      return [...newActiveItems, ...reorderedOverItems, ...others];
    });
  }, []);

  // Finalize drag: reorder within same column OR persist cross-column move
  const onDragEnd = useCallback(async ({ active, over }) => {
    setActiveTask(null);
    const startCol = dragStartCol;
    setDragStartCol(null);

    if (!over) {
      loadBoard();
      return;
    }

    const activeId = active.id;
    const overId = over.id;

    const currentTasks = tasksRef.current;
    const finalTask = currentTasks.find(t => t._id === activeId);
    if (!finalTask) return;

    const destCol = finalTask.status;

    try {
      emitMove(finalTask._id, finalTask.status, finalTask.position, finalTask.version ?? 0);

      // Quietly persist position updates for all other tasks in affected columns
      const destColTasks = currentTasks.filter(t => t.status === destCol);
      destColTasks.forEach(t => {
        if (t._id !== finalTask._id) {
          axios.put(`${API}/tasks/${t._id}`, { status: t.status, position: t.position })
            .catch(err => console.error('Quiet position update failed:', err.message));
        }
      });

      if (startCol && startCol !== destCol) {
        const sourceColTasks = currentTasks.filter(t => t.status === startCol);
        sourceColTasks.forEach(t => {
          axios.put(`${API}/tasks/${t._id}`, { status: t.status, position: t.position })
            .catch(err => console.error('Quiet position update failed:', err.message));
        });
      }

    } catch (e) {
      console.error('onDragEnd persist error:', e.message);
      loadBoard();
    }
  }, [dragStartCol, emitMove, loadBoard]);

  // ── create board ───────────────────────────────────────────────────────────
  const handleCreateBoard = async (e) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    try {
      const { data } = await axios.post(`${API}/boards`, { name: newBoardName.trim(), createdBy: me.userId });
      setNewBoardName('');
      await loadBoards();
      setSelectedId(data._id);
    } catch (e) {
      console.error('createBoard:', e.message);
    }
  };

  // ── add task ───────────────────────────────────────────────────────────────
  const handleAddTask = async (ev) => {
    ev.preventDefault();
    if (!newTask.title.trim()) return;
    try {
      const { data } = await axios.post(`${API}/tasks`, {
        ...newTask,
        status: addToCol,
        boardId: selectedId,
        dueDate: newTask.dueDate || null,
        assignedTo: newTask.assignedTo || null,
      });
      setTasks(prev => {
        if (prev.some(t => t._id === data._id)) return prev;
        return [...prev, data];
      });
      setNewTask({ title: '', description: '', priority: 'Medium', dueDate: '', assignedTo: '' });
      setAddToCol(null);
    } catch (e) {
      console.error('addTask:', e.message);
    }
  };

  // ── save edit ──────────────────────────────────────────────────────────────
  const handleSaveEdit = async (ev) => {
    ev.preventDefault();
    if (!editTask?.title?.trim()) return;
    try {
      const { data } = await axios.put(`${API}/tasks/${editTask._id}`, {
        title: editTask.title,
        description: editTask.description,
        priority: editTask.priority,
        dueDate: editTask.dueDate || null,
        assignedTo: editTask.assignedTo || null,
        updatedBy: me.userName,
      });
      setTasks(prev => prev.map(t => t._id === data._id ? data : t));
      emitTyping(editTask._id, false);
      setEditTask(null);
    } catch (e) {
      console.error('saveEdit:', e.message);
    }
  };

  // ── add comment ────────────────────────────────────────────────────────────
  const handleAddComment = async () => {
    if (!commentInput.trim() || !editTask) return;
    try {
      const { data } = await axios.post(`${API}/tasks/${editTask._id}/comments`, {
        text: commentInput.trim(),
        author: me.userName,
      });
      setTasks(prev => prev.map(t => t._id === data._id ? data : t));
      setEditTask(data);
      setCommentInput('');
    } catch (e) {
      console.error('addComment:', e.message);
    }
  };

  // ── delete task ────────────────────────────────────────────────────────────
  const handleDelete = async (taskId) => {
    if (!confirm('Delete this task?')) return;
    try {
      await axios.delete(`${API}/tasks/${taskId}`);
      setTasks(prev => prev.filter(t => t._id !== taskId));
    } catch (e) {
      console.error('deleteTask:', e.message);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  const dropAnim = { sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) };

  return (
    <div className="flex flex-col min-h-screen">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-600 to-violet-600 text-white p-2 rounded-xl font-black text-lg shadow-lg shadow-indigo-600/30 select-none">KB</div>
          <div>
            <p className="text-base font-bold text-white leading-none tracking-tight">Collaborative Kanban</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Real-time synced boards</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[160px]"
          >
            <option value="">— Select Board —</option>
            {boardsList.map(b => <option key={b._id} value={b._id}>{boardName(b)}</option>)}
          </select>

          <form onSubmit={handleCreateBoard} className="flex items-center gap-1.5">
            <input
              type="text" placeholder="New board…" value={newBoardName}
              onChange={e => setNewBoardName(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-36"
            />
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg p-1.5 transition-all shadow-md shadow-indigo-600/20">
              <Plus size={15} />
            </button>
          </form>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs font-semibold text-slate-300">{me.userName}</span>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/20 border border-red-800/40 hover:bg-red-900/30 text-red-400 text-xs font-semibold rounded-lg transition-all cursor-pointer"
          >
            Logout
          </button>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 p-5 flex flex-col gap-4">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-24">
            <Loader2 className="animate-spin text-indigo-500" size={36} />
            <p className="text-slate-500 text-sm">Loading board…</p>
          </div>
        ) : !board ? (
          <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-2xl p-12 text-center mt-4">
            <div className="p-4 bg-slate-900 rounded-2xl mb-4 border border-slate-800">
              <AlertCircle className="text-slate-600" size={36} />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">No Board Selected</h3>
            <p className="text-slate-500 text-sm max-w-sm">Pick a board from the dropdown or create a new one above.</p>
          </div>
        ) : (
          <>
            {/* Board sub-header */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/40 border border-slate-800/80 rounded-xl px-4 py-3">
              <div>
                <h2 className="font-bold text-white text-base">{boardName(board)}</h2>
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                  <Users size={12} className="text-indigo-400" />
                  {onlineMembers.length} member{onlineMembers.length !== 1 ? 's' : ''} online
                </p>
              </div>
              <div className="flex -space-x-2">
                {onlineMembers.map(m => (
                  <div key={m.socketId} title={`${m.userName} (online)`}
                    className="w-8 h-8 rounded-full ring-2 ring-slate-900 bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white uppercase select-none">
                    {m.userName.slice(0, 2)}
                  </div>
                ))}
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3 bg-slate-900/20 border border-slate-800/60 rounded-xl px-4 py-2.5 mt-1">
              <span className="text-xs font-semibold text-slate-400">Filters:</span>
              
              {/* Priority Filter */}
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Priority</label>
                <select
                  value={filterPriority}
                  onChange={e => setFilterPriority(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="All">All Priorities</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              {/* Assignee Filter */}
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assignee</label>
                <select
                  value={filterAssignee}
                  onChange={e => setFilterAssignee(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="All">All Assignees</option>
                  <option value="Unassigned">Unassigned</option>
                  {getBoardMembers().map(mId => (
                    <option key={mId} value={mId}>
                      {memberNames[mId] || 'Member (' + mId.slice(-4) + ')'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Due Date Filter */}
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Due Date</label>
                <select
                  value={filterDueDate}
                  onChange={e => setFilterDueDate(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="All">All Dates</option>
                  <option value="Overdue">Overdue</option>
                  <option value="Due Soon">Due Soon</option>
                </select>
              </div>

              {/* Clear Filters Button */}
              {(filterPriority !== 'All' || filterAssignee !== 'All' || filterDueDate !== 'All') && (
                <button
                  onClick={() => { setFilterPriority('All'); setFilterAssignee('All'); setFilterDueDate('All'); }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors ml-auto cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* ── Kanban grid with DnD ── */}
            <DndContext sensors={sensors} collisionDetection={closestCorners}
              onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
                {COLS.map(col => (
                  <KanbanColumn
                    key={col.id} col={col}
                    tasks={sortedColTasks(col.id)}
                    onAdd={setAddToCol}
                    onEdit={setEditTask}
                    onDelete={handleDelete}
                    typingUsers={typingUsers}
                    memberNames={memberNames}
                  />
                ))}
              </div>

              <DragOverlay dropAnimation={dropAnim}>
                {activeTask ? (
                  <TaskCard
                    task={activeTask}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    overlay
                    memberNames={memberNames}
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          </>
        )}
      </main>

      {/* ── Add Task Modal ── */}
      {addToCol && (
        <Modal title={`Add task to "${addToCol}"`} onClose={() => setAddToCol(null)}>
          <form onSubmit={handleAddTask} className="flex flex-col gap-4">
            <Field label="Title *">
              <input type="text" required autoFocus placeholder="Task title"
                value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                className={inputCls} />
            </Field>
            <Field label="Description">
              <textarea rows={3} placeholder="Optional details"
                value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                className={`${inputCls} resize-none`} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Priority">
                <select value={newTask.priority} onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))} className={inputCls}>
                  <option>Low</option><option>Medium</option><option>High</option>
                </select>
              </Field>
              <Field label="Due Date">
                <input type="date" value={newTask.dueDate || ''}
                  onChange={e => setNewTask(p => ({ ...p, dueDate: e.target.value }))}
                  className={inputCls} />
              </Field>
            </div>
            <Field label="Assignee">
              <select value={newTask.assignedTo || ''} onChange={e => setNewTask(p => ({ ...p, assignedTo: e.target.value || '' }))} className={inputCls}>
                <option value="">Unassigned</option>
                {getBoardMembers().map(mId => (
                  <option key={mId} value={mId}>
                    {memberNames[mId] || 'Member (' + mId.slice(-4) + ')'}
                  </option>
                ))}
              </select>
            </Field>
            <ModalActions onCancel={() => setAddToCol(null)} label="Add Task" />
          </form>
        </Modal>
      )}

      {/* ── Edit Task Modal (wide two-panel) ── */}
      {editTask && (
        <WideModal
          title={editTask.title || 'Edit Task'}
          onClose={() => { emitTyping(editTask._id, false); setEditTask(null); setCommentInput(''); }}
        >
          <div className="flex h-full overflow-hidden">

            {/* ── LEFT PANEL: Edit Form ── */}
            <div className="w-[55%] border-r border-slate-800 overflow-y-auto">
              <form onSubmit={handleSaveEdit} className="flex flex-col gap-4 p-6">
                <Field label="Title *">
                  <input type="text" required autoFocus value={editTask.title}
                    onChange={e => { setEditTask(p => ({ ...p, title: e.target.value })); emitTyping(editTask._id, true); }}
                    onBlur={() => emitTyping(editTask._id, false)}
                    className={inputCls} />
                </Field>
                <Field label="Description">
                  <textarea rows={3} value={editTask.description || ''}
                    onChange={e => { setEditTask(p => ({ ...p, description: e.target.value })); emitTyping(editTask._id, true); }}
                    onBlur={() => emitTyping(editTask._id, false)}
                    className={`${inputCls} resize-none`} />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Priority">
                    <select value={editTask.priority} onChange={e => setEditTask(p => ({ ...p, priority: e.target.value }))} className={inputCls}>
                      <option>Low</option><option>Medium</option><option>High</option>
                    </select>
                  </Field>
                  <Field label="Due Date">
                    <input type="date" value={getISODateOnly(editTask.dueDate)}
                      onChange={e => setEditTask(p => ({ ...p, dueDate: e.target.value }))}
                      className={inputCls} />
                  </Field>
                </div>

                <Field label="Assignee">
                  <select value={editTask.assignedTo || ''} onChange={e => setEditTask(p => ({ ...p, assignedTo: e.target.value || null }))} className={inputCls}>
                    <option value="">Unassigned</option>
                    {getBoardMembers().map(mId => (
                      <option key={mId} value={mId}>
                        {memberNames[mId] || 'Member (' + mId.slice(-4) + ')'}
                      </option>
                    ))}
                  </select>
                </Field>

                {/* Typing indicator */}
                {typingUsers[editTask._id] && Object.keys(typingUsers[editTask._id]).length > 0 && (
                  <div className="text-xs text-indigo-400 bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-2.5 flex items-center gap-2 animate-pulse select-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    <span><strong>{Object.values(typingUsers[editTask._id]).join(', ')}</strong> is editing this task right now…</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button type="button"
                    onClick={() => { emitTyping(editTask._id, false); setEditTask(null); setCommentInput(''); }}
                    className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg px-4 py-2 text-sm transition-all">
                    Cancel
                  </button>
                  <button type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all">
                    Save Changes
                  </button>
                </div>
              </form>
            </div>

            {/* ── RIGHT PANEL: Comments + Activity ── */}
            <div className="flex-1 flex flex-col overflow-hidden">

              {/* Tab bar */}
              <div className="flex border-b border-slate-800 shrink-0">
                <button
                  onClick={() => setModalTab('comments')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors ${
                    modalTab === 'comments'
                      ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <MessageSquare size={13} />
                  Comments
                  {editTask.comments?.length > 0 && (
                    <span className="bg-indigo-500/20 text-indigo-300 text-[9px] px-1.5 py-0.5 rounded-full font-bold">{editTask.comments.length}</span>
                  )}
                </button>
                <button
                  onClick={() => setModalTab('activity')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors ${
                    modalTab === 'activity'
                      ? 'text-emerald-400 border-b-2 border-emerald-500 bg-emerald-500/5'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Activity size={13} />
                  Activity
                  {editTask.activityLog?.length > 0 && (
                    <span className="bg-emerald-500/20 text-emerald-300 text-[9px] px-1.5 py-0.5 rounded-full font-bold">{editTask.activityLog.length}</span>
                  )}
                </button>
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto">

                {/* ── COMMENTS TAB ── */}
                {modalTab === 'comments' && (
                  <div className="flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                      {(!editTask.comments || editTask.comments.length === 0) ? (
                        <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
                          <MessageSquare size={28} className="text-slate-700" />
                          <p className="text-xs text-slate-600 italic">No comments yet. Be the first!</p>
                        </div>
                      ) : (
                        [...editTask.comments].reverse().map((c, i) => (
                          <div key={i} className="flex gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[10px] font-bold text-white uppercase shrink-0 mt-0.5">
                              {c.author.slice(0, 2)}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-baseline gap-2 mb-1">
                                <span className="text-xs font-semibold text-slate-200">{c.author}</span>
                                <span className="text-[10px] text-slate-600">
                                  {new Date(c.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-xs text-slate-300 bg-slate-800/60 border border-slate-800 rounded-xl rounded-tl-none px-3 py-2 leading-relaxed">
                                {c.text}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Comment input */}
                    <div className="p-3 border-t border-slate-800 shrink-0 flex gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[10px] font-bold text-white uppercase shrink-0">
                        {me.userName.slice(0, 2)}
                      </div>
                      <input
                        type="text"
                        placeholder="Write a comment…"
                        value={commentInput}
                        onChange={e => setCommentInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddComment(); }}
                        className="flex-1 bg-slate-800/60 border border-slate-700 text-white placeholder-slate-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        onClick={handleAddComment}
                        disabled={!commentInput.trim()}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white p-2 rounded-lg transition-all flex items-center shrink-0"
                      >
                        <Send size={13} />
                      </button>
                    </div>
                  </div>
                )}

                {/* ── ACTIVITY TIMELINE TAB ── */}
                {modalTab === 'activity' && (
                  <div className="p-4">
                    {(!editTask.activityLog || editTask.activityLog.length === 0) ? (
                      <div className="flex flex-col items-center justify-center gap-2 py-8">
                        <Activity size={28} className="text-slate-700" />
                        <p className="text-xs text-slate-600 italic">No activity recorded yet.</p>
                        <p className="text-[10px] text-slate-700 text-center">Move this task, change its priority or assignee to see entries here.</p>
                      </div>
                    ) : (
                      <ol className="relative border-l border-slate-800 ml-2 flex flex-col gap-0">
                        {[...editTask.activityLog].reverse().map((entry, i) => (
                          <li key={i} className="mb-4 ml-4">
                            <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full border-2 border-emerald-500 bg-slate-900" />
                            <p className="text-xs text-slate-300 leading-snug">{entry.text}</p>
                            <p className="text-[10px] text-slate-600 mt-0.5">
                              {new Date(entry.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}

              </div>
            </div>

          </div>
        </WideModal>
      )}
      {board && <AiAgentButton boardId={selectedId} />}
    </div>
  );
}
