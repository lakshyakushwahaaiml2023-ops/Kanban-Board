const axios = require('axios');
const Task = require('../models/Task');
const Board = require('../models/Board');
const User = require('../models/User');

// Hardcoded member mapping for tool output readability
const MEMBER_NAMES = {
  '6659f1a2c8e4a2b3d4e5f6a1': 'Alice',
  '6659f1a2c8e4a2b3d4e5f6a2': 'Bob',
  '6659f1a2c8e4a2b3d4e5f6a3': 'Carol',
};

// System prompt instructing the AI agent about its role and capabilities
const SYSTEM_PROMPT = `You are a helpful, collaborative Kanban Board AI Agent Assistant.
You assist teams in managing their projects, organizing tasks, and automating updates on the board.
You have access to tools that let you view, create, update, and delete tasks on the current board.

When performing actions:
1. Always confirm the action you took clearly in a friendly manner.
2. If the user asks you to add a task, do it using the 'create_task' tool.
3. If they ask to update a task (such as moving columns, renaming, changing priority, due date, or assignee), use 'update_task'.
4. If they ask to delete a task, use 'delete_task'.
5. Always explain what you did. Be concise and professional.
6. Use the list of registered users and their corresponding ObjectIds (which will be supplied dynamically below) to assign tasks to the correct users.
7. Due dates should be formatted as YYYY-MM-DD.

Keep conversations concise, helpful, and direct.`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_board_data',
      description: 'Get all tasks on the current board, along with columns and members.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a new task on the board.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The title of the task.' },
          description: { type: 'string', description: 'Detailed description.' },
          priority: { type: 'string', enum: ['Low', 'Medium', 'High'], description: 'Priority level (default is Medium).' },
          status: { type: 'string', enum: ['Todo', 'In Progress', 'Review', 'Done'], description: 'The column status (default is Todo).' },
          dueDate: { type: 'string', description: 'Due date in YYYY-MM-DD format.' },
          assignedTo: { type: 'string', description: 'ObjectId of the assignee (e.g. Bob is 6659f1a2c8e4a2b3d4e5f6a2).' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description: 'Update/modify an existing task details, move columns, assign users, or set due dates.',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'The ObjectId of the task to update.' },
          title: { type: 'string', description: 'New title for the task.' },
          description: { type: 'string', description: 'New description.' },
          priority: { type: 'string', enum: ['Low', 'Medium', 'High'] },
          status: { type: 'string', enum: ['Todo', 'In Progress', 'Review', 'Done'], description: 'Move to a new column.' },
          dueDate: { type: 'string', description: 'Due date in YYYY-MM-DD format, or null to remove.' },
          assignedTo: { type: 'string', description: 'ObjectId of assignee, or null to remove.' },
        },
        required: ['taskId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_task',
      description: 'Remove a task from the board.',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'The ObjectId of the task to delete.' },
        },
        required: ['taskId'],
      },
    },
  },
];

