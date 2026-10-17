import React, { useState, useEffect } from 'react';
import { OutboxJob } from '../types';
import { api } from '../api/client';
import {
  X,
  Activity,
  Play,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Zap
} from 'lucide-react';

interface OutboxMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshTriggered: () => void;
}

export const OutboxMonitorModal: React.FC<OutboxMonitorModalProps> = ({
  isOpen,
  onClose,
  onRefreshTriggered
}) => {
  const [jobs, setJobs] = useState<OutboxJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchResult, setBatchResult] = useState<string | null>(null);

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const res = await api.getOutboxJobs();
      setJobs(res.jobs);
    } catch (err) {
      console.error('Failed to fetch outbox jobs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchJobs();
      const interval = setInterval(fetchJobs, 2500);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleRunBatch = async () => {
    setIsProcessing(true);
    setBatchResult(null);
    try {
      const res = await api.processOutboxBatch();
      setBatchResult(`Processed ${res.result.processed} job(s) (${res.result.succeeded} succeeded, ${res.result.failed} failed)`);
      fetchJobs();
      onRefreshTriggered();
    } catch (err: any) {
      setBatchResult(`Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', fontSize: '0.7rem', fontWeight: 700 }}>
            <CheckCircle2 size={12} />
            COMPLETED
          </span>
        );
      case 'PROCESSING':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(6, 182, 212, 0.15)', color: '#38bdf8', fontSize: '0.7rem', fontWeight: 700 }}>
            <Activity size={12} />
            PROCESSING
          </span>
        );
      case 'PENDING':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#fde047', fontSize: '0.7rem', fontWeight: 700 }}>
            <Clock size={12} />
            PENDING
          </span>
        );
      case 'FAILED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(244, 63, 94, 0.15)', color: '#fca5a5', fontSize: '0.7rem', fontWeight: 700 }}>
            <AlertTriangle size={12} />
            FAILED
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="modal-overlay">
      <div
        className="glass-panel slide-up"
        style={{
          width: '100%',
          maxWidth: '820px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#0c1120',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.85)',
          padding: '24px'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(6, 182, 212, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Zap size={22} color="#06b6d4" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>
                Transactional Outbox & Async Jobs Monitor
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
                Guaranteed at-least-once async processing with exponential backoff & idempotent handlers
              </p>
            </div>
          </div>

          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '6px', borderRadius: '50%' }}>
            <X size={16} />
          </button>
        </div>

        {/* Control & Trigger Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
            marginBottom: '16px'
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
            <span>Auto-polling active (2.5s)</span>
            {batchResult && (
              <span style={{ marginLeft: '12px', color: '#34d399', fontWeight: 600 }}>
                • {batchResult}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={fetchJobs}
              disabled={isLoading}
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '6px 12px' }}
            >
              <RotateCcw size={13} />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleRunBatch}
              disabled={isProcessing}
              className="btn btn-primary"
              style={{ fontSize: '0.75rem', padding: '6px 14px' }}
            >
              <Play size={13} />
              <span>{isProcessing ? 'Dispatching...' : 'Trigger Batch Now'}</span>
            </button>
          </div>
        </div>

        {/* Jobs Table */}
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: 'rgba(0, 0, 0, 0.4)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '10px 14px', color: '#94a3b8', fontWeight: 700 }}>Event Type</th>
                <th style={{ padding: '10px 14px', color: '#94a3b8', fontWeight: 700 }}>Status</th>
                <th style={{ padding: '10px 14px', color: '#94a3b8', fontWeight: 700 }}>Retries</th>
                <th style={{ padding: '10px 14px', color: '#94a3b8', fontWeight: 700 }}>Payload Details</th>
                <th style={{ padding: '10px 14px', color: '#94a3b8', fontWeight: 700 }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: '#ffffff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="font-mono" style={{ fontSize: '0.75rem', color: '#a5b4fc' }}>
                        {job.event_type}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {getStatusBadge(job.status)}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#94a3b8' }}>
                    <span className="font-mono">{job.retry_count} / {job.max_retries}</span>
                  </td>
                  <td style={{ padding: '10px 14px', maxWidth: '320px' }}>
                    <div
                      className="font-mono"
                      style={{
                        fontSize: '0.7rem',
                        color: '#94a3b8',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={job.payload}
                    >
                      {job.payload}
                    </div>
                    {job.last_error && (
                      <div style={{ fontSize: '0.675rem', color: '#f87171', marginTop: '2px' }}>
                        Error: {job.last_error}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '0.7rem' }}>
                    {new Date(job.created_at).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-secondary">
            Close Monitor
          </button>
        </div>
      </div>
    </div>
  );
};
