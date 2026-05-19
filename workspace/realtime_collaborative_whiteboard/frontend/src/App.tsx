import React from 'react';
import Whiteboard from './components/Whiteboard';

const App: React.FC = () => {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          padding: '1rem',
          background: '#282c34',
          color: 'white',
          textAlign: 'center',
        }}
      >
        <h1>Realtime Collaborative Whiteboard</h1>
      </header>
      <main style={{ flex: 1 }}>
        <Whiteboard />
      </main>
    </div>
  );
};

export default App;