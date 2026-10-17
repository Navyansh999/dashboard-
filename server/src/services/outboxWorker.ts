import { db } from '../db/database.js';
import { OutboxJob } from '../types.js';
import { config } from '../config.js';

export type JobHandler = (payload: any) => Promise<void> | void;

export class OutboxWorker {
  private static handlers: Map<string, JobHandler> = new Map();
  private static timer: NodeJS.Timeout | null = null;
  private static isProcessing = false;
  private static processedNotificationIds: Set<string> = new Set();

  public static registerHandler(eventType: string, handler: JobHandler) {
    this.handlers.set(eventType, handler);
  }

  public static initializeDefaultHandlers() {
    this.registerHandler('NOTIFY_ASSIGNEE', async (payload) => {
      // Idempotent handler check
      const dedupKey = `notify-assignee-${payload.workItemId}-${payload.assigneeId}`;
      if (this.processedNotificationIds.has(dedupKey)) {
        return; // Idempotent skip
      }
      this.processedNotificationIds.add(dedupKey);
      // In production, would send Slack/email/push notification
      console.log(`[OutboxWorker] Dispatched notification for work item ${payload.workItemId} to assignee ${payload.assigneeId}`);
    });

    this.registerHandler('NOTIFY_APPROVAL_REQUEST', async (payload) => {
      const dedupKey = `approval-req-${payload.workItemId}-${payload.toStatus}`;
      if (this.processedNotificationIds.has(dedupKey)) {
        return;
      }
      this.processedNotificationIds.add(dedupKey);
      console.log(`[OutboxWorker] Dispatched Lead approval request for work item ${payload.workItemId}`);
    });

    this.registerHandler('NOTIFY_STATUS_CHANGE', async (payload) => {
      console.log(`[OutboxWorker] Work item ${payload.workItemId} moved to ${payload.toStatus}`);
    });

    this.registerHandler('AUDIT_EXPORT', async (payload) => {
      console.log(`[OutboxWorker] Exported audit telemetry for item ${payload.workItemId} v${payload.version}`);
    });
  }

  /**
   * Process pending outbox jobs in batch.
   * Can be called deterministically in unit tests or on a background loop.
   */
  public static async processNextBatch(limit = 10): Promise<{ processed: number; succeeded: number; failed: number }> {
    if (this.isProcessing) return { processed: 0, succeeded: 0, failed: 0 };
    this.isProcessing = true;

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    try {
      const now = new Date().toISOString();

      // Find pending jobs whose scheduled run time has passed
      const candidateJobs = db.all<OutboxJob>(
        `SELECT * FROM outbox_jobs
         WHERE status = 'PENDING' AND next_run_at <= ?
         ORDER BY created_at ASC
         LIMIT ?`,
        [now, limit]
      );

      for (const job of candidateJobs) {
        processed++;

        // Atomically claim the job by changing status to PROCESSING
        const claimResult = db.run(
          `UPDATE outbox_jobs
           SET status = 'PROCESSING', updated_at = ?
           WHERE id = ? AND status = 'PENDING'`,
          [now, job.id]
        );

        if (claimResult.changes === 0) {
          // Another concurrent worker claimed it
          continue;
        }

        try {
          const handler = this.handlers.get(job.event_type);
          if (!handler) {
            throw new Error(`No handler registered for event type ${job.event_type}`);
          }

          const parsedPayload = JSON.parse(job.payload);
          await handler(parsedPayload);

          // Job Succeeded -> COMPLETED
          const completeTime = new Date().toISOString();
          db.run(
            `UPDATE outbox_jobs
             SET status = 'COMPLETED', updated_at = ?
             WHERE id = ?`,
            [completeTime, job.id]
          );
          succeeded++;
        } catch (err: any) {
          failed++;
          const newRetryCount = job.retry_count + 1;
          const errorMsg = err?.message || 'Unknown processing error';
          const updateTime = new Date().toISOString();

          if (newRetryCount >= job.max_retries) {
            // Max retries exceeded -> FAILED
            db.run(
              `UPDATE outbox_jobs
               SET status = 'FAILED', retry_count = ?, last_error = ?, updated_at = ?
               WHERE id = ?`,
              [newRetryCount, errorMsg, updateTime, job.id]
            );
          } else {
            // Exponential backoff: 2^retry seconds
            const delayMs = Math.pow(2, newRetryCount) * 1000;
            const nextRun = new Date(Date.now() + delayMs).toISOString();

            db.run(
              `UPDATE outbox_jobs
               SET status = 'PENDING', retry_count = ?, last_error = ?, next_run_at = ?, updated_at = ?
               WHERE id = ?`,
              [newRetryCount, errorMsg, nextRun, updateTime, job.id]
            );
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return { processed, succeeded, failed };
  }

  public static start(intervalMs: number = config.outboxPollIntervalMs) {
    if (this.timer) return;
    this.initializeDefaultHandlers();

    this.timer = setInterval(async () => {
      try {
        await this.processNextBatch();
      } catch (err) {
        console.error('[OutboxWorker] Error during batch processing:', err);
      }
    }, intervalMs);

    console.log(`[OutboxWorker] Started background polling every ${intervalMs}ms`);
  }

  public static stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[OutboxWorker] Stopped background poller');
    }
  }

  public static listRecentJobs(limit = 30): OutboxJob[] {
    return db.all<OutboxJob>(
      `SELECT * FROM outbox_jobs ORDER BY created_at DESC LIMIT ?`,
      [limit]
    );
  }

  public static resetDeduplicationCache() {
    this.processedNotificationIds.clear();
  }
}
