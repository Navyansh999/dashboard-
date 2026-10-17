import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService.js';
import { UserWithMemberships } from '../types.js';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: UserWithMemberships;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = AuthService.verifyToken(token);
    const user = AuthService.getUserWithMemberships(payload.sub);

    if (!user) {
      res.status(401).json({ error: 'Unauthorized: User does not exist' });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}
