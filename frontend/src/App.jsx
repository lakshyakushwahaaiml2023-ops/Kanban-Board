import React, { useState } from 'react';
import KanbanBoard from './components/KanbanBoard';
import LoginPage from './components/LoginPage';

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('kb_token'));
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem('kb_user');
    return u ? JSON.parse(u) : null;
  });

  const handleLoginSuccess = ({ token, user }) => {
    setToken(token);
    setUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('kb_token');
    localStorage.removeItem('kb_user');
    setToken(null);
    setUser(null);
  };

  return (
    <div className="w-full min-h-screen bg-[#0b0f19]">
      {token && user ? (
        <KanbanBoard onLogout={handleLogout} />
      ) : (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}

export default App;
