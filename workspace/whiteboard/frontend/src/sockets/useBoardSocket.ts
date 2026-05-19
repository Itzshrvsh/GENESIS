import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

type Point = {
  x: number;
  y: number;
  color: string;
  size: number;
  type: 'start' | 'draw';
};

type UseBoardSocketReturn = {
  socket: Socket | null;
  connected: boolean;
  sendPoints: (points: Point[]) => void;
  clearBoard: () => void;
};

export default function useBoardSocket(
  boardId: string,
  onPoints: (points: Point[]) => void
): UseBoardSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Connect to the /board namespace (allow polling for better compatibility)
    const socket = io(`${import.meta.env.VITE_SOCKET_URL ?? ''}/board`);

    socketRef.current = socket;

    const handleConnect = () => {
      setConnected(true);
      socket.emit('joinBoard', boardId);
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    const handlePoints = (data: { points: Point[] }) => {
      onPoints(data.points);
    };

    const handleClear = () => {
      onPoints([]);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('points', handlePoints);
    socket.on('clear', handleClear);

    // Cleanup on unmount or board change
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('points', handlePoints);
      socket.off('clear', handleClear);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [boardId, onPoints]);

  const sendPoints = (points: Point[]) => {
    if (socketRef.current && connected) {
      socketRef.current.emit('points', { boardId, points });
    }
  };

  const clearBoard = () => {
    if (socketRef.current && connected) {
      socketRef.current.emit('clear', { boardId });
    }
  };

  return {
    socket: socketRef.current,
    connected,
    sendPoints,
    clearBoard,
  };
}