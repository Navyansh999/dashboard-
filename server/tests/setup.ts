import request from 'supertest';
import { app } from '../src/index.js';
import { runSeed } from '../src/db/seed.js';
import { db } from '../src/db/database.js';
import { AuthService } from '../src/services/authService.js';

export function resetDatabase() {
  runSeed(db);
}

export function getAuthToken(userId: string): string {
  const session = AuthService.loginAs(userId);
  return session.token;
}

export { request, app, db };
