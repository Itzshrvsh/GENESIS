import { Router, Request, Response } from 'express';

const router = Router();

/**
 * POST /auth/login
 * Placeholder login that accepts any credentials and returns a dummy JWT.
 */
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };

  // In a real implementation you would validate credentials here.
  // This placeholder simply returns a static token.
  const dummyToken = 'dummy-jwt-token';

  res.json({ token: dummyToken, user: { username: username || 'guest' } });
});

/**
 * POST /auth/register
 * Placeholder registration endpoint.
 */
router.post('/register', (req: Request, res: Response) => {
  // Normally you'd create a user record here.
  res.status(201).json({ message: 'User registered (placeholder)' });
});

export default router;