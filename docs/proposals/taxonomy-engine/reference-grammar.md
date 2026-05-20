# Reference Grammar

> 00-design.md §5 분리. v0.7 모듈화 (T-L1).

OpenAPI의 `$ref: '#/components/schemas/Foo'`에 대응하는 메커니즘. 좌표계에선 **id rename에 강건**해야 하므로 3-tier로 설계.

## 5.1 3-tier 참조

**Tier 1 — Path-based (JSON Pointer 스타일)**
정확/verbose. 도구·codegen·진단 메시지의 입력.

```
qa-sdk-coordinate-system                                            # 전체 taxonomy
qa-sdk-coordinate-system#/axes/scope                                # 차원 전체
qa-sdk-coordinate-system#/axes/scope/entries/apm                    # 한 entry
qa-sdk-coordinate-system#/axes/scope/entries/apm/meta/owner         # 내부 깊숙한 필드
qa-sdk-coordinate-system#/relations/depth-contains/rules/0          # 특정 rule
qa-sdk-coordinate-system#/constraints/capacity-headroom             # constraint
```

**Tier 2 — Dotted shorthand**
사람·CLI 친화, lossy. `tax show qa-sdk-coordinate-system:scope.apm` 같은 사용.

```
qa-sdk-coordinate-system:scope.apm
qa-sdk-coordinate-system:scope
qa-sdk-coordinate-system:relations/depth-contains
qa-sdk-coordinate-system:coord{scope=apm,aspect=model,depth=layer}
```

**Tier 3 — Address-based**
id rename에 강건. 정수 hash로 빠른 lookup. 깊은 binding이 자주 일어나는 곳(lesson-builder의 Clip 호출)에서 안전.

```
qa-sdk-coordinate-system::scope#1                  # scope axis의 address=1
qa-sdk-coordinate-system::coord:0x010203           # packed integer 좌표
```

## 5.2 참조 가능한 단위 7종

| 단위 | 예시 | 용도 |
|------|------|------|
| Taxonomy | `qa-sdk-coordinate-system` | 다른 yaml에서 통째 의존 |
| Axis | `:scope` | "이 축의 entries를 가져와" (codegen) |
| Entry | `:scope.apm` | 가장 흔한 참조 |
| Coordinate | `:coord{scope=apm,aspect=model}` | 좌표점 = 노드 자체 |
| Relation | `:relations/depth-contains` | 다른 taxonomy가 같은 관계 재사용 |
| Rule | `:relations/depth-contains/rules/0` | constraint 진단 메시지 |
| Meta field | `:scope.apm#/meta/owner` | "내부 깊숙히" |

## 5.3 Cross-taxonomy 참조

```yaml
# lesson-builder-taxonomy.yaml
imports:
  - taxonomy: qa-sdk-coordinate-system
    version: 1
    as: qac

axes:
  asset-layer:
    entries: [type-schema, asset, clip, cue, stage, branch, scenario]
    projects-to: qac:layer       # cross-taxonomy projection
```

registry에 import target이 없으면 `ref-unresolved-import` error ([diagnostics-catalog.md](./concepts/diagnostics-catalog.md) 참조).

## 5.4 Resolver 동작

1. **Parse**: `parseTaxonomyRef("qa-sdk-coordinate-system:scope.apm#/meta/owner")` → `{taxonomy, axis, entry, jsonPointer}`
2. **Resolve**: Taxonomy registry에서 taxonomy 찾고 IR 따라 값 추출
3. **Strict mode**: 모든 ref가 해소되어야 validate 통과 (broken-ref = error, qa-sdk LinkType broken-link 정책 답습)
4. **Address fallback**: id 변경 시에도 address-based ref는 유효. Indexer가 (id↔address) 양방향 인덱스 보유

## 5.5 버전 정책

- ref에 `@v<n>` 미명시 → latest
- `qa-sdk-coordinate-system@v1:scope.apm` → v1 entries 기준
- IR의 `axes.<name>.version` stamp로 cross-version 참조 가능

## 5.6 왜 3-tier인가 (설계 의도)

- **Tier 1 (JSON pointer)**: 도구/codegen의 정확한 입력. 정규 형식. 자동화 친화.
- **Tier 2 (dotted)**: 사람이 CLI에 타이핑하는 단축형. 일상 사용.
- **Tier 3 (address)**: 영속 링크. id rename 안전. lesson-builder처럼 깊은 binding이 자주 일어나는 곳에서 안전망.

OpenAPI는 Tier 1만 있어서 ref가 rename 따라 깨지는 약점이 있다. qa-sdk의 (address 불변 / id 가변) 컨벤션을 답습해 그 약점을 메운다.

## 참조

- ref grammar 코드: `packages/taxonomy-engine/src/ref/`
- ref 관련 진단 코드: [concepts/diagnostics-catalog.md](./concepts/diagnostics-catalog.md) §ref-*
- 라이브러리 API: [api-surface.md](./api-surface.md) (parseRef, resolveRef, show)
- cross-tax 계획: [plans/v0.2.md](./plans/v0.2.md) §T-A2
- 좌표 컨벤션: `docs/CONVENTIONS.md` §DimRef
