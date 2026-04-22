---
lifecycle: draft
plan: 11c
phase: 4
depends-on: [10b, 11a, 04c]
---

# Plan 11c — 시뮬 지원 도메인 모델 (notification / document / reporting)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan 10b에서 부팅한 지원 서비스 4개 중 도메인 모델이 필요한 3개 (`sim-notification-api`, `sim-document-api`, `sim-reporting-api`)에 도메인을 부착한다. **notification-api**는 Notification + Subscription 2 entity, **document-api**는 Document + DocumentVersion + Comment 3 entity, **reporting-api**는 read-aggregate 성격이라 별도 테이블 적음 — Report (저장된 쿼리 정의) + DailyMetric (집계 결과 캐시) 2 entity. `sim-audit-browser-api`는 own table 없음 (qa-sdk 본체의 audit-recorder-store 조회만) — 본 plan은 read-only adapter 정의만, 영속 schema는 추가 안 함. 모든 서비스는 Plan 11a/11b의 dual-target SSOT 패턴 그대로 복제.

**Architecture:**
- **dual-target SSOT** (Plan 11a/11b 패턴):
  - `shared/{types,errors,port}.ts`
  - `sqlite/{schema,adapter,adapter.test}.ts`
  - `pg/{schema,adapter,adapter.test}.ts`
  - `factory.ts` + `port-contract.test.ts`
  - NestJS `<domain>-db.module.ts` + 도메인별 service/controller
- **notification-api 도메인** (design.md §3):
  - Notification(id, recipientUserId, type, title, body, status: pending|sent|read|failed, createdAt, sentAt)
  - Subscription(userId, eventType, channel: in_app|email, isActive)
  - Plan 12b가 Redis subscriber로 publish event 수신 → Notification 생성
- **document-api 도메인** (design.md §3 본문 참조):
  - Document(id, projectId, title, currentVersion, ownerId, createdAt, updatedAt)
  - DocumentVersion(documentId, versionNumber, contentRef, authorId, createdAt) — content 자체는 외부 storage (본 plan은 ref string만)
  - Comment(id, documentId, authorId, parentCommentId, body, createdAt)
- **reporting-api 도메인**:
  - Report(id, name, queryDefinition, createdBy, createdAt) — 저장된 분석 쿼리 정의 (JSON)
  - DailyMetric(id, metricKey, value, dimensions, computedAt) — marginal density 측정 결과 캐시 (Plan 14a가 채움, 본 plan은 schema만)
- **audit-browser-api**: 도메인 schema 없음. Plan 12c가 audit-recorder-store를 dependency injection으로 주입.
- **TDD steps** — 각 service에서 동일 패턴: shared types → schema → adapter → factory → port-contract → service → controller → app.module.

**Tech Stack:** Plan 11a/11b와 동일.

---

## File Structure

### 새로 만드는 파일 — notification-api

```
simulations/enterprise-pm/services/notification-api/src/
├── notification/
│   ├── shared/{types,errors,port}.ts
│   ├── sqlite/{schema,adapter,adapter.test}.ts
│   ├── pg/{schema,adapter,adapter.test}.ts
│   ├── factory.ts + factory.test.ts
│   ├── port-contract.test.ts
│   ├── notification-db.module.ts
│   ├── notification/{module,service,service.test,controller}.ts
│   └── subscription/{module,service,service.test,controller}.ts
└── drizzle/{sqlite,pg}/0001_init.sql
```

### 새로 만드는 파일 — document-api

```
simulations/enterprise-pm/services/document-api/src/
├── document/
│   ├── shared/{types,errors,port}.ts
│   ├── sqlite/{schema,adapter,adapter.test}.ts
│   ├── pg/{schema,adapter,adapter.test}.ts
│   ├── factory.ts + factory.test.ts
│   ├── port-contract.test.ts
│   ├── document-db.module.ts
│   ├── document/{module,service,service.test,controller}.ts
│   ├── version/{module,service,service.test,controller}.ts
│   └── comment/{module,service,service.test,controller}.ts
└── drizzle/{sqlite,pg}/0001_init.sql
```

### 새로 만드는 파일 — reporting-api

