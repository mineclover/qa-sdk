---
def:
  id: definition-harness-cli
  level: leaf
  scope: interface
  aspect: cli_contract
  depth: specification
  lifecycle: draft
  layer: mediation
  svc: definition-service
  tags: [tier-system]
  links:
    - target: definition-harness
      type: refines
    - target: definition-state-model
      type: depends_on
---
# Harness CLI — 상태 조회/전이/프로세스 실행

## 목적 ^purpose

CLI에서 11개 머신의 상태 분포를 조회하고, 단일 전이를 실행하고, 프로세스(복수 머신 전이 시퀀스)를 실행한다. `def state` 서브커맨드로 통합.

## CLI 인터페이스 ^api-surface

```bash
# ── 조회 ──────────────────────────────────────────────

# 전체 상태 분포 (11개 머신)
qa-sdk def state

# 특정 머신의 분포
qa-sdk def state doc-lifecycle
qa-sdk def state version-lifecycle
qa-sdk def state address-state

# 특정 엔티티의 모든 상태 조회
qa-sdk def state <entityId>

# 가능한 전이 조회
qa-sdk def state <entityId> --transitions

# ── 전이 실행 ─────────────────────────────────────────

# 단일 전이 (guard 자동 검증, cascade 자동 실행)
qa-sdk def state <entityId> --machine doc-lifecycle --to review

# 프로세스 실행
qa-sdk def state <entityId> --process prefix-release
qa-sdk def state <entityId> --process doc-approval
qa-sdk def state <entityId> --process service-deprecation

# ── 진단 ──────────────────────────────────────────────

# 의존 관계 시각화
qa-sdk def state --deps

# 프로세스 사전 검증 (dry-run)
qa-sdk def state <entityId> --process prefix-release --dry-run
```

## 출력 형식 ^outputs

### 전체 분포

```
── 문서 계층 ──────────────────────────
doc-lifecycle        draft(13) review(0) approved(480) deprecated(63) archived(0)
spec-impl            designed(5) implementing(2) implemented(3) verified(1) source-referenced(489)
convention           unverified(490) partial(3) compliant(2) violated(0)
db-sync              synced(1)

── 시스템 계층 ────────────────────────
address-state        active(28) inactive(3) open(2) reserved(1)
version-lifecycle    draft(0) released(0) active(34) deprecated(3)
service-status       active(14) deprecated(0) retired(0)
event-status         active(47) deprecated(2) retired(0)
metric-health        ok(8) warning(1) critical(0)

── 프로세스 계층 ──────────────────────
decision-flow        pending(0) active(1) completed(12) abandoned(2) blocked(0)
policy-candidate     candidate(3) approved(5) rejected(1) modified(1)
```

### 엔티티 상태

```
service:v2
  version-lifecycle: active
  address-state:    active
  db-sync:          synced
  transitions:
    version-lifecycle → deprecated (폐기)
    address-state     → inactive (비활성화)
```

### 프로세스 dry-run

```
prefix-release on service:v2
  ✓ step 0: version-lifecycle → released (현재: draft)
  ✓ step 1: version-lifecycle → active   (precondition: released ✓)
  ✓ step 2: address-state → active       (guard: version active ✓)
  ✓ step 3: db-sync → syncing
  ✓ step 4: db-sync → synced
  result: 전부 실행 가능
```

### 의존 관계 출력

```
cascade:
  version:deprecated → address:inactive
  service:deprecated → event:deprecated
  spec:verified      → convention:compliant

guard:
  version:active     → address:active
  doc:approved       → convention:compliant

notify:
  metric:critical    → flow:blocked
  flow:completed     → doc:review
```

## 품질 게이트 CLI (quality 커맨드) ^quality

문서 상태 관리(`def state`)와 별개로, 게이트 문서 실행 경로가 존재한다.

```bash
# gate 문서 목록 (필터: --domain, --kind, --story, --pkg, --q)
qa-sdk quality list [--domain=backend-logic] [--kind=typecheck]

# gate 문서 상세 (kind, domain, contract 참조, references, next 추천)
qa-sdk quality show <gate-doc-id>

# gate 명령 실행 + pass/fail 기반 다음 추천
qa-sdk quality run <gate-doc-id> [--dry-run]

# 번들 구조 조회 (contract + gates)
qa-sdk quality bundle <bundle-doc-id>

# pass/fail 기반 다음 gate 추천
qa-sdk quality next <gate-doc-id> [--outcome=pass|fail]
```

gate 문서는 definition-catalog의 `gate:` frontmatter로 정의된다. `quality run`은 명령을 실행하고, 결과에 따라 `suggestOnPass`/`suggestOnFail`로 다음 gate를 추천한다.

코드 SSOT: `cli/src/commands/quality.ts`

## SDK 이벤트 emit ^constraint

모든 전이 실행 시 `harness.transition` 이벤트가 자동 emit된다. 프로세스의 각 스텝은 `harness.process_step`으로, guard 검증은 `harness.guard_check`로 emit.
