import { describe, it, expect, beforeEach } from 'vitest';
import { request, app, resetDatabase, getAuthToken, db } from './setup.js';

describe('Critical Behaviour 1: Concurrent Claim Race Condition', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('allows only one user to claim an unclaimed work item when two claim requests fire simultaneously', async () => {
    // wi-103 is an unassigned item in team-core
    // user-sarah and user-david are members of team-core
    const sarahToken = getAuthToken('user-sarah');
    const davidToken = getAuthToken('user-david');

    // Fire both claims concurrently in parallel
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/work-items/wi-103/claim')
        .set('Authorization', `Bearer ${sarahToken}`),
      request(app)
        .post('/api/work-items/wi-103/claim')
        .set('Authorization', `Bearer ${davidToken}`)
    ]);

    // One must succeed with 200, the other must be rejected with 409 Conflict
    const statusCodes = [res1.status, res2.status].sort();
    expect(statusCodes).toEqual([200, 409]);

    const winner = res1.status === 200 ? res1 : res2;
    const loser = res1.status === 409 ? res1 : res2;

    expect(winner.body.item.assignee_id).toBeTruthy();
    expect(winner.body.item.version).toBe(2); // incremented from 1 to 2
    expect(loser.body.error).toMatch(/Conflict: Work item was already claimed/);

    // Verify in database: Exactly one assignee, exactly one ASSIGNED activity event
    const itemInDb = db.get<any>('SELECT * FROM work_items WHERE id = ?', ['wi-103']);
    expect(itemInDb.assignee_id).toBe(winner.body.item.assignee_id);
    expect(itemInDb.version).toBe(2);

    const events = db.all<any>(
      "SELECT * FROM activity_events WHERE work_item_id = ? AND event_type = 'ASSIGNED'",
      ['wi-103']
    );
    expect(events.length).toBe(1);
  });
});
