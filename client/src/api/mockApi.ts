/**
 * Mock API — runs entirely in-browser when the backend is unavailable.
 * Used for the Vercel static deployment demo.
 * All mutations are applied to in-memory clones of the seed data.
 */
import { WorkItem, UserWithMemberships, Team, ActivityEvent, Comment, OutboxJob, WorkItemStatus } from '../types';
import { MOCK_USERS, MOCK_TEAMS, MOCK_WORK_ITEMS, MOCK_ACTIVITY, MOCK_COMMENTS, MOCK_OUTBOX_JOBS } from './mockData';

// Deep-clone mutable state
let items: WorkItem[] = JSON.parse(JSON.stringify(MOCK_WORK_ITEMS));
const activityMap: Record<string, ActivityEvent[]> = JSON.parse(JSON.stringify(MOCK_ACTIVITY));
const commentMap: Record<string, Comment[]> = JSON.parse(JSON.stringify(MOCK_COMMENTS));
let outboxJobs: OutboxJob[] = JSON.parse(JSON.stringify(MOCK_OUTBOX_JOBS));
let currentUserId = 'user-sarah';

// Simple JWT-like token (base64 user id)
function makeToken(userId: string): string {
  return `demo.${btoa(userId)}.mock`;
}

function getUserById(userId: string): UserWithMemberships | undefined {
  return MOCK_USERS.find((u) => u.id === userId);
}

function isAdminUser(userId: string): boolean {
  const u = getUserById(userId);
  return u?.memberships.some((m) => m.role === 'ADMIN') ?? false;
}

function canAccessTeam(userId: string, teamId: string): boolean {
  if (isAdminUser(userId)) return true;
  const u = getUserById(userId);
  return u?.memberships.some((m) => m.team_id === teamId) ?? false;
}

function isLeadForTeam(userId: string, teamId: string): boolean {
  if (isAdminUser(userId)) return true;
  const u = getUserById(userId);
  return u?.memberships.some((m) => m.team_id === teamId && (m.role === 'LEAD' || m.role === 'ADMIN')) ?? false;
}

function isViewer(userId: string, teamId: string): boolean {
  const u = getUserById(userId);
  const m = u?.memberships.find((m) => m.team_id === teamId);
  return m?.role === 'VIEWER';
}

