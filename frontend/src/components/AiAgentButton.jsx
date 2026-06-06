import React, { useState, useEffect, useRef } from 'react';
import { Bot, Sparkles, Send, X, MessageSquare, Loader2 } from 'lucide-react';
import axios from 'axios';

const API = 'http://localhost:5000/api';

const SUGGESTIONS = [
  'What tasks are currently on the board?',
  'Add a High priority task called "API Security Audit" in Todo',
  'Move task "Redesign landing page" to Done',
  'What is Bob working on?',
];

export default function AiAgentButton({ boardId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'assistant',
      text: "👋 Hi there! I'm your Kanban AI Assistant. I can help you query, create, update, or delete tasks. Try clicking one of the suggestions below or type a message!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  const handleSend = async (textToSend) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    if (!textToSend) {
      setInput('');
    }

    const userMessage = {
      sender: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      // Send message, active boardId, and chat history to the backend
      const { data } = await axios.post(`${API}/ai/chat`, {
        message: text.trim(),
        boardId,
        history: messages.slice(-10), // Send last 10 messages for context
      });

      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: data.text,
          timestamp: new Date(),
        },
      ]);
    } catch (e) {
      console.error('AI chat failed:', e.message);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: '⚠️ Sorry, I encountered an error connecting to my server. Please verify the Groq API key in your server environment.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* ── Chat Window ── */}
      {isOpen && (
        <div className="mb-4 w-96 h-[500px] bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-md transition-all duration-300 transform scale-100 origin-bottom-right">
          {/* Header */}
          <div className="bg-slate-950 px-4 py-3.5 border-b border-slate-850 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Bot size={18} className="text-white" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white leading-none">Kanban AI Agent</h4>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-slate-500">Connected to Groq</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 bg-slate-900/40">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none ml-auto shadow-md shadow-indigo-600/10'
                    : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-none'
                }`}
              >
                {/* Simple formatting for task lists/paragraphs */}
                <div className="whitespace-pre-line select-text">
                  {m.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl rounded-bl-none px-3.5 py-2 text-xs text-slate-400 max-w-[80%] flex items-center gap-2">
                <Loader2 size={12} className="animate-spin text-indigo-400" />
                <span>AI is thinking…</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestion Chips */}
          {messages.length === 1 && !loading && (
            <div className="px-4 py-2 border-t border-slate-850 bg-slate-950/20 flex flex-col gap-1.5">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Suggested Actions</span>
              <div className="flex flex-col gap-1">
                {SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(s)}
                    className="text-left text-[11px] text-indigo-300 hover:text-white bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/10 hover:border-indigo-500/20 px-2.5 py-1.5 rounded-lg transition-all truncate"
                  >
                    💡 {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Footer Input */}
          <div className="p-3 border-t border-slate-850 bg-slate-950 flex items-center gap-2">
            <input
              type="text"
              placeholder="Ask AI to view, add, or move tasks..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              className="flex-1 bg-slate-900 border border-slate-850 text-white placeholder-slate-600 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white p-2 rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center shrink-0 cursor-pointer"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Floating Action Button ── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-indigo-600/30 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer relative"
      >
        <Bot size={22} className="relative z-10 animate-pulse" />
        <span className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
        <div className="absolute top-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
      </button>
    </div>
  );
}
