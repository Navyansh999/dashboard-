import React from 'react';
import { Team } from '../types';
import { Search, X } from 'lucide-react';

interface QuickFiltersProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedTeamId: string;
  onTeamChange: (teamId: string) => void;
  selectedPriority: string;
  onPriorityChange: (p: string) => void;
  selectedStatus: string;
  onStatusChange: (s: string) => void;
  selectedType: string;
  onTypeChange: (t: string) => void;
  teams: Team[];
  onReset: () => void;
}

export const QuickFilters: React.FC<QuickFiltersProps> = ({
  searchQuery,
  onSearchChange,
  selectedTeamId,
  onTeamChange,
  selectedPriority,
  onPriorityChange,
  selectedStatus,
  onStatusChange,
  selectedType,
  onTypeChange,
  teams,
  onReset
}) => {
  const hasActiveFilters =
    searchQuery ||
    selectedTeamId ||
    selectedPriority ||
    selectedStatus ||
    selectedType;

  return (
    <div
      className="glass-panel"
      style={{
        padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '12px',
        justifyContent: 'space-between'
      }}
    >
      {/* Search Input */}
      <div style={{ position: 'relative', flex: '1 1 280px', minWidth: '220px' }}>
        <Search
          size={16}
          color="#94a3b8"
          style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search items by title, description, incident..."
          style={{
            width: '100%',
            padding: '9px 12px 9px 36px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-subtle)',
            color: '#ffffff',
            fontSize: '0.85rem',
            outline: 'none',
            transition: 'border-color 0.2s ease'
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--border-subtle)')}
        />
      </div>

      {/* Dropdown Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
        
        {/* Team Dropdown */}
        <select
          value={selectedTeamId}
          onChange={(e) => onTeamChange(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-subtle)',
            color: '#ffffff',
            fontSize: '0.825rem',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="" style={{ backgroundColor: '#0f172a' }}>All Teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id} style={{ backgroundColor: '#0f172a' }}>
              {t.name}
            </option>
          ))}
        </select>

        {/* Priority Dropdown */}
        <select
          value={selectedPriority}
          onChange={(e) => onPriorityChange(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-subtle)',
            color: '#ffffff',
            fontSize: '0.825rem',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="" style={{ backgroundColor: '#0f172a' }}>All Priorities</option>
          <option value="URGENT" style={{ backgroundColor: '#0f172a' }}>🚨 Urgent</option>
          <option value="HIGH" style={{ backgroundColor: '#0f172a' }}>⚠️ High</option>
          <option value="MEDIUM" style={{ backgroundColor: '#0f172a' }}>🔹 Medium</option>
          <option value="LOW" style={{ backgroundColor: '#0f172a' }}>🟢 Low</option>
        </select>

        {/* Status Dropdown */}
        <select
          value={selectedStatus}
          onChange={(e) => onStatusChange(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-subtle)',
            color: '#ffffff',
            fontSize: '0.825rem',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="" style={{ backgroundColor: '#0f172a' }}>All Statuses</option>
          <option value="OPEN" style={{ backgroundColor: '#0f172a' }}>Open</option>
          <option value="IN_PROGRESS" style={{ backgroundColor: '#0f172a' }}>In Progress</option>
          <option value="AWAITING_APPROVAL" style={{ backgroundColor: '#0f172a' }}>Awaiting Approval</option>
          <option value="RESOLVED" style={{ backgroundColor: '#0f172a' }}>Resolved</option>
          <option value="CLOSED" style={{ backgroundColor: '#0f172a' }}>Closed</option>
        </select>

        {/* Type Dropdown */}
        <select
          value={selectedType}
          onChange={(e) => onTypeChange(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-subtle)',
            color: '#ffffff',
            fontSize: '0.825rem',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="" style={{ backgroundColor: '#0f172a' }}>All Types</option>
          <option value="INCIDENT" style={{ backgroundColor: '#0f172a' }}>Incident</option>
          <option value="CUSTOMER_ISSUE" style={{ backgroundColor: '#0f172a' }}>Customer Issue</option>
          <option value="PAYMENT" style={{ backgroundColor: '#0f172a' }}>Payment</option>
          <option value="COMPLIANCE" style={{ backgroundColor: '#0f172a' }}>Compliance</option>
          <option value="OPERATIONAL_TASK" style={{ backgroundColor: '#0f172a' }}>Operational Task</option>
        </select>

        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="btn btn-secondary"
            style={{ padding: '8px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <X size={14} />
            <span>Clear Filters</span>
          </button>
        )}
      </div>
    </div>
  );
};
