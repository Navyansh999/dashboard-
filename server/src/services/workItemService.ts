import crypto from 'node:crypto';
import { db } from '../db/database.js';
import {
  WorkItem,
  WorkItemPriority,
  WorkItemStatus,
  WorkItemType,
  ActivityEvent,
  Comment,
  UserWithMemberships,
  ALLOWED_TRANSITIONS,
  APPROVAL_ALLOWED_ROLES
} from '../types.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError
} from '../middleware/errorHandler.js';
import {
  canAccessTeam,
  getUserTeamRole,
  hasMinimumRole
} from '../middleware/authorize.js';

export interface CreateWorkItemInput {
  title: string;
  description: string;
  type: WorkItemType;
  priority: WorkItemPriority;
  team_id: string;
  assignee_id?: string | null;
  due_date?: string | null;
}

export interface UpdateWorkItemInput {
  title?: string;
  description?: string;
  priority?: WorkItemPriority;
  due_date?: string | null;
  version: number;
}

export interface ListWorkItemsParams {
  teamId?: string;
  status?: string;
  priority?: string;
  type?: string;
  assigneeId?: string;
  q?: string;
  viewPreset?: 'all' | 'assigned_to_me' | 'unassigned_urgent' | 'awaiting_approval';
  limit?: number;
  offset?: number;
}

