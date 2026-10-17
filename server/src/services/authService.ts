import jwt from 'jsonwebtoken';
import { db } from '../db/database.js';
import { config } from '../config.js';
import { User, UserWithMemberships, UserRole } from '../types.js';

export class AuthService {
  public static listDemoUsers(): UserWithMemberships[] {
    const users = db.all<User>('SELECT * FROM users ORDER BY name ASC');
    return users.map((u) => this.getUserWithMemberships(u.id)!);
  }

  public static getUserWithMemberships(userId: string): UserWithMemberships | null {
    const user = db.get<User>('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) return null;

    const memberships = db.all<{ team_id: string; team_name: string; role: UserRole }>(
      `SELECT tm.team_id, t.name as team_name, tm.role
       FROM team_memberships tm
       JOIN teams t ON tm.team_id = t.id
       WHERE tm.user_id = ?`,
      [userId]
    );

    return {
      ...user,
      memberships
    };
  }

  public static loginAs(userId: string): { token: string; user: UserWithMemberships } {
    const user = this.getUserWithMemberships(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name
      },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    return { token, user };
  }

  public static verifyToken(token: string): { sub: string; email: string; name: string } {
    return jwt.verify(token, config.jwtSecret) as { sub: string; email: string; name: string };
  }
}
