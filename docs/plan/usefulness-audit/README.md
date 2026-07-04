---
def:
  id: qa-sdk-usefulness-audit-plan
  type: knowledge
  knowledge_kind: guide
  lifecycle: draft
  owner_system: qa-sdk
  scope: meta
  aspect: quality_flow
  tier: layout
  depth: overview
  tags: [audit, usefulness, pruning]
  links:
    - target: design-usefulness-audit
      type: depends_on
---

# qa-sdk Usefulness Audit Plan

## 목적 ^purpose

qa-sdk의 설계를 계속 확장하기보다, 실제로 작업을 줄이고 실패를 막는 표면만 남기기 위한 감사 계획이다. 이 계획은 `keep/prove/quarantine/remove` 판정을 쓰되, 첫 라운드에서는 기존 문서와 패키지를 지우지 않고 `prove` 후보를 보수적으로 모으는 데 집중한다.

## 시작 명령

```bash
pnpm docs:usefulness-audit
pnpm docs:usefulness-audit -- --format json
pnpm docs:usefulness-audit -- --format json --all
```

기본 리포트는 우선순위가 높은 후보만 보여준다. 전체 인벤토리가 필요할 때만 `--all`을 붙인다. `prove`나 `quarantine` 후보를 바로 삭제하지 말고, 해당 package/docs의 실제 소비자와 검증 명령을 먼저 확인한다. approved 문서는 증거가 약해도 첫 판정을 `prove`로 유지한다.

## 1차 감사 기준

| 판정 | 기준 |
|---|---|
| `keep` | CLI/API/test/fixture/smoke/consumer 중 하나가 현재 존재한다 |
| `prove` | 설계 의도는 있으나 실행 증거가 부족하다 |
| `quarantine` | 참조자 확인 뒤 live workflow에서 빼도 됨이 확인됐다 |
| `remove` | 대체 완료, 중복, stale, 또는 참조자 없는 generated/obsolete surface임이 증명됐다 |

## 우선 살릴 후보

| 표면 | 이유 | 확인 명령 |
|---|---|---|
| `packages/data-structure-profile` | fixture-first contract, CLI, profile isolation validator, bridge smoke가 있음 | `pnpm --filter data-structure-profile test` |
| `packages/request-contract` | request/observation normalize/validate/evaluate가 package-local test로 닫힘 | package-local test/build |
| `definition-catalog` + CLI def validation | 문서 감사와 링크 정합성의 현재 실행 기반 | `node packages/cli/dist/index.js def validate` |
| `spec-core` semantic indexing pack | report/compatibility kernel과 CLI smoke가 있음 | `node packages/cli/dist/index.js spec semantic-pack report --no-git --format json` |

## 먼저 증명할 후보군

- `docs/specs/**` 중 approved인데 `sources:`와 검증 명령이 모두 없는 문서.
- `docs/proposals/**` 중 오래 열린 proposal이면서 package, fixture, CLI, smoke로 이어지지 않은 문서.
- ontology/taxonomy 성격의 문서 중 consumer package나 validator가 없는 문서.
- package가 있으나 README, test script, 실제 test file이 없는 workspace package.

## 운영 원칙

- 한 번에 하나의 topic만 `prove`한다.
- `prove`는 문서 보강이 아니라 작은 실행 증거 추가를 뜻한다.
- `quarantine`은 삭제가 아니라 live route에서 빼고 참조를 명확히 하는 작업이며, 별도 변경으로 다룬다.
- `remove`는 def validation, arch feedback, package tests가 통과한 뒤에만 한다.
