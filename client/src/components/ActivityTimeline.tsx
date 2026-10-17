import React from 'react';
import { ActivityEvent } from '../types';
import {
  Clock,
  GitCommit,
  UserCheck,
  CheckCircle2,
  FileText,
  MessageSquare
} from 'lucide-react';

interface ActivityTimelineProps {
  events: ActivityEvent[];
  isLoading: boolean;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ events, isLoading }) => {
  if (isLoading) {
    return <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>Loading audit timeline...</div>;
  }

  if (events.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
        No historical activity recorded yet.
      </div>
    );
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'CREATED':
        return <GitCommit size={14} color="#6366f1" />;
      case 'ASSIGNED':
      case 'UNASSIGNED':
        return <UserCheck size={14} color="#06b6d4" />;
      case 'STATUS_CHANGED':
        return <CheckCircle2 size={14} color="#10b981" />;
      case 'COMMENT_ADDED':
        return <MessageSquare size={14} color="#a855f7" />;
      default:
        return <FileText size={14} color="#f59e0b" />;
    }
  };

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString();
  };

  return (
    <div style={{ position: 'relative', paddingLeft: '24px' }}>
      {/* Timeline line */}
      <div
        style={{
          position: 'absolute',
          left: '11px',
          top: '12px',
          bottom: '12px',
          width: '2px',
          background: 'rgba(255, 255, 255, 0.08)'
        }}
      />

      {events.map((ev, idx) => (
        <div key={ev.id || idx} style={{ position: 'relative', marginBottom: '20px' }}>
          {/* Dot Icon */}
          <div
            style={{
              position: 'absolute',
              left: '-24px',
              top: '2px',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: '#0e1424',
              border: '1.5px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 10px rgba(0,0,0,0.5)'
            }}
          >
            {getEventIcon(ev.event_type)}
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#ffffff' }}>
                  {ev.actor_name || 'System / User'}
                </span>
                <span style={{ fontSize: '0.675rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#94a3b8', fontWeight: 600 }}>
                  {ev.event_type.replace('_', ' ')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#64748b' }}>
                <Clock size={12} />
                <span>{formatDate(ev.created_at)}</span>
              </div>
            </div>

            {/* Note or Details */}
            {ev.note && (
              <p style={{ fontSize: '0.8rem', color: '#cbd5e1', margin: '4px 0 0 0', lineHeight: '1.4' }}>
                {ev.note}
              </p>
            )}

            {/* Transition values */}
            {(ev.previous_value || ev.new_value) && ev.event_type !== 'COMMENT_ADDED' && (
              <div style={{ marginTop: '6px', fontSize: '0.725rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {ev.previous_value && <span style={{ textDecoration: 'line-through', color: '#ef4444' }}>{ev.previous_value}</span>}
                {ev.previous_value && <span>→</span>}
                <span style={{ color: '#10b981', fontWeight: 600 }}>{ev.new_value}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
