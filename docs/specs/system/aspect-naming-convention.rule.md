---
def:
  id: aspect-naming-convention
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [structural, taxonomy, convention]
  links:
    - target: definition-catalog-spec
      type: constrains
    - target: definition-taxonomy
      type: refines
---

# Aspect Naming Convention — `{role}_{parent-stem}` 명명 규율

## 목적 ^purpose

`DEF_ASPECT` 에 신규 aspect 값을 추가할 때의 네이밍/매핑 규율을 고정한다. 이 규율은 `aspect-vocab-split` RFC (Phase 5b) 에서 도입되어 `aspect-schema-hierarchy` RFC (Phase C) 의 기계적 전환을 가능하게 만든 기반이다. 값 치환이 아닌 **값 추가 + 명시 map** 방식을 강제하여 어휘 확장의 가역성과 외부 도구 호환성을 보장한다.

---

## 1. 규칙

### 1.1 네이밍 패턴 — `{role}_{parent-stem}`

신규 aspect 는 `snake_case` 2 단어 결합이며 다음 구성을 따른다.

- **role** (첫 단어): 부모 aspect 의 관심사 내에서 이 값이 담당하는 하위 역할/도메인 식별자
- **parent-stem** (두 번째 단어): 부모 aspect 이름의 **마지막 underscore-separated segment**

| 신규 값 | role | parent-stem | 부모 aspect |
|---|---|---|---|
| `codegen_func` | codegen | func | `func_def` (stem 예외 — §1.2) |
| `ingest_flow` | ingest | flow | `process_flow` |
| `decode_contract` | decode | contract | `api_contract` |
| `taxonomy_data` | taxonomy | data | `domain_data` |

### 1.2 `func_def` 계열의 예외

`func_def` 는 "기능(func) 의 정의(def)" 의미이며, parent-stem 은 마지막 단어 `def` 가 **아니라** `func` 를 채택한다. 이유:

- `def` 는 메타 접미사 — 타 aspect (`prefix_schema`, `axis_catalog`) 는 `_def` 를 붙이지 않는다
- 의미상 분류 대상은 "func" (기능) 이며 `codegen_func` / `harness_func` 는 "기능의 하위 유형"

이 예외는 **`ASPECT_PARENTS` map 으로 명시 등록** 한다 (이름 역산 금지).

### 1.3 Stem 중복 (`data`) 처리

`domain_data` / `system_data` / `external_data` 3 형제가 stem `data` 를 공유한다. stem 만으로 부모를 역산하면 불안정하므로:

- 기본 부모는 가장 일반적인 `domain_data` 로 규정
- 예외 필요 시 `{role}_{parent-prefix}_{stem}` 3-segment 로 확장 허용
- **부모 추론은 런타임에 절대 이름에서 역산하지 않는다** — `ASPECT_PARENTS[child]` lookup 만 신뢰

### 1.4 신규 값 등록 체크리스트 (동시 수정 필수)

신규 aspect 를 1건 추가할 때마다 다음 4개 지점을 **원자 커밋** 으로 동시 변경한다.

1. `packages/definition-catalog/src/vocabulary.ts` §`DEF_ASPECT.entries` — entry 배열 추가
2. `packages/definition-catalog/src/vocabulary.ts` §`DEF_ASPECT.ko` — 한글 매핑 추가
3. `packages/definition-catalog/src/vocabulary.ts` §`ASPECT_PARENTS` — child → parent 쌍 추가
4. `packages/definition-catalog/src/taxonomy.ts` §`VALID_SCOPE_ASPECTS` — scope 키에 신규 aspect 추가
5. (필요 시) `DEF_ASPECT.capacity` 재검토 — `nextPowerOf2(entries.length * 2)` 이상 유지

누락 검증은 `pnpm --filter definition-catalog test` + `pnpm exec qa-sdk def validate` 가 자동 수행.

### 1.5 Generic parent 의 유지 정책

