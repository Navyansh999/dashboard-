import React from 'react';
import { WorkItem } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle,
  Clock,
  UserCheck,
  Inbox
} from 'lucide-react';

interface StatsOverviewProps {
  items: WorkItem[];
  onSelectPreset: (preset: 'all' | 'assigned_to_me' | 'unassigned_urgent' | 'awaiting_approval') => void;
  activePreset: string;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({
  items,
  onSelectPreset,
  activePreset
}) => {
  const { currentUser } = useAuth();

  const totalCount = items.length;
  const assignedToMe = items.filter((i) => i.assignee_id === currentUser?.id).length;
  const unassignedUrgent = items.filter(
    (i) => !i.assignee_id && (i.priority === 'URGENT' || i.priority === 'HIGH') && i.status !== 'RESOLVED' && i.status !== 'CLOSED'
  ).length;
  const awaitingApproval = items.filter((i) => i.status === 'AWAITING_APPROVAL').length;

  const cards = [
    {
      id: 'all',
      title: 'Active Work Items',
      count: totalCount,
      icon: Inbox,
      color: '#6366f1',
      bgGlow: 'rgba(99, 102, 241, 0.15)',
      description: 'Total visible work items'
    },
    {
      id: 'assigned_to_me',
      title: 'Assigned to Me',
      count: assignedToMe,
      icon: UserCheck,
      color: '#06b6d4',
      bgGlow: 'rgba(6, 182, 212, 0.15)',
      description: 'In your active responsibility'
    },
    {
      id: 'unassigned_urgent',
      title: 'Unassigned Urgent',
      count: unassignedUrgent,
      icon: AlertTriangle,
      color: '#f43f5e',
      bgGlow: 'rgba(244, 63, 94, 0.18)',
      description: 'Needs immediate claiming',
      isUrgentAlert: unassignedUrgent > 0
    },
    {
      id: 'awaiting_approval',
      title: 'Awaiting Lead Approval',
      count: awaitingApproval,
      icon: Clock,
      color: '#f59e0b',
      bgGlow: 'rgba(245, 158, 11, 0.15)',
      description: 'Blocked on Lead decision'
    }
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected = activePreset === card.id;

        return (
          <div
            key={card.id}
            onClick={() => onSelectPreset(card.id as any)}
            className={`glass-panel ${card.isUrgentAlert ? 'animate-pulse-urgent' : ''}`}
            style={{
              padding: '18px 20px',
              cursor: 'pointer',
              border: isSelected ? `1.5px solid ${card.color}` : '1px solid var(--border-subtle)',
              background: isSelected ? card.bgGlow : 'var(--bg-card)',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                {card.title}
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: card.bgGlow,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Icon size={18} color={card.color} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em' }}>
                {card.count}
              </span>
              <span style={{ fontSize: '0.725rem', color: 'var(--text-dim)' }}>
                {card.description}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
