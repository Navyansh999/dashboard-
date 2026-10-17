import { db } from './database.js';

export function runSeed(database = db) {
  database.exec('PRAGMA foreign_keys = OFF;');
  database.exec(`
    DELETE FROM comments;
    DELETE FROM activity_events;
    DELETE FROM outbox_jobs;
    DELETE FROM idempotency_keys;
    DELETE FROM work_items;
    DELETE FROM team_memberships;
    DELETE FROM teams;
    DELETE FROM users;
  `);
  database.exec('PRAGMA foreign_keys = ON;');

  const now = new Date().toISOString();
  const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
  const twoHoursAgo = new Date(Date.now() - 7200 * 1000).toISOString();
  const yesterday = new Date(Date.now() - 86400 * 1000).toISOString();
  const twoDaysAgo = new Date(Date.now() - 172800 * 1000).toISOString();

  // 1. Seed Users
  const users = [
    { id: 'user-sarah', name: 'Sarah Chen', email: 'sarah.chen@newtonite.internal', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' },
    { id: 'user-alex', name: 'Alex Rivera', email: 'alex.rivera@newtonite.internal', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
    { id: 'user-priya', name: 'Priya Patel', email: 'priya.patel@newtonite.internal', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150' },
    { id: 'user-marcus', name: 'Marcus Brody', email: 'marcus.brody@newtonite.internal', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150' },
    { id: 'user-elena', name: 'Elena Rostova', email: 'elena.rostova@newtonite.internal', avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150' },
    { id: 'user-david', name: 'David Kim', email: 'david.kim@newtonite.internal', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150' },
    { id: 'user-zainab', name: 'Zainab Al-Mansoor', email: 'zainab.m@newtonite.internal', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
    { id: 'user-liam', name: 'Liam O\'Connor', email: 'liam.o@newtonite.internal', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150' },
    { id: 'user-maya', name: 'Maya Lin', email: 'maya.lin@newtonite.internal', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150' },
    { id: 'user-noah', name: 'Noah Bennett', email: 'noah.b@newtonite.internal', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150' },
  ];

  for (const u of users) {
    database.run('INSERT INTO users (id, name, email, avatar, created_at) VALUES (?, ?, ?, ?, ?)', [
      u.id, u.name, u.email, u.avatar, twoDaysAgo
    ]);
  }

  // 2. Seed Teams
  const teams = [
    { id: 'team-core', name: 'Platform Core', description: 'Distributed infrastructure, database clusters, and cloud services' },
    { id: 'team-payments', name: 'Payments & Settlement', description: 'Payment gateway integrations, high-volume ledger, and fraud anomaly detection' },
    { id: 'team-compliance', name: 'Compliance & Risk', description: 'Regulatory audits, KYC verification, data privacy, and security controls' },
    { id: 'team-support', name: 'Customer Operations', description: 'Tier 3 escalations, high-priority merchant incidents, and VIP ticketing' },
  ];

  for (const t of teams) {
    database.run('INSERT INTO teams (id, name, description, created_at) VALUES (?, ?, ?, ?)', [
      t.id, t.name, t.description, twoDaysAgo
    ]);
  }

  // 3. Seed Team Memberships
  const memberships = [
    // Sarah: Lead in Platform Core, Member in Payments
    { id: 'mem-1', user_id: 'user-sarah', team_id: 'team-core', role: 'LEAD' },
    { id: 'mem-2', user_id: 'user-sarah', team_id: 'team-payments', role: 'MEMBER' },

    // Elena: Lead in Payments
    { id: 'mem-3', user_id: 'user-elena', team_id: 'team-payments', role: 'LEAD' },

    // Liam: Lead in Customer Ops
    { id: 'mem-4', user_id: 'user-liam', team_id: 'team-support', role: 'LEAD' },

    // Priya: ADMIN in Compliance, but Admin role gives broad access
    { id: 'mem-5', user_id: 'user-priya', team_id: 'team-compliance', role: 'ADMIN' },
    { id: 'mem-6', user_id: 'user-priya', team_id: 'team-core', role: 'MEMBER' },

    // David Kim: Member in Core
    { id: 'mem-7', user_id: 'user-david', team_id: 'team-core', role: 'MEMBER' },

    // Zainab: Member in Payments
    { id: 'mem-8', user_id: 'user-zainab', team_id: 'team-payments', role: 'MEMBER' },

    // Alex Rivera: Member in Customer Ops
    { id: 'mem-9', user_id: 'user-alex', team_id: 'team-support', role: 'MEMBER' },

    // Noah Bennett: Member in Customer Ops
    { id: 'mem-10', user_id: 'user-noah', team_id: 'team-support', role: 'MEMBER' },

    // Maya Lin: Member in Platform Core and Compliance
    { id: 'mem-11', user_id: 'user-maya', team_id: 'team-core', role: 'MEMBER' },
    { id: 'mem-12', user_id: 'user-maya', team_id: 'team-compliance', role: 'MEMBER' },

    // Marcus Brody: VIEWER in Compliance & Customer Ops
    { id: 'mem-13', user_id: 'user-marcus', team_id: 'team-compliance', role: 'VIEWER' },
    { id: 'mem-14', user_id: 'user-marcus', team_id: 'team-support', role: 'VIEWER' },
  ];

  for (const m of memberships) {
    database.run('INSERT INTO team_memberships (id, user_id, team_id, role, created_at) VALUES (?, ?, ?, ?, ?)', [
      m.id, m.user_id, m.team_id, m.role, twoDaysAgo
    ]);
  }

  // 4. Seed Work Items
  const items = [
    {
      id: 'wi-101',
      title: 'Payment Gateway Latency Spike in EU-West-1',
      description: 'Stripe webhook p99 latency breached 1.8s threshold during peak trading hours. Ingestion queue is buffering 45,000 transactions.',
      type: 'INCIDENT',
      priority: 'URGENT',
      status: 'IN_PROGRESS',
      team_id: 'team-payments',
      assignee_id: 'user-zainab',
      created_by_id: 'user-elena',
      due_date: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
      version: 2,
      created_at: twoHoursAgo,
      updated_at: oneHourAgo,
    },
    {
      id: 'wi-102',
      title: 'High-Value Merchant #4829 Wire Transfer Discrepancy',
      description: 'Reconciliation service reported a $142,500 mismatch between swift confirmation code and internal ledger. Requires lead approval to re-route settlement.',
      type: 'PAYMENT',
      priority: 'HIGH',
      status: 'AWAITING_APPROVAL',
      team_id: 'team-payments',
      assignee_id: 'user-sarah',
      created_by_id: 'user-zainab',
      due_date: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
      version: 3,
      created_at: yesterday,
      updated_at: oneHourAgo,
    },
    {
      id: 'wi-103',
      title: 'Critical Outage: Postgres Read Replica Connection Starvation',
      description: 'Analytics pooling service exhausted max_connections on replica-02. Read requests failing over to primary, driving CPU load to 89%.',
      type: 'INCIDENT',
      priority: 'URGENT',
      status: 'OPEN',
      team_id: 'team-core',
      assignee_id: null, // Ready for concurrent claim testing!
      created_by_id: 'user-david',
      due_date: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      version: 1,
      created_at: oneHourAgo,
      updated_at: oneHourAgo,
    },
    {
      id: 'wi-104',
      title: 'Quarterly FinCEN SAR & Sanctions Screening Anomaly',
      description: 'Automated batch check flagged 3 accounts associated with high-risk jurisdiction. Suspicious activity reports must be submitted within 24h statutory window.',
      type: 'COMPLIANCE',
      priority: 'HIGH',
      status: 'AWAITING_APPROVAL',
      team_id: 'team-compliance',
      assignee_id: 'user-maya',
      created_by_id: 'user-priya',
      due_date: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      version: 2,
      created_at: yesterday,
      updated_at: twoHoursAgo,
    },
    {
      id: 'wi-105',
      title: 'VIP Client Enterprise Portal SSO Certificate Expiry',
      description: 'SAML signing certificate for Acme Corp SSO will expire in 48 hours. Requires rotating identity provider metadata in production vault.',
      type: 'CUSTOMER_ISSUE',
      priority: 'HIGH',
      status: 'OPEN',
      team_id: 'team-support',
      assignee_id: null, // Ready for claim
      created_by_id: 'user-alex',
      due_date: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      version: 1,
      created_at: twoHoursAgo,
      updated_at: twoHoursAgo,
    },
    {
      id: 'wi-106',
      title: 'Cross-Region Kafka Cluster Broker #4 Disk Full Alert',
      description: 'Log retention topic was not compacted properly. Broker 4 has 4% disk headroom left before failing partition replication.',
      type: 'INCIDENT',
      priority: 'URGENT',
      status: 'IN_PROGRESS',
      team_id: 'team-core',
      assignee_id: 'user-sarah',
      created_by_id: 'user-david',
      due_date: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
      version: 2,
      created_at: twoHoursAgo,
      updated_at: now,
    },
    {
      id: 'wi-107',
      title: 'Customer Data Subject Access Request (GDPR Article 15)',
      description: 'Verified identity request received from EU citizen requesting complete machine-readable archive of audit events and ledger interactions.',
      type: 'COMPLIANCE',
      priority: 'MEDIUM',
      status: 'OPEN',
      team_id: 'team-compliance',
      assignee_id: null,
      created_by_id: 'user-priya',
      due_date: new Date(Date.now() + 120 * 3600 * 1000).toISOString(),
      version: 1,
      created_at: yesterday,
      updated_at: yesterday,
    },
    {
      id: 'wi-108',
      title: 'Automated Disaster Recovery Drill & Database Failover Test',
      description: 'Simulated AZ outage in us-east-1 to verify RTO/RPO metrics. Automatic failover completed in 34 seconds with zero transaction loss.',
      type: 'OPERATIONAL_TASK',
      priority: 'LOW',
      status: 'RESOLVED',
      team_id: 'team-core',
      assignee_id: 'user-david',
      created_by_id: 'user-sarah',
      due_date: null,
      version: 3,
      created_at: twoDaysAgo,
      updated_at: yesterday,
    },
    {
      id: 'wi-109',
      title: 'Refund Reversal Double-Debit on iOS Mobile Checkout',
      description: 'Mobile app build 2.4.1 sent idempotent refund request without checking cached token, causing transient 500 error display to user.',
      type: 'CUSTOMER_ISSUE',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      team_id: 'team-support',
      assignee_id: 'user-alex',
      created_by_id: 'user-noah',
      due_date: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
      version: 2,
      created_at: yesterday,
      updated_at: oneHourAgo,
    },
    {
      id: 'wi-110',
      title: 'SOC2 Type II Annual Evidence Collection & Key Rotation',
      description: 'All KMS key rotation schedules and RBAC assignment logs must be signed by security lead for third-party audit firm.',
      type: 'COMPLIANCE',
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      team_id: 'team-compliance',
      assignee_id: 'user-priya',
      created_by_id: 'user-priya',
      due_date: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
      version: 2,
      created_at: twoDaysAgo,
      updated_at: yesterday,
    }
  ];

  for (const item of items) {
    database.run(`
      INSERT INTO work_items (
        id, title, description, type, priority, status,
        team_id, assignee_id, created_by_id, due_date,
        version, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      item.id, item.title, item.description, item.type, item.priority, item.status,
      item.team_id, item.assignee_id, item.created_by_id, item.due_date,
      item.version, null, item.created_at, item.updated_at
    ]);
  }

  // 5. Seed Activity Events (Audit History)
  const events = [
    {
      id: 'ev-1',
      work_item_id: 'wi-101',
      actor_id: 'user-elena',
      event_type: 'CREATED',
      previous_value: null,
      new_value: 'OPEN',
      note: 'Item logged from automated Datadog latency monitor alert.',
      created_at: twoHoursAgo
    },
    {
      id: 'ev-2',
      work_item_id: 'wi-101',
      actor_id: 'user-zainab',
      event_type: 'ASSIGNED',
      previous_value: null,
      new_value: 'user-zainab',
      note: 'Zainab claimed this urgent item for immediate remediation.',
      created_at: oneHourAgo
    },
    {
      id: 'ev-3',
      work_item_id: 'wi-101',
      actor_id: 'user-zainab',
      event_type: 'STATUS_CHANGED',
      previous_value: 'OPEN',
      new_value: 'IN_PROGRESS',
      note: 'Initiating rate limiter throttling on webhook ingress pipeline.',
      created_at: oneHourAgo
    },
    {
      id: 'ev-4',
      work_item_id: 'wi-102',
      actor_id: 'user-zainab',
      event_type: 'CREATED',
      previous_value: null,
      new_value: 'OPEN',
      note: 'Wire discrepancy detected by automated ledger validator.',
      created_at: yesterday
    },
    {
      id: 'ev-5',
      work_item_id: 'wi-102',
      actor_id: 'user-zainab',
      event_type: 'STATUS_CHANGED',
      previous_value: 'IN_PROGRESS',
      new_value: 'AWAITING_APPROVAL',
      note: 'Requires Team Lead (Elena or Sarah) approval to authorize ledger balance override.',
      created_at: oneHourAgo
    },
    {
      id: 'ev-6',
      work_item_id: 'wi-103',
      actor_id: 'user-david',
      event_type: 'CREATED',
      previous_value: null,
      new_value: 'OPEN',
      note: 'Production incident raised following Sentry alert.',
      created_at: oneHourAgo
    }
  ];

  for (const ev of events) {
    database.run(`
      INSERT INTO activity_events (id, work_item_id, actor_id, event_type, previous_value, new_value, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [ev.id, ev.work_item_id, ev.actor_id, ev.event_type, ev.previous_value, ev.new_value, ev.note, ev.created_at]);
  }

  // 6. Seed Comments
  const comments = [
    {
      id: 'comm-1',
      work_item_id: 'wi-101',
      user_id: 'user-elena',
      body: 'I have dialed back non-critical webhook retries by 50% while Zainab reviews the queue workers.',
      created_at: oneHourAgo
    },
    {
      id: 'comm-2',
      work_item_id: 'wi-101',
      user_id: 'user-zainab',
      body: 'Identified a memory leak in redis queue driver under node v24 connection pool. Rolling out patch now.',
      created_at: now
    },
    {
      id: 'comm-3',
      work_item_id: 'wi-102',
      user_id: 'user-sarah',
      body: 'Reviewing audit ledger logs. Swift MT103 confirmation matches the intermediary bank batch ID.',
      created_at: oneHourAgo
    }
  ];

  for (const c of comments) {
    database.run(`
      INSERT INTO comments (id, work_item_id, user_id, body, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [c.id, c.work_item_id, c.user_id, c.body, c.created_at]);
  }

  // 7. Seed Outbox Jobs (to showcase Transactional Outbox pattern)
  const sampleJobs = [
    {
      id: 'job-1',
      event_type: 'NOTIFY_ASSIGNEE',
      payload: JSON.stringify({ workItemId: 'wi-101', assigneeId: 'user-zainab', priority: 'URGENT' }),
      status: 'COMPLETED',
      retry_count: 0,
      max_retries: 3,
      last_error: null,
      next_run_at: oneHourAgo,
      created_at: oneHourAgo,
      updated_at: oneHourAgo
    },
    {
      id: 'job-2',
      event_type: 'NOTIFY_APPROVAL_REQUEST',
      payload: JSON.stringify({ workItemId: 'wi-102', teamId: 'team-payments', requestedRole: 'LEAD' }),
      status: 'PENDING',
      retry_count: 0,
      max_retries: 3,
      last_error: null,
      next_run_at: now,
      created_at: oneHourAgo,
      updated_at: oneHourAgo
    }
  ];

  for (const j of sampleJobs) {
    database.run(`
      INSERT INTO outbox_jobs (id, event_type, payload, status, retry_count, max_retries, last_error, next_run_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [j.id, j.event_type, j.payload, j.status, j.retry_count, j.max_retries, j.last_error, j.next_run_at, j.created_at, j.updated_at]);
  }

  console.log('Seed completed successfully with 4 teams, 10 users, 10 work items, activity events, comments, and outbox jobs.');
}

// If invoked directly from CLI:
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  runSeed();
}
