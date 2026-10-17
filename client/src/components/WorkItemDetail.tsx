import React, { useState, useEffect } from 'react';
import { WorkItem, ActivityEvent, Comment, ALLOWED_TRANSITIONS, WorkItemStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../api/client';
import { ActivityTimeline } from './ActivityTimeline';
import { CommentsSection } from './CommentsSection';
import {
  X,
  UserCheck,
  ArrowRight,
  Edit3,
  Shield,
  History,
  MessageSquare,
  Code2,
  AlertTriangle
} from 'lucide-react';

interface WorkItemDetailProps {
  itemId: string | null;
  onClose: () => void;
  onItemUpdated: (updatedItem: WorkItem) => void;
  onConflictDetected: (message: string, expectedVersion: number, serverItem?: WorkItem) => void;
}

export const WorkItemDetail: React.FC<WorkItemDetailProps> = ({
  itemId,
  onClose,
  onItemUpdated,
  onConflictDetected
}) => {
  const { currentUser, isLeadOrAdminForTeam, getUserRoleForTeam } = useAuth();
  const [item, setItem] = useState<WorkItem | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activeTab, setActiveTab] = useState<'activity' | 'comments' | 'raw'>('activity');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPriority, setEditPriority] = useState<any>('MEDIUM');

  const loadData = async (id: string) => {
    setIsLoading(true);
    setActionError(null);
    try {
      const [itemRes, eventsRes, commentsRes] = await Promise.all([
        api.getWorkItem(id),
        api.getActivityHistory(id),
        api.getComments(id)
      ]);
      setItem(itemRes.item);
      setEvents(eventsRes.history);
      setComments(commentsRes.comments);
      setEditTitle(itemRes.item.title);
      setEditDesc(itemRes.item.description);
      setEditPriority(itemRes.item.priority);
    } catch (err: any) {
      console.error('Failed to load work item details:', err);
      setActionError(err.message || 'Error loading item details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (itemId) {
      loadData(itemId);
    }
  }, [itemId]);

  if (!itemId) return null;

  // Permissions
  const userTeamRole = item ? getUserRoleForTeam(item.team_id) : null;
  const isLeadOrAdmin = item ? isLeadOrAdminForTeam(item.team_id) : false;
  const isViewer = userTeamRole === 'VIEWER';

  // Handle Claim
  const handleClaim = async () => {
    if (!item) return;
    setActionError(null);
    try {
      const res = await api.claimWorkItem(item.id);
      setItem(res.item);
      onItemUpdated(res.item);
      loadData(item.id);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 409) {
        onConflictDetected(err.message, item.version, err.data?.details?.currentItem);
      } else {
        setActionError(err.message);
      }
    }
  };

  // Handle Transition
  const handleTransition = async (newStatus: WorkItemStatus) => {
    if (!item) return;
    setActionError(null);
    try {
      const res = await api.transitionWorkItem(item.id, {
        newStatus,
        expectedVersion: item.version,
        note: `Transitioned status to ${newStatus}`
      });
      setItem(res.item);
      onItemUpdated(res.item);
      loadData(item.id);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 409) {
        onConflictDetected(err.message, item.version, err.data?.details?.currentItem);
      } else {
        setActionError(err.message);
      }
    }
  };

  // Handle Update
  const handleSaveEdit = async () => {
    if (!item) return;
    setActionError(null);
    try {
      const res = await api.updateWorkItem(item.id, {
        title: editTitle,
        description: editDesc,
        priority: editPriority,
        version: item.version
      });
      setItem(res.item);
      onItemUpdated(res.item);
      setIsEditing(false);
      loadData(item.id);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 409) {
        onConflictDetected(err.message, item.version, err.data?.details?.currentItem);
      } else {
        setActionError(err.message);
      }
    }
  };

  // Handle Add Comment
  const handleAddComment = async (body: string) => {
    if (!item) return;
    try {
      await api.addComment(item.id, body);
      loadData(item.id);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const allowedNextTransitions = item ? ALLOWED_TRANSITIONS[item.status] || [] : [];

  return (
    <div className="modal-overlay" style={{ justifyContent: 'flex-end', padding: 0 }}>
      <div
        className="slide-up"
        style={{
          width: '100%',
          maxWidth: '780px',
          height: '100vh',
          background: '#0a0f1d',
          borderLeft: '1px solid var(--border-subtle)',
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Drawer Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="font-mono" style={{ fontSize: '0.8rem', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: '4px' }}>
              {item?.id}
            </span>
            <span className="font-mono" style={{ fontSize: '0.8rem', color: '#38bdf8', background: 'rgba(6, 182, 212, 0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
              v{item?.version}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {item?.type.replace('_', ' ')}
            </span>
          </div>

          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '6px', borderRadius: '50%' }}>
            <X size={18} />
          </button>
        </div>

        {/* Action Error Banner */}
        {actionError && (
          <div style={{ padding: '12px 24px', background: 'rgba(244, 63, 94, 0.15)', borderBottom: '1px solid rgba(244, 63, 94, 0.3)', color: '#fca5a5', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} color="#f43f5e" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Content Body */}
        {isLoading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
            Loading work item details...
          </div>
        ) : item ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            
            {/* Title & Description Section */}
            {!isEditing ? (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', lineHeight: '1.3' }}>
                    {item.title}
                  </h2>
                  {!isViewer && (
                    <button onClick={() => setIsEditing(true)} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem' }}>
                      <Edit3 size={14} />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
                <p style={{ marginTop: '12px', fontSize: '0.925rem', color: '#cbd5e1', lineHeight: '1.6' }}>
                  {item.description}
                </p>
              </div>
            ) : (
              <div style={{ marginBottom: '24px', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-subtle)', color: '#fff', fontSize: '0.9rem' }}
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Description</label>
                  <textarea
                    rows={3}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-subtle)', color: '#fff', fontSize: '0.9rem' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setIsEditing(false)} className="btn btn-secondary" style={{ fontSize: '0.8rem' }}>Cancel</button>
                  <button onClick={handleSaveEdit} className="btn btn-primary" style={{ fontSize: '0.8rem' }}>Save (v{item.version})</button>
                </div>
              </div>
            )}

            {/* Quick Metadata Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Status</div>
                <div style={{ marginTop: '4px', fontSize: '0.9rem', fontWeight: 700, color: '#ffffff' }}>{item.status.replace('_', ' ')}</div>
              </div>

              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Priority</div>
                <div style={{ marginTop: '4px', fontSize: '0.9rem', fontWeight: 700, color: '#ffffff' }}>{item.priority}</div>
              </div>

              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Team</div>
                <div style={{ marginTop: '4px', fontSize: '0.9rem', fontWeight: 700, color: '#ffffff' }}>{item.team_name}</div>
              </div>

              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Assignee</div>
                <div style={{ marginTop: '4px', fontSize: '0.9rem', fontWeight: 700, color: item.assignee_name ? '#38bdf8' : '#94a3b8' }}>
                  {item.assignee_name || 'Unassigned'}
                </div>
              </div>
            </div>

            {/* Workflow Action Bar */}
            <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', marginBottom: '24px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Shield size={14} />
                <span>Operational Workflow Actions</span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                {/* Claim Button */}
                {!item.assignee_id && (
                  <button
                    onClick={handleClaim}
                    disabled={isViewer}
                    className="btn btn-primary"
                    style={{ fontSize: '0.825rem' }}
                  >
                    <UserCheck size={16} />
                    <span>Claim Work Item (Atomic)</span>
                  </button>
                )}

                {/* Workflow State Transitions */}
                {allowedNextTransitions.map((nextStatus) => {
                  const isApprovalAction = item.status === 'AWAITING_APPROVAL' && nextStatus === 'RESOLVED';
                  const canPerformApproval = isApprovalAction ? isLeadOrAdmin : !isViewer;

                  return (
                    <button
                      key={nextStatus}
                      onClick={() => handleTransition(nextStatus)}
                      disabled={!canPerformApproval}
                      className="btn btn-secondary"
                      style={{
                        fontSize: '0.825rem',
                        background: isApprovalAction ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.06)',
                        borderColor: isApprovalAction ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-subtle)',
                        color: isApprovalAction ? '#6ee7b7' : '#ffffff'
                      }}
                      title={!canPerformApproval ? 'Requires Team Lead role' : undefined}
                    >
                      <ArrowRight size={14} />
                      <span>Move to {nextStatus.replace('_', ' ')}</span>
                      {isApprovalAction && <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '3px', background: 'rgba(16, 185, 129, 0.25)' }}>Lead Gate</span>}
                    </button>
                  );
                })}
              </div>

              {item.status === 'AWAITING_APPROVAL' && !isLeadOrAdmin && (
                <p style={{ marginTop: '10px', fontSize: '0.75rem', color: '#f59e0b' }}>
                  ⚠️ Item is awaiting Lead Approval. Only Team Leads or Admins can transition to RESOLVED.
                </p>
              )}
            </div>

            {/* Tabs Navigation */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', marginBottom: '18px', gap: '20px' }}>
              <button
                onClick={() => setActiveTab('activity')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '10px 0',
                  color: activeTab === 'activity' ? '#ffffff' : '#94a3b8',
                  borderBottom: activeTab === 'activity' ? '2px solid var(--primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <History size={15} />
                <span>Audit Timeline ({events.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('comments')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '10px 0',
                  color: activeTab === 'comments' ? '#ffffff' : '#94a3b8',
                  borderBottom: activeTab === 'comments' ? '2px solid var(--primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <MessageSquare size={15} />
                <span>Discussion ({comments.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('raw')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '10px 0',
                  color: activeTab === 'raw' ? '#ffffff' : '#94a3b8',
                  borderBottom: activeTab === 'raw' ? '2px solid var(--primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Code2 size={15} />
                <span>Technical Metadata</span>
              </button>
            </div>

            {/* Tab Contents */}
            {activeTab === 'activity' && (
              <ActivityTimeline events={events} isLoading={false} />
            )}

            {activeTab === 'comments' && (
              <CommentsSection
                comments={comments}
                onAddComment={handleAddComment}
                isLoading={false}
              />
            )}

            {activeTab === 'raw' && (
              <div style={{ background: '#050811', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '8px' }}>
                  Database Row (Optimistic Concurrency v{item.version})
                </div>
                <pre className="font-mono" style={{ fontSize: '0.75rem', color: '#a5b4fc', overflowX: 'auto' }}>
                  {JSON.stringify(item, null, 2)}
                </pre>
              </div>
            )}

          </div>
        ) : null}

      </div>
    </div>
  );
};
