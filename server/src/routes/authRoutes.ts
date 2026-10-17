import { Router, Request, Response } from 'express';
import { AuthService } from '../services/authService.js';
import { authMiddleware } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.get('/demo-users', (req: Request, res: Response) => {
  const users = AuthService.listDemoUsers();
  res.json({ users });
});

authRouter.post('/login', (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  try {
    const session = AuthService.loginAs(userId);
    res.json(session);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

authRouter.get('/me', authMiddleware, (req: Request, res: Response) => {
  res.json({ user: req.user });
});
