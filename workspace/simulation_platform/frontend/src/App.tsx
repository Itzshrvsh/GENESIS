import { createContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';

/** Context that provides the active Socket.io client */
export const SocketContext = createContext<Socket | null>(null);

/** Simple home page component */
function Home() {
  return (
    <div>
      <h2>Welcome to the Simulation Platform</h2>
      <p>Select a page from the navigation menu.</p>
    </div>
  );
}

/** Component that displays real‑time telemetry */
function Telemetry() {
  const socket = useContext(SocketContext);
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    if (!socket) return;

    const handler = (msg: string) => {
      setMessages(prev => [...prev, msg]);
    };

    socket.on('telemetry', handler);
    return () => {
      socket.off('telemetry', handler);
    };
  }, [socket]);

  return (
    <div>
      <h2>Telemetry</h2>
      {messages.length === 0 ? (
        <p>No telemetry received yet.</p>
      ) : (
        <ul>
          {messages.map((msg, i) => (
            <li key={i}>{msg}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Root application component */
export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const endpoint = import.meta.env.VITE_BACKEND_URL ?? window.location.origin;
    const newSocket = io(endpoint, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
    });
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      <Router>
        <nav style={{ padding: '1rem', borderBottom: '1px solid #ccc' }}>
          <NavLink to="/" style={{ marginRight: '1rem' }}>
            Home
          </NavLink>
          <NavLink to="/telemetry">Telemetry</NavLink>
        </nav>
        <main style={{ padding: '1rem' }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/telemetry" element={<Telemetry />} />
          </Routes>
        </main>
      </Router>
    </SocketContext.Provider>
  );
}