```
simulations/enterprise-pm/services/reporting-api/src/
├── reporting/
│   ├── shared/{types,errors,port}.ts
│   ├── sqlite/{schema,adapter,adapter.test}.ts
│   ├── pg/{schema,adapter,adapter.test}.ts
│   ├── factory.ts + factory.test.ts
│   ├── port-contract.test.ts
│   ├── reporting-db.module.ts
│   ├── report/{module,service,service.test,controller}.ts
│   └── metric/{module,service,service.test,controller}.ts
└── drizzle/{sqlite,pg}/0001_init.sql
```

### audit-browser-api

본 plan에서는 schema 추가 없음. Plan 12c가 audit-recorder-store를 inject.

---

## Task 0: baseline

- [ ] **Step 1: 선행 plan 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls simulations/enterprise-pm/services/notification-api/src/main.ts \
     simulations/enterprise-pm/services/document-api/src/main.ts \
     simulations/enterprise-pm/services/reporting-api/src/main.ts \
     simulations/enterprise-pm/services/auth-api/src/auth/factory.ts && \
  ls packages/db-bootstrap/src/connection.ts
```

Expected: 모두 hit. Plan 10b (4 서비스 부팅) + Plan 11a (dual-target 패턴 확립) + Plan 04c (db-bootstrap).

- [ ] **Step 2: qa-sdk-postgres + sim schema 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && \
  docker compose -f docker-compose.infra.yaml ps qa-sdk-db | grep healthy
```

Expected: healthy.

---

## Task 1: notification-api — package + dep + shared

**Files:**
- Modify: `simulations/enterprise-pm/services/notification-api/package.json`
- Create: `src/notification/shared/{types,errors,port}.ts`

- [ ] **Step 1: package.json — Plan 11a 패턴 (drizzle + db-bootstrap + peerDeps)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install
```

- [ ] **Step 2: shared/types.ts**

```ts
// @def.boundary sim-notification-api
// @def.doc sim-erp-pm-design

export type NotificationStatus = "pending" | "sent" | "read" | "failed";
export type NotificationChannel = "in_app" | "email";

export interface Notification {
  id: string;
  recipientUserId: string;
  type: string;            // "budget.approved", "task.assigned" 등
  title: string;
  body: string;
  status: NotificationStatus;
  createdAt: string;
  sentAt: string | null;
  readAt: string | null;
}

export interface Subscription {
  userId: string;
  eventType: string;       // wildcard 지원: "budget.*", "task.*"
  channel: NotificationChannel;
  isActive: boolean;
  createdAt: string;
}

export interface NotificationCreate {
  recipientUserId: string;
  type: string;
  title: string;
  body: string;
}

export interface SubscriptionCreate {
  userId: string;
  eventType: string;
  channel: NotificationChannel;
  isActive?: boolean;
}
```

- [ ] **Step 3: shared/errors.ts**

```ts
// @def.boundary sim-notification-api
// @def.doc sim-erp-pm-design

export class NotificationNotFoundError extends Error {
  constructor(public readonly id: string) { super(`Notification not found: ${id}`); this.name = "NotificationNotFoundError"; }
}
export class SubscriptionNotFoundError extends Error {
  constructor(public readonly userId: string, public readonly eventType: string) {
    super(`Subscription not found: ${userId}/${eventType}`); this.name = "SubscriptionNotFoundError";
  }
}
```

- [ ] **Step 4: shared/port.ts**

```ts
// @def.boundary sim-notification-api
// @def.doc sim-erp-pm-design

import type { Notification, NotificationCreate, NotificationStatus, Subscription, SubscriptionCreate } from "./types.js";

export interface NotificationRepository {
  // Notification
  createNotification(args: NotificationCreate): Promise<Notification>;
  findNotification(id: string): Promise<Notification | null>;
  listNotificationsForUser(userId: string, status?: NotificationStatus): Promise<Notification[]>;
  markAsSent(id: string): Promise<Notification>;
  markAsRead(id: string): Promise<Notification>;
  markAsFailed(id: string): Promise<Notification>;

