---
def:
  tier: component
  id: authorization-ontology-nested-audit-tracing
  type: spec
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: draft
  layer: operation
  svc: authorization-ontology
  tags: [security, observability, audit, tracing]
  links:
    - target: authorization-ontology-system
      type: traces_to
    - target: authorization-ontology-audit-layer
      type: refines
    - target: authorization-ontology-decision-observation
      type: refs
    - target: authorization-ontology-resource-lifecycle
      type: refs
    - target: authorization-ontology-bitmap-pipeline
      type: refs
---

# Authorization Ontology Nested Audit Tracing — 중첩 트랜잭션의 감사 추적

## 목적 ^purpose

트랜잭션이 내부에서 다른 API를 호출하고, 그 API가 또 다른 트랜잭션을 호출하는 **중첩 구조**에서 감사 경로를 추적 가능하게 한다. 기본 감사 이벤트는 flat하게 기록되면 "어느 트랜잭션의 일부인가"를 사후에 재구성할 수 없어 권한 판정·거절의 원인 분석이 불가능해진다.

본 스펙은 감사 entry에 **트리 구조**를 부여해, 하나의 최상위 사용자 요청부터 하위 API 호출·권한 판정까지 전부 하나의 추적 트리로 묶는다. qa-sdk의 기존 `@qa-sdk/otel` trace_id/span_id를 재사용해 별도 ID 체계를 만들지 않는다.

## 구성 ^overview

- **Root audit entry**: 최상위 API 호출(통상 외부 진입) — 자기 자신이 root
- **Child audit entry**: parent 내부에서 발생한 후속 API 호출 — `parent_entry_id` 참조
- **Decision entry**: 권한 판정 단계(Pass 1 / Pass 2) — 실행 entry의 `kind="check"` 변종

모든 entry는 OTEL span과 1:1. trace_id는 최상위 요청의 trace, span_id는 해당 entry의 고유 ID.

```
root span (txn-A 실행)
├── check span (bitmap check for txn-A)
├── child span (createDocument API)
│   ├── check span (Pass 1 bitmap)
│   └── check span (Pass 2 resource-policy)
├── child span (linkProject API)
│   └── check span (Pass 1 only)
└── child span (nested txn-B)
    ├── check span (bitmap check for txn-B)
    └── child span (updateUser API)
        └── check span (Pass 1 + Pass 2)
```

## 정의 ^defines

### 1. Audit entry schema

```sql
CREATE TABLE audit_entries (
  span_id            TEXT PRIMARY KEY,        -- OTEL span_id 재사용
  trace_id           TEXT NOT NULL,           -- OTEL trace_id
  parent_span_id     TEXT,                    -- 최상위는 NULL
  root_span_id       TEXT NOT NULL,           -- 전체 트리의 최상위
  depth              INTEGER NOT NULL,        -- 0 = root
  kind               TEXT NOT NULL            -- 'execution' | 'check'
                     CHECK (kind IN ('execution','check')),

  -- execution kind fields
  api_id             TEXT,                    -- 호출된 API 식별자
  actor_user_id      TEXT NOT NULL,
  actor_tenant_id    TEXT,
  target_kind        TEXT,                    -- 'resource' | 'transaction'
  target_id          TEXT,                    -- resource_id 또는 transition_id
  outcome            TEXT NOT NULL            -- 'allow' | 'deny' | 'error'
                     CHECK (outcome IN ('allow','deny','error')),

  -- check kind fields
  pass               TEXT,                    -- 'bitmap' | 'lifecycle' | 'cerbos' | 'acl'
  address            INTEGER,                 -- bitmap check일 때 좌표 address
  union_kind         TEXT,                    -- DisjointUnionIndex의 kind
  deny_reason        TEXT,                    -- outcome='deny'일 때 사유 코드

  started_at         TEXT NOT NULL,
  ended_at           TEXT,                    -- 실행 종료 시각
  metadata           TEXT                     -- JSON blob (추가 context)
);

CREATE INDEX idx_audit_trace ON audit_entries(trace_id);
CREATE INDEX idx_audit_root ON audit_entries(root_span_id);
CREATE INDEX idx_audit_parent ON audit_entries(parent_span_id);
CREATE INDEX idx_audit_actor ON audit_entries(actor_user_id, started_at);
CREATE INDEX idx_audit_target ON audit_entries(target_kind, target_id);
```

