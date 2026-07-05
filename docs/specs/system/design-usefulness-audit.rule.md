---
def:
  id: design-usefulness-audit
  type: spec
  tier: system
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [structural, audit, usefulness, pruning]
  links:
    - target: system-specs-rules-index
      type: traces_to
    - target: layer-separation
      type: refines
    - target: work-lifecycle
      type: depends_on
---

# Design Usefulness Audit — 운영 규칙

## 목적 ^purpose

qa-sdk 설계 문서와 패키지가 실제 작업을 줄이거나 실패를 막는지 판정하는 기준을 정의한다. 이 규칙의 목표는 큰 좌표계 자체를 보존하는 것이 아니라, 실행 가능한 contract tooling만 남기고 증거 없는 설계를 우선 `prove` 대상으로 돌리는 것이다. `quarantine`과 `remove`는 자동 판정이 아니라, 별도 참조자 확인 뒤에만 수행하는 보수적 후속 조치다.

## 판정 등급 ^defines

| 등급 | 의미 | 다음 행동 |
|---|---|---|
| `keep` | 실행 명령, 테스트, fixture, consumer smoke 중 하나 이상으로 실제 실패를 막는 표면 | 소유 spec과 검증 명령을 유지한다 |
| `prove` | 아이디어는 있어 보이나 현재 실행 증거가 약함 | 작은 fixture, CLI, package test, consumer smoke 중 하나로 증명한다 |
| `quarantine` | 참조자와 실행 경로를 확인한 뒤 현재 workflow에서 손실 없이 격리 가능함 | archive 또는 proposal/todo로 낮추는 별도 PR을 준비한다 |
| `remove` | 대체 완료, 중복, stale, 또는 runtime/package surface와 연결이 끊겼음이 증명됨 | 삭제 또는 archive 후 참조를 정리한다 |

## 유용성 기준 ^constraint

설계가 `keep`이 되려면 아래 중 최소 하나를 만족해야 한다.

- CLI, script, package API, smoke command처럼 사람이 실행할 수 있는 표면이 있다.
- fixture 또는 test가 있고, 실패하면 실제 회귀를 잡는다.
- 다른 package, service, UI, bridge script가 artifact를 소비한다.
- 문서가 code source refs와 검증 명령을 통해 drift를 점검할 수 있다.
- 없애면 반복 작업, 통합 검증, 또는 운영 판단이 더 느려진다는 구체적 증거가 있다.

반대로 아래 신호가 있으면 기본적으로 `prove` 후보로 본다.

- approved 문서인데 source refs, test refs, 검증 명령이 없다.
- vocabulary/axis/relation은 있으나 validator나 consumer가 없다.
- proposal이 오래 열려 있지만 package/API/fixture로 이어지지 않는다.
- 같은 책임을 여러 문서가 반복하고 source authority가 불분명하다.
- "에이전트가 이해하기 쉬움" 외에 사용자 또는 repo 운영 가치가 없다.

## 보수 정리 원칙 ^constraint

- `docs:usefulness-audit` 결과만으로 기존 문서나 패키지를 삭제하지 않는다.
- approved spec의 증거가 약해도 첫 판정은 `prove`다. 문서가 크거나 오래됐다는 이유만으로 `quarantine`하지 않는다.
- `quarantine`은 링크, package dependency, CLI entry, test/smoke, Git history 중 최소 2개 표면에서 live consumer가 없음을 확인한 뒤에만 수동 전환한다.
- `remove`는 감사 스크립트가 자동 산출하지 않는다. 대체 표면과 검증 명령을 함께 남긴 별도 변경으로만 수행한다.
- 첫 라운드는 기존 동작을 바꾸지 않는 감사 장치와 후보 목록 생성까지만 포함한다.
- package 후보는 `pnpm-workspace.yaml`에 등록된 workspace root만 대상으로 삼는다. nested `package.json`은 빌드 산출물이나 배포 manifest일 수 있으므로 자동 정리 후보로 보지 않는다.
- workspace glob 아래 hidden directory는 pnpm workspace filter에 잡히지 않는 경우가 있으므로 package 후보에서 제외한다.
- test-only package는 `tests/`, `scenarios/`, `*.spec.*`, `*.test.*` 파일을 실행 증거 표면으로 인정한다.

## 감사 절차 ^validation

1. `pnpm docs:usefulness-audit -- --limit 40`으로 후보를 생성한다.
2. `prove` 후보는 한 번에 한 topic만 골라 작은 실행 증거를 추가한다.
3. 실행 증거를 만들 수 없으면 참조자를 먼저 찾고, 별도 변경에서 `quarantine`으로 낮춘다.
4. `quarantine` 후보는 바로 삭제하지 않는다. 먼저 링크, package dependency, CLI entry, tests를 확인한다.
5. 삭제/아카이브 PR은 `node packages/cli/dist/index.js def validate`, `pnpm arch:feedback`, `git diff --check`를 통과해야 한다.

## 보존 우선순위 ^constraint

- `data-structure-profile`처럼 fixture-first contract와 consumer bridge smoke가 있는 표면은 우선 보존한다.
- `request-contract`처럼 package-local test가 있는 표면은 삭제 대상으로 보지 않는다. 다만 `package-surface-separation-rule`에서 `no-promotion`으로 분리된 동안 제품 core나 roadmap의 keep 표면으로 승격하지 않고 quarantine decision queue에 둔다.
- `weighted-gpu`처럼 구현과 package-local test가 있어도 실제 consumer/performance promotion 근거가 약한 표면은 `no-promotion` queue에서 보존한다.
- `definition-catalog`와 `packages/cli`의 def validation surface는 감사 자체를 가능하게 하므로, 대체 도구 없이 제거하지 않는다.
- 순수 ontology/taxonomy 문서는 runtime/tooling 소비자가 없으면 `prove` 후보로 되돌린다.

## 관련 명령

- `pnpm docs:usefulness-audit`
- `pnpm docs:usefulness-audit -- --format json`
- `pnpm docs:usefulness-audit -- --format json --all`
- `node packages/cli/dist/index.js def validate`
- `node packages/cli/dist/index.js def scan-audit`
- `pnpm arch:feedback`