  // Subscription
  createSubscription(args: SubscriptionCreate): Promise<Subscription>;
  findSubscription(userId: string, eventType: string): Promise<Subscription | null>;
  listSubscriptionsForUser(userId: string): Promise<Subscription[]>;
  /** event matching: 정확 일치 + wildcard "domain.*" */
  listSubscribersByEventType(eventType: string): Promise<Subscription[]>;
  setSubscriptionActive(userId: string, eventType: string, isActive: boolean): Promise<Subscription>;
  deleteSubscription(userId: string, eventType: string): Promise<void>;
}
```

- [ ] **Step 5: typecheck + 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/sim-notification-api typecheck
```

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/notification-api/package.json \
          simulations/enterprise-pm/services/notification-api/src/notification/shared \
          pnpm-lock.yaml && \
  git commit -m "$(cat <<'EOF'
feat(sim-notification-api): notification domain shared (types + port)

Notification + Subscription 2 entity. wildcard eventType matching 지원.
Plan 12b가 Redis subscriber로 createNotification 호출.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: notification-api — sqlite + pg adapter (TDD)

Plan 11a Task 5/6 패턴 — sqlite/schema.ts (`notifications` + `subscriptions` 테이블) + adapter.ts + adapter.test.ts (8건) + pg/ 동일 (`sim.notif_notifications`, `sim.notif_subscriptions`) + adapter.test.ts (env gate, 2건).

- [ ] **Step 1: sqlite/schema.ts**

```ts
// @def.boundary sim-notification-api
// @def.doc sim-erp-pm-design

import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  recipientUserId: text("recipient_user_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  status: text("status", { enum: ["pending", "sent", "read", "failed"] }).notNull(),
  createdAt: text("created_at").notNull(),
  sentAt: text("sent_at"),
  readAt: text("read_at"),
}, (t) => [
  index("idx_notif_recipient").on(t.recipientUserId),
  index("idx_notif_status").on(t.status),
]);

export const subscriptions = sqliteTable("subscriptions", {
  userId: text("user_id").notNull(),
  eventType: text("event_type").notNull(),
  channel: text("channel", { enum: ["in_app", "email"] }).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.eventType] }),
  index("idx_sub_event").on(t.eventType),
]);

export const SIM_NOTIF_SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  recipient_user_id TEXT NOT NULL,
  type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','sent','read','failed')),
  created_at TEXT NOT NULL, sent_at TEXT, read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notif_status ON notifications(status);

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id TEXT NOT NULL, event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','email')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, event_type)
);
CREATE INDEX IF NOT EXISTS idx_sub_event ON subscriptions(event_type);
`;
```

- [ ] **Step 2: sqlite/adapter.ts**

핵심 메서드 — `listSubscribersByEventType` wildcard:

```ts
async listSubscribersByEventType(eventType: string): Promise<Subscription[]> {
  // 정확 매치 + wildcard 매치 (eventType="budget.approved"에 "budget.*" 패턴이 매치)
  const all = this.db.select().from(subscriptions).where(eq(subscriptions.isActive, true)).all();
  return all.filter((s) => matchesEventType(s.eventType, eventType));
}

function matchesEventType(pattern: string, actual: string): boolean {
  if (pattern === actual) return true;
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -2);
    return actual.startsWith(prefix + ".");
  }
  return false;
}
```

나머지 메서드는 11a 패턴.

- [ ] **Step 3: sqlite/adapter.test.ts** (8건)
  - createNotification + findNotification round-trip
  - listNotificationsForUser status filter
  - markAsSent → status="sent" + sentAt 갱신
  - markAsRead → status="read" + readAt 갱신
  - createSubscription + listSubscriptionsForUser
  - listSubscribersByEventType — 정확 매치
  - listSubscribersByEventType — wildcard "budget.*" 매치
  - setSubscriptionActive false → listSubscribersByEventType에서 제외

- [ ] **Step 4: pg/schema.ts + adapter.ts + adapter.test.ts** — `sim.notif_notifications`, `sim.notif_subscriptions`. wildcard 매칭 PG에서는 SQL `LIKE` 활용 가능 — 본 plan은 application-level 동일 (in-memory filter)로 단순화. 2건 (createNotification + listSubscribersByEventType wildcard).

- [ ] **Step 5: 테스트 + 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/sim-notification-api test -- notification/sqlite notification/pg
```

