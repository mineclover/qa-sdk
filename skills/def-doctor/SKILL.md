---
name: def-doctor
description: "definition-catalog 통합 헬스체크. validate + sync + coverage + aspect + annotation 점검을 한 번에 실행하고 구조화된 요약을 낸다. 신규 기여자가 가장 먼저 실행해야 할 명령."
---

# Definition Catalog — Doctor (통합 헬스체크)

## 언제 쓰는가

- **Onboarding** — 신규 기여자/에이전트가 가장 먼저 실행해야 하는 단일 명령.
  카탈로그 전체 상태와 개별 follow-up 명령으로의 진입을 한 화면에 제공한다.
- **Pre-commit** — frontmatter/코드 대규모 변경 후 regression 빠른 스캔.
- **Debugging** — `validate` 만으로 부족할 때 coverage/aspect/annotation 누락을
  동시에 확인.

## 실행

```bash
qa-sdk def doctor
qa-sdk def doctor --json     # 자동화 파이프라인용
```

## 샘플 출력

```
$ qa-sdk def doctor

Core
  ⚠ validate  0 errors, 1 warning
  ✓ sync      <docs>건 docs, <links>건 links

Domains
  ✓ by-domain  <roots>건 roots
      top: definition-catalog-spec, meta-semantic-system, registry-system, prefix-service, storage-system
  ✓ coverage   <adjusted>% adjusted (<linked>/<total>) — raw <raw>% (<linked>/<rawTotal>), <excluded> infra excluded

Aspects
  ✓ hierarchy     48 total (23 roots, 25 parented), no drift
  ✓ ROOT_ASPECTS  complete (all DEF_ASPECT entries accounted for)

Annotations
  ⚠ deprecated     14 @def.doc|boundary refs to deprecated doc(s) (decode-service-spec)
  ✓ @def.boundary  all targets valid

Summary
  ✓ 0 errors
  ⚠ 2 warnings
  → run `qa-sdk def validate` for warnings/errors detail
  → run `qa-sdk def code-link-gaps` for coverage detail
  → run `qa-sdk def audit --by-domain` for domain breakdown
```

수치 placeholder 는 카탈로그 상태에 따라 매번 달라진다. 실측 예시 (2026-05 기준):
`coverage  99.5% adjusted (1663/1671) — raw 96.5% (1663/1723), 52 infra excluded`.

### Adjusted vs Raw coverage

| 지표 | 계산 | 의미 |
|------|------|------|
| `raw` | `linked / totalFiles` | 전체 소스 파일 중 문서 연결이 있는 비율 |
| `adjusted` | `linked / (totalFiles - excluded)` | infra 제외 비율 — 문서 연결 의무가 없는 인프라성 코드를 분모에서 뺀다 |
| `excluded` | infra-only 파일 수 | bootstrap/wiring/index re-export 등 — `collectCodeLinkCoverage` 내부 규칙이 식별 |

**임계값**: `def doctor` 의 coverage warning 트리거는 **adjusted** 80% 기준 (CON-004). raw 가 80% 미만이라도 adjusted ≥ 80% 면 pass. 즉 infra 제외 후의 의미 있는 커버리지를 게이트로 본다.

## 섹션별 의미

| Section | Check | 의미 |
|---------|-------|------|
| Core | `validate` | `validateGraph` 결과 — broken-link / circular-ref / missing-purpose 등 |
| Core | `sync` | DB 에 적재된 문서 수 + 총 outgoing link 수. `qa-sdk def sync` 가 최신 상태면 OK |
| Domains | `by-domain` | `deriveAllDomainRoots` 집계 루트 수 + 최상위 5 개 루트 이름 |
| Domains | `coverage` | `@def.boundary` / `@def.doc` / frontmatter `source:` 로 문서에 연결된 소스 파일 비율. `adjusted` (infra 제외) / `raw` 두 값을 함께 보고하며, infra-only 파일 수도 표기한다. **warning 트리거는 adjusted < 80%** (CON-004) — raw 는 참고용 |
| Aspects | `hierarchy` | `ASPECT_PARENTS` + `ROOT_ASPECTS` 완결성 불변식 4 경로 (aspect-parents.test.ts 와 동일 규율) |
| Aspects | `ROOT_ASPECTS` | `DEF_ASPECT.entries` 전체가 ROOT_ASPECTS ∪ ASPECT_PARENTS 에 포함되는지 |
| Annotations | `deprecated` | 코드 주석 타깃이 `lifecycle: deprecated`/`archived` 인 문서를 가리키는지 |
| Annotations | `@def.boundary` | 코드 주석 타깃 문서가 DB 에 실존하는지 |

