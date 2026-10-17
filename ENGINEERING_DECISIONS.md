# ENGINEERING DECISIONS

**Project:** Newtonite Operations Under Pressure — Operational Work Management Platform  
**Architecture Track:** Full-Stack Distributed Reliability Engineering  

This document explains five key architectural decisions made while designing and implementing the Newtonite operational coordination platform, detailing the context, options evaluated, chosen solution, and intentional trade-offs.

---

## 1. Concurrency Control: Atomic Conditional Claims vs. Optimistic Version Locking

### Context
In operational incidents (e.g., payment discrepancies or production outages), multiple operators often race to claim an unassigned issue, or two engineers view the same issue and simultaneously submit conflicting updates. Without deliberate concurrency handling, silent overwrites and duplicated efforts occur.

### Options Considered
1. **Pessimistic Row Locking (`SELECT ... FOR UPDATE`):** Locks the database row while an operator has an item open in their browser or starts an edit session.
2. **Last-Write-Wins (LWW):** Unconditional `UPDATE work_items SET ... WHERE id = ?`. Overwrites whatever is in the database with the latest HTTP payload.
3. **Dual Concurrency Strategy:**
   - **Atomic Conditional Updates for Claims:** `UPDATE work_items SET assignee_id = ?, version = version + 1 WHERE id = ? AND assignee_id IS NULL;`
   - **Optimistic Concurrency Control (OCC) for Edits:** Every work item carries an integer `version`. Clients send their current `version`, and the server updates only `WHERE id = ? AND version = ?`.

### Choice
We implemented the **Dual Concurrency Strategy (Option 3)**:
- **Claim Operation:** Guaranteed atomic race resolution. When two users fire claims in parallel, exactly one update modifies a row (`changes === 1`), while the second encounters `changes === 0`. The server immediately raises an `HttpError 409 Conflict` informing the second user who claimed the item first.
- **Form Edits & Status Transitions:** Optimistic locking ensures stale edits are rejected with `409 Conflict`, returning the latest server entity payload so the frontend can reconcile without data loss.

### Trade-Offs
- *Benefit:* High throughput without database deadlock risk; no lingering distributed locks if a user closes their laptop; zero silent overwrites.
- *Cost:* The frontend must handle `409 Conflict` gracefully. We built a dedicated `ConflictResolutionModal` that diffs the user's attempted change against the server's current state and provides one-click reconciliation.

---

## 2. Transactional Boundary & Same-Transaction Audit Logging

### Context
Work items frequently progress through escalations, reassignment, and approvals. A critical failure mode in operational systems is "log drift", where a work item state changes in the database, but writing the audit log fails (or vice versa), making post-incident investigation unreliable.

### Options Considered
1. **Application-Level Event Emitter (Separate Steps):** Update the work item in DB, then call an asynchronous logging service or insert into an activity table outside the transaction.
2. **Database Triggers:** Automatically insert into an audit table via SQLite/PostgreSQL `AFTER UPDATE` triggers.
3. **Single-Transaction Atomic Enclosure:** Execute the work item mutation, the append-only `activity_events` insertion, and the outbox job row creation within the exact same database transaction (`BEGIN IMMEDIATE ... COMMIT`).

### Choice
We selected **Single-Transaction Atomic Enclosure (Option 3)** using an explicit repository service boundary:
```typescript
return db.transaction(() => {
  // 1. Mutate work item with version check
  db.run(`UPDATE work_items SET ... WHERE id = ? AND version = ?`, ...);
  // 2. Append immutable audit event in SAME transaction
  db.run(`INSERT INTO activity_events (...) VALUES (...)`, ...);
  // 3. Queue asynchronous side-effect in SAME transaction
  db.run(`INSERT INTO outbox_jobs (...) VALUES (...)`, ...);
});
```

### Trade-Offs
- *Benefit:* Mathematical guarantee that history can never diverge from reality. If the database crashes or an error is thrown, the entire operation rolls back atomically.
- *Cost:* Slightly longer transaction duration. Minimized by keeping work within the transaction strictly limited to fast indexed SQLite/PostgreSQL operations (no network I/O inside the transaction).

---

## 3. Server-Enforced Resource-Level Authorization & Workflow State Machine

### Context
Newtonite spans multiple teams (Platform Core, Payments, Compliance, Customer Ops). A user belongs to one or more teams with differing roles (`VIEWER`, `MEMBER`, `LEAD`, `ADMIN`). The specification mandates that permissions must be enforced by the server and cannot rely solely on hiding UI buttons. Furthermore, workflow transitions (such as moving an item from `AWAITING_APPROVAL` to `RESOLVED`) require explicit authorization.

### Options Considered
1. **Client-Side UI Guarding:** Hide approval and claim buttons based on the user object stored in React state.
2. **Coarse Role-Based Access Control (RBAC):** Assign users a single global role (e.g. "Engineer" or "Manager") across the entire company.
3. **Scoped Resource-Level RBAC with Server-Enforced State Machine:** Every query and mutation is scoped by team membership. A finite state machine dictionary defines valid transitions (`ALLOWED_TRANSITIONS`), and critical steps (such as `AWAITING_APPROVAL -> RESOLVED`) explicitly require `LEAD` or `ADMIN` roles for the item's team.