Expected: 8 + 2 PASS.

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/notification-api/src/notification/sqlite \
          simulations/enterprise-pm/services/notification-api/src/notification/pg && \
  git commit -m "$(cat <<'EOF'
feat(sim-notification-api): SQLite + PG schema + adapter (Notification/Subscription)

wildcard eventType matching ("budget.*").
PG: sim.notif_* prefix.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: notification-api — factory + port-contract + NestJS 모듈

Plan 11a Task 7/8 패턴.

- [ ] **Step 1: factory.ts + factory.test.ts** — 11a 패턴.
- [ ] **Step 2: port-contract.test.ts** — 4 시나리오 (createNotification + markAsRead + createSubscription + wildcard match).
- [ ] **Step 3: notification-db.module.ts** — `NOTIFICATION_REPOSITORY` symbol + `forRoot()` factory.
- [ ] **Step 4: notification/notification 모듈 + subscription 모듈** — 각 4 파일.

**컨트롤러 라우트**:
- `NotificationController`:
  - `POST /notifications` — create (Plan 12b Redis subscriber가 호출)
  - `GET /notifications/:id`
  - `GET /users/:userId/notifications?status=pending`
  - `PUT /notifications/:id/sent` (mark)
  - `PUT /notifications/:id/read`
  - `PUT /notifications/:id/failed`
- `SubscriptionController`:
  - `POST /subscriptions`
  - `GET /users/:userId/subscriptions`
  - `PUT /subscriptions/:userId/:eventType/active` (body: isActive)
  - `DELETE /subscriptions/:userId/:eventType`

- [ ] **Step 5: app.module.ts 부착**

```ts
import { NotificationDbModule } from "./notification/notification-db.module.js";
import { NotificationModule } from "./notification/notification/notification.module.js";
import { SubscriptionModule } from "./notification/subscription/subscription.module.js";

@Module({
  imports: [HealthModule, NotificationDbModule.forRoot(), NotificationModule, SubscriptionModule],
})
export class AppModule {}
```

- [ ] **Step 6: typecheck + 전체 테스트 + e2e 부팅**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-notification-api typecheck && \
  pnpm --filter @qa-sdk/sim-notification-api test && \
  QA_DB_DIALECT=sqlite QA_SQLITE_PATH=/tmp/sim-notif-test.sqlite \
  pnpm --filter @qa-sdk/sim-notification-api start &
PID=$!
sleep 3
echo "create notification:"
curl -fsS -X POST http://localhost:4700/notifications \
  -H "content-type: application/json" \
  -d '{"recipientUserId":"u-1","type":"budget.approved","title":"승인","body":"5M 예산 승인됨"}'
echo
kill $PID 2>/dev/null || true
rm -f /tmp/sim-notif-test.sqlite
```

Expected: 201 + notification JSON.

- [ ] **Step 7: drizzle config + migration + 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/notification-api && \
  git commit -m "$(cat <<'EOF'
feat(sim-notification-api): factory + port-contract + 2 NestJS 모듈 + e2e

NotificationDbModule.forRoot() global. e2e POST /notifications 통과.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: document-api — package + dep + shared

**Files:**
- Modify: `simulations/enterprise-pm/services/document-api/package.json`
- Create: `src/document/shared/{types,errors,port}.ts`

- [ ] **Step 1: package.json — Plan 11a 패턴**

- [ ] **Step 2: shared/types.ts**

```ts
// @def.boundary sim-document-api
// @def.doc sim-erp-pm-design

