# 🗂️ Collaborative Kanban Board

A full-stack, real-time collaborative Kanban board built with the **MERN stack** (MongoDB, Express, React, Node.js). Features drag-and-drop task management, live multi-user collaboration via WebSockets, and an **AI Agent** powered by Groq (LLaMA 3.3 70B) that can create, update, and delete tasks using natural language.

---

## ✨ Features

- 🔐 **JWT Authentication** — Register & login with secure token-based auth
- 🗃️ **Multiple Boards** — Create and switch between multiple Kanban boards
- 📋 **4-Column Workflow** — `To Do → In Progress → In Review → Done`
- 🖱️ **Drag & Drop** — Smooth cross-column and within-column task reordering via `@dnd-kit`
- 🔴 **Real-time Sync** — Live updates across all connected clients using Socket.io
- 👁️ **Presence Indicators** — See which team members are online on the board
- ✍️ **Typing Indicators** — Shows when another user is editing a task
- 🤖 **AI Agent** — Chat-based assistant (Groq / LLaMA 3.3 70b) that can manage tasks on your behalf
- 🔖 **Task Details** — Title, description, priority (Low / Medium / High), due date, assignee
- 💬 **Comments & Activity** — Per-task comment threads and activity log
- 🔍 **Filters** — Filter tasks by priority, assignee, or due date status (Overdue / Due Soon)
- ⚡ **Optimistic UI** — Instant local updates with server reconciliation

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express 5 | REST API server |
| MongoDB + Mongoose | Database & ODM |
| Socket.io | Real-time WebSocket events |
| JSON Web Tokens (JWT) | Authentication |
| bcryptjs | Password hashing |
| Groq API (LLaMA 3.3 70B) | AI agent for task management |
| dotenv | Environment configuration |
| nodemon | Development auto-reload |

### Frontend
| Technology | Purpose |
|---|---|
| React 19 + Vite | UI framework & build tool |
| Zustand | Global state management |
| @dnd-kit | Drag-and-drop interactions |
| Socket.io-client | Real-time WebSocket client |
| Axios | HTTP requests |
| Tailwind CSS v4 | Styling |
| Lucide React | Icons |

---

## 📁 Project Structure

```
03-Kanban-Board/
├── backend/
│   ├── config/
│   │   └── db.js                  # MongoDB connection
│   ├── controllers/
│   │   ├── aiController.js        # Groq AI agent with tool calling
│   │   ├── authController.js      # Register / Login / Users
│   │   ├── boardController.js     # CRUD for boards
│   │   └── taskController.js      # CRUD for tasks, comments, activity
│   ├── middleware/
│   │   └── authMiddleware.js      # JWT protect middleware
│   ├── models/
│   │   ├── Board.js               # Board schema
│   │   ├── Task.js                # Task schema (with comments & activity)
│   │   └── User.js                # User schema
│   ├── routes/
│   │   ├── aiRoutes.js
│   │   ├── authRoutes.js
│   │   ├── boardRoutes.js
│   │   └── taskRoutes.js
│   ├── socket/
│   │   └── socketHandler.js       # Socket.io event handlers
│   ├── seed.js                    # Database seeder
│   ├── server.js                  # Entry point
│   └── KanbanBoard.postman_collection.json
│
└── frontend/
    ├── public/
    │   ├── favicon.svg
    │   └── icons.svg
    └── src/
        ├── components/
        │   ├── KanbanBoard.jsx    # Main board UI (DnD, sockets, filters)
        │   ├── LoginPage.jsx      # Auth page
        │   └── AiAgentButton.jsx  # Floating AI chat panel
        ├── store/
        │   └── useBoardStore.js   # Zustand store
        ├── App.jsx
        ├── App.css
        ├── index.css
        └── main.jsx
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18+
- **MongoDB** (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- **Groq API Key** (free at [console.groq.com](https://console.groq.com)) — for the AI agent feature

---

### 1. Clone the Repository

```bash
git clone https://github.com/lakshyakushwahaaiml2023-ops/Kanban-Board.git
cd Kanban-Board
```

---

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/kanban-board
JWT_SECRET=your_super_secret_jwt_key
GROQ_API_KEY=your_groq_api_key_here
```

Start the backend server:

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The API will be running at `http://localhost:5000`.

#### (Optional) Seed the Database

```bash
npm run seed
```

This creates sample boards, tasks, and users for testing.

---

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The app will be running at `http://localhost:5173`.

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login and receive JWT |
| `GET` | `/api/auth/users` | Get all registered users |

### Boards
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/boards` | Get all boards |
| `POST` | `/api/boards` | Create a new board |
| `GET` | `/api/boards/:id` | Get board with tasks |
| `DELETE` | `/api/boards/:id` | Delete a board |

### Tasks
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/tasks` | Create a task |
| `PUT` | `/api/tasks/:id` | Update a task |
| `DELETE` | `/api/tasks/:id` | Delete a task |
| `POST` | `/api/tasks/:id/comments` | Add a comment to a task |

### AI Agent
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ai/chat` | Send a message to the AI agent |

---

## 🔄 Socket.io Events

| Event | Direction | Description |
|---|---|---|
| `join_board` | Client → Server | Join a board room |
| `online_members` | Server → Client | Broadcast who's online |
| `move_task` | Client → Server | Request to move/reorder a task |
| `move_confirmed` | Server → Client | Move accepted & persisted |
| `move_rejected` | Server → Client | Conflict detected, refresh required |
| `task_moved` | Server → Client | Broadcast task move to other clients |
| `task_created` | Server → Client | New task pushed to all clients |
| `task_updated` | Server → Client | Updated task pushed to all clients |
| `task_deleted` | Server → Client | Deleted task ID pushed to all clients |
| `typing_indicator` | Client → Server | User is typing in a task |
| `user_typing` | Server → Client | Broadcast typing state to others |

---

## 🤖 AI Agent

The built-in AI agent is powered by **Groq's LLaMA 3.3 70B** model with tool calling. Open the chat panel and ask it to manage your board in plain English.

**Example prompts:**
- *"Add a high-priority task called 'Fix login bug' to the In Progress column"*
- *"Move the 'Deploy to production' task to Done"*
- *"Show me all tasks on this board"*
- *"Assign the 'UI redesign' task to Alice with a due date of 2025-07-01"*
- *"Delete the task called 'Old feature request'"*

The agent has access to 4 tools: `get_board_data`, `create_task`, `update_task`, and `delete_task`. All AI-triggered changes are instantly synced to all connected clients via Socket.io.

---

## 📸 Key Workflows

```
User Login/Register
      ↓
Select / Create Board
      ↓
View tasks in 4 columns (Todo | In Progress | Review | Done)
      ↓
  ┌─────────────────────────────────────────┐
  │  Drag tasks across columns              │
  │  Add/Edit tasks with priority & due date│
  │  Assign tasks to team members           │
  │  Comment & view activity log            │
  │  Filter by priority / assignee / date   │
  │  Chat with AI agent to automate actions │
  └─────────────────────────────────────────┘
      ↓
All changes sync in real-time to all board members
```

---

## 🧪 Testing with Postman

A Postman collection is included at `backend/KanbanBoard.postman_collection.json`. Import it into Postman to test all API endpoints.

---

## 📄 License

This project is open-source and available under the [ISC License](LICENSE).

---

<div align="center">
  Built with ❤️ using the MERN Stack + Socket.io + Groq AI
</div>
