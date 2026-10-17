import React, { useState } from 'react';
import { Team, WorkItemType, WorkItemPriority, WorkItem } from '../types';
import { api } from '../api/client';
import { X, Plus, AlertCircle } from 'lucide-react';

interface CreateWorkItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  teams: Team[];
  onItemCreated: (item: WorkItem) => void;
}

export const CreateWorkItemModal: React.FC<CreateWorkItemModalProps> = ({
  isOpen,
  onClose,
  teams,
  onItemCreated
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<WorkItemType>('INCIDENT');
  const [priority, setPriority] = useState<WorkItemPriority>('HIGH');
  const [teamId, setTeamId] = useState<string>(teams[0]?.id || 'team-core');
  const [dueDate, setDueDate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    // Client-side generated Idempotency-Key
    const idempotencyKey = `create-item-${crypto.randomUUID()}`;

    try {
      const res = await api.createWorkItem(
        {
          title: title.trim(),
          description: description.trim(),
          type,
          priority,
          team_id: teamId,
          due_date: dueDate ? new Date(dueDate).toISOString() : null
        },
        idempotencyKey
      );

      onItemCreated(res.item);
      onClose();
    } catch (err: any) {
      console.error('Failed to create work item:', err);
      setError(err.message || 'Failed to create work item');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div
        className="glass-panel slide-up"
        style={{
          width: '100%',
          maxWidth: '560px',
          background: '#0d1322',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
          padding: '24px'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>Create Operational Work Item</h3>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
              Protected with Idempotency Key & Transactional Outbox
            </p>
          </div>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '6px', borderRadius: '50%' }}>
            <X size={16} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fca5a5', fontSize: '0.825rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} color="#f43f5e" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Title */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '0.775rem', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              Title / Summary *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Database read replica connection starvation"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                color: '#ffffff',
                fontSize: '0.875rem',
                outline: 'none'
              }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '0.775rem', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              Why does this exist & Investigation Details *
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the background, context, metrics breached, and initial findings..."
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                color: '#ffffff',
                fontSize: '0.875rem',
                outline: 'none'
              }}
            />
          </div>

          {/* Grid row: Team & Type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '0.775rem', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                Responsible Team *
              </label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id} style={{ backgroundColor: '#0f172a' }}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.775rem', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                Work Item Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              >
                <option value="INCIDENT" style={{ backgroundColor: '#0f172a' }}>Incident</option>
                <option value="CUSTOMER_ISSUE" style={{ backgroundColor: '#0f172a' }}>Customer Issue</option>
                <option value="PAYMENT" style={{ backgroundColor: '#0f172a' }}>Payment</option>
                <option value="COMPLIANCE" style={{ backgroundColor: '#0f172a' }}>Compliance</option>
                <option value="OPERATIONAL_TASK" style={{ backgroundColor: '#0f172a' }}>Operational Task</option>
              </select>
            </div>
          </div>

          {/* Grid row: Priority & Due Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
            <div>
              <label style={{ fontSize: '0.775rem', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                Priority Level
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              >
                <option value="URGENT" style={{ backgroundColor: '#0f172a' }}>🚨 Urgent</option>
                <option value="HIGH" style={{ backgroundColor: '#0f172a' }}>⚠️ High</option>
                <option value="MEDIUM" style={{ backgroundColor: '#0f172a' }}>🔹 Medium</option>
                <option value="LOW" style={{ backgroundColor: '#0f172a' }}>🟢 Low</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.775rem', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                Resolution Target (Optional)
              </label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={16} />
              <span>{isSubmitting ? 'Creating...' : 'Create Work Item'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
