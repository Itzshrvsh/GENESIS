import { Router, Request, Response, NextFunction } from 'express';
import { auth } from '../middleware/auth';

interface Board {
  id: number;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

const router = Router();

// In‑memory store (replace with DB in real app)
let boards: Board[] = [];
let nextId = 1;

// GET /boards – list all boards
router.get('/', auth, (_req: Request, res: Response) => {
  res.json(boards);
});

// POST /boards – create a new board
router.post('/', auth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    const now = new Date();
    const board: Board = {
      id: nextId++,
      title,
      createdAt: now,
      updatedAt: now,
    };
    boards.push(board);
    res.status(201).json(board);
  } catch (err) {
    next(err);
  }
});

// GET /boards/:id – get board by ID
router.get('/:id', auth, (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const board = boards.find(b => b.id === id);
  if (!board) {
    return res.status(404).json({ error: 'Board not found' });
  }
  res.json(board);
});

// PUT /boards/:id – update board title
router.put('/:id', auth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { title } = req.body;
    const board = boards.find(b => b.id === id);
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    board.title = title;
    board.updatedAt = new Date();
    res.json(board);
  } catch (err) {
    next(err);
  }
});

// DELETE /boards/:id – remove a board
router.delete('/:id', auth, (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const index = boards.findIndex(b => b.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Board not found' });
  }
  boards.splice(index, 1);
  res.status(204).send();
});

export default router;