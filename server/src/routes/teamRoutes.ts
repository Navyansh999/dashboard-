import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { Team } from '../types.js';

export const teamRouter = Router();

teamRouter.get('/', authMiddleware, (req: Request, res: Response) => {
  const teams = db.all<Team & { member_count: number }>(`
    SELECT t.*, COUNT(tm.id) as member_count
    FROM teams t
    LEFT JOIN team_memberships tm ON t.id = tm.team_id
    GROUP BY t.id
    ORDER BY t.name ASC
  `);

  res.json({ teams });
});

teamRouter.get('/:id/members', authMiddleware, (req: Request, res: Response) => {
  const members = db.all(`
    SELECT tm.id as membership_id, tm.role, u.id as user_id, u.name, u.email, u.avatar
    FROM team_memberships tm
    JOIN users u ON tm.user_id = u.id
    WHERE tm.team_id = ?
    ORDER BY u.name ASC
  `, [req.params.id as string]);

  res.json({ members });
});
