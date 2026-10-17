import {
  WorkItem,
  UserWithMemberships,
  Team,
  ActivityEvent,
  Comment,
  OutboxJob
} from '../types';
import { mockApi } from './mockApi';

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

// Auto-detect static deployment: if NOT running on localhost/127.0.0.1,
// there is no backend — switch directly to mock mode.
// This prevents Vercel's SPA rewrite from silently returning index.html
// for /api/* routes (HTTP 200 with HTML body instead of JSON).
const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.'));

let useMock = !isLocalhost; // true on Vercel / any non-local host


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

// ── Mock-aware wrappers ────────────────────────────────────────────────────────
// Each method tries the real backend first. On network/server error it switches
// to the in-browser mock for the rest of the session.

async function withFallback<T>(realFn: () => Promise<T>, mockFn: () => Promise<T>): Promise<T> {
  if (useMock) return mockFn();
  try {
    return await realFn();
  } catch (err: any) {
    // Switch to mock if we get a network error or 5xx from the server
    if (!err.status || err.status >= 500 || err.message === 'Failed to fetch') {
      console.warn('[Newtonite] Backend unavailable — switching to demo mode');
      useMock = true;
      return mockFn();
    }
    // Re-throw 4xx (auth/validation errors) as ApiErrors so UI can handle them
    if (err instanceof ApiError) throw err;
    throw Object.assign(new ApiError(err.status || 500, err.message, err.data), { status: err.status });
  }
}

// Wrap mock errors so they have the same ApiError shape
async function wrapMockError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    throw new ApiError(err.status || 500, err.message, err.data);
  }
}

// API Endpoints
export const api = {
  // Auth
  getDemoUsers: () =>
    withFallback(
      () => apiFetch<{ users: UserWithMemberships[] }>('/api/auth/demo-users'),
      () => mockApi.getDemoUsers()
    ),

  login: (userId: string) =>
    withFallback(
      () => apiFetch<{ token: string; user: UserWithMemberships }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ userId })
      }),
      () => mockApi.login(userId)
    ),

  getMe: () =>
    withFallback(
      () => apiFetch<{ user: UserWithMemberships }>('/api/auth/me'),
      () => mockApi.getMe()
    ),

  // Teams
  getTeams: () =>
    withFallback(
      () => apiFetch<{ teams: Team[] }>('/api/teams'),
      () => mockApi.getTeams()
    ),

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
    return withFallback(
      () => apiFetch<{
        items: WorkItem[];
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
      }>(`/api/work-items?${query.toString()}`),
      () => mockApi.getWorkItems(params)
    );
  },

  getWorkItem: (id: string) =>
    withFallback(
      () => apiFetch<{ item: WorkItem }>(`/api/work-items/${id}`),
      () => wrapMockError(() => mockApi.getWorkItem(id))
    ),

  createWorkItem: (payload: any, idempotencyKey?: string) =>
    withFallback(
      () => apiFetch<{ item: WorkItem }>('/api/work-items', {
        method: 'POST',
        body: JSON.stringify(payload),
        idempotencyKey
      }),
      () => wrapMockError(() => mockApi.createWorkItem(payload))
    ),

  updateWorkItem: (id: string, payload: { title?: string; description?: string; priority?: string; due_date?: string | null; version: number }) =>
    withFallback(
      () => apiFetch<{ item: WorkItem }>(`/api/work-items/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      }),
      () => wrapMockError(() => mockApi.updateWorkItem(id, payload))
    ),

  claimWorkItem: (id: string) =>
    withFallback(
      () => apiFetch<{ item: WorkItem; message: string }>(`/api/work-items/${id}/claim`, {
        method: 'POST'
      }),
      () => wrapMockError(() => mockApi.claimWorkItem(id))
    ),

  transitionWorkItem: (id: string, payload: { newStatus: string; expectedVersion: number; note?: string }) =>
    withFallback(
      () => apiFetch<{ item: WorkItem; message: string }>(`/api/work-items/${id}/transition`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
      () => wrapMockError(() => mockApi.transitionWorkItem(id, payload as any))
    ),

  getActivityHistory: (id: string) =>
    withFallback(
      () => apiFetch<{ history: ActivityEvent[] }>(`/api/work-items/${id}/activity`),
      () => mockApi.getActivityHistory(id)
    ),

  getComments: (id: string) =>
    withFallback(
      () => apiFetch<{ comments: Comment[] }>(`/api/work-items/${id}/comments`),
      () => mockApi.getComments(id)
    ),

  addComment: (id: string, body: string) =>
    withFallback(
      () => apiFetch<{ comment: Comment }>(`/api/work-items/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body })
      }),
      () => wrapMockError(() => mockApi.addComment(id, body))
    ),

  // Outbox
  getOutboxJobs: () =>
    withFallback(
      () => apiFetch<{ jobs: OutboxJob[] }>('/api/outbox'),
      () => mockApi.getOutboxJobs()
    ),

  processOutboxBatch: () =>
    withFallback(
      () => apiFetch<{ result: any; message: string }>('/api/outbox/process', { method: 'POST' }),
      () => mockApi.processOutboxBatch()
    ),

  // Utility: check if currently in mock/demo mode
  isMockMode: () => useMock,
};
