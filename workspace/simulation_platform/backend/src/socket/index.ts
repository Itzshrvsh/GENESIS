import { Server as HttpServer } from "http";
import { Server as IOServer, Socket } from "socket.io";

let io: IOServer | null = null;

/**
 * Initialize Socket.IO on the given HTTP server.
 * Call this once during server startup.
 * @param server - The underlying HTTP server from Express.
 */
export function initSocket(server: HttpServer): void {
  io = new IOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket: Socket) => {
    console.log(`WebSocket client connected: ${socket.id}`);

    socket.on("disconnect", () => {
      console.log(`WebSocket client disconnected: ${socket.id}`);
    });
  });
}

/**
 * Broadcast telemetry data to all connected clients.
 * @param payload - Arbitrary telemetry payload.
 */
export function broadcastTelemetry(payload: unknown): void {
  if (io) {
    io.emit("telemetry", payload);
  }
}