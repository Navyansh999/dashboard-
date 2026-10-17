import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  jwtSecret: process.env.JWT_SECRET || 'newtonite_super_secret_jwt_key_2026',
  dbPath: process.env.DATABASE_PATH || path.resolve(process.cwd(), 'newtonite.db'),
  outboxPollIntervalMs: parseInt(process.env.OUTBOX_POLL_INTERVAL_MS || '2000', 10),
  nodeEnv: process.env.NODE_ENV || 'development'
};
