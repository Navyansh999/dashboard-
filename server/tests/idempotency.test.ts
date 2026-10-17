import { describe, it, expect, beforeEach } from 'vitest';
import { request, app, resetDatabase, getAuthToken, db } from './setup.js';

describe('Critical Behaviour 3: Idempotent Mutation Handling (Double-clicks & Retries)', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('creates only one work item and returns identical cached response when repeated with the same Idempotency-Key', async () => {
    const token = getAuthToken('user-sarah');
    const idempotencyKey = 'req-dedup-uuid-987654';

    const payload = {
      title: 'Idempotency Validation Work Item',
      description: 'Ensuring network retries do not result in duplicate records',
      type: 'OPERATIONAL_TASK',
      priority: 'MEDIUM',
      team_id: 'team-core'
    };

    // First request
    const res1 = await request(app)
      .post('/api/work-items')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(res1.status).toBe(201);
    expect(res1.body.item).toBeDefined();
    const createdItemId = res1.body.item.id;

    // Second request (simulating double-click or network retry)
    const res2 = await request(app)
      .post('/api/work-items')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(res2.status).toBe(201);
    expect(res2.headers['x-idempotent-replay']).toBe('true');
    expect(res2.body.item.id).toBe(createdItemId);
    expect(res2.body.item.title).toBe(payload.title);

    // Verify only 1 work item was created in the database with that title
    const countRow = db.get<any>(
      'SELECT COUNT(*) as count FROM work_items WHERE title = ?',
      [payload.title]
    );
    expect(countRow.count).toBe(1);

    // Verify idempotency record exists in DB
    const idempRecord = db.get<any>(
      'SELECT * FROM idempotency_keys WHERE idempotency_key = ?',
      [idempotencyKey]
    );
    expect(idempRecord).toBeDefined();
    expect(idempRecord.status_code).toBe(201);
  });
});
