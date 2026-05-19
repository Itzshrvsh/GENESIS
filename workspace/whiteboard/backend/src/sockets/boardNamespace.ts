import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { Batcher } from "../utils/batcher";

type DrawPoint = {
  x: number;
  y: number;
  color: string;
  size: number;
  type: 'start' | 'draw';
};

export function initBoardNamespace(httpServer: HttpServer): void {
  console.log("Initializing Socket.IO server...");
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
  });

  const boardNs = io.of("/board");

  boardNs.on("connection", (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("joinBoard", (boardId: string) => {
      console.log(`Socket ${socket.id} joining board ${boardId}`);
      socket.join(boardId);
      socket.to(boardId).emit("userJoined", { userId: socket.id });
    });

    socket.on("leaveBoard", (boardId: string) => {
      socket.leave(boardId);
      socket.to(boardId).emit("userLeft", { userId: socket.id });
    });

    socket.on(
      "points",
      (data: { boardId: string; points: DrawPoint[] }) => {
        const { boardId, points } = data;
        socket.to(boardId).emit("points", { points });
      }
    );

    socket.on("clear", (boardId: string) => {
      boardNs.to(boardId).emit("clear");
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}