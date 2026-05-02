---
def:
  id: definition-harness-cli
  type: design
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: interface
  aspect: cli_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: definition-service
  tags: [entry-point, runtime, testing, cross-scope]
  links:
    - target: definition-harness
      type: refines
    - target: definition-state-model
      type: depends_on
---
# Harness CLI — 상태 조회/전이/프로세스 실행

## 목적 ^purpose

CLI에서 11개 머신의 상태 분포를 조회하고, 단일 전이를 실행하고, 프로세스(복수 머신 전이 시퀀스)를 실행한다. `def state` 서브커맨드로 통합.

## 구성 ^overview

`qa-sdk def state` 서브커맨드가 3가지 모드를 제공한다: (1) 전체 머신 분포 조회 — 11개 머신별 상태 카운트, (2) 단일 엔티티 상태 조회/전이 — `--to` 옵션으로 특정 상태로 전이, (3) 프로세스 실행 — `--process` 옵션으로 prefix-release, doc-approval, service-deprecation 등 복수 머신 전이 시퀀스를 한번에 실행. `--dry-run`으로 실제 전이 없이 시뮬레이션 가능.

## 사용 맥락 ^context

CLI에서 하네스 상태를 직접 관리할 때 사용한다. 자동 파생(`harness-derive`)이 대부분의 상태를 결정하지만, 수동 전이가 필요한 경우(검토 요청, 폐기 선언 등) 이 CLI를 사용한다. definition-service가 실행 중이면 HTTP 모드, 아니면 로컬 SQLite 모드로 동작.

## 정의 ^defines

- `qa-sdk def state` 서브커맨드 (조회/전이/프로세스/진단)
- 3종 출력 형식 (전체 분포, 엔티티 상태, dry-run)
- 의존 관계 시각화 (`--deps`)

## 소비 ^consumes

- state-model — computeDistribution(), 머신 정의
- harness-derive — deriveDocLifecycle, deriveSpecImplState 등 11개 파생 함수
- def-config — readDefConfig(), detectDrift()

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
## 품질 게이트 CLI
상세: `definition-quality-gates` 문서 참조. `qa-sdk quality list/show/run/bundle/next` 커맨드.
## SDK 이벤트 emit ^constraint
모든 전이 실행 시 `harness.transition` 이벤트가 자동 emit된다. 프로세스의 각 스텝은 `harness.process_step`으로, guard 검증은 `harness.guard_check`로 emit.