export interface Document {
  id: string;
  projectId: string;
  title: string;
  currentVersion: number;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersion {
  documentId: string;
  versionNumber: number;
  /** 외부 storage(S3/local) 참조 키. 본 plan은 string ref만 영속 — content 자체는 별도. */
  contentRef: string;
  authorId: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  documentId: string;
  authorId: string;
  parentCommentId: string | null;
  body: string;
  createdAt: string;
}

export interface DocumentCreate {
  projectId: string;
  title: string;
  ownerId: string;
}

export interface DocumentVersionCreate {
  documentId: string;
  contentRef: string;
  authorId: string;
}

export interface CommentCreate {
  documentId: string;
  authorId: string;
  body: string;
  parentCommentId?: string;
}
```

- [ ] **Step 3: shared/errors.ts** — DocumentNotFoundError + CommentNotFoundError + VersionMismatchError.

- [ ] **Step 4: shared/port.ts**

```ts
export interface DocumentRepository {
  // Document
  createDocument(args: DocumentCreate): Promise<Document>;
  findDocument(id: string): Promise<Document | null>;
  listDocumentsByProject(projectId: string): Promise<Document[]>;
  updateDocument(id: string, patch: Partial<DocumentCreate>): Promise<Document>;
  deleteDocument(id: string): Promise<void>;

  // DocumentVersion (append-only)
  createVersion(args: DocumentVersionCreate): Promise<DocumentVersion>;
  findVersion(documentId: string, versionNumber: number): Promise<DocumentVersion | null>;
  listVersions(documentId: string): Promise<DocumentVersion[]>;

  // Comment (threaded)
  createComment(args: CommentCreate): Promise<Comment>;
  findComment(id: string): Promise<Comment | null>;
  listCommentsForDocument(documentId: string): Promise<Comment[]>;
  listReplies(parentCommentId: string): Promise<Comment[]>;
  deleteComment(id: string): Promise<void>;
}
```

- [ ] **Step 5: 커밋**

---

## Task 5: document-api — sqlite + pg adapter (TDD)

- [ ] **Step 1: sqlite/schema.ts** (3 테이블 — `documents`, `document_versions`, `comments`)

```ts
import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  title: text("title").notNull(),
  currentVersion: integer("current_version").notNull().default(0),
  ownerId: text("owner_id").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [index("idx_doc_proj").on(t.projectId)]);

export const documentVersions = sqliteTable("document_versions", {
  documentId: text("document_id").notNull(),
  versionNumber: integer("version_number").notNull(),
  contentRef: text("content_ref").notNull(),
  authorId: text("author_id").notNull(),
  createdAt: text("created_at").notNull(),
}, (t) => [primaryKey({ columns: [t.documentId, t.versionNumber] })]);

export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull(),
  authorId: text("author_id").notNull(),
  parentCommentId: text("parent_comment_id"),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull(),
}, (t) => [
  index("idx_cmt_doc").on(t.documentId),
  index("idx_cmt_parent").on(t.parentCommentId),
]);

export const SIM_DOC_SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 0, owner_id TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_doc_proj ON documents(project_id);

