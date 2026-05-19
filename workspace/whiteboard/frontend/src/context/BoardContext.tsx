import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import useBoardSocket from '../sockets/useBoardSocket';

type Point = {
  x: number;
  y: number;
  color: string;
  size: number;
  type: 'start' | 'draw';
};

type BoardContextType = {
  boardId: string | null;
  setBoardId: (id: string) => void;
  points: Point[];
  addPoint: (point: Point) => void;
  tool: string;
  setTool: (tool: string) => void;
  color: string;
  setColor: (color: string) => void;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
};

export const BoardContext = createContext<BoardContextType | undefined>(undefined);

export const BoardProvider = ({ boardId, children }: { boardId: string, children: ReactNode }) => {
  const [points, setPoints] = useState<Point[]>([]);
  const [tool, setTool] = useState<string>('pen');
  const [color, setColor] = useState<string>('#000000');
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  
  const pointsBuffer = React.useRef<Point[]>([]);

  const { sendPoints, clearBoard } = useBoardSocket(boardId, (receivedPoints) => {
    setPoints((prev) => [...prev, ...receivedPoints]);
  });

  useEffect(() => {
    const interval = setInterval(() => {
      if (pointsBuffer.current.length > 0) {
        sendPoints([...pointsBuffer.current]);
        pointsBuffer.current = [];
      }
    }, 50);
    return () => clearInterval(interval);
  }, [sendPoints]);

  const addPoint = (point: Point) => {
    pointsBuffer.current.push(point);
    setPoints((prev) => [...prev, point]); // optimistic update
  };

  return (
    <BoardContext.Provider
      value={{ 
        boardId, 
        setBoardId: () => {}, 
        points, 
        addPoint,
        tool,
        setTool,
        color,
        setColor,
        strokeWidth,
        setStrokeWidth
      }}
    >
      {children}
    </BoardContext.Provider>
  );
};

export default BoardProvider;

export const useBoard = () => {
  const context = useContext(BoardContext);
  if (context === undefined) {
    throw new Error('useBoard must be used within a BoardProvider');
  }
  return context;
};