function delay(ms = 80): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function addActivity(workItemId: string, actorId: string, eventType: ActivityEvent['event_type'], prev: string | null, next: string | null, note?: string) {
  const actor = getUserById(actorId);
  if (!activityMap[workItemId]) activityMap[workItemId] = [];
  activityMap[workItemId].push({
    id: `ae-${workItemId}-${Date.now()}`,
    work_item_id: workItemId,
    actor_id: actorId,
    actor_name: actor?.name,
    event_type: eventType,
    previous_value: prev,
    new_value: next,
    note: note || null,
    created_at: new Date().toISOString(),
  });
  // Add outbox job
  outboxJobs.push({
    id: `ob-${Date.now()}`,
    event_type: `WORK_ITEM_${eventType}`,
    payload: JSON.stringify({ workItemId, actorId }),
    status: 'PENDING',
    retry_count: 0,
    max_retries: 3,
    last_error: null,
    next_run_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

// ========================
// Mock API Methods
// ========================

export const mockApi = {
  getDemoUsers: async (): Promise<{ users: UserWithMemberships[] }> => {
    await delay();
    return { users: MOCK_USERS };
  },

  login: async (userId: string): Promise<{ token: string; user: UserWithMemberships }> => {
    await delay();
    const user = getUserById(userId);
    if (!user) throw new Error('User not found');
    currentUserId = userId;
    return { token: makeToken(userId), user };
  },

  getMe: async (): Promise<{ user: UserWithMemberships }> => {
    await delay();
    const user = getUserById(currentUserId);
    if (!user) throw new Error('Not authenticated');
    return { user };
  },

  getTeams: async (): Promise<{ teams: Team[] }> => {
    await delay();
    return { teams: MOCK_TEAMS };
  },

  getWorkItems: async (params: {
    teamId?: string;
    status?: string;
    priority?: string;
    type?: string;
    assigneeId?: string;
    q?: string;
    viewPreset?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: WorkItem[]; total: number; limit: number; offset: number; hasMore: boolean }> => {
    await delay();
    const user = getUserById(currentUserId);
    const limit = params.limit ?? 15;
    const offset = params.offset ?? 0;

    let filtered = items.filter((item) => canAccessTeam(currentUserId, item.team_id));

    if (params.teamId) filtered = filtered.filter((i) => i.team_id === params.teamId);
    if (params.status) filtered = filtered.filter((i) => i.status === params.status);
    if (params.priority) filtered = filtered.filter((i) => i.priority === params.priority);
    if (params.type) filtered = filtered.filter((i) => i.type === params.type);
    if (params.q) {
      const q = params.q.toLowerCase();
      filtered = filtered.filter((i) => i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
    }

    if (params.viewPreset === 'assigned_to_me') {
      filtered = filtered.filter((i) => i.assignee_id === currentUserId);
    } else if (params.viewPreset === 'unassigned_urgent') {
      filtered = filtered.filter((i) => !i.assignee_id && (i.priority === 'URGENT' || i.priority === 'HIGH'));
    } else if (params.viewPreset === 'awaiting_approval') {
      filtered = filtered.filter((i) => i.status === 'AWAITING_APPROVAL');
    }

    // Sort: URGENT first, then HIGH, then by updated_at desc
    const priorityOrder: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    filtered.sort((a, b) => {
      const pd = (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
      if (pd !== 0) return pd;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    const total = filtered.length;
    const page = filtered.slice(offset, offset + limit);
    return { items: page, total, limit, offset, hasMore: offset + limit < total };
  },

  getWorkItem: async (id: string): Promise<{ item: WorkItem }> => {
    await delay();
    const item = items.find((i) => i.id === id);
    if (!item) throw new Error('Not found');
    if (!canAccessTeam(currentUserId, item.team_id)) throw Object.assign(new Error('Forbidden'), { status: 403 });
    return { item };
  },

  createWorkItem: async (payload: any): Promise<{ item: WorkItem }> => {
    await delay();
    const team = MOCK_TEAMS.find((t) => t.id === payload.team_id);
    const creator = getUserById(currentUserId);
    if (isViewer(currentUserId, payload.team_id)) throw Object.assign(new Error('Forbidden: Viewers cannot create items'), { status: 403 });

    const newItem: WorkItem = {
      id: `wi-${Date.now()}`,
      title: payload.title,
      description: payload.description || '',
      type: payload.type,
      priority: payload.priority,
      status: 'OPEN',
      team_id: payload.team_id,
      team_name: team?.name,
      assignee_id: null,
      assignee_name: null,
      created_by_id: currentUserId,
      creator_name: creator?.name,
      due_date: payload.due_date || null,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    items = [newItem, ...items];
    addActivity(newItem.id, currentUserId, 'CREATED', null, 'OPEN');
    return { item: newItem };
  },

  updateWorkItem: async (id: string, payload: { title?: string; description?: string; priority?: string; due_date?: string | null; version: number }): Promise<{ item: WorkItem }> => {
    await delay();
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) throw Object.assign(new Error('Not found'), { status: 404 });
    const item = items[idx];
    if (!canAccessTeam(currentUserId, item.team_id)) throw Object.assign(new Error('Forbidden'), { status: 403 });
    if (isViewer(currentUserId, item.team_id)) throw Object.assign(new Error('Forbidden: Viewers cannot edit'), { status: 403 });
    // OCC check
    if (item.version !== payload.version) {
      throw Object.assign(new Error(`Conflict: item has been modified (expected v${payload.version}, server has v${item.version})`), {
        status: 409,
        data: { details: { currentItem: item } },
      });
    }

    const updated: WorkItem = {
      ...item,
      title: payload.title ?? item.title,
      description: payload.description ?? item.description,
      priority: (payload.priority as any) ?? item.priority,
      due_date: payload.due_date !== undefined ? payload.due_date : item.due_date,
      version: item.version + 1,
      updated_at: new Date().toISOString(),
    };
    items[idx] = updated;
    addActivity(id, currentUserId, 'UPDATED', null, null);
    return { item: updated };
  },

  claimWorkItem: async (id: string): Promise<{ item: WorkItem; message: string }> => {
    await delay();
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) throw Object.assign(new Error('Not found'), { status: 404 });
    const item = items[idx];
    if (!canAccessTeam(currentUserId, item.team_id)) throw Object.assign(new Error('Forbidden'), { status: 403 });
    if (isViewer(currentUserId, item.team_id)) throw Object.assign(new Error('Forbidden: Viewers cannot claim'), { status: 403 });
    if (item.assignee_id && item.assignee_id !== currentUserId) {
      throw Object.assign(new Error(`Conflict: Item already claimed by ${item.assignee_name}`), {
        status: 409,
        data: { details: { currentItem: item } },
      });
    }

    const claimUser = getUserById(currentUserId);
    const updated: WorkItem = {
      ...item,
      assignee_id: currentUserId,
      assignee_name: claimUser?.name,
      status: item.status === 'OPEN' ? 'IN_PROGRESS' : item.status,
      version: item.version + 1,
      updated_at: new Date().toISOString(),
    };
    items[idx] = updated;
    addActivity(id, currentUserId, 'ASSIGNED', item.assignee_id, currentUserId);
    if (updated.status !== item.status) addActivity(id, currentUserId, 'STATUS_CHANGED', item.status, updated.status);
    return { item: updated, message: 'Item claimed successfully' };
  },

  transitionWorkItem: async (id: string, payload: { newStatus: WorkItemStatus; expectedVersion: number; note?: string }): Promise<{ item: WorkItem; message: string }> => {
    await delay();
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) throw Object.assign(new Error('Not found'), { status: 404 });
    const item = items[idx];
    if (!canAccessTeam(currentUserId, item.team_id)) throw Object.assign(new Error('Forbidden'), { status: 403 });
    if (isViewer(currentUserId, item.team_id)) throw Object.assign(new Error('Forbidden: Viewers cannot transition'), { status: 403 });

    // OCC
    if (item.version !== payload.expectedVersion) {
      throw Object.assign(new Error(`Conflict: stale version (expected v${payload.expectedVersion}, server has v${item.version})`), {
        status: 409,
        data: { details: { currentItem: item } },
      });
    }

    // Lead gate for AWAITING_APPROVAL -> RESOLVED
    if (item.status === 'AWAITING_APPROVAL' && payload.newStatus === 'RESOLVED') {
      if (!isLeadForTeam(currentUserId, item.team_id)) {
        throw Object.assign(new Error('Forbidden: Only Leads or Admins can approve items'), { status: 403 });
      }
    }

    const updated: WorkItem = {
      ...item,
      status: payload.newStatus,
      version: item.version + 1,
      updated_at: new Date().toISOString(),
    };
    items[idx] = updated;
    addActivity(id, currentUserId, 'STATUS_CHANGED', item.status, payload.newStatus, payload.note);
    return { item: updated, message: `Status updated to ${payload.newStatus}` };
  },

  getActivityHistory: async (id: string): Promise<{ history: ActivityEvent[] }> => {
    await delay();
    return { history: (activityMap[id] || []).slice().reverse() };
  },

  getComments: async (id: string): Promise<{ comments: Comment[] }> => {
    await delay();
    return { comments: commentMap[id] || [] };
  },

  addComment: async (id: string, body: string): Promise<{ comment: Comment }> => {
    await delay();
    const user = getUserById(currentUserId);
    const comment: Comment = {
      id: `cm-${id}-${Date.now()}`,
      work_item_id: id,
      user_id: currentUserId,
      user_name: user?.name,
      user_avatar: user?.avatar,
      body,
      created_at: new Date().toISOString(),
    };
    if (!commentMap[id]) commentMap[id] = [];
    commentMap[id].push(comment);
    addActivity(id, currentUserId, 'COMMENT_ADDED', null, body.substring(0, 50));
    return { comment };
  },

  getOutboxJobs: async (): Promise<{ jobs: OutboxJob[] }> => {
    await delay();
    return { jobs: outboxJobs.slice().reverse() };
  },

  processOutboxBatch: async (): Promise<{ result: any; message: string }> => {
    await delay(300);
    let processed = 0;
    outboxJobs = outboxJobs.map((j) => {
      if (j.status === 'PENDING') {
        processed++;
        return { ...j, status: 'COMPLETED' as const, updated_at: new Date().toISOString() };
      }
      return j;
    });
    return { result: { processed }, message: `Mock: Processed ${processed} outbox job(s)` };
  },
};
