import React from 'react';
import { WorkItem } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  ArrowRight,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface WorkItemListProps {
  items: WorkItem[];
  total: number;
  limit: number;
  offset: number;
  onPageChange: (newOffset: number) => void;
  onSelectItem: (item: WorkItem) => void;
  onQuickClaim: (item: WorkItem, e: React.MouseEvent) => void;
  isLoading: boolean;
}

export const WorkItemList: React.FC<WorkItemListProps> = ({
  items,
  total,
  limit,
  offset,
  onPageChange,
  onSelectItem,
  onQuickClaim,
  isLoading
}) => {
  const { currentUser } = useAuth();

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'URGENT':
        return <span className="badge badge-urgent">🚨 Urgent</span>;
      case 'HIGH':
        return <span className="badge badge-high">⚠️ High</span>;
      case 'MEDIUM':
        return <span className="badge badge-medium">🔹 Medium</span>;
      case 'LOW':
        return <span className="badge badge-low">🟢 Low</span>;
      default:
        return <span className="badge">{p}</span>;
    }
  };

  const getStatusPill = (s: string) => {
    const sLower = s.toLowerCase();
    const label = s.replace('_', ' ');
    return <span className={`status-pill status-${sLower}`}>{label}</span>;
  };

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit) || 1;

  if (isLoading) {
    return (
      <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid rgba(99, 102, 241, 0.3)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '16px', fontSize: '0.9rem' }}>Loading operational work items...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <AlertCircle size={44} color="#6366f1" style={{ margin: '0 auto 16px auto', opacity: 0.8 }} />
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px' }}>No work items found</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '440px', margin: '0 auto' }}>
          No work items match the active filters for your assigned teams. Try resetting filters or switching user roles to view cross-team items.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0, 0, 0, 0.2)' }}>
              <th style={{ padding: '14px 18px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Work Item</th>
              <th style={{ padding: '14px 18px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Team & Type</th>
              <th style={{ padding: '14px 18px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Priority</th>
              <th style={{ padding: '14px 18px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
              <th style={{ padding: '14px 18px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assignee</th>
              <th style={{ padding: '14px 18px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Version</th>
              <th style={{ padding: '14px 18px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isUrgent = item.priority === 'URGENT' && item.status !== 'RESOLVED' && item.status !== 'CLOSED';
              const isAssignedToMe = item.assignee_id === currentUser?.id;

              return (
                <tr
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                    background: isUrgent ? 'rgba(244, 63, 94, 0.04)' : 'transparent'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isUrgent ? 'rgba(244, 63, 94, 0.04)' : 'transparent')}
                >
                  {/* Title & Description */}
                  <td style={{ padding: '16px 18px', maxWidth: '380px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.925rem', fontWeight: 700, color: '#ffffff' }}>
                        {item.title}
                      </span>
                    </div>
                    <p style={{
                      fontSize: '0.775rem',
                      color: 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '360px'
                    }}>
                      {item.description}
                    </p>
                  </td>

                  {/* Team & Type */}
                  <td style={{ padding: '16px 18px' }}>
                    <div style={{ fontSize: '0.825rem', fontWeight: 600, color: '#e2e8f0' }}>
                      {item.team_name || item.team_id}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {item.type.replace('_', ' ')}
                    </div>
                  </td>

                  {/* Priority */}
                  <td style={{ padding: '16px 18px' }}>
                    {getPriorityBadge(item.priority)}
                  </td>

                  {/* Status */}
                  <td style={{ padding: '16px 18px' }}>
                    {getStatusPill(item.status)}
                  </td>

                  {/* Assignee */}
                  <td style={{ padding: '16px 18px' }}>
                    {item.assignee_id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          background: isAssignedToMe ? 'linear-gradient(135deg, #6366f1, #06b6d4)' : 'rgba(255, 255, 255, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#ffffff'
                        }}>
                          {item.assignee_name ? item.assignee_name.charAt(0) : 'U'}
                        </div>
                        <div style={{ fontSize: '0.825rem', fontWeight: isAssignedToMe ? 700 : 500, color: isAssignedToMe ? '#a5b4fc' : '#e2e8f0' }}>
                          {item.assignee_name || 'Assigned'}
                          {isAssignedToMe && <span style={{ fontSize: '0.7rem', color: '#818cf8', marginLeft: '4px' }}>(You)</span>}
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => onQuickClaim(item, e)}
                        className="btn btn-secondary"
                        style={{
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          background: 'rgba(99, 102, 241, 0.12)',
                          color: '#a5b4fc',
                          border: '1px solid rgba(99, 102, 241, 0.3)'
                        }}
                      >
                        Claim Item
                      </button>
                    )}
                  </td>

                  {/* Version (Optimistic concurrency token) */}
                  <td style={{ padding: '16px 18px' }}>
                    <span
                      className="font-mono"
                      title="Optimistic Concurrency Version Token"
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.75rem',
                        color: '#94a3b8'
                      }}
                    >
                      v{item.version}
                    </span>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600 }}>
                      <span>Details</span>
                      <ArrowRight size={14} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div
        style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(0, 0, 0, 0.15)'
        }}
      >
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Showing <span style={{ color: '#ffffff', fontWeight: 600 }}>{Math.min(offset + 1, total)}</span> to{' '}
          <span style={{ color: '#ffffff', fontWeight: 600 }}>{Math.min(offset + items.length, total)}</span> of{' '}
          <span style={{ color: '#ffffff', fontWeight: 600 }}>{total}</span> total work items
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => onPageChange(Math.max(offset - limit, 0))}
            disabled={offset === 0}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
          >
            <ChevronLeft size={16} />
            <span>Prev</span>
          </button>

          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0 8px' }}>
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => onPageChange(offset + limit)}
            disabled={offset + limit >= total}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
          >
            <span>Next</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
