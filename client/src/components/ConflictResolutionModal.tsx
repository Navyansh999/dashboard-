import React from 'react';
import { WorkItem } from '../types';
import { AlertOctagon, RefreshCw, X, ArrowRight } from 'lucide-react';

interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReload: () => void;
  conflictMessage: string;
  expectedVersion?: number;
  serverItem?: WorkItem | null;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  onClose,
  onReload,
  conflictMessage,
  expectedVersion,
  serverItem
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div
        className="glass-panel slide-up"
        style={{
          width: '100%',
          maxWidth: '560px',
          background: '#0d1322',
          border: '1.5px solid rgba(244, 63, 94, 0.4)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(244, 63, 94, 0.15)',
          padding: '24px'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(244, 63, 94, 0.15)',
                border: '1px solid rgba(244, 63, 94, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <AlertOctagon size={24} color="#f43f5e" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
                Concurrency Conflict (HTTP 409)
              </h3>
              <p style={{ fontSize: '0.775rem', color: '#94a3b8', margin: 0 }}>
                Operations Under Pressure • Optimistic Concurrency Guard
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '6px', borderRadius: '50%' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Message Explanation */}
        <div
          style={{
            padding: '14px 16px',
            borderRadius: '8px',
            backgroundColor: 'rgba(244, 63, 94, 0.08)',
            border: '1px solid rgba(244, 63, 94, 0.25)',
            marginBottom: '18px'
          }}
        >
          <p style={{ fontSize: '0.85rem', color: '#fca5a5', lineHeight: '1.5', margin: 0 }}>
            {conflictMessage}
          </p>
        </div>

        {/* Version Comparison Details */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
            padding: '14px 16px',
            marginBottom: '20px'
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '10px' }}>
            State Reconciliation
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Your Token</div>
              <div className="font-mono" style={{ fontSize: '1rem', fontWeight: 700, color: '#f87171' }}>
                {expectedVersion !== undefined ? `v${expectedVersion}` : 'Stale'}
              </div>
            </div>

            <ArrowRight size={18} color="#94a3b8" />

            <div style={{ padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Server State</div>
              <div className="font-mono" style={{ fontSize: '1rem', fontWeight: 700, color: '#34d399' }}>
                {serverItem ? `v${serverItem.version}` : 'Latest'}
              </div>
            </div>
          </div>

          {serverItem && (
            <div style={{ marginTop: '12px', fontSize: '0.775rem', color: '#cbd5e1', lineHeight: '1.5' }}>
              <div><strong>Current Assignee:</strong> {serverItem.assignee_name || 'Unassigned'}</div>
              <div><strong>Current Status:</strong> {serverItem.status}</div>
              <div><strong>Latest Title:</strong> {serverItem.title}</div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onClose} className="btn btn-secondary">
            Dismiss
          </button>
          <button
            onClick={() => {
              onReload();
              onClose();
            }}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={16} />
            <span>Reload Latest Server Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};
