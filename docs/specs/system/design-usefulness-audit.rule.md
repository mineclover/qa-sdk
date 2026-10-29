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
    - target: package-surface-separation-rule
      type: depends_on
sources:
  - scripts/design-usefulness-audit.mjs
  - scripts/package-surfaces.mjs
  - scripts/analyze-package-usage.ts
  - scripts/verify-analysis-os.ts
  - docs/specs/system/package-surface-separation.rule.md
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
- package 감사는 모든 workspace root를 보지만, 기능 surface 승격/격리 판정은 `packages/*` surface-managed 범위에만 적용한다. `simulations/*`와 `vendor/*`는 `workspace-support`로 표시하고, package 이름 끝부분이 `packages/*` surface package와 같아도 package surface manifest의 `keep`/`no-promotion` 큐와 섞지 않는다.
- `packages/*` 후보는 `surfaceGroup`을 함께 노출한다. coordinate kernel, observability runtime, definition catalog, decision evidence, spec analysis, taxonomy capability, profile capability, authorization support, simulation contract, verification suite, demo consumer, quarantine을 같은 제품 기능처럼 해석하지 않는다.
- workspace glob 아래 hidden directory는 pnpm workspace filter에 잡히지 않는 경우가 있으므로 package 후보에서 제외한다.
- test-only package는 `tests/`, `scenarios/`, `*.spec.*`, `*.test.*` 파일을 실행 증거 표면으로 인정한다.

## 관리 구조 ^overview

usefulness 정리는 문서가 구현을 소유하게 만드는 작업이 아니다. 구현과 테스트가 먼저 source authority이고, 문서는 그 authority를 찾을 수 있게 좌표화한다. 유지 가능한 정리 구조는 다음 5개 역할로 나눈다.

| 역할 | 소유 표면 | 책임 | 금지 사항 |
|---|---|---|---|
| Source owner | `packages/*`, `simulations/*`, `scripts/*`, `skills/*` | runtime, CLI, test, fixture, smoke, generated contract의 실제 동작 | 문서 판정을 맞추기 위해 동작을 넓히거나 임시 API를 만들지 않는다 |
| Surface manifest | `scripts/package-surfaces.mjs` | `packages/*`의 기능군, 승격, `no-promotion` 큐 | docs 표를 먼저 바꾸고 manifest를 따라오게 하지 않는다 |
| Definition docs | `docs/specs/**`, `docs/*.md` 중 `def:` frontmatter가 있는 문서 | 현재 승인된 개념/계약/시스템의 목적, 책임, source refs | 구현 세부 타입/API 사본을 SSOT처럼 보관하지 않는다 |
| Legacy design records | `docs/superpowers/**`, 일부 plan/proposal 기록 | 완료된 설계/계획의 배경과 추적 가능한 결과 | 현재 spec이나 제품 roadmap으로 재승격하지 않는다 |
| Audit tooling | `scripts/design-usefulness-audit.mjs`, `scripts/verify-analysis-os.ts` | 후보 생성과 회귀 방지 | 자동 삭제, 자동 lifecycle 변경, 자동 archive 결정을 하지 않는다 |

source-backed 정리는 위 역할을 섞지 않는 것이 핵심이다. `sources:`는 "이 문서가 구현을 소유한다"가 아니라 "현재 구현/검증 authority는 여기서 확인한다"는 역참조다.

## Source-backed 작성 규칙 ^constraint

- definition 문서에는 기존 `def:` frontmatter를 유지하고, 같은 frontmatter의 top-level `sources:` 배열에 repo-relative source refs를 추가한다.
- legacy 설계/계획 문서에는 `def:`를 새로 만들지 않는다. 대신 top-level `status: source-backed`와 `sources:`만 추가해 완료 기록임을 표시한다.
- source ref는 `packages/`, `docs/`, `scripts/`, `skills/`, `simulations/` 아래의 실제 파일이어야 한다. 절대경로, `./`, `../`는 쓰지 않는다.
- source ref는 가능하면 implementation file + test/smoke file + 소비 문서/README 중 2종 이상을 함께 가리킨다.
- source ref가 없으면 문서를 `keep`으로 만들기 위해 lifecycle을 낮추거나 archive로 숨기지 않는다. 그대로 `prove`로 남긴다.
- `prove`를 닫는 방식은 작은 실행 증거 추가, 기존 실행 증거 발견 후 source ref 연결, 또는 별도 quarantine/remove 변경 중 하나다.
- `quarantine`/`remove`는 source-backed 정리 커밋과 섞지 않는다. 별도 topic에서 참조자 확인, 대체 경로, 검증 명령을 같이 남긴다.

## 감사 절차 ^validation

1. `corepack pnpm docs:usefulness-audit -- --limit 40`으로 후보를 생성한다.
2. `prove` 후보는 한 번에 한 topic만 골라 작은 실행 증거를 추가한다.
3. 실행 증거를 만들 수 없으면 참조자를 먼저 찾고, 별도 변경에서 `quarantine`으로 낮춘다.
4. `quarantine` 후보는 바로 삭제하지 않는다. 먼저 링크, package dependency, CLI entry, tests를 확인한다.
5. 삭제/아카이브 PR은 `node packages/cli/dist/index.js def validate`, `corepack pnpm arch:feedback`, `git diff --check`를 통과해야 한다.

`status: superseded` proposal 중 `role: moved-note`이고 `superseded_by` 대상 파일이 실제로 존재하는 문서는 redirect scaffold로 보존한다. 대상이 없거나 moved-note가 아니면 계속 `prove`로 남겨 이동 경로를 재확인한다.

이 규칙의 package 판정은 `package-surface-separation-rule`의 surface manifest 경계를 소비한다. 따라서 `packages/*`는 기능 surface 승격/격리 후보로 계산하지만, `simulations/*`와 `vendor/*` workspace는 `workspace-support`로만 보고 제품 surface 표에 섞지 않는다.

## 보존 우선순위 ^constraint

- `data-structure-profile`처럼 fixture-first contract와 consumer bridge smoke가 있는 표면은 우선 보존한다.
- package-local test만 있는 표면은 그것만으로 삭제 대상이 아니다. `package-surface-separation-rule`에서 `no-promotion`으로 분리된 동안 제품 core나 roadmap의 keep 표면으로 승격하지 않고 quarantine decision queue에 둔다.
- quarantine queue의 표면은 소비처와 승격 근거가 끝내 생기지 않으면 사람이 삭제를 결정한다. 사례: `request-contract`, `weighted-gpu`는 2026-10-29 삭제했다 (`docs/proposals/swc-next-qa-sdk-optimization/` 핵심 기능 정리).
- `definition-catalog`와 `packages/cli`의 def validation surface는 감사 자체를 가능하게 하므로, 대체 도구 없이 제거하지 않는다.
- 순수 ontology/taxonomy 문서는 runtime/tooling 소비자가 없으면 `prove` 후보로 되돌린다.

## 관련 명령

- `corepack pnpm docs:usefulness-audit`
- `corepack pnpm docs:usefulness-audit -- --format json`
- `corepack pnpm docs:usefulness-audit -- --format json --all`
- `node packages/cli/dist/index.js def validate`
- `node packages/cli/dist/index.js def scan-audit`
- `corepack pnpm arch:feedback`
