import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';

import authRouter from './routes/auth';
import scenariosRouter from './routes/scenarios';
import simulationsRouter from './routes/simulations';
import { verifyJWT } from './middleware/jwt';
import { initSocket } from './socket';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// Public routes
app.use('/api/auth', authRouter);

// Protected routes
app.use('/api/scenarios', verifyJWT, scenariosRouter);
app.use('/api/simulations', verifyJWT, simulationsRouter);

// Initialize Socket.IO event handling
initSocket(io);

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});

export { app, io };