fallback 부모 aspect (`func_def`, `process_flow`, `api_contract`, `domain_data`) 는 **영구 유지** 한다. 하위 분화되지 않은 기타 문서의 귀속처가 사라지면 `VALID_SCOPE_ASPECTS` 검증이 실패하므로 `B-4` (레거시 제거) 는 실행하지 않는다.

### 1.6 Capacity 관리

`DEF_ASPECT.capacity` 는 항상 `nextPowerOf2(entries.length * 2)` 이상이어야 한다. headroom ≤ 1 은 warning, = 0 은 critical.

| entries | capacity |
|---:|---:|
| 23 | 64 |
| 40 | 128 |
| 46 (현재) | 128 |

---

## 2. 검증

### 2.1 정합성 점검 (CLI)

```bash
# 1. aspect vocabulary 자체 검증
pnpm --filter definition-catalog test vocabulary taxonomy aspect-family

# 2. 문서 검증 (scope-aspect 조합 + dup-coord 상태 재확인)
pnpm exec qa-sdk def validate
```

### 2.2 Delta 정합성 체크

신규 aspect 추가 PR 리뷰 시 아래 등식을 확인:

```
|ASPECT_PARENTS| + |최상위 aspect 목록| == |DEF_ASPECT.entries|
```

최상위 aspect 는 map 에 등록하지 않으므로 `ASPECT_PARENTS` 에는 존재하지 않고 entries 에는 존재한다. 이 delta 가 깨지면 누락이 있다.

### 2.3 Rollup 정합성

```bash
pnpm exec qa-sdk def audit --rollup-aspect | head -30
```

root aspect 별 family size 가 예상대로인지 확인 (예: `func_def` family = 11 = self + 10 자식).

### 2.4 DB 동기화 확인

```bash
sqlite3 data/definition-service.sqlite \
  "SELECT COUNT(*) FROM aspect_parents;"
# 결과는 |ASPECT_PARENTS| 과 일치해야 함
```

불일치 시 `pnpm exec qa-sdk def sync` 로 재포퓰레이트.

---

## 3. 예외

| 예외 | 정당화 | 근거 |
|---|---|---|
| `func_def` 의 stem 규칙 (`def` 가 아닌 `func`) | 메타 접미사 분리 | aspect-vocab-split 00-design §"func_def 계열의 특례" |
| 기존 23개 legacy aspect (`layout`, `component`, `interaction`, `scenario`, `relation` 등) | 단일 단어 최상위 분류 — 하위 분할 불필요 | aspect-vocab-split 00-design §"기존 aspect 의 네이밍 적합성 분석" |
| fallback parent (`func_def`, `process_flow`, `api_contract`, `domain_data`) 유지 | 비세분화 문서 귀속처 필요 | aspect-vocab-split 01-migration §"Q1 — 기존 coarse 값의 생명주기" |

---

## 4. 근거

- [aspect-vocab-split RFC (README)](../../proposals/aspect-vocab-split/README.md)
- [aspect-vocab-split 00-design §명명 컨벤션](../../proposals/aspect-vocab-split/00-design.md)
- [aspect-schema-hierarchy RFC](../../proposals/aspect-schema-hierarchy/README.md) — 본 규율이 schema 승격의 기반
- [domain-hierarchy/reviews/2026-04-21-final-cleanup.md](../../proposals/domain-hierarchy/reviews/2026-04-21-final-cleanup.md) §"Part C — Aspect split deferred" — 세분화가 미완이면 dup-coord 가 재발한다는 경험적 근거
- [aspect-evolution-index.md](../../proposals/aspect-evolution-index.md) — 3-RFC 통합 서사
- `packages/definition-catalog/src/vocabulary.ts` — 구현 지점 (`DEF_ASPECT`, `ASPECT_PARENTS`, `deriveAspectParent`, `getAspectFamily`)
- `packages/definition-catalog/src/taxonomy.ts` — `VALID_SCOPE_ASPECTS` 동시 수정 지점
