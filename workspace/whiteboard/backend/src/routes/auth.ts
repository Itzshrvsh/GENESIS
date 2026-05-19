import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

interface User {
  id: string;
  username: string;
  password: string; // In a real app, passwords should be hashed
  token?: string;
}

// In‑memory user store (for demo purposes only)
const users: User[] = [];

const router = Router();

/**
 * Register a new user.
 * Body: { username: string, password: string }
 */
router.post('/register', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (users.find(u => u.username === username)) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      username,
      password,
    };
    users.push(newUser);

    // Generate a simple token
    newUser.token = crypto.randomBytes(24).toString('hex');

    res.status(201).json({ token: newUser.token, userId: newUser.id });
  } catch (err) {
    next(err);
  }
});

/**
 * Login an existing user.
 * Body: { username: string, password: string }
 */
router.post('/login', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = users.find(u => u.username === username && u.password === password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Refresh token on each login
    user.token = crypto.randomBytes(24).toString('hex');

    res.json({ token: user.token, userId: user.id });
  } catch (err) {
    next(err);
  }
});

export default router;