## 상태 아이콘

- `✓` pass — 문제 없음
- `⚠` warn — 동작은 하되 관찰 필요
- `✗` fail — 즉시 수정 필요

## Exit code

| 코드 | 의미 | CI 동작 |
|------|------|---------|
| 0 | errors 0 && warnings 0 | PASS |
| 2 | errors 0 && warnings > 0 | PASS (경고만) — 운영 가능 |
| 1 | errors > 0 | FAIL — 즉시 수정 |

warnings-only 를 2 로 둔 이유: CI 에서 warnings 를 soft-fail (별도 gate) 로 다룰 수
있게 하기 위함. `|| true` 없이 bash 에서 `def doctor && ...` 체인을 깨지 않도록
기본 운영 전제는 0 수렴이다.

## 경고/에러 별 follow-up

| 섹션 | 경고/에러 | 다음 명령 |
|------|-----------|----------|
| Core `validate` | errors/warnings > 0 | `qa-sdk def validate` — 유형별 목록 (상세: `skills/def-validate/SKILL.md`) |
| Core `sync` | 0 docs | `qa-sdk def sync` — DB 재구축 |
| Domains `by-domain` | 0 roots | `qa-sdk def audit --by-domain` — 루트 파생 경로 확인 |
| Domains `coverage` | < 80% | `qa-sdk def code-link-gaps` — 연결 없는 소스 파일 리스트 |
| Aspects `hierarchy` | drift > 0 | `packages/definition-catalog/src/vocabulary.ts` 에서 `ASPECT_PARENTS` 또는 `ROOT_ASPECTS` 갱신 |
| Aspects `ROOT_ASPECTS` | unaccounted > 0 | 누락된 aspect 를 `ROOT_ASPECTS` 또는 `ASPECT_PARENTS` 중 하나에 등록 (자식 aspect 명명 규율 참조: `aspect-naming-convention.rule.md`) |
| Annotations `deprecated` | refs > 0 | 타깃 문서를 `approved` 로 재지정하거나 소스 주석을 권위 문서로 갱신 |
| Annotations `@def.boundary` | broken refs > 0 | `qa-sdk def validate` 가 broken-link error 로 병렬 보고 — 거기서 수정 |

## 관련 skill

- `def-validate` — validator 에러/경고 유형별 해소
- `def-audit` — 품질 감사 (purpose/links/tags/level)
- `def-boundary` — 코드 ↔ 문서 경계 정리
- `def-entry-sync` — 기능 추가 후 root entry + skill index 갱신

## 계층 맥락

`def doctor` 는 **L1-L4 통합 헬스체크** — 한 화면에 모든 계층의 상태를 드러내는 유일한 명령.

| Doctor 섹션 | 대응 계층 | 책임 |
|-----------|---------|------|
| **Core** (`validate`, `sync`) | L1 data + L2 validator | frontmatter schema + validateGraph 규칙 |
| **Domains** (`by-domain`, `coverage`) | L3 workflow | `deriveAllDomainRoots` 파생 + 소스 파일 커버리지 |
| **Aspects** (`hierarchy`, `ROOT_ASPECTS`) | L2 validator + L3 workflow | `aspect-parents` 불변식 + rollup 가시성 |
| **Annotations** (`deprecated`, `@def.boundary`) | L4 tooling | 코드 주석 round-trip 검증 |

어느 섹션의 경고든 단독으로 발생할 수 있으므로 **섹션별 follow-up** 이 계층 진입점이다. 예: Core 만 green + Domains 붕괴 → L3 workflow 가정 깨짐 (Option B 패턴).

계층 분리 규칙: `docs/specs/system/layer-separation.rule.md`. Semantic 변경 후 doctor 만으로 부족하면 `skills/semantic-change/SKILL.md` Step 3 체크리스트를 추가 실행.
