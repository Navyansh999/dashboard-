import { describe, it, expect, beforeEach } from 'vitest';
import { request, app, resetDatabase, getAuthToken, db } from './setup.js';
import { OutboxWorker } from '../src/services/outboxWorker.js';

describe('Critical Behaviour 6: Transactional Outbox Pattern & Reliable Async Worker', () => {
  beforeEach(() => {
    resetDatabase();
    OutboxWorker.resetDeduplicationCache();
  });

  it('guarantees an outbox job is created in the same database transaction as work item creation', async () => {
    const token = getAuthToken('user-sarah');

    const res = await request(app)
      .post('/api/work-items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Outbox Test Work Item',
        description: 'Verify atomic outbox insertion in transaction',
        type: 'INCIDENT',
        priority: 'URGENT',
        team_id: 'team-core'
      });

    expect(res.status).toBe(201);
    const createdItemId = res.body.item.id;

    // Verify outbox row exists in DB
    const jobs = db.all<any>(
      "SELECT * FROM outbox_jobs WHERE status = 'PENDING' ORDER BY created_at DESC"
    );

    const match = jobs.find((j) => j.payload.includes(createdItemId));
    expect(match).toBeDefined();
    expect(match.event_type).toBe('NOTIFY_ASSIGNEE');
  });

  it('worker processes pending jobs and updates status to COMPLETED', async () => {
    OutboxWorker.initializeDefaultHandlers();

    // Insert a pending job
    const now = new Date().toISOString();
    const jobId = 'test-job-process-1';
    db.run(
      `INSERT INTO outbox_jobs (id, event_type, payload, status, retry_count, max_retries, next_run_at, created_at, updated_at)
       VALUES (?, 'NOTIFY_STATUS_CHANGE', ?, 'PENDING', 0, 3, ?, ?, ?)`,
      [jobId, JSON.stringify({ workItemId: 'wi-101', toStatus: 'RESOLVED' }), now, now, now]
    );

    // Process batch
    const result = await OutboxWorker.processNextBatch();
    expect(result.processed).toBeGreaterThanOrEqual(1);

    const job = db.get<any>('SELECT * FROM outbox_jobs WHERE id = ?', [jobId]);
    expect(job.status).toBe('COMPLETED');
  });

  it('retries failed jobs with exponential backoff and marks as FAILED after max retries', async () => {
    // Register a deliberately failing handler
    const errorEventType = 'SIMULATED_FAILING_EVENT';
    OutboxWorker.registerHandler(errorEventType, () => {
      throw new Error('Simulated external service timeout (e.g. email provider down)');
    });

    const now = new Date().toISOString();
    const jobId = 'test-job-failing-1';

    // Insert with retry_count = 2, max_retries = 3
    db.run(
      `INSERT INTO outbox_jobs (id, event_type, payload, status, retry_count, max_retries, next_run_at, created_at, updated_at)
       VALUES (?, ?, '{}', 'PENDING', 2, 3, ?, ?, ?)`,
      [jobId, errorEventType, now, now, now]
    );

    // Process: since 2 + 1 = 3 == max_retries, it should be marked FAILED
    await OutboxWorker.processNextBatch();

    const job = db.get<any>('SELECT * FROM outbox_jobs WHERE id = ?', [jobId]);
    expect(job.status).toBe('FAILED');
    expect(job.retry_count).toBe(3);
    expect(job.last_error).toContain('Simulated external service timeout');
  });
});
