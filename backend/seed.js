const dns = require('dns');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const Board = require('./models/Board');
const Task = require('./models/Task');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

// ─── Fake user ObjectIds (stand-ins until auth is built) ─────────────────────
const USERS = {
  alice: new mongoose.Types.ObjectId('6659f1a2c8e4a2b3d4e5f6a1'),
  bob:   new mongoose.Types.ObjectId('6659f1a2c8e4a2b3d4e5f6a2'),
  carol: new mongoose.Types.ObjectId('6659f1a2c8e4a2b3d4e5f6a3'),
};

// ─── Seed Data ────────────────────────────────────────────────────────────────
const BOARDS = [
  {
    name: 'Website Redesign',
    title: 'Website Redesign',
    createdBy: USERS.alice,
    members: [USERS.bob, USERS.carol],
  },
  {
    name: 'Mobile App Launch',
    title: 'Mobile App Launch',
    createdBy: USERS.bob,
    members: [USERS.alice],
  },
  {
    name: 'Backend Infrastructure',
    title: 'Backend Infrastructure',
    createdBy: USERS.carol,
    members: [USERS.alice, USERS.bob],
  },
];

// Tasks per board: [status, title, description, priority, daysUntilDue, assignedTo]
const TASK_TEMPLATES = [
  // Website Redesign tasks
  [
    ['Todo',        'Audit existing UI',             'Review all current pages for inconsistencies',         'High',   7,  USERS.alice],
    ['Todo',        'Set up design tokens',          'Define colors, spacing, and typography tokens',        'Medium', 10, USERS.bob],
    ['In Progress', 'Redesign landing page',         'Create new hero section and feature highlights',       'High',   5,  USERS.alice],
    ['In Progress', 'Build component library',       'Reusable React components with Storybook docs',        'Medium', 14, USERS.bob],
    ['Review',      'Navigation bar redesign',       'New sticky nav with mobile hamburger menu',            'Low',    3,  USERS.carol],
    ['Done',        'Wireframes approved',           'All wireframes signed off by stakeholders',            'High',   0,  USERS.alice],
  ],
  // Mobile App Launch tasks
  [
    ['Todo',        'App store listing copy',        'Write compelling description and select screenshots',  'Medium', 12, USERS.alice],
    ['Todo',        'Crash reporting setup',         'Integrate Sentry for error tracking',                  'High',   6,  USERS.bob],
    ['In Progress', 'Push notification service',    'Implement Firebase Cloud Messaging',                   'High',   8,  USERS.bob],
    ['In Progress', 'Onboarding flow',              'Build 3-step user onboarding screens',                'Medium', 9,  USERS.alice],
    ['Review',      'Beta testing feedback review', 'Collate and prioritise beta user feedback',            'High',   2,  USERS.bob],
    ['Done',        'Core authentication',          'JWT login, register, and refresh token flow',          'High',   0,  USERS.alice],
    ['Done',        'API integration layer',        'Axios interceptors and service abstractions',          'Medium', 0,  USERS.bob],
  ],
  // Backend Infrastructure tasks
  [
    ['Todo',        'Set up CI/CD pipeline',        'GitHub Actions for test and deploy on main branch',    'High',   15, USERS.carol],
    ['Todo',        'Redis caching layer',           'Cache frequent DB queries with TTL strategy',          'Medium', 20, USERS.alice],
    ['In Progress', 'Docker containerisation',      'Dockerfile + docker-compose for local dev setup',     'High',   7,  USERS.carol],
    ['In Progress', 'Rate limiting middleware',     'Express rate limiter for public API endpoints',        'Medium', 5,  USERS.bob],
    ['Review',      'MongoDB indexes audit',        'Ensure compound indexes are optimal for query patterns','High',  3,  USERS.carol],
    ['Done',        'Environment config setup',     '.env validation with Joi schema on startup',           'Low',    0,  USERS.alice],
    ['Done',        'Base Express server',          'Express + CORS + error handler scaffold',              'Medium', 0,  USERS.carol],
  ],
];

// ─── Seeder ───────────────────────────────────────────────────────────────────
const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      appName: 'kanban-seeder',
    });
    console.log('✅ Connected to MongoDB Atlas\n');

    // Clear existing data
    await Board.deleteMany({});
    await Task.deleteMany({});
    await User.deleteMany({});
    console.log('🗑️  Cleared existing boards, tasks, and users\n');

    // Insert seeded users
    const hashedPassword = await bcrypt.hash('password123', 10);
    await User.insertMany([
      { _id: USERS.alice, name: 'Alice', email: 'alice@example.com', password: hashedPassword },
      { _id: USERS.bob, name: 'Bob', email: 'bob@example.com', password: hashedPassword },
      { _id: USERS.carol, name: 'Carol', email: 'carol@example.com', password: hashedPassword },
    ]);
    console.log('👤 Seeded users (Alice, Bob, Carol) created (password: password123)\n');

    // Insert boards
    const createdBoards = await Board.insertMany(BOARDS);
    console.log(`📋 Created ${createdBoards.length} boards:`);
    createdBoards.forEach((b) => console.log(`   • [${b._id}] ${b.name}`));

    // Insert tasks for each board
    let totalTasks = 0;
    for (let i = 0; i < createdBoards.length; i++) {
      const board = createdBoards[i];
      const templates = TASK_TEMPLATES[i];

      // Track position per status column
      const positionMap = {};

      const tasks = templates.map(([status, title, description, priority, daysUntilDue, assignedTo]) => {
        positionMap[status] = positionMap[status] !== undefined ? positionMap[status] + 1 : 0;
        const dueDate = daysUntilDue > 0
          ? new Date(Date.now() + daysUntilDue * 24 * 60 * 60 * 1000)
          : undefined;

        return {
          title,
          description,
          priority,
          status,
          position: positionMap[status],
          dueDate,
          assignedTo,
          board: board._id,
        };
      });

      const created = await Task.insertMany(tasks);
      totalTasks += created.length;
      console.log(`\n🗂️  Board: "${board.name}" → ${created.length} tasks`);
      created.forEach((t) =>
        console.log(`   [${t.status.padEnd(11)}] ${t.title}`)
      );
    }

    console.log(`\n✅ Seeding complete! ${createdBoards.length} boards, ${totalTasks} tasks inserted.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  }
};

seed();
