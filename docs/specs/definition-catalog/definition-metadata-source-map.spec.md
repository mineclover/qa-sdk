---
def:
  id: definition-metadata-source-map
  type: design
  tier: system
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [metadata, structural, coordinate-cluster]
  links:
    - target: definition-frontmatter-metadata-system
      type: refines
    - target: definition-code-link-coverage
      type: depends_on
sources:
  - packages/definition-catalog/src/code-references.ts
  - packages/definition-catalog/src/code-references.test.ts
  - packages/definition-catalog/src/frontmatter.ts
  - packages/cli/src/lib/review-feedback-docs.ts
  - packages/cli/src/commands/review.ts
  - packages/review-ledger/src/feedback-request.ts
  - packages/review-ledger/src/types.ts
---

# Definition Metadata — `source` / `sources`

## 목적 ^purpose

`source`와 `sources`는 문서 책임과 코드 파일/심볼을 연결한다. closure, find-by-file, review feedback의 code responsibility evidence다.

## 정의 ^defines

| field           | 위치                  | 의미                                    |
| --------------- | --------------------- | --------------------------------------- |
| `source`        | top-level frontmatter | 단일 코드 target                        |
| `sources`       | top-level frontmatter | 복수 코드 target                        |
| `@def.doc`      | code comment          | 코드에서 문서를 가리키는 보조 선언      |
| `@def.boundary` | code comment          | 코드 파일의 primary definition boundary |

`source`/`sources`와 `@def.doc`는 문서 책임을 뒷받침하는 evidence 관계다. 이 관계만으로는 코드 소유권을 확정하지 않는다. `@def.boundary`만 파일 또는 심볼의 authoritative boundary를 선언하며, 같은 조회 대상에서 유효한 boundary가 둘 이상이면 모호성 오류로 처리한다.

## 제약 ^constraint

- `source`/`sources`는 `def:` 블록 안에 넣지 않는다.
- symbol target은 `packages/pkg/src/file.ts:Symbol` 형식을 쓴다.
- source mapping은 context dependency의 source가 아니라 해당 책임의 source여야 한다.
- `find-by-file`은 explicit `@def.boundary`가 있을 때만 `unique` authoritative 결과를 반환한다.
- `sources`/`@def.doc`만 있으면 supporting docs를 포함한 `evidence-only` 결과를 반환한다. 상위 문서나 tier를 따라 boundary를 추론하지 않는다.

## `find-by-file` resolution 상태

| 상태            | 의미                                           | 후속 조치                          |
| --------------- | ---------------------------------------------- | ---------------------------------- |
| `none`          | 해당 코드 경로에 참조가 없음                   | source 또는 code comment 추가      |
| `evidence-only` | 참조 문서는 있으나 authoritative boundary 없음 | 적절한 소스에 `@def.boundary` 추가 |
| `unique`        | explicit boundary 하나가 확정됨                | authoritative anchor 사용 가능     |
| `ambiguous`     | explicit boundary가 둘 이상임                  | 파일/심볼 boundary를 하나로 정리   |

validator와 local/server `find-by-file`는 동일한 explicit boundary 규칙을 사용한다. validator는 `evidence-only`를 오류로 보지 않으며, boundary가 필수인 엔트리포인트 정책은 별도 workflow gate에서 검사한다. 다만 review feedback consumer는 `evidence-only`의 supporting docs를 `file-evidence` 후보로 노출할 수 있고, 이를 authoritative owner로 사용하지 않는다. 반대로 `ontology prompt extract-file`처럼 owner가 필요한 workflow는 `unique`만 허용한다.

review feedback consumer가 `none` 또는 `ambiguous`를 만난 경우에는 자동 후보를 만들지 않지만, `EvidenceBundleItem.relatedDocResolution`에 해석 결과를 보존한다. `ambiguous`에는 충돌한 anchor 후보 ID를 함께 기록한다. 이 진단은 ownership link가 아니며, boundary 정리 후 다음 요청에서 후보를 다시 계산한다.
