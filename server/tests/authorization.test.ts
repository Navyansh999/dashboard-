import { describe, it, expect, beforeEach } from 'vitest';
import { request, app, resetDatabase, getAuthToken } from './setup.js';

describe('Critical Behaviour 5: Resource-Level Authorization', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('rejects cross-team access when a user attempts to read items from an unauthorized team', async () => {
    // user-alex belongs ONLY to team-support (Customer Operations)
    // team-core has work item wi-103
    const alexToken = getAuthToken('user-alex');

    const res = await request(app)
      .get('/api/work-items/wi-103')
      .set('Authorization', `Bearer ${alexToken}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ForbiddenError');
    expect(res.body.error).toContain('You do not have permission to view work items for team team-core');
  });

  it('rejects cross-team modification when a user attempts to claim an item in another team', async () => {
    const alexToken = getAuthToken('user-alex');

    const res = await request(app)
      .post('/api/work-items/wi-103/claim')
      .set('Authorization', `Bearer ${alexToken}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ForbiddenError');
  });

  it('allows company-wide ADMIN users to access work items across all teams', async () => {
    // user-priya has role ADMIN
    const priyaToken = getAuthToken('user-priya');

    // Access item in team-support
    const res = await request(app)
      .get('/api/work-items/wi-105')
      .set('Authorization', `Bearer ${priyaToken}`);

    expect(res.status).toBe(200);
    expect(res.body.item.id).toBe('wi-105');
  });
});
