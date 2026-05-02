---
def:
  tier: component
  id: quality-ledger
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: operation
  svc: quality-ledger
  tags: [persistence, observability]
  links:
    - target: quality-gates-system
      type: refines
    - target: harness-state-model
      type: depends_on
---

## 탐색 ^navigation

quality-gates-system > **quality-ledger**

형제: `harness-state-model` · `harness-model`

## 목적 ^purpose

품질 게이트 실행 결과를 SQLite에 영속하는 원장. gate 문서 ID + 문서 버전 기준으로 최신 실행 결과를 저장하고, 번들 단위 검증 상태를 도출한다. 하네스의 "verified" 판정은 이 원장에 의존한다.

## 테이블 (1개)

소스: `packages/quality-ledger/src/db/schema.ts`

### quality_gate_runs

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | integer PK | 자동 증가 |
| gate_doc_id | text | 게이트 스펙 문서 ID |
| doc_version | integer | 게이트 문서 버전 (stale 판정 기준) |
| bundle_id | text (nullable) | 소속 번들 ID |
| command | text | 실행한 검증 명령어 |
| outcome | text | `pass` / `fail` |
| exit_code | integer (nullable) | 프로세스 종료 코드 |
| executed_at | text | 실행 시각 |
| notes | text (nullable) | 비고 |
| repo_root | text (nullable) | 레포 루트 경로 |
| git_branch | text (nullable) | 실행 시 브랜치 |
| git_sha | text (nullable) | 실행 시 커밋 해시 |
| run_duration_ms | integer (nullable) | 실행 시간 (ms) |
| success_pattern | text (nullable) | 성공 판정 정규식 |
| success_pattern_matched | boolean (nullable) | 패턴 매칭 결과 |
| failure_class | text (nullable) | 실패 분류 (8종) |

인덱스: gate_doc_id, bundle_id, executed_at, git_sha

## 핵심 타입

```typescript
type GateRunOutcome = "pass" | "fail";
type GateVerificationStatus = "verified" | "failed" | "stale" | "unverified";
type GateFailureClass =
  | "command-not-found" | "infra-transient" | "static-check-failure"
  | "test-failure" | "build-failure" | "audit-failure"
  | "ai-eval-failure" | "success-pattern-mismatch";
```

## API

| 메서드 | 입력 | 출력 | 설명 |
|--------|------|------|------|
| `recordRun()` | gateDocId + outcome + command + ... | void | 실행 결과 기록 |
| `statusForGate()` | GateDescriptor | GateStatus | 단건 게이트 상태 |
| `statusForGates()` | GateDescriptor[] | Map<string, GateStatus> | 다건 게이트 상태 |
| `resolveBundleVerification()` | GateDescriptor[] | BundleVerification | 번들 검증 판정 |

## 검증 판정 로직

```
GateDescriptor { gateDocId, docVersion }
  → 최신 실행 조회 (gate_doc_id 기준)
  → 버전 비교:
    - 실행 없음 → "unverified"
    - 실행 있지만 docVersion 불일치 → "stale"
    - 실행 있고 docVersion 일치 + outcome="pass" → "verified"
    - 실행 있고 docVersion 일치 + outcome="fail" → "failed"

BundleVerification:
  - 모든 gate "verified" → verified=true
  - 하나라도 아닌 gate → verified=false, blockingGateStatuses에 나열
```

## 강제(enforcement) 모델

현재: **관측 전용** — 원장은 결과를 기록하지만, 하네스 전이를 차단하지 않는다.
- `doc-lifecycle: approved` 전이 시 gate 통과 여부를 검사하지 않음
- cross-loop bridge에서 bundleState=complete일 때 convention → compliant 자동 전이만 수행

향후: gate guard 추가 시 `doc-lifecycle:approved` 전이에 `bundleVerification.verified === true` 선행 조건 부과 가능.