### Choice
We selected **Scoped Resource-Level RBAC (Option 3)**:
- Users only retrieve items for teams they belong to (or all teams if company `ADMIN`).
- Attempts by a user from Customer Ops to read or mutate Platform Core items are rejected with `403 Forbidden`.
- Illegal state jumps (e.g., jumping from `OPEN` directly to `CLOSED`) return `400 Bad Request`.
- Approval transitions are strictly restricted to team Leads and company Admins.

### Trade-Offs
- *Benefit:* True defense-in-depth. Bypassing the frontend via direct cURL/Postman API calls cannot violate team boundaries or approval policies.
- *Cost:* Requires checking user memberships on every API call. We optimized this by injecting parsed memberships into `req.user` in the authentication middleware.

---

## 4. Reliable Asynchronous Processing: Transactional Outbox Pattern

### Context
Operational actions require secondary side-effects (dispatching notifications, escalating SLA warnings, triggering external webhooks, sending email alerts). Direct synchronous execution inside HTTP request handlers causes slow response times, external service failure propagation, and dual-write inconsistencies if the external service fails after the database commits.

### Options Considered
1. **Synchronous In-Line Execution:** Call notification APIs directly before returning the HTTP response.
2. **In-Memory Fire-and-Forget (`setImmediate` / EventEmitters):** Dispatch promises in memory without awaiting. If the Node process restarts or crashes mid-flight, the notification is permanently lost.
3. **Transactional Outbox Pattern with Exponential Backoff:** Persist an outbox job row to `outbox_jobs` in the same database transaction as the primary entity mutation. A background worker periodically claims pending jobs, executes idempotent handlers, and retries failures with exponential backoff up to a maximum retry limit.

### Choice
We selected the **Transactional Outbox Pattern (Option 3)**:
- Guarantees at-least-once delivery without distributed dual-write failure.
- Handlers are made idempotent via deduplication keys (`notify-assignee-${workItemId}-${assigneeId}`).
- If external services fail, jobs are rescheduled with exponential backoff (`delay = 2^retry * 1000ms`), capping out at `max_retries = 3` before moving to `FAILED`.
- The frontend includes a live **Outbox Monitor** where operators and evaluators can view background jobs and trigger batch runs on demand.

### Trade-Offs
- *Benefit:* Total decoupling of HTTP response times from external third-party latency; resilience against network partitions; zero lost notifications on process restart.
- *Cost:* Introduces eventual consistency (typically sub-second) rather than immediate synchronous notification.

---

## 5. Idempotent API Design for Double-Clicks and Network Retries

### Context
Under high-pressure operational environments, users frequently double-click buttons when responses lag, or network proxies retransmit dropped HTTP packets. Creating duplicate incidents or duplicate payment adjustments creates serious downstream hazards.

### Options Considered
1. **Client-Side Button Disabling:** Disable the submit button upon click. (Fails against network-level retries or page refreshes).
2. **Database Unique Constraints on Business Fields:** Rely on unique indexes (e.g. unique titles), which restricts legitimate distinct work items that happen to share titles.
3. **HTTP `Idempotency-Key` Middleware:** Clients generate a unique UUID per intent and send it via the `Idempotency-Key` header. The server records the key, request path, parameter hash, status code, and response body in `idempotency_keys`.

### Choice
We implemented the **HTTP `Idempotency-Key` Middleware (Option 3)**:
- Applied automatically on `POST /api/work-items`.
- If an incoming request contains a previously processed `Idempotency-Key`, the middleware intercepts execution, attaches header `X-Idempotent-Replay: true`, and returns the cached HTTP status code and response payload.
- No duplicate database rows are created, and side-effects are executed exactly once.

### Trade-Offs
- *Benefit:* Robust protection against flaky networks, browser retries, and rapid double-clicks.
- *Cost:* Requires storing idempotency cache records with an expiration TTL (configured to 24 hours).

---

## Summary of Decisions & Guarantees

| Situation | Architectural Mechanism | Guarantee |
|---|---|---|
| **Two operators claim the same item** | Atomic Conditional Update (`assignee_id IS NULL`) | Exactly 1 succeeds; loser gets 409 Conflict |
| **Two operators edit the same item** | Optimistic Concurrency Token (`version = ?`) | Stale edit rejected with 409; latest state returned |
| **Rapid double-click or network retry** | `Idempotency-Key` Header Middleware | Single record created; identical cached response returned |
| **Unauthorized state progression** | Workflow State Machine + Scoped RBAC | Illegal jumps rejected (400); Lead required for approvals (403) |
| **Audit log reliability** | Single Database Transaction Enclosure | History can never disagree with item state |
| **Notification / side-effect failure** | Transactional Outbox + Exponential Backoff | At-least-once delivery; no lost events on crash |
