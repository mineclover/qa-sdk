---
def:
  id: domain-hierarchy-mini5b-split
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: validation
  links:
    - target: domain-hierarchy-readme
      type: depends_on
status: under-review
date: 2026-04-21
part_of: domain-hierarchy
role: review
---

# Mini Phase 5b — 추가 aspect 분할 (encoding + definition_mgmt)

## 추가 분할 근거 ^purpose

Phase 5g (final-cleanup, 2026-04-21) 이후 dup-coord warning 3 건이 잔존했다.
3 건 모두 cross-scope 태그로 숨기지 않고 "aspect vocabulary 부족"이라는 실제 구조 문제로 남겨, Phase C 후보 RFC 로 예고했다. 본 Mini 5b 는 그 중 2 건 (encoding / definition_mgmt) 을 즉시 해소한다. 세번째 (decode_contract) 는 의미가 다른 구조 이슈 (동일 서비스의 HTTP API vs service def) 라 별도 설계가 필요하여 유지한다.

처리 배경:

| # | 그룹 | 멤버 | 2026-04-21 처리 |
|---|---|---|---|
| 1 | encoding_func @ partial-binder-spec | cq-system, partial-binder-spec, wi-pack-format-system | **본 작업 해소** |
| 2 | decode_contract @ registry-system | decode-api, decode-service-spec | **유지** (별도 설계) |
| 3 | definition_mgmt_flow @ definition-catalog-spec | definition-mgmt-observability-model, definition-service-quality-bundle, harness-architecture | **본 작업 해소** |

## 신규 aspect 6 개

명명 규칙 `{role}_{parent-stem}` 준수. Option A (flat under parent) 선택 — Phase 5b 에서 1-level hierarchy 로 표준화되어 있으므로 grandchild 가 되지 않도록 sibling 으로 배치.

### feature/func_def 하위 (encoding 계열)

| 신규 값 | parent | 의미 | ko |
|---|---|---|---|
| `codec_func` | `func_def` | 조합형 encoding/decoding 통합 기능 (binder + format 결합) | 코덱기능 |
| `binder_func` | `func_def` | partial-binder 등 인코딩 입력 바인딩 기능 | 바인더기능 |
| `format_func` | `func_def` | pack-format 등 인코딩 결과 포맷 정의 기능 | 포맷기능 |

기존 `encoding_func` 는 **umbrella fallback 으로 유지**. 새 3 개 role 에 정확히 맞지 않는 일반 인코딩 기능 (wi-system, decode-bigint, decode-service-system 등) 은 그대로 `encoding_func` 를 사용한다.

### flow/process_flow 하위 (definition-management 계열)

| 신규 값 | parent | 의미 | ko |
|---|---|---|---|
| `mgmt_flow` | `process_flow` | definition 관리/관측 모델 흐름 | 관리흐름 |
| `quality_flow` | `process_flow` | definition 서비스 품질 번들 흐름 | 품질흐름 |
| `harness_flow` | `process_flow` | definition 하네스 아키텍처 흐름 | 하네스흐름 |

기존 `definition_mgmt_flow` 역시 umbrella fallback 으로 유지.

### Capacity

`DEF_ASPECT.entries` 40 → **46**. capacity 128 유지 (nextPowerOf2(46×2=92)=128). headroom 82 — 여유 충분.

## migrated 6 docs

| doc | old aspect | new aspect | path |
|---|---|---|---|
| cq-system | encoding_func | codec_func | docs/specs/coord-query-system/cq-system.md |
| partial-binder-spec | encoding_func | binder_func | docs/specs/weighted-index-system/partial-binder.spec.md |
| wi-pack-format-system | encoding_func | format_func | docs/specs/weighted-index-system/wi-pack-format-system.md |
| definition-mgmt-observability-model | definition_mgmt_flow | mgmt_flow | docs/specs/definition-catalog/definition-management/definition-mgmt-observability-model.spec.md |
| definition-service-quality-bundle | definition_mgmt_flow | quality_flow | docs/specs/quality-gates/definition-service-quality-bundle.md |
| harness-architecture | definition_mgmt_flow | harness_flow | docs/specs/definition-catalog/definition-harness-architecture.spec.md |

각 문서 frontmatter 의 `aspect` 한 줄만 변경. address 는 DB 에서 자동 재계산.

