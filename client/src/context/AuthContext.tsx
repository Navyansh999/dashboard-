import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserWithMemberships, UserRole } from '../types';
import { api, setAuthToken } from '../api/client';

interface AuthContextType {
  currentUser: UserWithMemberships | null;
  demoUsers: UserWithMemberships[];
  token: string | null;
  isLoading: boolean;
  switchUser: (userId: string) => Promise<void>;
  getUserRoleForTeam: (teamId: string) => UserRole | null;
  isLeadOrAdminForTeam: (teamId: string) => boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserWithMemberships | null>(null);
  const [demoUsers, setDemoUsers] = useState<UserWithMemberships[]>([]);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize and load demo users
  useEffect(() => {
    async function initAuth() {
      try {
        const { users } = await api.getDemoUsers();
        setDemoUsers(users);

        // Default login as Sarah Chen (Platform Core Lead)
        const defaultUser = users.find((u) => u.id === 'user-sarah') || users[0];
        if (defaultUser) {
          const session = await api.login(defaultUser.id);
          setAuthToken(session.token);
          setTokenState(session.token);
          setCurrentUser(session.user);
        }
      } catch (err) {
        console.error('Failed to initialize demo auth:', err);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  const switchUser = async (userId: string) => {
    setIsLoading(true);
    try {
      const session = await api.login(userId);
      setAuthToken(session.token);
      setTokenState(session.token);
      setCurrentUser(session.user);
    } catch (err) {
      console.error('Failed to switch user:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getUserRoleForTeam = (teamId: string): UserRole | null => {
    if (!currentUser) return null;
    const hasAdmin = currentUser.memberships.some((m) => m.role === 'ADMIN');
    if (hasAdmin) return 'ADMIN';
    const membership = currentUser.memberships.find((m) => m.team_id === teamId);
    return membership ? membership.role : null;
  };

  const isLeadOrAdminForTeam = (teamId: string): boolean => {
    const role = getUserRoleForTeam(teamId);
    return role === 'LEAD' || role === 'ADMIN';
  };

  const isAdmin = currentUser?.memberships.some((m) => m.role === 'ADMIN') ?? false;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        demoUsers,
        token,
        isLoading,
        switchUser,
        getUserRoleForTeam,
        isLeadOrAdminForTeam,
        isAdmin
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
