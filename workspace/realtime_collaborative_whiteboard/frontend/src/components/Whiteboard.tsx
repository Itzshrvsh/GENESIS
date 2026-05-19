import React, { useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";

type Point = { x: number; y: number };
type DrawData = {
  from: Point;
  to: Point;
  color: string;
  lineWidth: number;
};

const SERVER_URL = "http://localhost:4000"; // adjust if needed
const DEFAULT_COLOR = "#000000";
const DEFAULT_LINE_WIDTH = 2;

const Whiteboard: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const drawing = useRef(false);
  const lastPos = useRef<Point | null>(null);

  const getMousePos = (e: MouseEvent | TouchEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e && e.touches.length > 0) {
      const touch = e.touches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    const mouseEvent = e as MouseEvent;
    return { x: mouseEvent.clientX - rect.left, y: mouseEvent.clientY - rect.top };
  };

  const drawLine = (ctx: CanvasRenderingContext2D, from: Point, to: Point, color: string, lineWidth: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const handleRemoteDraw = (data: DrawData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawLine(ctx, data.from, data.to, data.color, data.lineWidth);
  };

  const startDraw = (e: MouseEvent | TouchEvent) => {
    drawing.current = true;
    lastPos.current = getMousePos(e);
  };

  const endDraw = () => {
    drawing.current = false;
    lastPos.current = null;
  };

  const moveDraw = (e: MouseEvent | TouchEvent) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const newPos = getMousePos(e);
    const prevPos = lastPos.current;
    if (!prevPos) {
      lastPos.current = newPos;
      return;
    }

    drawLine(ctx, prevPos, newPos, DEFAULT_COLOR, DEFAULT_LINE_WIDTH);

    // Emit to server
    socketRef.current?.emit("draw", {
      from: prevPos,
      to: newPos,
      color: DEFAULT_COLOR,
      lineWidth: DEFAULT_LINE_WIDTH,
    } as DrawData);

    lastPos.current = newPos;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.lineCap = "round";
    }

    // Socket.io setup
    const socket = io(SERVER_URL);
    socketRef.current = socket;
    socket.on("draw", handleRemoteDraw);

    // Mouse events
    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", moveDraw);
    window.addEventListener("mouseup", endDraw);
    canvas.addEventListener("mouseleave", endDraw);

    // Touch events
    canvas.addEventListener("touchstart", startDraw);
    canvas.addEventListener("touchmove", moveDraw);
    canvas.addEventListener("touchend", endDraw);
    canvas.addEventListener("touchcancel", endDraw);

    return () => {
      socket.disconnect();
      canvas.removeEventListener("mousedown", startDraw);
      canvas.removeEventListener("mousemove", moveDraw);
      window.removeEventListener("mouseup", endDraw);
      canvas.removeEventListener("mouseleave", endDraw);
      canvas.removeEventListener("touchstart", startDraw);
      canvas.removeEventListener("touchmove", moveDraw);
      canvas.removeEventListener("touchend", endDraw);
      canvas.removeEventListener("touchcancel", endDraw);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      style={{ border: "1px solid #000", touchAction: "none", cursor: "crosshair" }}
    />
  );
};

export default Whiteboard;