인덱스 용도:
- `trace_id`: OTEL trace 전체 조회
- `root_span_id`: 한 최상위 요청의 모든 하위 entry
- `parent_span_id`: 바로 위 부모 탐색
- `actor_user_id + started_at`: 사용자별 시간순 감사
- `target_kind + target_id`: 특정 리소스·트랜잭션 유형 감사

### 2. Entry kind 분리

| kind | 의미 | 주요 필드 |
|---|---|---|
| **execution** | 실제 API/트랜잭션 실행 | `api_id`, `target_*`, `outcome` |
| **check** | 권한 판정 한 단계 | `pass`, `address`, `union_kind`, `deny_reason` |

한 API 호출은 보통:
- `execution` entry 1건 (호출 시작·종료)
- `check` entry 1~3건 (bitmap → lifecycle → cerbos/acl)

**이유**: check는 성공 시 대부분 조용하지만 실패 시 원인이 핵심. execution과 분리하면 감사 쿼리가 단순 (`WHERE kind='check' AND outcome='deny'`).

### 3. 트리 구축 규약

새 API 호출 시 caller는:

1. 현재 OTEL span을 parent로 식별 (`context.activeSpan`)
2. 새 span 생성 (OTEL tracer.startSpan)
3. audit_entry INSERT:
   - `span_id` = 새 span의 ID
   - `parent_span_id` = parent span ID (없으면 NULL)
   - `root_span_id` = parent의 `root_span_id` 또는 parent가 root면 parent.span_id, parent 없으면 자기 자신
   - `depth` = parent.depth + 1 (parent 없으면 0)
4. 권한 체크 단계마다 별도 check entry 기록 (parent = execution entry)
5. 실행 종료 시 execution entry의 `ended_at` + `outcome` 업데이트

### 4. 중첩 트랜잭션 처리

트랜잭션 A가 트랜잭션 B를 호출하면:

```
execution(A, depth=0, root=A.span)
├── check(pass='bitmap', addr=encode("tx","A"))
├── execution(createDoc, depth=1, root=A.span)
│   └── check(pass='bitmap', addr=encode("r","doc","create"))
└── execution(B, depth=1, root=A.span)              ← nested txn
    ├── check(pass='bitmap', addr=encode("tx","B"))
    └── execution(updateUser, depth=2, root=A.span)
```

- nested 트랜잭션도 **자기 bitmap 체크 수행** (트랜잭션 = API, 따라서 비트 있어야 호출 가능)
- `root_span_id`는 최상위 A. nested B는 자기가 root가 아님.
- **보상 로직**: nested 실패 시 parent까지 전파. `outcome='error'`가 tree 위로 propagate.

### 5. Decision replay

감사 목적으로 "이 요청이 왜 거절됐는가"를 재구성하려면:

```sql
-- root_span_id로 전체 트리 조회, depth + started_at으로 정렬
SELECT * FROM audit_entries
WHERE root_span_id = ?
ORDER BY depth, started_at;
```

트리 순회로 첫 `outcome='deny'` entry 추출 → `deny_reason` + `pass` + `address`로 원인 특정.

### 6. 보관 정책

- **hot window**: 최근 30일 전체 entry (execution + check)
- **warm window**: 90일 execution만 (check는 aggregate로 압축)
- **cold**: 1년 execution만, 외부 스토리지
- **retention**: 규제 요건에 따라 조정

