---
def:
  id: skill-spec-lifecycle-rule
  type: spec
  tier: component
  level: leaf
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [documentation, tooling, lifecycle]
  links:
    - target: skill-spec-lifecycle
      type: refines
    - target: docs-control-plane
      type: depends_on
    - target: definition-code-link-coverage
      type: depends_on
    - target: definition-mgmt-verification-loop
      type: depends_on
sources:
  - skills/spec-lifecycle/SKILL.md
  - packages/cli/src/commands/docs.ts
  - packages/cli/src/commands/def.ts:cliDef
---

# Spec Lifecycle — 도구 소비 규칙

## 목적 ^purpose

구현 후 문서의 코드 SSOT 전환을 검토할 때, artifact 현황·책임 closure·source-map·definition
정합성을 같은 명령으로 중복 판단하지 않도록 각 도구의 책임과 실행 순서를 고정한다.

## 도구 선택 ^defines

| 질문 | 사용 도구 | 판정 | 하지 않는 일 |
|---|---|---|---|
| 같은 문서 family에 어떤 역할 파일이 있는가? | `docs status <doc-id> --family-only --json` | lifecycle, role coverage, follow-up inventory | missing role만으로 artifact 생성 |
| 전환 범위에 무엇을 읽어야 하는가? | `docs collect <doc-id> --family-only --json` | related artifact와 관계 수집 | 완료 또는 promotion 판정 |
| 책임·source·test/evidence 중 무엇이 비었는가? | `docs closure <doc-id|source> --json` | 편집 전 missing 발견과 편집 후 final closure | 문서 수정 또는 todo 승격 |
| BDD 계약이 유효하고 test/implementation unit이 붙었는가? | `docs bdd validate/units <doc-id> --family-only --json` | BDD block이 있는 family의 contract | BDD가 없는 문서에 계약 강제 |
| 특정 source가 어느 문서에 명시적으로 연결됐는가? | `def sync` 후 `def find-by-file <path[:symbol]>` | DB에 동기화된 explicit `sources`/boundary mapping | heuristic ownership 추정 |
| 범위 안 source 중 연결되지 않은 것은 무엇인가? | `def code-link-gaps --scope=<scope> --json` | unlinked file 목록과 coverage | 문서 lifecycle 판정 |
| Markdown/DB/graph가 정합한가? | `def scan-audit → def sync → def validate → def audit` | raw source, local DB, graph gate | source Markdown 자동 수정 |

## 실행 규칙 ^constraint

1. 새 behavior가 있으면 먼저 `bdd-contract`로 계약을 고정한다. BDD block이 없으면
   `docs bdd` 출력의 부재는 실패가 아니라 비적용이다.
2. 구현 후에는 `docs status`와 `docs collect`로 artifact 범위를 확인한다. status의
   missing role은 현재 책임이 요구할 때만 follow-up이며, 가족을 7종 파일로 채우는 목표가 아니다.
3. 편집 전 `docs closure`로 missing 항목을 찾고, 타입·시그니처·API가 구현돼 있으면
   문서 사본 대신 source reference를 남긴다.
4. definition Markdown을 편집했으면 `scan-audit` 후 `sync`로 DB를 갱신한다. 그 뒤에만
   `def find-by-file`을 신뢰하고, 좁은 `def code-link-gaps --scope`로 explicit mapping을 확인한다.
5. `def validate → def audit` 후 `docs closure`를 다시 실행한다. final closure의 missing과
   diagnostics가 해소돼야 source-map 전환 완료를 주장할 수 있다.
6. `.todo.md`의 완료 record를 이동·변환할 때는 `docs cleanup review` 후
   `docs cleanup plan --dry-run`을 먼저 실행한다. `apply`는 계획을 검토한 뒤에만 선택한다.

## 금지와 실패 해석 ^constraint

- `docs closure`가 mapped를 반환해도 test/evidence missing이 있으면 구현 완료 증거가 아니다.
- `def find-by-file`가 결과를 반환하지 않으면 상위 문서나 tier로 owner를 추론하지 않는다.
  `sources` 또는 `@def.boundary`를 명시한다.
- `def validate` green만으로 source→document round-trip이 닫혔다고 주장하지 않는다.
  sync 뒤의 `find-by-file` 또는 `code-link-gaps`와 final `docs closure` 결과를 함께 본다.
- 이 규칙은 `qa-sdk spec-lifecycle`이라는 새 alias를 만들지 않는다. 상태·closure·mapping·gate는
  각각의 기존 `docs`/`def` 명령이 계속 소유한다.
