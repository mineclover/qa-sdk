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
sources:
  - packages/cli/src/commands/def.ts
  - packages/cli/src/commands/def/verification.ts
  - packages/cli/src/lib/spec-definition-verification.ts
  - packages/cli/src/commands/def.state-verification.test.ts
  - packages/definition-catalog/src/harness-derive.ts
  - packages/definition-catalog/src/def-config.ts
---
# Harness CLI — 상태 분포/검증 read model

## 목적 ^purpose

CLI에서 문서 하네스의 파생 상태와 동기화 상태를 조회하고, 검증 artifact를 문서 상태 read model에 조합한다.
현재 `def state`는 상태를 직접 전이시키는 명령이 아니라, 문서·검증·drift 결과를 읽기 위한 projection surface다.

## 구성 ^overview

`qa-sdk def state`는 다음 조회 모드를 제공한다.

1. 전체 문서 상태 분포 — `doc-lifecycle`, `spec-impl`, `convention-compliance`, `db-sync`
2. 특정 머신 분포 — registry에 등록된 machine id를 positional argument로 전달
3. 특정 문서 상태 — 문서 id를 positional argument로 전달하고 `--json`으로 read model을 받음
4. 하네스 의존 관계 — `--deps`로 cascade/guard/notify 관계를 출력
5. 검증 연계 — `--verification-artifact`, `--verification-drift`로 binding/report/drift를 조합

상태 파생은 `harness-derive`와 현재 frontmatter/config snapshot을 사용하며, 검증 artifact가 없으면
convention 상태는 `unverified`로 유지된다.

## 사용 맥락 ^context

문서 lifecycle과 구현 상태를 한 번에 점검하거나, 검증 runner가 생성한 artifact가 현재 definition
snapshot과 연결되는지 확인할 때 사용한다. DataSource는 CLI의 `--local`, `--server`, `--scan`
선택을 따르며, state 명령 자체는 상태 전이나 프로세스 실행을 소유하지 않는다.

## 정의 ^defines

- `qa-sdk def state` 전체 문서 상태 분포 read model
- machine/document 단위 상태 조회와 JSON projection
- `--deps` 의존 관계 시각화
- verification report/binding/drift sidecar 조합
- 외부 서비스가 아직 연결되지 않은 machine 영역의 명시적 fallback 출력

## 소비 ^consumes

- state-model — machine registry와 dependency 정의
- harness-derive — deriveDocLifecycle, deriveSpecImplState, deriveConventionState, deriveSyncState
- def-config — readDefConfig(), detectDrift()
- spec-definition-verification — verification artifact와 drift read model

## CLI 인터페이스 ^api-surface

```bash
# 전체 문서 상태 분포
qa-sdk def state

# 특정 머신의 분포
qa-sdk def state doc-lifecycle

# 특정 문서 상태
qa-sdk def state definition-management
qa-sdk def state definition-management --json

# 의존 관계 시각화
qa-sdk def state --deps

# 검증 artifact를 문서 상태에 조합
qa-sdk def state definition-management \
  --verification-artifact=artifacts/verification-artifact.json --json

# artifact와 구현 drift read model을 함께 요청
qa-sdk def state definition-management \
  --verification-artifact=artifacts/verification-artifact.json \
  --verification-drift --json

# definition snapshot에서 run-start binding 생성
qa-sdk def verification-bindings \
  --spec-ids=definition-management \
  --out=artifacts/verification-bindings.json \
  --captured-at=2026-01-01T00:00:00.000Z --json

# scan datasource로 binding을 직접 캡처
qa-sdk def verification-bindings --scan \
  --spec-ids=definition-management \
  --out=artifacts/verification-bindings.json \
  --captured-at=2026-01-01T00:00:00.000Z --json

# VerificationSummary + binding을 immutable artifact로 조합
qa-sdk def verification-artifact \
  --summary=artifacts/verification-summary.json \
  --bindings=artifacts/verification-bindings.json \
  --out=artifacts/verification-artifact.json \
  --run-started-at=2026-01-01T00:00:00.000Z \
  --run-completed-at=2026-01-01T00:02:00.000Z --json
```

## 출력 형식 ^outputs

### 전체 분포

```
── 문서 계층 (N건) ──────────────────────
doc-lifecycle        draft(...) review(...) approved(...) deprecated(...)
spec-impl             designed(...) implementing(...) implemented(...) verified(...)
convention            unverified(...) partial(...) compliant(...) violated(...)
db-sync              synced(...)

── 시스템 계층 ────────────────────────
address-state        (외부 서비스 연결 필요)
version-lifecycle    (외부 서비스 연결 필요)
service-status       (외부 서비스 연결 필요)
event-status         (외부 서비스 연결 필요)
metric-health        (외부 서비스 연결 필요)

── 프로세스 계층 ──────────────────────
decision-flow        (외부 서비스 연결 필요)
policy-candidate     (외부 서비스 연결 필요)
```

### 특정 문서 JSON

```json
{
  "id": "definition-management",
  "doc-lifecycle": "approved",
  "spec-impl": "source-referenced",
  "convention-compliance": "unverified",
  "db-sync": "synced",
  "verification": {
    "reportStatus": "no-report",
    "bindingStatus": "not-evaluated",
    "convention": "unverified"
  }
}
```

### 의존 관계 출력

```
cascade:
  <source-machine>:<source-state> → <target-machine>:<target-state>  (<label>)
guard:
  <source-machine>:<source-state> → <target-machine>:<target-state>  (<label>)
notify:
  <source-machine>:<source-state> → <target-machine>:<target-state>  (<label>)
```

## 품질 게이트 CLI
상세: `definition-quality-gates` 문서 참조. `qa-sdk quality list/show/run/bundle/next` 커맨드.
## 검증 artifact 연계 ^constraint

`--verification-artifact`를 지정하면 definition snapshot과 artifact의 report/binding을 함께 읽는다.
`--verification-drift`를 추가하면 service source의 선언과 구현을 비교한 drift read model을 보조 정보로 붙인다.
artifact가 없거나 현재 snapshot과 연결되지 않으면 상태를 `unverified`로 유지하며, state 조회 자체는 실패시키지 않는다.

## 검증 producer와 JSON 채널 계약 ^verification-contract

`verification-bindings`는 실행 시작 시점의 definition snapshot을 binding으로 고정하고,
`verification-artifact`는 외부 VerificationSummary와 binding을 하나의 immutable artifact로 묶는다.
`state`는 이 artifact를 소비해 report/binding/drift read model을 제공한다. producer와 consumer 사이의
구체적인 파일 shape은 `packages/cli/src/lib/spec-definition-verification.ts`가 SSOT이며, 이 문서는
CLI 호출 순서와 책임 경계만 정의한다.

`--json`을 지정한 성공 응답은 stdout에 JSON 문서 하나만 출력한다. 입력·파일·datasource 오류는
exit code `1`과 함께 stderr로 진단하며 stdout을 오염시키지 않는다. 따라서 shell pipe나 JSON parser가
성공/실패를 분리해서 처리할 수 있다.
