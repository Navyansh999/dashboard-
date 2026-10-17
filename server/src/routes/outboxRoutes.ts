import { Router, Request, Response } from 'express';
import { OutboxWorker } from '../services/outboxWorker.js';
import { authMiddleware } from '../middleware/auth.js';

export const outboxRouter = Router();

outboxRouter.use(authMiddleware);

// List recent outbox jobs
outboxRouter.get('/', (req: Request, res: Response) => {
  const jobs = OutboxWorker.listRecentJobs(50);
  res.json({ jobs });
});

// Trigger batch run manually (for immediate demo or verification)
outboxRouter.post('/process', async (req: Request, res: Response) => {
  const result = await OutboxWorker.processNextBatch();
  res.json({ result, message: 'Outbox batch execution complete' });
});