check entry는 양이 많으므로(API 1회 = 1~3 check) 조기 축약.

## 소비 ^consumes

- `authorization-ontology-resource-lifecycle` — 2-pass check 단계 각각이 check entry 생성
- `authorization-ontology-bitmap-pipeline` — Pass 1 bitmap 체크 address·kind 기록
- `authorization-ontology-cerbos-mapping` — Cerbos 호출 결과를 check entry로 기록
- `authorization-graph-store` — DELEGATED 상태의 ACL 탐색 결과 기록
- `authorization-ontology-decision-observation` — 기존 decision 관찰 모델과 동일 schema 공유

## 위임 ^delegates

- **OTEL 인프라**: `@qa-sdk/otel` — trace_id/span_id 발급, context propagation
- **감사 저장소**: ingest-server의 store 어댑터 또는 전용 audit DB
- **감사 UI**: `authorization-monitor-web`의 trace explorer

## 방법 ^method

### 구현 순서

1. **Phase 1 — schema + entry recording**
   - `audit_entries` 테이블 마이그레이션
   - `AuditRecorder` 서비스: execution/check entry 기록 API
   - OTEL span에서 parent/root 자동 추출

2. **Phase 2 — 권한 레이어 통합**
   - `permission-middleware`가 Pass 1 check entry 기록
   - `resource-policy-registry`가 Pass 2 check entry 기록
   - Cerbos client가 policy 판정 결과 기록

3. **Phase 3 — 트리 replay·UI**
   - root_span_id 기반 트리 조회 API
   - `authorization-monitor-web`에 trace explorer 페이지
   - deny 원인 자동 하이라이트

4. **Phase 4 — 보관 정책**
   - 축약·archive 배치
   - retention compliance 감사 스크립트

### 테스트 전략

- **트리 정합성**: N depth 중첩 시 root_span_id가 모든 레벨에서 동일
- **parent ref 무결성**: 모든 non-root entry의 `parent_span_id`가 실재 entry
- **OTEL 연동**: 실제 trace/span context에서 올바른 ID 주입
- **nested 실패 전파**: 최하위 error가 상위 execution entry까지 outcome 반영
- **replay**: 실패한 트리에서 첫 deny entry 식별 정확성
- **hot/warm 전이**: retention 배치가 올바른 entry만 축약·삭제

## 주의사항

- **OTEL context 누락 방어**: span context가 없는 경로(cron job, 내부 이벤트 핸들러 등)는 별도 root span 시작 필수. context 없이 entry 기록 시 `trace_id` 발급 정책 명시.
- **check entry 폭발**: 고빈도 API + 다단계 체크는 entry 수 급증. 샘플링 또는 결과 캐시로 실제 기록은 deny/error·변경 발생 시로 한정 권장.
- **privacy**: target_id에 민감 식별자가 들어갈 수 있으므로 PII scrubbing 정책 적용. metadata JSON에는 PII 금지.
- **cross-service 트랜잭션**: 서비스 A → B 호출은 OTEL context propagation (W3C traceparent header) 필수. 미설정 시 B가 새 root로 시작되어 트리가 끊어짐.
- **시계열 skew**: 분산 환경에서 `started_at`이 clock skew로 역전될 수 있음. depth로 정렬을 primary, started_at은 secondary.
- **거부는 체인을 이어가지 않는다**: 권한 deny 시 하위 API 호출은 발생하지 않으므로 deny entry 이후 child는 없음. 있는데 deny면 버그.

## 용어

- **Root span**: 최상위 요청의 OTEL span. 모든 하위 entry의 `root_span_id` 대상.
- **Depth**: 트리 높이. 0 = root, 1 = root의 직접 호출.
- **Execution entry**: 실제 실행 단계 기록.
- **Check entry**: 권한 판정 한 단계 기록.
- **Decision replay**: 감사 시 트리 순회로 거절 원인 재구성.
