import {
  WorkItem,
  UserWithMemberships,
  Team,
  ActivityEvent,
  Comment,
  OutboxJob
} from '../types';

export class ApiError extends Error {
  public status: number;
  public data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

let currentAuthToken: string | null = null;

export function setAuthToken(token: string | null) {
  currentAuthToken = token;
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit & { idempotencyKey?: string } = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (currentAuthToken) {
    headers.set('Authorization', `Bearer ${currentAuthToken}`);
  }

  if (options.idempotencyKey) {
    headers.set('Idempotency-Key', options.idempotencyKey);
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  const contentType = response.headers.get('content-type');
  let data: any = null;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = data?.error || response.statusText || 'Request failed';
    throw new ApiError(response.status, errorMsg, data);
  }

  return data as T;
}

// API Endpoints
export const api = {
  // Auth
  getDemoUsers: () => apiFetch<{ users: UserWithMemberships[] }>('/api/auth/demo-users'),
  login: (userId: string) =>
    apiFetch<{ token: string; user: UserWithMemberships }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ userId })
    }),
  getMe: () => apiFetch<{ user: UserWithMemberships }>('/api/auth/me'),

  // Teams
  getTeams: () => apiFetch<{ teams: Team[] }>('/api/teams'),

  // Work Items
  getWorkItems: (params: {
    teamId?: string;
    status?: string;
    priority?: string;
    type?: string;
    assigneeId?: string;
    q?: string;
    viewPreset?: string;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.set(key, String(val));
      }
    });
    return apiFetch<{
      items: WorkItem[];
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    }>(`/api/work-items?${query.toString()}`);
  },

  getWorkItem: (id: string) => apiFetch<{ item: WorkItem }>(`/api/work-items/${id}`),

  createWorkItem: (payload: any, idempotencyKey?: string) =>
    apiFetch<{ item: WorkItem }>('/api/work-items', {
      method: 'POST',
      body: JSON.stringify(payload),
      idempotencyKey
    }),

  updateWorkItem: (id: string, payload: { title?: string; description?: string; priority?: string; due_date?: string | null; version: number }) =>
    apiFetch<{ item: WorkItem }>(`/api/work-items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),

  claimWorkItem: (id: string) =>
    apiFetch<{ item: WorkItem; message: string }>(`/api/work-items/${id}/claim`, {
      method: 'POST'
    }),

  transitionWorkItem: (id: string, payload: { newStatus: string; expectedVersion: number; note?: string }) =>
    apiFetch<{ item: WorkItem; message: string }>(`/api/work-items/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  getActivityHistory: (id: string) =>
    apiFetch<{ history: ActivityEvent[] }>(`/api/work-items/${id}/activity`),

  getComments: (id: string) =>
    apiFetch<{ comments: Comment[] }>(`/api/work-items/${id}/comments`),

  addComment: (id: string, body: string) =>
    apiFetch<{ comment: Comment }>(`/api/work-items/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body })
    }),

  // Outbox
  getOutboxJobs: () => apiFetch<{ jobs: OutboxJob[] }>('/api/outbox'),
  processOutboxBatch: () => apiFetch<{ result: any; message: string }>('/api/outbox/process', { method: 'POST' })
};
