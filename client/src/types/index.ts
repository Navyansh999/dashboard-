export type UserRole = 'VIEWER' | 'MEMBER' | 'LEAD' | 'ADMIN';

export type WorkItemType =
  | 'INCIDENT'
  | 'CUSTOMER_ISSUE'
  | 'PAYMENT'
  | 'COMPLIANCE'
  | 'OPERATIONAL_TASK';

export type WorkItemPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type WorkItemStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'AWAITING_APPROVAL'
  | 'RESOLVED'
  | 'CLOSED';

export type ActivityEventType =
  | 'CREATED'
  | 'ASSIGNED'
  | 'UNASSIGNED'
  | 'STATUS_CHANGED'
  | 'PRIORITY_CHANGED'
  | 'UPDATED'
  | 'COMMENT_ADDED';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  created_at: string;
}

export interface TeamMembership {
  team_id: string;
  team_name: string;
  role: UserRole;
}

export interface UserWithMemberships extends User {
  memberships: TeamMembership[];
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  member_count?: number;
}

export interface WorkItem {
  id: string;
  title: string;
  description: string;
  type: WorkItemType;
  priority: WorkItemPriority;
  status: WorkItemStatus;
  team_id: string;
  team_name?: string;
  assignee_id: string | null;
  assignee_name?: string | null;
  created_by_id: string;
  creator_name?: string;
  due_date: string | null;
  version: number;
  metadata?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityEvent {
  id: string;
  work_item_id: string;
  actor_id: string;
  actor_name?: string;
  event_type: ActivityEventType;
  previous_value: string | null;
  new_value: string | null;
  note: string | null;
  created_at: string;
}

export interface Comment {
  id: string;
  work_item_id: string;
  user_id: string;
  user_name?: string;
  user_avatar?: string;
  body: string;
  created_at: string;
}

export interface OutboxJob {
  id: string;
  event_type: string;
  payload: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  next_run_at: string;
  created_at: string;
  updated_at: string;
}

export const ALLOWED_TRANSITIONS: Record<WorkItemStatus, WorkItemStatus[]> = {
  OPEN: ['IN_PROGRESS'],
  IN_PROGRESS: ['AWAITING_APPROVAL', 'RESOLVED'],
  AWAITING_APPROVAL: ['RESOLVED', 'IN_PROGRESS'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: []
};