## insert-on-discovery 검증 (aspect_parents 6 rows)

`pnpm exec qa-sdk def sync` 이후 `aspect_parents` 테이블 자동 갱신 확인:

```
sqlite3 data/definition-service.sqlite \
  "SELECT child_id, parent_id FROM aspect_parents \
   WHERE child_id IN ('codec_func','binder_func','format_func',\
                      'mgmt_flow','quality_flow','harness_flow');"
```

결과:

| child_id | parent_id |
|---|---|
| binder_func | func_def |
| codec_func | func_def |
| format_func | func_def |
| harness_flow | process_flow |
| mgmt_flow | process_flow |
| quality_flow | process_flow |

6 rows 정상 등록. Phase C-1 insert-on-discovery 훅이 정상 작동함을 확인.

## 최종 metrics

| 지표 | before (Phase 5g) | after (Mini 5b) | Δ |
|---|---:|---:|---:|
| errors | 0 | 0 | 0 |
| warnings (total) | 3 | **1** | -2 |
| duplicate-coordinate | 3 | **1** | -2 |
| level-violation | 0 | 0 | 0 |
| multi-parent | 0 | 0 | 0 |
| orphan | 0 | 0 | 0 |

세션 누적:

- Phase 5f 이전 baseline: 68 warnings
- Phase 5g 완료: 3 warnings (96% 감소)
- **Mini 5b 완료: 1 warning (98.5% 감소)**

잔존 warning 1 건은 아래 decode_contract 구조 이슈로 의도적 유지.

## decode_contract 별도 계획

**잔존 그룹**: `system:interface:mediation:decode_contract @ registry-system` — [decode-api, decode-service-spec].

**분석** (final-cleanup §Part C #4 연속):

- 두 문서는 "동일 decode 서비스"의 서로 다른 facet
  - `decode-api`: HTTP API 계약 (endpoint, request/response schema)
  - `decode-service-spec`: 서비스 정의 (module 구조, boot config, lifecycle)
- "independent peer" 아닌 "동일 subject 의 관점 분리" — cross-scope tag 로 숨기면 의미 왜곡
- naive aspect split (`decode_api_contract` vs `decode_service_contract`) 도 좋은 해결책이 아님 — API 는 서비스의 하위 계약이지 sibling 이 아님

**제안 경로** (추가 RFC 대상):

1. **Tier 재배치**: `decode-api` 를 `tier: component` 로 강등 → decode-service-spec 의 component 로 포함. 좌표 공간 분리 + "API = 서비스의 하위 계약" 의미도 정확.
2. **Sub-aspect 추가** (비추천): `decode_api_contract` / `decode_service_contract` — sibling 관계 강제, 의미 왜곡.
3. **contains 명시 + cross-scope tag** (비추천): tag 로 숨기면 실제 계층 관계가 데이터에 안 남음.

본 Mini 5b 는 경로 1 을 권장하며, 실제 수행은 decode-service-system 스펙의 structural 결정이 필요하므로 분리 RFC 대상.

## 커밋

| # | hash | 제목 |
|---|---|---|
| 1 | 200dec40 | feat(def): mini-5b — 6 new aspects for encoding + definition_mgmt families |
| 2 | 48ec543d | fix(def): mini-5b — migrate 6 docs to sub-aspects |
| 3 | (본 보고서) | docs(proposals): mini-5b split execution report |

## 참조

- [2026-04-21-final-cleanup.md](./2026-04-21-final-cleanup.md) §Part C — 본 작업의 직접 선행 (deferred 3 groups)
- [2026-04-21-phase5b-exec.md](./2026-04-21-phase5b-exec.md) — 원 Phase 5b 실행 (encoding_func / definition_mgmt_flow 값 최초 도입)
- [../../aspect-vocab-split/00-design.md](../../aspect-vocab-split/00-design.md) §"Helper: deriveAspectParent" — 명명 컨벤션 규율
- `packages/definition-catalog/src/vocabulary.ts` §`DEF_ASPECT` / `ASPECT_PARENTS`
- `packages/definition-catalog/src/taxonomy.ts` §`VALID_SCOPE_ASPECTS`
- 검증 로그: `/tmp/mini5b-before.txt`, `/tmp/mini5b-after.txt`
