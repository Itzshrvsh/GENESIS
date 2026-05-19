import React, { useRef, useEffect, useState } from 'react';
import { useBoard } from '../context/BoardContext';

const Canvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { points, addPoint, tool, color, strokeWidth } = useBoard();
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and redraw all points
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    points.forEach((point, index) => {
      if (point.type === 'start' || index === 0) return;
      const prevPoint = points[index - 1];
      
      ctx.beginPath();
      ctx.moveTo(prevPoint.x, prevPoint.y);
      ctx.lineTo(point.x, point.y);
      ctx.strokeStyle = point.color;
      ctx.lineWidth = point.size;
      ctx.stroke();
    });
  }, [points]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDrawing(true);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      addPoint({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        color: tool === 'eraser' ? '#ffffff' : color,
        size: strokeWidth,
        type: 'start'
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      addPoint({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        color: tool === 'eraser' ? '#ffffff' : color,
        size: strokeWidth,
        type: 'draw'
      });
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  return (
    <canvas
      ref={canvasRef}
      width={window.innerWidth - 100}
      height={window.innerHeight}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: 'crosshair', display: 'block' }}
    />
  );
};

export default Canvas;
