import express from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import cors from 'cors';

// Types for drawing events
type DrawPayload = {
  // Basic payload – extend as needed
  start: { x: number; y: number };
  end: { x: number; y: number };
  color?: string;
  width?: number;
};

type DrawEvent = {
  type: 'draw';
  payload: DrawPayload;
};

type ClearEvent = {
  type: 'clear';
};

type BoardEvent = DrawEvent | ClearEvent;

// In‑memory board state
const boardState: BoardEvent[] = [];

// Express app setup
const app = express();
app.use(cors());
app.use(express.json());

// Simple health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket: Socket) => {
  // Send existing board state to the newly connected client
  socket.emit('init', boardState);

  // Handle incoming draw events
  socket.on('draw', (payload: DrawPayload) => {
    const event: DrawEvent = { type: 'draw', payload };
    boardState.push(event);
    // Broadcast to all other clients
    socket.broadcast.emit('draw', payload);
  });

  // Handle clear board events
  socket.on('clear', () => {
    boardState.length = 0; // reset state
    io.emit('clear');
  });
});

// Start server
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});