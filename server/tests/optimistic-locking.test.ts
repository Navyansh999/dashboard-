import { describe, it, expect, beforeEach } from 'vitest';
import { request, app, resetDatabase, getAuthToken, db } from './setup.js';

describe('Critical Behaviour 2: Optimistic Concurrency Control (Version Checking)', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('rejects stale edits with 409 Conflict when another user has already updated the item', async () => {
    // Both Sarah and David are in team-core. They both inspect wi-106 at version 2.
    const sarahToken = getAuthToken('user-sarah');
    const davidToken = getAuthToken('user-david');

    // 1. User Sarah submits an update with version: 2
    const sarahRes = await request(app)
      .patch('/api/work-items/wi-106')
      .set('Authorization', `Bearer ${sarahToken}`)
      .send({
        title: 'Kafka Broker #4 Disk Full - Retention Adjusted by Sarah',
        priority: 'HIGH',
        version: 2
      });

    expect(sarahRes.status).toBe(200);
    expect(sarahRes.body.item.version).toBe(3); // Successfully updated to v3
    expect(sarahRes.body.item.title).toContain('Adjusted by Sarah');

    // 2. User David attempts to submit his edit based on stale version: 2
    const davidRes = await request(app)
      .patch('/api/work-items/wi-106')
      .set('Authorization', `Bearer ${davidToken}`)
      .send({
        title: 'Kafka Broker #4 Disk Full - Conflicting Edit by David',
        priority: 'URGENT',
        version: 2 // Stale version!
      });

    expect(davidRes.status).toBe(409);
    expect(davidRes.body.code).toBe('ConflictError');
    expect(davidRes.body.error).toContain('Conflict: Work item was updated by another user');
    expect(davidRes.body.details.currentItem.version).toBe(3);
    expect(davidRes.body.details.expectedVersion).toBe(2);

    // Verify David's stale edit was NOT applied in DB
    const finalItem = db.get<any>('SELECT * FROM work_items WHERE id = ?', ['wi-106']);
    expect(finalItem.title).toBe('Kafka Broker #4 Disk Full - Retention Adjusted by Sarah');
    expect(finalItem.version).toBe(3);
  });
});