// Handles communication with Groq and executes tool calls
const handleChat = async (req, res, next) => {
  try {
    const { message, boardId, history = [] } = req.body;

    if (!boardId) {
      return res.status(400).json({ message: 'boardId is required' });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'message is required' });
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return res.status(500).json({ message: 'GROQ_API_KEY is not configured on the server' });
    }

    // Fetch registered users to provide active context to the AI
    const dbUsers = await User.find({}, '_id name email').lean();
    const usersContext = dbUsers.map(u => `- ${u.name}: ${u._id} (${u.email})`).join('\n');
    const dynamicSystemPrompt = `${SYSTEM_PROMPT}\n\nRegistered Users in Database:\n${usersContext}`;

    // Format chat history for the LLM
    const formattedMessages = [
      { role: 'system', content: dynamicSystemPrompt },
      ...history.map((h) => ({
        role: h.sender === 'user' ? 'user' : 'assistant',
        content: h.text,
      })),
      { role: 'user', content: message },
    ];

    // Call Groq API
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: formattedMessages,
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 0.2,
      },
      {
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const choice = response.data.choices[0];
    let aiMessage = choice.message;

    // Check if the LLM wants to call a tool
    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      formattedMessages.push(aiMessage);

      // Execute tool calls
      for (const toolCall of aiMessage.tool_calls) {
        const { name, arguments: argsString } = toolCall.function;
        const args = JSON.parse(argsString);
        let toolResult = '';

        console.log(`🤖 AI executing tool: ${name} with args:`, args);

        try {
          if (name === 'get_board_data') {
            const board = await Board.findById(boardId);
            const tasks = await Task.find({ board: boardId }).sort({ status: 1, position: 1 });
            
            const dbUsers = await User.find({}, '_id name').lean();
            const userMap = {};
            dbUsers.forEach((u) => {
              userMap[u._id.toString()] = u.name;
            });

            toolResult = JSON.stringify({
              boardName: board?.title || board?.name || 'Unknown Board',
              members: board?.members || [],
              tasks: tasks.map((t) => ({
                id: t._id,
                title: t.title,
                description: t.description,
                status: t.status,
                priority: t.priority,
                dueDate: t.dueDate,
                assignedTo: t.assignedTo ? (userMap[t.assignedTo.toString()] || t.assignedTo) : 'Unassigned',
                version: t.version,
              })),
            });
          } else if (name === 'create_task') {
            const status = args.status || 'Todo';
            const colCount = await Task.countDocuments({ board: boardId, status });

            const task = await Task.create({
              title: args.title,
              description: args.description || '',
              priority: args.priority || 'Medium',
              status,
              dueDate: args.dueDate || null,
              assignedTo: args.assignedTo || null,
              position: colCount,
              board: boardId,
            });

            // Emit socket event to sync client boards instantly
            if (req.io) {
              req.io.to(boardId).emit('task_created', task);
            }

            toolResult = JSON.stringify({
              success: true,
              message: 'Task created successfully',
              task: {
                id: task._id,
                title: task.title,
                status: task.status,
                priority: task.priority,
              },
            });
          } else if (name === 'update_task') {
            const updates = {};
            if (args.title !== undefined) updates.title = args.title;
            if (args.description !== undefined) updates.description = args.description;
            if (args.priority !== undefined) updates.priority = args.priority;
            if (args.status !== undefined) updates.status = args.status;
            if (args.dueDate !== undefined) updates.dueDate = args.dueDate || null;
            if (args.assignedTo !== undefined) updates.assignedTo = args.assignedTo || null;

            const task = await Task.findByIdAndUpdate(args.taskId, { $set: updates }, { new: true });

            if (task) {
              // Emit socket event to sync client boards instantly
              if (req.io) {
                req.io.to(boardId).emit('task_updated', task);
              }

              toolResult = JSON.stringify({
                success: true,
                message: 'Task updated successfully',
                task: {
                  id: task._id,
                  title: task.title,
                  status: task.status,
                  priority: task.priority,
                },
              });
            } else {
              toolResult = JSON.stringify({ success: false, message: 'Task not found' });
            }
          } else if (name === 'delete_task') {
            const task = await Task.findByIdAndDelete(args.taskId);

            if (task) {
              // Emit socket event to sync client boards instantly
              if (req.io) {
                req.io.to(boardId).emit('task_deleted', { taskId: args.taskId });
              }

              toolResult = JSON.stringify({
                success: true,
                message: 'Task deleted successfully',
                taskId: args.taskId,
              });
            } else {
              toolResult = JSON.stringify({ success: false, message: 'Task not found' });
            }
          }
        } catch (toolErr) {
          console.error(`Error executing tool ${name}:`, toolErr.message);
          toolResult = JSON.stringify({ success: false, error: toolErr.message });
        }

        // Push the tool result back into messages
        formattedMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: name,
          content: toolResult,
        });
      }

      // Call Groq completions again with the tool output to formulate final response
      const secondResponse = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.3-70b-versatile',
          messages: formattedMessages,
          temperature: 0.2,
        },
        {
          headers: {
            Authorization: `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      aiMessage = secondResponse.data.choices[0].message;
    }

    res.status(200).json({ text: aiMessage.content });

  } catch (error) {
    console.error('AI chat controller error:', error.response?.data || error.message);
    next(error);
  }
};

module.exports = {
  handleChat,
};
