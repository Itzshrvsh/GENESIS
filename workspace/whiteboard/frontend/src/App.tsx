import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import AuthProvider from './context/AuthContext';
import BoardProvider from './context/BoardContext';
import Toolbar from './components/Toolbar';

const Home: React.FC = () => {
  const navigate = useNavigate();

  const handleCreateBoard = () => {
    const boardId = Math.random().toString(36).substring(2, 9);
    navigate(`/board/${boardId}`);
  };

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'inherit'
    }}>
      <div className="glass-card" style={{ textAlign: 'center', maxWidth: '500px' }}>
        <h1 className="gradient-text" style={{ fontSize: '3rem', marginBottom: '1rem' }}>
          EdgeVoid Whiteboard
        </h1>
        <p style={{ fontSize: '1.2rem', opacity: 0.8, marginBottom: '2.5rem' }}>
          Experience seamless real-time collaboration with our next-gen digital canvas.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button className="primary-button" onClick={handleCreateBoard}>
            Create New Board
          </button>
          <button className="secondary-button" onClick={() => navigate('/board/demo')}>
            Try Demo
          </button>
        </div>
      </div>
    </div>
  );
};

import Canvas from './components/Canvas';

const Board: React.FC = () => {
  const { boardId } = useParams<{ boardId: string }>();

  if (!boardId) {
    return <Navigate to='/' replace />;
  }

  return (
    <BoardProvider boardId={boardId}>
      <div style={{ 
        display: 'flex', 
        height: '100vh', 
        width: '100vw', 
        overflow: 'hidden',
        background: 'inherit'
      }}>
        <Toolbar />
        <div style={{ 
          flex: 1, 
          position: 'relative',
          background: 'white',
          boxShadow: 'inset 0 0 50px rgba(0,0,0,0.05)'
        }}>
          <div style={{
            position: 'absolute',
            top: '1rem',
            left: '1rem',
            padding: '0.5rem 1rem',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.8)',
            backdropFilter: 'blur(5px)',
            border: '1px solid rgba(0,0,0,0.1)',
            zIndex: 10,
            fontSize: '0.9rem',
            fontWeight: 600,
            color: '#666'
          }}>
            Board: {boardId}
          </div>
          <Canvas />
        </div>
      </div>
    </BoardProvider>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path='/' element={<Home />} />
          <Route path='/board/:boardId' element={<Board />} />
          <Route path='*' element={<Navigate to='/' replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;