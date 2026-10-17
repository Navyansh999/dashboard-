import React, { useState, useEffect, useCallback } from 'react';
import { WorkItem, Team } from './types';
import { useAuth } from './context/AuthContext';
import { api, ApiError } from './api/client';
import { Navbar } from './components/Navbar';
import { StatsOverview } from './components/StatsOverview';
import { QuickFilters } from './components/QuickFilters';
import { WorkItemList } from './components/WorkItemList';
import { WorkItemDetail } from './components/WorkItemDetail';
import { CreateWorkItemModal } from './components/CreateWorkItemModal';
import { ConflictResolutionModal } from './components/ConflictResolutionModal';
import { OutboxMonitorModal } from './components/OutboxMonitorModal';

export const App: React.FC = () => {
  const { currentUser, token } = useAuth();

  // Data states
  const [items, setItems] = useState<WorkItem[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [outboxPendingCount, setOutboxPendingCount] = useState<number>(0);

  // Filter & Pagination states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [activePreset, setActivePreset] = useState<'all' | 'assigned_to_me' | 'unassigned_urgent' | 'awaiting_approval'>('all');
  const [limit] = useState(15);
  const [offset, setOffset] = useState(0);

  // Modals & Drawers
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isOutboxOpen, setIsOutboxOpen] = useState(false);

  // Concurrency Conflict Modal state
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictMessage, setConflictMessage] = useState('');
  const [conflictExpectedVersion, setConflictExpectedVersion] = useState<number | undefined>();
  const [conflictServerItem, setConflictServerItem] = useState<WorkItem | null>(null);

  // Load Teams
  useEffect(() => {
    if (!token) return;
    api.getTeams()
      .then((res) => setTeams(res.teams))
      .catch((err) => console.error('Failed to fetch teams:', err));
  }, [token]);

  // Load Work Items
  const loadWorkItems = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await api.getWorkItems({
        teamId: selectedTeamId || undefined,
        status: selectedStatus || undefined,
        priority: selectedPriority || undefined,
        type: selectedType || undefined,
        q: searchQuery || undefined,
        viewPreset: activePreset,
        limit,
        offset
      });

      setItems(res.items);
      setTotalItems(res.total);
    } catch (err) {
      console.error('Failed to load work items:', err);
    } finally {
      setIsLoading(false);
    }
  }, [
    token,
    currentUser?.id,
    selectedTeamId,
    selectedStatus,
    selectedPriority,
    selectedType,
    searchQuery,
    activePreset,
    limit,
    offset
  ]);

  useEffect(() => {
    loadWorkItems();
  }, [loadWorkItems]);

  // Check outbox pending count periodically
  useEffect(() => {
    if (!token) return;
    const checkOutbox = () => {
      api.getOutboxJobs()
        .then((res) => {
          const pending = res.jobs.filter((j) => j.status === 'PENDING').length;
          setOutboxPendingCount(pending);
        })
        .catch(() => {});
    };

    checkOutbox();
    const interval = setInterval(checkOutbox, 4000);
    return () => clearInterval(interval);
  }, [token]);

  // Reset offset on filter change
  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setOffset(0);
  };
  const handleTeamChange = (t: string) => {
    setSelectedTeamId(t);
    setOffset(0);
  };
  const handlePriorityChange = (p: string) => {
    setSelectedPriority(p);
    setOffset(0);
  };
  const handleStatusChange = (s: string) => {
    setSelectedStatus(s);
    setOffset(0);
  };
  const handleTypeChange = (tp: string) => {
    setSelectedType(tp);
    setOffset(0);
  };
  const handlePresetSelect = (preset: 'all' | 'assigned_to_me' | 'unassigned_urgent' | 'awaiting_approval') => {
    setActivePreset(preset);
    setOffset(0);
  };
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedTeamId('');
    setSelectedPriority('');
    setSelectedStatus('');
    setSelectedType('');
    setActivePreset('all');
    setOffset(0);
  };

  // Quick Claim from Table Row
  const handleQuickClaim = async (item: WorkItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await api.claimWorkItem(item.id);
      setItems((prev) => prev.map((i) => (i.id === item.id ? res.item : i)));
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 409) {
        setConflictMessage(err.message);
        setConflictExpectedVersion(item.version);
        setConflictServerItem(err.data?.details?.currentItem || null);
        setConflictModalOpen(true);
      } else {
        alert(err.message || 'Failed to claim work item');
      }
    }
  };

  const handleConflictDetected = (
    msg: string,
    expectedVersion: number,
    serverItem?: WorkItem
  ) => {
    setConflictMessage(msg);
    setConflictExpectedVersion(expectedVersion);
    setConflictServerItem(serverItem || null);
    setConflictModalOpen(true);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar with Persona Switcher */}
      <Navbar
        onOpenCreate={() => setIsCreateOpen(true)}
        onOpenOutbox={() => setIsOutboxOpen(true)}
        outboxPendingCount={outboxPendingCount}
      />

      {/* Main Content Dashboard */}
      <main style={{ flex: 1, maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '24px' }}>
        
        {/* KPI Stats Overview */}
        <StatsOverview
          items={items}
          onSelectPreset={handlePresetSelect}
          activePreset={activePreset}
        />

        {/* Quick Filters & Live Search */}
        <QuickFilters
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          selectedTeamId={selectedTeamId}
          onTeamChange={handleTeamChange}
          selectedPriority={selectedPriority}
          onPriorityChange={handlePriorityChange}
          selectedStatus={selectedStatus}
          onStatusChange={handleStatusChange}
          selectedType={selectedType}
          onTypeChange={handleTypeChange}
          teams={teams}
          onReset={handleResetFilters}
        />

        {/* Work Item List */}
        <WorkItemList
          items={items}
          total={totalItems}
          limit={limit}
          offset={offset}
          onPageChange={(newOffset) => setOffset(newOffset)}
          onSelectItem={(item) => setSelectedItemId(item.id)}
          onQuickClaim={handleQuickClaim}
          isLoading={isLoading}
        />
      </main>

      {/* Detail Drawer */}
      {selectedItemId && (
        <WorkItemDetail
          itemId={selectedItemId}
          onClose={() => setSelectedItemId(null)}
          onItemUpdated={(updated) => {
            setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
          }}
          onConflictDetected={handleConflictDetected}
        />
      )}

      {/* Create Modal */}
      <CreateWorkItemModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        teams={teams}
        onItemCreated={(newItem) => {
          setItems((prev) => [newItem, ...prev]);
          setTotalItems((prev) => prev + 1);
        }}
      />

      {/* Outbox Monitor Modal */}
      <OutboxMonitorModal
        isOpen={isOutboxOpen}
        onClose={() => setIsOutboxOpen(false)}
        onRefreshTriggered={loadWorkItems}
      />

      {/* Concurrency Conflict Resolution Modal */}
      <ConflictResolutionModal
        isOpen={conflictModalOpen}
        onClose={() => setConflictModalOpen(false)}
        onReload={loadWorkItems}
        conflictMessage={conflictMessage}
        expectedVersion={conflictExpectedVersion}
        serverItem={conflictServerItem}
      />
    </div>
  );
};
