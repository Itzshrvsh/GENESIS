import express from 'express';
import cors from 'cors';
import { json } from 'body-parser';
import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import authRouter from './routes/auth';
import boardsRouter from './routes/boards';
import { errorHandler } from './middleware/errorHandler';
import { initBoardNamespace } from './sockets/boardNamespace';
import env from './config/env';

const app = express();
const PORT = env.PORT;

// Middleware
app.use(cors());
app.use(json());

// API routes
app.use('/api/auth', authRouter);
app.use('/api/boards', boardsRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Central error handler
app.use(errorHandler);

// HTTP & Socket.IO servers
const httpServer = new HttpServer(app);

initBoardNamespace(httpServer);

export { app, httpServer, PORT };
export default app;