export class WorkItemService {
  /**
   * List work items with server-side filtering, search, and pagination.
   * Scoped to the teams the requesting user has access to.
   */
  public static listWorkItems(
    user: UserWithMemberships,
    params: ListWorkItemsParams
  ): { items: WorkItem[]; total: number; limit: number; offset: number; hasMore: boolean } {
    const isGlobalAdmin = user.memberships.some((m) => m.role === 'ADMIN');
    const userTeamIds = user.memberships.map((m) => m.team_id);

    const conditions: string[] = [];
    const values: any[] = [];

    // Team filtering & resource-level scoping
    if (params.teamId) {
      if (!isGlobalAdmin && !canAccessTeam(user, params.teamId)) {
        throw new ForbiddenError(`You do not have permission to view items for team ${params.teamId}`);
      }
      conditions.push('wi.team_id = ?');
      values.push(params.teamId);
    } else if (!isGlobalAdmin) {
      if (userTeamIds.length === 0) {
        return { items: [], total: 0, limit: params.limit || 20, offset: params.offset || 0, hasMore: false };
      }
      const placeholders = userTeamIds.map(() => '?').join(',');
      conditions.push(`wi.team_id IN (${placeholders})`);
      values.push(...userTeamIds);
    }

    // View Presets
    if (params.viewPreset === 'assigned_to_me') {
      conditions.push('wi.assignee_id = ?');
      values.push(user.id);
    } else if (params.viewPreset === 'unassigned_urgent') {
      conditions.push('wi.assignee_id IS NULL');
      conditions.push("wi.priority IN ('URGENT', 'HIGH')");
      conditions.push("wi.status NOT IN ('RESOLVED', 'CLOSED')");
    } else if (params.viewPreset === 'awaiting_approval') {
      conditions.push("wi.status = 'AWAITING_APPROVAL'");
    }

    // Specific filters
    if (params.status) {
      conditions.push('wi.status = ?');
      values.push(params.status);
    }

    if (params.priority) {
      conditions.push('wi.priority = ?');
      values.push(params.priority);
    }

    if (params.type) {
      conditions.push('wi.type = ?');
      values.push(params.type);
    }

    if (params.assigneeId) {
      conditions.push('wi.assignee_id = ?');
      values.push(params.assigneeId);
    }

    if (params.q && params.q.trim()) {
      conditions.push('(wi.title LIKE ? OR wi.description LIKE ?)');
      const pattern = `%${params.q.trim()}%`;
      values.push(pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total Count
    const countSql = `SELECT COUNT(*) as total FROM work_items wi ${whereClause}`;
    const countRow = db.get<{ total: number }>(countSql, values);
    const total = countRow ? countRow.total : 0;

    // Pagination
    const limit = Math.min(Math.max(params.limit || 20, 1), 100);
    const offset = Math.max(params.offset || 0, 0);

    const querySql = `
      SELECT 
        wi.*,
        t.name as team_name,
        u_assignee.name as assignee_name,
        u_creator.name as creator_name
      FROM work_items wi
      JOIN teams t ON wi.team_id = t.id
      LEFT JOIN users u_assignee ON wi.assignee_id = u_assignee.id
      JOIN users u_creator ON wi.created_by_id = u_creator.id
      ${whereClause}
      ORDER BY 
        CASE wi.priority
          WHEN 'URGENT' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          WHEN 'LOW' THEN 4
        END ASC,
        wi.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const items = db.all<WorkItem>(querySql, [...values, limit, offset]);

    return {
      items,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total
    };
  }

  /**
   * Get work item by ID with authorization check.
   */
  public static getWorkItemById(user: UserWithMemberships, itemId: string): WorkItem {
    const querySql = `
      SELECT 
        wi.*,
        t.name as team_name,
        u_assignee.name as assignee_name,
        u_creator.name as creator_name
      FROM work_items wi
      JOIN teams t ON wi.team_id = t.id
      LEFT JOIN users u_assignee ON wi.assignee_id = u_assignee.id
      JOIN users u_creator ON wi.created_by_id = u_creator.id
      WHERE wi.id = ?
    `;

    const item = db.get<WorkItem>(querySql, [itemId]);
    if (!item) {
      throw new NotFoundError(`Work item ${itemId} not found`);
    }

    if (!canAccessTeam(user, item.team_id)) {
      throw new ForbiddenError(`You do not have permission to view work items for team ${item.team_id}`);
    }

    return item;
  }

  /**
   * Create work item.
   * Atomically records work item, audit history event, and transactional outbox job.
   */
  public static createWorkItem(user: UserWithMemberships, input: CreateWorkItemInput): WorkItem {
    if (!hasMinimumRole(user, input.team_id, 'MEMBER')) {
      throw new ForbiddenError(`You must be at least a Member in team ${input.team_id} to create work items`);
    }

    const id = `wi-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();

    return db.transaction(() => {
      db.run(
        `INSERT INTO work_items (
          id, title, description, type, priority, status,
          team_id, assignee_id, created_by_id, due_date,
          version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, ?, 1, ?, ?)`,
        [
          id,
          input.title,
          input.description,
          input.type,
          input.priority,
          input.team_id,
          input.assignee_id || null,
          user.id,
          input.due_date || null,
          now,
          now
        ]
      );

      // 1. Audit event
      db.run(
        `INSERT INTO activity_events (id, work_item_id, actor_id, event_type, previous_value, new_value, note, created_at)
         VALUES (?, ?, ?, 'CREATED', NULL, 'OPEN', ?, ?)`,
        [`ev-${crypto.randomUUID()}`, id, user.id, `Created work item: ${input.title}`, now]
      );

      // 2. Transactional Outbox Job
      db.run(
        `INSERT INTO outbox_jobs (id, event_type, payload, status, next_run_at, created_at, updated_at)
         VALUES (?, 'NOTIFY_ASSIGNEE', ?, 'PENDING', ?, ?, ?)`,
        [
          `job-${crypto.randomUUID()}`,
          JSON.stringify({
            workItemId: id,
            title: input.title,
            assigneeId: input.assignee_id || null,
            priority: input.priority,
            creatorId: user.id
          }),
          now,
          now,
          now
        ]
      );

      return this.getWorkItemById(user, id);
    });
  }

  /**
   * Critical Behaviour 1: Atomic Claim with Conditional Update
   * Prevents two users from taking responsibility for the same work item.
   * Uses conditional SQL: WHERE id = ? AND assignee_id IS NULL
   */
  public static claimWorkItem(user: UserWithMemberships, itemId: string): WorkItem {
    const item = this.getWorkItemById(user, itemId);

    if (!hasMinimumRole(user, item.team_id, 'MEMBER')) {
      throw new ForbiddenError(`You must be at least a Member in team ${item.team_id} to claim work items`);
    }

    const now = new Date().toISOString();

    return db.transaction(() => {
      // Atomic conditional update
      const result = db.run(
        `UPDATE work_items
         SET assignee_id = ?, updated_at = ?, version = version + 1
         WHERE id = ? AND assignee_id IS NULL`,
        [user.id, now, itemId]
      );

      if (result.changes === 0) {
        // Fetch current owner to return accurate 409 Conflict information
        const current = db.get<WorkItem>(
          `SELECT wi.*, u.name as assignee_name 
           FROM work_items wi 
           LEFT JOIN users u ON wi.assignee_id = u.id 
           WHERE wi.id = ?`,
          [itemId]
        );

        throw new ConflictError(
          `Conflict: Work item was already claimed by ${current?.assignee_name || 'another team member'}.`,
          { currentItem: current }
        );
      }

      // Record activity event in the same transaction
      db.run(
        `INSERT INTO activity_events (id, work_item_id, actor_id, event_type, previous_value, new_value, note, created_at)
         VALUES (?, ?, ?, 'ASSIGNED', NULL, ?, ?, ?)`,
        [`ev-${crypto.randomUUID()}`, itemId, user.id, user.id, `${user.name} claimed this work item.`, now]
      );

      // Queue Outbox notification
      db.run(
        `INSERT INTO outbox_jobs (id, event_type, payload, status, next_run_at, created_at, updated_at)
         VALUES (?, 'NOTIFY_ASSIGNEE', ?, 'PENDING', ?, ?, ?)`,
        [
          `job-${crypto.randomUUID()}`,
          JSON.stringify({
            workItemId: itemId,
            assigneeId: user.id,
            action: 'CLAIMED'
          }),
          now,
          now,
          now
        ]
      );

      return this.getWorkItemById(user, itemId);
    });
  }

  /**
   * Critical Behaviour 2: Optimistic Concurrency Control (Version Checking)
   * Prevents overwriting changes when multiple users edit concurrently.
   * Client sends current version; update succeeds ONLY if version matches.
   */
  public static updateWorkItem(
    user: UserWithMemberships,
    itemId: string,
    updates: UpdateWorkItemInput
  ): WorkItem {
    const existing = this.getWorkItemById(user, itemId);

    if (!hasMinimumRole(user, existing.team_id, 'MEMBER')) {
      throw new ForbiddenError(`You must be at least a Member in team ${existing.team_id} to edit work items`);
    }

    const title = updates.title ?? existing.title;
    const description = updates.description ?? existing.description;
    const priority = updates.priority ?? existing.priority;
    const dueDate = updates.due_date !== undefined ? updates.due_date : existing.due_date;
    const now = new Date().toISOString();

    return db.transaction(() => {
      const result = db.run(
        `UPDATE work_items
         SET title = ?, description = ?, priority = ?, due_date = ?, updated_at = ?, version = version + 1
         WHERE id = ? AND version = ?`,
        [title, description, priority, dueDate, now, itemId, updates.version]
      );

      if (result.changes === 0) {
        const latest = this.getWorkItemById(user, itemId);
        throw new ConflictError(
          `Conflict: Work item was updated by another user (Server version: ${latest.version}, Your version: ${updates.version}). Please reload latest data.`,
          { currentItem: latest, expectedVersion: updates.version }
        );
      }

      // Record update event
      db.run(
        `INSERT INTO activity_events (id, work_item_id, actor_id, event_type, previous_value, new_value, note, created_at)
         VALUES (?, ?, ?, 'UPDATED', ?, ?, ?, ?)`,
        [
          `ev-${crypto.randomUUID()}`,
          itemId,
          user.id,
          `v${updates.version}`,
          `v${updates.version + 1}`,
          `${user.name} updated item details.`,
          now
        ]
      );

      // Outbox job for audit sync
      db.run(
        `INSERT INTO outbox_jobs (id, event_type, payload, status, next_run_at, created_at, updated_at)
         VALUES (?, 'AUDIT_EXPORT', ?, 'PENDING', ?, ?, ?)`,
        [
          `job-${crypto.randomUUID()}`,
          JSON.stringify({ workItemId: itemId, actorId: user.id, version: updates.version + 1 }),
          now,
          now,
          now
        ]
      );

      return this.getWorkItemById(user, itemId);
    });
  }

  /**
   * Critical Behaviour 4: Workflow State Machine & Role-based Approvals
   * Enforces valid transitions and restricts AWAITING_APPROVAL -> RESOLVED to Leads.
   */
  public static transitionStatus(
    user: UserWithMemberships,
    itemId: string,
    newStatus: WorkItemStatus,
    expectedVersion: number,
    note?: string
  ): WorkItem {
    const item = this.getWorkItemById(user, itemId);

    // 1. Check allowed state transitions
    const allowed = ALLOWED_TRANSITIONS[item.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestError(
        `Invalid workflow transition: Cannot move from ${item.status} to ${newStatus}. Allowed transitions: ${allowed.join(', ') || 'None'}`
      );
    }

    // 2. Role-based workflow restriction: Approvals require LEAD or ADMIN role
    if (item.status === 'AWAITING_APPROVAL' && newStatus === 'RESOLVED') {
      const userRole = getUserTeamRole(user, item.team_id);
      if (!userRole || !APPROVAL_ALLOWED_ROLES.includes(userRole)) {
        throw new ForbiddenError(
          `Workflow Rule Violation: Only a team Lead or Admin can approve items from AWAITING_APPROVAL to RESOLVED. Your role in team is ${userRole || 'NONE'}.`
        );
      }
    } else {
      // General transition requires at least MEMBER
      if (!hasMinimumRole(user, item.team_id, 'MEMBER')) {
        throw new ForbiddenError(`You must be at least a Member in team ${item.team_id} to progress work items`);
      }
    }

    const now = new Date().toISOString();

    return db.transaction(() => {
      // Optimistic concurrency check during transition
      const result = db.run(
        `UPDATE work_items
         SET status = ?, updated_at = ?, version = version + 1
         WHERE id = ? AND version = ?`,
        [newStatus, now, itemId, expectedVersion]
      );

      if (result.changes === 0) {
        const latest = this.getWorkItemById(user, itemId);
        throw new ConflictError(
          `Conflict: Work item status was changed concurrently by another user. Current status: ${latest.status}`,
          { currentItem: latest }
        );
      }

      // Activity event
      db.run(
        `INSERT INTO activity_events (id, work_item_id, actor_id, event_type, previous_value, new_value, note, created_at)
         VALUES (?, ?, ?, 'STATUS_CHANGED', ?, ?, ?, ?)`,
        [
          `ev-${crypto.randomUUID()}`,
          itemId,
          user.id,
          item.status,
          newStatus,
          note || `${user.name} transitioned status from ${item.status} to ${newStatus}.`,
          now
        ]
      );

      // Outbox job for notification or review
      const jobType =
        newStatus === 'AWAITING_APPROVAL'
          ? 'NOTIFY_APPROVAL_REQUEST'
          : 'NOTIFY_STATUS_CHANGE';

      db.run(
        `INSERT INTO outbox_jobs (id, event_type, payload, status, next_run_at, created_at, updated_at)
         VALUES (?, ?, ?, 'PENDING', ?, ?, ?)`,
        [
          `job-${crypto.randomUUID()}`,
          jobType,
          JSON.stringify({
            workItemId: itemId,
            fromStatus: item.status,
            toStatus: newStatus,
            actorId: user.id,
            teamId: item.team_id
          }),
          now,
          now,
          now
        ]
      );

      return this.getWorkItemById(user, itemId);
    });
  }

  /**
   * Add comment to work item with audit entry and notification job in same transaction.
   */
  public static addComment(
    user: UserWithMemberships,
    itemId: string,
    body: string
  ): Comment {
    if (!body || !body.trim()) {
      throw new BadRequestError('Comment body cannot be empty');
    }

    const item = this.getWorkItemById(user, itemId);
    if (!hasMinimumRole(user, item.team_id, 'MEMBER')) {
      throw new ForbiddenError(`You must be at least a Member in team ${item.team_id} to post comments`);
    }

    const commentId = `comm-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    return db.transaction(() => {
      db.run(
        `INSERT INTO comments (id, work_item_id, user_id, body, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [commentId, itemId, user.id, body.trim(), now]
      );

      // Record activity event
      db.run(
        `INSERT INTO activity_events (id, work_item_id, actor_id, event_type, previous_value, new_value, note, created_at)
         VALUES (?, ?, ?, 'COMMENT_ADDED', NULL, NULL, ?, ?)`,
        [`ev-${crypto.randomUUID()}`, itemId, user.id, `Comment: ${body.trim().slice(0, 80)}`, now]
      );

      // Outbox job
      db.run(
        `INSERT INTO outbox_jobs (id, event_type, payload, status, next_run_at, created_at, updated_at)
         VALUES (?, 'NOTIFY_ASSIGNEE', ?, 'PENDING', ?, ?, ?)`,
        [
          `job-${crypto.randomUUID()}`,
          JSON.stringify({ workItemId: itemId, commentId, authorId: user.id }),
          now,
          now,
          now
        ]
      );

      return {
        id: commentId,
        work_item_id: itemId,
        user_id: user.id,
        user_name: user.name,
        user_avatar: user.avatar,
        body: body.trim(),
        created_at: now
      };
    });
  }

  /**
   * Get chronological activity log for an item.
   */
  public static getActivityHistory(user: UserWithMemberships, itemId: string): ActivityEvent[] {
    // Check permission
    this.getWorkItemById(user, itemId);

    return db.all<ActivityEvent>(
      `SELECT ae.*, u.name as actor_name
       FROM activity_events ae
       JOIN users u ON ae.actor_id = u.id
       WHERE ae.work_item_id = ?
       ORDER BY ae.created_at ASC`,
      [itemId]
    );
  }

  /**
   * Get comments for an item.
   */
  public static getComments(user: UserWithMemberships, itemId: string): Comment[] {
    // Check permission
    this.getWorkItemById(user, itemId);

    return db.all<Comment>(
      `SELECT c.*, u.name as user_name, u.avatar as user_avatar
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.work_item_id = ?
       ORDER BY c.created_at ASC`,
      [itemId]
    );
  }
}
