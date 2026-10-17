import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import {
  ShieldAlert,
  ChevronDown,
  Plus,
  Activity,
  CheckCircle2,
  Zap
} from 'lucide-react';

interface NavbarProps {
  onOpenCreate: () => void;
  onOpenOutbox: () => void;
  outboxPendingCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenCreate,
  onOpenOutbox,
  outboxPendingCount
}) => {
  const { currentUser, demoUsers, switchUser } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isMock, setIsMock] = useState(false);

  useEffect(() => {
    // Poll until mock mode is determined (set after first API call)
    const check = setInterval(() => {
      if (api.isMockMode()) {
        setIsMock(true);
        clearInterval(check);
      }
    }, 500);
    return () => clearInterval(check);
  }, []);

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 40 }}>
      {/* Demo Mode Banner */}
      {isMock && (
        <div style={{
          background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.08) 100%)',
          borderBottom: '1px solid rgba(245, 158, 11, 0.4)',
          padding: '6px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}>
          <Zap size={13} color="#fbbf24" />
          <span style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 600, letterSpacing: '0.04em' }}>
            DEMO MODE — Backend unavailable. All data is in-browser mock. RBAC, OCC &amp; workflow rules are fully enforced.
          </span>
          <Zap size={13} color="#fbbf24" />
        </div>
      )}
    <header className="border-b border-subtle" style={{ backgroundColor: 'rgba(7, 10, 19, 0.9)', backdropFilter: 'blur(12px)' }}>
      <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 24px', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        
        {/* Brand & Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)'
          }}>
            <ShieldAlert size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(to right, #ffffff, #cbd5e1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                NEWTONITE
              </span>
              <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '999px', background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.4)', fontWeight: 700, letterSpacing: '0.05em' }}>
                OPS ENGINE
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: 0 }}>
              Operations Under Pressure • High Reliability Work Hub
            </p>
          </div>
        </div>

        {/* Action Controls & Persona Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          
          {/* Outbox Activity Monitor */}
          <button
            onClick={onOpenOutbox}
            className="btn btn-secondary"
            title="Inspect Transactional Outbox Background Queue"
            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Activity size={16} color="#06b6d4" />
            <span style={{ fontSize: '0.825rem' }}>Outbox Queue</span>
            {outboxPendingCount > 0 ? (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: '#f43f5e',
                color: '#fff',
                fontSize: '0.65rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 8px rgba(244, 63, 94, 0.8)'
              }}>
                {outboxPendingCount}
              </span>
            ) : (
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
            )}
          </button>

          {/* Create Work Item CTA */}
          <button
            onClick={onOpenCreate}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>Create Work Item</span>
          </button>

          <div style={{ width: '1px', height: '28px', backgroundColor: 'var(--border-subtle)' }} />

          {/* User Persona Switcher */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}
            >
              <img
                src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                alt={currentUser?.name}
                style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--primary)' }}
              />
              <div style={{ textAlign: 'left', lineHeight: '1.2' }}>
                <div style={{ fontSize: '0.825rem', fontWeight: 600 }}>{currentUser?.name || 'Loading...'}</div>
                <div style={{ fontSize: '0.675rem', color: '#94a3b8' }}>
                  {currentUser?.memberships[0] ? `${currentUser.memberships[0].team_name} (${currentUser.memberships[0].role})` : 'User'}
                </div>
              </div>
              <ChevronDown size={14} color="#94a3b8" />
            </button>

            {dropdownOpen && (
              <div
                className="glass-dropdown"
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  width: '320px',
                  padding: '10px',
                  zIndex: 50
                }}
              >
                <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Switch Demo User Persona
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                    Switch roles to test team isolation and approval gates
                  </div>
                </div>

                <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                  {demoUsers.map((user) => {
                    const isSelected = user.id === currentUser?.id;
                    return (
                      <div
                        key={user.id}
                        onClick={() => {
                          switchUser(user.id);
                          setDropdownOpen(false);
                        }}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                          border: isSelected ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
                          marginBottom: '4px',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <img
                          src={user.avatar}
                          alt={user.name}
                          style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.825rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {user.name}
                            {isSelected && <CheckCircle2 size={13} color="#10b981" />}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {user.memberships.map((m) => `${m.team_name}: ${m.role}`).join(' • ')}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </header>
    </div>
  );
};
