---
def:
  id: definition-code-link-coverage-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  svc: cli
  links:
    - target: definition-code-link-coverage
      type: refines
sources:
  - packages/cli/src/commands/def/platform.ts:hasExternalPlatform
  - packages/cli/src/commands/def/platform.ts:isPlatformExecutableAvailable
  - packages/cli/src/commands/def.lifecycle.test.ts
---
# Definition Code Link Coverage — Compatibility Cases

## 목적 ^purpose

외부 spec-management platform을 점진적으로 도입할 때 `--platform=auto`가 설치 상태를 기준으로 외부 검증 경로를 선택하고, 외부 실행 파일이 없으면 기존 qa-sdk collector를 보존하는지 검증한다.

## BDD 계약 ^overview

```yaml bdd
bdd_contracts:
  - id: definition-code-link-coverage.platform.auto.installed.v1
    owner_system: definition-service
    contract_kind: dependency-contract
    mode: read
    links:
      spec: definition-code-link-coverage
    given:
      predicates:
        - platform-mode-is-auto
        - qa-spec-platform-is-on-path
      fixtures:
        - executable-platform-adapter
    when:
      actor: operator
      operation: def.code-link-gaps
    then:
      returns:
        collector: external-platform
      invariants:
        - installed-adapter-is-selected
        - explicit-platform-bin-remains-higher-precedence

  - id: definition-code-link-coverage.platform.auto.fallback.v1
    owner_system: definition-service
    contract_kind: dependency-contract
    mode: read
    links:
      spec: definition-code-link-coverage
    given:
      predicates:
        - platform-mode-is-auto
        - qa-spec-platform-is-not-available
      fixtures:
        - legacy-code-link-collector
    when:
      actor: operator
      operation: def.code-link-gaps
    then:
      returns:
        collector: legacy-qa-sdk
      invariants:
        - no-external-process-is-required
        - legacy-output-contract-is-preserved

test_units:
  - id: TU-definition-code-link-coverage-platform-auto-installed
    contract: definition-code-link-coverage.platform.auto.installed.v1
    level: unit
    given_fixture: executable-platform-adapter
    when: hasExternalPlatform({ platform: 'auto' }, path)
    assertions: [installed-adapter-is-selected, explicit-platform-bin-precedence]
    test_file: packages/cli/src/commands/def.lifecycle.test.ts
  - id: TU-definition-code-link-coverage-platform-auto-fallback
    contract: definition-code-link-coverage.platform.auto.fallback.v1
    level: unit
    given_fixture: legacy-code-link-collector
    when: hasExternalPlatform({ platform: 'auto' }, unavailablePath)
    assertions: [external-route-not-selected, legacy-routing-preserved]
    test_file: packages/cli/src/commands/def.lifecycle.test.ts

implementation_units:
  - id: IU-definition-code-link-coverage-platform-availability
    contract: definition-code-link-coverage.platform.auto.installed.v1
    unit_kind: guard
    owned_by: definition-service
    source_target: packages/cli/src/commands/def/platform.ts:isPlatformExecutableAvailable
    inputs: [executable-name, path-value]
    effects: [deterministic-executable-availability]
    must_not_own: [platform-parser, document-collection, evidence-storage]
  - id: IU-definition-code-link-coverage-platform-selection
    contract: definition-code-link-coverage.platform.auto.fallback.v1
    unit_kind: guard
    owned_by: definition-service
    source_target: packages/cli/src/commands/def/platform.ts:hasExternalPlatform
    inputs: [cli-flags, explicit-executable, path-value]
    effects: [external-or-legacy-route-selection]
    must_not_own: [parser-implementation, legacy-collector-behavior]
```

## 운영 경계 ^constraint

- `--platform=auto`는 설치된 `qa-spec-platform`을 발견한 경우에만 외부 경로를 선택한다.
- `--platform=true`, `--platform-bin`, `QA_SPEC_PLATFORM_BIN`은 명시적 요청이므로 실행 실패를 숨기지 않는다.
- 레지스트리 배포와 기본값 전환 전까지 `auto`는 호환 모드이며, 기본 명령 경로는 legacy collector로 유지한다.
