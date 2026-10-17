import { UserWithMemberships, UserRole } from '../types.js';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  VIEWER: 1,
  MEMBER: 2,
  LEAD: 3,
  ADMIN: 4
};

export function getUserTeamRole(user: UserWithMemberships, teamId: string): UserRole | null {
  // If user has ADMIN role on ANY team, they possess system-wide Admin capabilities
  const hasGlobalAdmin = user.memberships.some((m) => m.role === 'ADMIN');
  if (hasGlobalAdmin) return 'ADMIN';

  const membership = user.memberships.find((m) => m.team_id === teamId);
  return membership ? membership.role : null;
}

export function canAccessTeam(user: UserWithMemberships, teamId: string): boolean {
  return getUserTeamRole(user, teamId) !== null;
}

export function hasMinimumRole(
  user: UserWithMemberships,
  teamId: string,
  minRole: UserRole
): boolean {
  const actualRole = getUserTeamRole(user, teamId);
  if (!actualRole) return false;
  return ROLE_HIERARCHY[actualRole] >= ROLE_HIERARCHY[minRole];
}
