import { describe, it, expect, beforeEach } from 'vitest';
import { request, app, resetDatabase, getAuthToken, db } from './setup.js';

describe('Critical Behaviour 4: Workflow State Machine & Role-based Approvals', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('rejects illegal status jumps that violate the workflow state machine', async () => {
    // wi-103 is OPEN. An invalid jump is trying to move directly to CLOSED.
    const sarahToken = getAuthToken('user-sarah');

    const res = await request(app)
      .post('/api/work-items/wi-103/transition')
      .set('Authorization', `Bearer ${sarahToken}`)
      .send({
        newStatus: 'CLOSED',
        expectedVersion: 1
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BadRequestError');
    expect(res.body.error).toContain('Invalid workflow transition: Cannot move from OPEN to CLOSED');
  });

  it('prohibits non-Lead members from approving work items into RESOLVED status', async () => {
    // wi-102 is in team-payments, status AWAITING_APPROVAL, version 3.
    // user-zainab is a regular MEMBER of team-payments (not LEAD).
    const zainabToken = getAuthToken('user-zainab');

    const res = await request(app)
      .post('/api/work-items/wi-102/transition')
      .set('Authorization', `Bearer ${zainabToken}`)
      .send({
        newStatus: 'RESOLVED',
        expectedVersion: 3,
        note: 'Attempting to self-approve without lead role'
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ForbiddenError');
    expect(res.body.error).toContain('Only a team Lead or Admin can approve items from AWAITING_APPROVAL to RESOLVED');

    // Status in DB remains unchanged
    const item = db.get<any>('SELECT status FROM work_items WHERE id = ?', ['wi-102']);
    expect(item.status).toBe('AWAITING_APPROVAL');
  });

  it('permits team Leads to approve work items from AWAITING_APPROVAL to RESOLVED', async () => {
    // user-elena is a LEAD of team-payments.
    const elenaToken = getAuthToken('user-elena');

    const res = await request(app)
      .post('/api/work-items/wi-102/transition')
      .set('Authorization', `Bearer ${elenaToken}`)
      .send({
        newStatus: 'RESOLVED',
        expectedVersion: 3,
        note: 'Lead approved following verification of SWIFT ledger batch'
      });

    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe('RESOLVED');
    expect(res.body.item.version).toBe(4);

    // Activity event recorded
    const event = db.get<any>(
      "SELECT * FROM activity_events WHERE work_item_id = 'wi-102' AND new_value = 'RESOLVED'"
    );
    expect(event).toBeDefined();
    expect(event.actor_id).toBe('user-elena');
  });
});
