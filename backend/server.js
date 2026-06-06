const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors   = require('cors');
const dotenv = require('dotenv');

const connectDB            = require('./config/db');
const registerSocketHandlers = require('./socket/socketHandler');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app    = express();
const server = http.createServer(app); // wrap Express in a raw HTTP server

// ─── Socket.io ────────────────────────────────────────────────────────────────

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174', 'http://127.0.0.1:5175'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Reconnection transport order — WebSocket first, polling fallback
  transports: ['websocket', 'polling'],
});

// Attach all socket event listeners
registerSocketHandlers(io);

// ─── Express Middleware ───────────────────────────────────────────────────────

const corsOptions = {
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174', 'http://127.0.0.1:5175'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Expose io to route handlers via req.io (useful for emitting from REST endpoints)
app.use((req, _res, next) => {
  req.io = io;
  next();
});

// ─── REST Routes ──────────────────────────────────────────────────────────────

app.get('/', (_req, res) => {
  res.json({ message: '🚀 Kanban Board API is running!' });
});

app.use('/api/auth',   require('./routes/authRoutes'));
app.use('/api/boards', require('./routes/boardRoutes'));
app.use('/api/tasks',  require('./routes/taskRoutes'));
app.use('/api/ai',     require('./routes/aiRoutes'));

// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔌 Socket.io listening on ws://localhost:${PORT}`);
});
