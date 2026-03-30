---
def:
  id: cli-scenario-2
  scope: feature
  aspect: scenario
  depth: specification
  lifecycle: draft
  svc: cli
  links:
    - target: cli-contract-spec
      type: refines
    - target: quality-gates-system
      type: depends_on
---
# quality 게이트 실행 흐름

## 목적 ^purpose

개발자가 CLI를 통해 문서의 하네스 상태(11개 상태 머신)를 확인하고, work-domain 품질 게이트(typecheck/build/test)를 실행하여 결과를 확인하는 흐름을 검증한다.

## 행위자 ^actor

- **개발자**: 문서의 품질 상태를 확인하고 게이트를 실행하는 사람
- **CLI**: `qa-sdk def state` 서브커맨드
- **하네스 엔진**: 11개 상태 머신을 통합 관리 (doc-lifecycle, spec-impl, convention, db-sync 등)
- **Gate FSM**: GateState 9종(not_started → type_checking → type_passed → building → build_passed → testing → test_passed → complete / failed)

## 사전 조건 ^preconditions

- 모노레포 루트에 `docs/` 디렉토리와 frontmatter 포함 .md 파일이 존재
- `.qa-sdk/def-config.json`이 존재 (scan 이력이 있어야 drift 감지 가능)
- 대상 문서에 `svc` 필드가 지정되어 있어야 spec-impl 상태가 의미 있음
- 해당 서비스 패키지에 `src/` 디렉토리와 TypeScript 소스가 존재

## 스텝 ^steps

1. 개발자가 `qa-sdk def state` 실행 → 전체 문서의 상태 머신 분포 조회
2. CLI가 docs/ 스캔 + def-config.json 로드 → checksum 비교로 drift 감지
3. 각 문서별 상태 파생: deriveDocLifecycle(lifecycle) → doc-lifecycle 상태
4. svc 필드 기준 코드/테스트 존재 여부 확인 → deriveSpecImplState() → spec-impl 상태
5. deriveConventionState() → convention-compliance 상태 (현재 spec-tracker 미연동 → unverified)
6. deriveSyncState() → db-sync 상태 (config 존재, 문서 수 일치, checksum 일치 여부)
7. CLI가 문서 계층(doc-lifecycle, spec-impl, convention, db-sync) + 시스템 계층 분포 출력
8. 개발자가 `qa-sdk def state <문서ID>` 실행 → 특정 문서의 4개 머신 상태 출력
9. 개발자가 `qa-sdk def state --deps` 실행 → 머신 간 의존 관계 출력 (guard 의존 순서)
10. scope×aspect에서 deriveGateKinds → 적용 가능한 게이트 종류 도출
11. buildHarnessPlan + runHarness로 게이트 실행 → GateState 전이 (not_started → type_checking → ... → complete 또는 failed)
12. BundleState 전이: idle → running → complete/failed

## 검증 ^assertions

- `qa-sdk def state` → 문서 계층 4종(doc-lifecycle, spec-impl, convention, db-sync) 분포가 출력
- 각 머신의 상태값이 정의된 상태 집합 이내 (doc-lifecycle: draft/review/approved/deprecated/archived)
- `qa-sdk def state <문서ID>` → 해당 문서의 doc-lifecycle, spec-impl, convention, db-sync 상태 출력
- `qa-sdk def state <머신ID>` → 해당 머신의 상태별 문서 수 분포 출력
- `qa-sdk def state --deps` → 머신 간 의존 그래프 출력 (convention → doc-lifecycle: approved guard)
- drift 감지: frontmatter 변경 시 checksum 불일치 → db-sync 상태가 `drifted` 또는 `stale`
- svc 없는 문서 → spec-impl이 `not_applicable` 또는 `no_service`
- svc 있고 코드 있고 테스트 있으면 → spec-impl이 `implemented` 이상
- GateState 전이: type_checking 실패 → failed (building 단계로 진행 불가)
- BundleState complete → convention `compliant` 자동 전이 가능 (guard: doc-lifecycle approved 필수)

## 변형 ^variants

### V1: 전체 게이트 실행 (typecheck → build → test 순차)

- deriveGateKinds가 typecheck, build, test 모두 반환
- GateState: not_started → type_checking → type_passed → building → build_passed → testing → test_passed → complete
- 중간 단계 실패 시 → failed 전이, 이후 단계 건너뜀

### V2: svc 미지정 문서 (순수 스펙 문서)

- svc 필드 없음 → spec-impl = `not_applicable`
- 게이트 실행 대상에서 제외 (build/test 불가)
- doc-lifecycle과 convention만 유의미

### V3: drift 감지 후 재동기화

- frontmatter 변경으로 checksum 불일치 → db-sync = `drifted`
- `qa-sdk def scan` + sync 실행 후 → db-sync = `synced`
- 재동기화 후 상태 머신 재파생

### V4: guard 의존 체인 검증

- convention → compliant 전이에 doc-lifecycle: approved guard 필요
- approved 아닌 문서에서 convention compliant 시도 → guard 거부
- 전체 루프: Decision success → Doc approved → Gate complete → Convention compliant

## 재검토 트리거 ^update-trigger

- quality-gates-system: GateState 상태 집합 또는 전이 규칙 변경 시
- harness-machines: 머신 정의 추가/변경 시 (현재 11개)
- harness-guards: guard 의존 관계 변경 시
- work-domain/gate-fsm: GateState/BundleState 전이 로직 변경 시
- harness-derive: derive 함수 입력/출력 변경 시
