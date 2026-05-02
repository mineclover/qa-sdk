---
def:
  tier: component
  id: docs-control-plane-markdown-governance
  type: spec
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: cli
  tags: [structural, contract, testing]
  links:
    - target: docs-control-plane
      type: traces_to
    - target: docs-control-plane-rule
      type: refines
    - target: definition-extraction
      type: depends_on
    - target: definition-metadata-id
      type: depends_on
sources:
  - packages/cli/src/lib/docs-control-plane/markdown-links.ts
  - packages/cli/src/lib/docs-control-plane/markdown-bundle.ts
  - packages/cli/src/commands/docs.ts
  - packages/cli/src/lib/docs-control-plane/markdown-links.test.ts
  - packages/cli/src/lib/docs-control-plane/markdown-bundle.test.ts
---

# Docs Control Plane — Markdown Link & Anchor Governance

## 목적 ^purpose

Markdown link governance는 복잡한 문서 집합을 일관적으로 관리하기 위한 연결 규칙이다. 목표는 상대경로 링크, 헤딩 fragment, 마커 anchor, 임시 병합 preview를 같은 기준으로 스캔하고, 끊긴 연결을 가능한 한 복원하되 모호한 연결을 자동 확정하지 않는 것이다.

## 핵심 규칙 ^overview

- Markdown 링크는 source file 위치에서 해석되는 상대경로이며, project root 후보는 연결 복원과 rebase를 위한 projection이다.
- `def.id`는 문서 identity이고, Markdown path는 표현 경로다. 경로 변경은 link repair 대상이지만 identity 변경으로 간주하지 않는다.
- 헤딩은 구조이고, `^marker`는 사람이 의도한 안정 anchor다.
- 문서 병합 preview는 read-only projection이며, source 문서나 링크 ownership을 새로 만들지 않는다.
- 자동 복원은 deterministic evidence가 있을 때만 허용한다. 동점이나 중복 anchor는 review diagnostic으로 남긴다.

## 링크 해석 규칙 ^link-resolution

- 상대경로 link와 image path는 source file의 디렉터리를 기준으로 먼저 해석한다.
- 외부 URL, mailto, data URL은 repository repair 대상이 아니다.
- fragment가 없는 markdown link는 파일 존재 여부만 확인한다.
- `#heading` fragment는 대상 markdown의 heading slug 또는 marker alias에 연결되어야 한다.
- `#^marker`와 `#marker`는 같은 marker anchor 후보를 볼 수 있다. 단, 중복 marker는 stable target이 아니므로 warning 대상이다.
- `#L123` 형태의 line fragment는 파일 존재 여부만 검증한다. line number는 semantic anchor가 아니므로 headingMissing으로 보지 않는다.
- 삭제되었거나 repo에 존재하지 않는 계획 산출물은 Markdown link로 유지하지 않는다. 연결할 source가 없으면 code text나 일반 텍스트로 낮춘다.

## 복원 규칙 ^repair-policy

Repair는 candidate를 제안하는 read model에서 시작하고, source rewrite는 명시적 `--apply`에서만 발생한다.

복원 우선순위:

1. 기존 ledger에 기록된 동일 source link의 과거 resolved target.
2. candidate root 변경만으로 유효해지는 동일 relative path.
3. 같은 target 문서 안에서 exact marker 또는 exact heading이 확인되는 fragment.
4. 파일명, 제목, def.id, 기존 연결 기록을 합친 similarity candidate.

아래 조건에서는 자동 복원하지 않는다.

- score가 threshold 미만이다.
- 최고 후보가 둘 이상이다.
- target fragment가 중복 heading 또는 중복 marker에 걸린다.
- 후보가 repo 바깥 path를 요구한다.

## 헤딩과 마커 규칙 ^anchor-policy

- 반복 heading은 문서 구조로 허용된다.
- 반복 heading을 link target으로 쓰려면 각 heading에 고유 `^marker`를 붙인다.
- 반복 heading에 고유 marker가 모두 있으면 informational diagnostic으로만 기록한다.
- 반복 heading에 marker가 없거나 일부만 있으면 `repeatable-heading-without-marker` warning이다.
- 실제 link가 중복 heading slug를 target으로 삼으면 `duplicate-heading-anchor` warning이다.
- 같은 파일 안의 marker는 기본적으로 고유해야 한다.
- `.cases.md`와 `.test.md`의 contract marker 반복은 extraction marker다. 이 marker는 반복 가능하지만 stable link anchor로 쓰지 않는다.

## 임시 병합 규칙 ^bundle-preview-policy

`docs bundle preview`는 여러 markdown을 한 번에 읽기 위한 read-only 임시 문서 projection이다.

- 출력에는 임시 문서임을 명확히 표시한다.
- 원본 문서의 frontmatter, heading, marker, link ownership은 변경하지 않는다.
- preview에서 보이는 heading 순서는 review 편의용이다. canonical structure나 contains graph를 대체하지 않는다.
- 대형 stage 문서를 한 화면에서 비교할 수 있지만, 병합 결과를 새 source of truth로 승격하지 않는다.

## 품질 게이트 ^quality-gate

Docs link scan의 green 기준은 아래 항목이 모두 0인 상태다.

- `missing`
- `headingMissing`
- `duplicateHeadings`
- `unmarkedRepeatableHeadings`
- `duplicateMarkers`

아래 항목은 관리 가능한 구조 신호다.

- `repeatableHeadings`: 반복 heading이 marker로 disambiguation된 상태.
- `repeatableMarkers`: `.cases.md` 또는 `.test.md`에서 허용된 반복 contract marker.

## 소스 경계 ^source-refs

- `markdown-links.ts`: markdown-it token 기반 link/image/heading scan, reference definition scan, repair/rebase candidate 계산.
- `markdown-bundle.ts`: read-only temporary bundle preview.
- `docs.ts`: `qa-sdk docs links`와 `qa-sdk docs bundle` command surface.
- `markdown-links.test.ts`: missing link, root candidate, marker/heading, repair/rebase 정책 검증.
- `markdown-bundle.test.ts`: temporary bundle preview 표시와 ordering 검증.