CREATE TABLE IF NOT EXISTS document_versions (
  document_id TEXT NOT NULL, version_number INTEGER NOT NULL,
  content_ref TEXT NOT NULL, author_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (document_id, version_number)
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY, document_id TEXT NOT NULL, author_id TEXT NOT NULL,
  parent_comment_id TEXT, body TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cmt_doc ON comments(document_id);
CREATE INDEX IF NOT EXISTS idx_cmt_parent ON comments(parent_comment_id);
`;
```

- [ ] **Step 2: sqlite/adapter.ts**

핵심 — `createVersion`이 documents.currentVersion을 atomic increment + insert.

```ts
async createVersion(args: DocumentVersionCreate): Promise<DocumentVersion> {
  const doc = await this.findDocument(args.documentId);
  if (!doc) throw new DocumentNotFoundError(args.documentId);
  const nextVersion = doc.currentVersion + 1;
  const version: DocumentVersion = {
    documentId: args.documentId,
    versionNumber: nextVersion,
    contentRef: args.contentRef,
    authorId: args.authorId,
    createdAt: new Date().toISOString(),
  };
  this.db.transaction(() => {
    this.db.insert(documentVersions).values(version).run();
    this.db.update(documents).set({
      currentVersion: nextVersion,
      updatedAt: version.createdAt,
    }).where(eq(documents.id, args.documentId)).run();
  });
  return version;
}
```

- [ ] **Step 3: sqlite/adapter.test.ts** (8건)
  - createDocument round-trip
  - listDocumentsByProject
  - createVersion (1) → currentVersion=1
  - createVersion (2) → currentVersion=2 + listVersions 2건
  - createComment (top-level)
  - createComment with parentCommentId → listReplies
  - listCommentsForDocument
  - deleteComment

- [ ] **Step 4: pg/schema.ts + adapter.ts + adapter.test.ts** — `sim.doc_documents`, `sim.doc_versions`, `sim.doc_comments`. PG transaction은 `db.transaction(async (tx) => {...})` 패턴. 2건.

- [ ] **Step 5: 테스트 + 커밋**

---

## Task 6: document-api — factory + port-contract + NestJS 3 모듈

Plan 11a Task 7/8 패턴 — factory + port-contract.test (4 시나리오) + DocumentDbModule + 3 모듈 (document/version/comment).

**컨트롤러 라우트**:
- `DocumentController`:
  - `POST /documents`, `GET /documents/:id`, `GET /documents?projectId=X`, `PUT /documents/:id`, `DELETE /documents/:id`
- `VersionController`:
  - `POST /documents/:id/versions` (body: contentRef, authorId)
  - `GET /documents/:id/versions`
  - `GET /documents/:id/versions/:versionNumber`
- `CommentController`:
  - `POST /comments`, `GET /comments/:id`
  - `GET /documents/:docId/comments`
  - `GET /comments/:parentId/replies`
  - `DELETE /comments/:id`

- [ ] **Step 1~5**: 11a Task 8 패턴.

- [ ] **Step 6: app.module.ts 부착 + e2e**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  QA_DB_DIALECT=sqlite QA_SQLITE_PATH=/tmp/sim-doc-test.sqlite \
  pnpm --filter @qa-sdk/sim-document-api start &
PID=$!
sleep 3
echo "create document:"; D=$(curl -fsS -X POST http://localhost:4900/documents \
  -H "content-type: application/json" \
  -d '{"projectId":"p-1","title":"Spec","ownerId":"u-1"}')
echo "$D"
DID=$(echo "$D" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)

echo "create version 1:"; curl -fsS -X POST http://localhost:4900/documents/$DID/versions \
  -H "content-type: application/json" \
  -d '{"contentRef":"s3://bucket/key1","authorId":"u-1"}'
echo
echo "list versions:"; curl -fsS http://localhost:4900/documents/$DID/versions
echo

kill $PID 2>/dev/null || true
rm -f /tmp/sim-doc-test.sqlite
```

Expected: createVersion → listVersions에 1건, currentVersion=1.

- [ ] **Step 7: 커밋**

---

## Task 7: reporting-api — package + dep + shared

**Files:**
- Modify: `simulations/enterprise-pm/services/reporting-api/package.json`
- Create: `src/reporting/shared/{types,errors,port}.ts`

- [ ] **Step 1: package.json**

- [ ] **Step 2: shared/types.ts**

```ts
// @def.boundary sim-reporting-api
// @def.doc sim-erp-pm-design

export interface Report {
  id: string;
  name: string;
  /** JSON-serialized 쿼리 정의 — 본 plan은 string으로만 영속, 실제 쿼리 실행은 별도. */
  queryDefinition: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyMetric {
  id: string;
  metricKey: string;       // "marginal_density.sim.budget"
  /** ISO date — yyyy-mm-dd */
  date: string;
  value: number;
  /** JSON: dimension breakdown (예: { service: "approval-api", prefix: "sim.budget" }) */
  dimensions: string;
  computedAt: string;
}

export interface ReportCreate {
  name: string;
  queryDefinition: string;
  createdBy: string;
}

export interface DailyMetricCreate {
  metricKey: string;
  date: string;
  value: number;
  dimensions: string;
}
```

- [ ] **Step 3: shared/errors.ts** + **Step 4: shared/port.ts**

```ts
export interface ReportingRepository {
  // Report
  createReport(args: ReportCreate): Promise<Report>;
  findReport(id: string): Promise<Report | null>;
  listReports(): Promise<Report[]>;
  updateReport(id: string, patch: Partial<ReportCreate>): Promise<Report>;
  deleteReport(id: string): Promise<void>;

  // DailyMetric (append-only, computed by Plan 14a)
  recordMetric(args: DailyMetricCreate): Promise<DailyMetric>;
  findMetric(metricKey: string, date: string): Promise<DailyMetric | null>;
  listMetricsByKey(metricKey: string, fromDate: string, toDate: string): Promise<DailyMetric[]>;
  listMetricKeys(): Promise<string[]>;
}
```

- [ ] **Step 5: 커밋**

---

## Task 8: reporting-api — sqlite + pg adapter (TDD)

- [ ] **Step 1: sqlite/schema.ts**

```ts
import { sqliteTable, text, real, primaryKey, index } from "drizzle-orm/sqlite-core";

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  queryDefinition: text("query_definition").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const dailyMetrics = sqliteTable("daily_metrics", {
  id: text("id").primaryKey(),
  metricKey: text("metric_key").notNull(),
  date: text("date").notNull(),
  value: real("value").notNull(),
  dimensions: text("dimensions").notNull(),
  computedAt: text("computed_at").notNull(),
}, (t) => [
  index("idx_dm_key_date").on(t.metricKey, t.date),
]);

export const SIM_REPORTING_SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  query_definition TEXT NOT NULL, created_by TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_metrics (
  id TEXT PRIMARY KEY,
  metric_key TEXT NOT NULL, date TEXT NOT NULL,
  value REAL NOT NULL, dimensions TEXT NOT NULL,
  computed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dm_key_date ON daily_metrics(metric_key, date);
`;
```

- [ ] **Step 2: sqlite/adapter.ts** (단순 CRUD + listMetricsByKey range query)

- [ ] **Step 3: sqlite/adapter.test.ts** (6건)
  - createReport + findReport
  - listReports
  - updateReport patch
  - recordMetric + findMetric
  - listMetricsByKey range
  - listMetricKeys distinct

- [ ] **Step 4: pg/** — `sim.reporting_reports`, `sim.reporting_daily_metrics`. 2건.

- [ ] **Step 5: 테스트 + 커밋**

---

## Task 9: reporting-api — factory + port-contract + NestJS 2 모듈

Plan 11a Task 7/8 패턴.

**컨트롤러 라우트**:
- `ReportController`:
  - `POST /reports`, `GET /reports/:id`, `GET /reports`, `PUT /reports/:id`, `DELETE /reports/:id`
- `MetricController`:
  - `POST /metrics` (Plan 14a가 호출)
  - `GET /metrics?metricKey=X&fromDate=Y&toDate=Z`
  - `GET /metrics/keys`

- [ ] **Step 1~5**: 11a Task 8 패턴.

- [ ] **Step 6: app.module.ts + e2e**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  QA_DB_DIALECT=sqlite QA_SQLITE_PATH=/tmp/sim-rep-test.sqlite \
  pnpm --filter @qa-sdk/sim-reporting-api start &
PID=$!
sleep 3
echo "create report:"; curl -fsS -X POST http://localhost:4800/reports \
  -H "content-type: application/json" \
  -d '{"name":"Daily","queryDefinition":"{\"select\":\"sum(amount)\"}","createdBy":"u-1"}'
echo
echo "record metric:"; curl -fsS -X POST http://localhost:4800/metrics \
  -H "content-type: application/json" \
  -d '{"metricKey":"marginal_density.sim.budget","date":"2026-04-22","value":0.42,"dimensions":"{}"}'
echo
kill $PID 2>/dev/null || true
rm -f /tmp/sim-rep-test.sqlite
```

Expected: 2 endpoint 모두 200/201.

- [ ] **Step 7: 커밋**

---

## Task 10: drizzle config + migration (3 서비스)

Plan 11a Task 11 패턴을 notification-api / document-api / reporting-api 3 서비스에 적용. 각 서비스에 `drizzle.sqlite/pg.config.ts` + `drizzle/{sqlite,pg}/0001_init.sql` + package.json scripts (`db:gen:sqlite`, `db:gen:pg`).

- [ ] **Step 1: 3 서비스 × 4 파일 = 12 파일 작성**
- [ ] **Step 2: package.json scripts 추가**
- [ ] **Step 3: 커밋**

---

## Task 11: 회귀 — 9 시뮬 서비스 통합

- [ ] **Step 1: 9 시뮬 서비스 typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter "@qa-sdk/sim-*" typecheck 2>&1 | tail -10
```

Expected: 모두 0 error.

- [ ] **Step 2: 9 시뮬 서비스 전체 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter "@qa-sdk/sim-*" test 2>&1 | tail -10
```

Expected: 11a (auth) + 11b (pm/approval) + 11c (notif/doc/rep) 합산 100+ PASS.

- [ ] **Step 3: workflow-smoke + def gate 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/cli test 2>&1 | tail -3 && \
  node packages/cli/dist/index.js def validate 2>&1 | head -3
```

Expected: smoke PASS, def errors 0.

- [ ] **Step 4: 7 도메인 서비스 동시 부팅 (audit-browser + gateway + metrics 제외)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  for svc in sim-auth-api sim-pm-api sim-approval-api sim-notification-api sim-reporting-api sim-document-api; do
    QA_DB_DIALECT=sqlite QA_SQLITE_PATH=/tmp/${svc}.sqlite \
    pnpm --filter @qa-sdk/$svc start &
  done
sleep 8
for port in 4400 4500 4600 4700 4800 4900; do
  echo "port $port:"; curl -fsS http://localhost:$port/health | head -c 120; echo
done
pkill -f "node dist/main.js" || true
rm -f /tmp/sim-*.sqlite
```

Expected: 6 /health 200.

---

## Self-Review

- [ ] dual-target SSOT 패턴 (Plan 11a) — 3 서비스에 동일 복제
- [ ] notification — wildcard eventType matching ("budget.*") 동작
- [ ] document — createVersion이 currentVersion atomic increment + transaction
- [ ] reporting — Report (저장된 쿼리 정의) + DailyMetric (Plan 14a가 채움)
- [ ] PG 테이블명: `sim.notif_*`, `sim.doc_*`, `sim.reporting_*` (도메인 격리)
- [ ] audit-browser-api는 본 plan 범위 외 (Plan 12c가 audit-recorder-store inject)
- [ ] 9 시뮬 서비스 모두 typecheck 0
- [ ] 6 도메인 서비스 동시 부팅 → 6 /health 200
- [ ] console.log 0건

---

## Defer (본 plan 범위 외)

| 작업 | 이유 | 후속 plan |
|---|---|---|
| Notification 발송 actual implementation (email send 등) | 시뮬 — 실제 발송 안 함, status 갱신만 | (없음) |
| Document content storage backend (S3 / 로컬) | content는 외부 책임, 본 plan은 ref만 영속 | (시뮬 외 별도) |
| audit-browser-api의 read-only adapter | audit-recorder-store dependency injection | Plan 12c |
| reporting-api의 cross-service aggregation 쿼리 실행 | 단순 ingest 데이터 + marginal density | Plan 14a |
| RLS 정책 (sim.notif_*, sim.doc_*, sim.reporting_*) | Phase 3 §3 RLS plan | Phase 3 |
| seed 데이터 (sample subscriptions / documents) | 시나리오 작성 시점 | Plan 13c/d |

---

## 의존·후속

- **Plan 10b** (지원 서비스 부팅): 본 plan의 직접 전제.
- **Plan 11a** (auth dual-target 패턴): 본 plan이 패턴 그대로 복제.
- **Plan 04c** (db-bootstrap): `createConnection` + `dbEnvSchema` + fixture.
- **Plan 09b** (init.sql sim schema): PG adapter 동작 전제.
- **Plan 11b** (pm + approval): 본 plan과 직렬, 동일 패턴 복제.
- **Plan 12b** (Redis pub/sub): notification-api의 createNotification 호출.
- **Plan 12c** (audit 연동): audit-browser-api 위에 audit-recorder-store inject.
- **Plan 13d** (시나리오 7, 8): 본 plan의 notification + bitmap invalidation 흐름 e2e.
- **Plan 14a** (marginal density): reporting-api의 recordMetric에 측정 결과 영속.
