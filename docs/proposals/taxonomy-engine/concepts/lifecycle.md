# Lifecycle — 결정 진행 상태

> entry/axis에 부여하는 결정 상태. **결정의 결과만** 다루던 v0.7에서 **결정 자체**를 1급으로 격상.

## 정의

[[entry]]와 [[axis]]에 선택적으로 부여하는 결정 진행 상태. 6 값 — `draft / review / approved / deprecated / archived / tbd`.

앞 5개는 vocabulary.ts `DEF_LIFECYCLE`(qa-sdk 공용 어휘) 그대로. 마지막 `tbd`만 taxonomy-engine 신규 — placeholder/미정 표현용.

## 목적 ^purpose

- 진화 중인 텍소노미(확정 + 미정 섞임)를 자연스럽게 표현
- 리뷰어가 "이 entry는 결정 완료인가, 진행 중인가, 미정인가"를 좌표 단위로 즉시 식별
- 미정 entry에 `decisionLink`를 달아 결정 컨텍스트(왜, 누가, 무엇이 필요한가)로 연결

## 6 값

| value | 의미 | UI |
|------|------|----|
| `draft` | 초안, 작성 중 | blue |
| `review` | 검토 중, 피드백 수집 | amber |
| `approved` | 승인, 결정 완료 | green |
| `deprecated` | 폐기 예정, 새 사용 금지 | gray |
| `archived` | 보관, 변경 금지 | dark |
| `tbd` | **미정** — placeholder entry | red dashed |

`tbd`는 taxonomy-engine 신규. 다른 5개는 DEF_LIFECYCLE 그대로 → vocabulary.ts와 자동 추출로 동기화 가능 ([[doctor]] 참조).

## 적용 위치

```yaml
axes:
  layer:
    description: lesson-builder Layer
    lifecycle: approved          # axis 단위 (선택)
    entries:
      - { id: type-schema, address: 0, lifecycle: approved }
      - { id: asset,       address: 1, lifecycle: approved, decisionLink: "../proposals/lesson-builder/decisions/asset-interface.md" }
      - { id: cue,         address: 12, lifecycle: tbd, placeholderReason: "interaction 정의 미정" }
```

- entry: 가장 흔함, 결정 단위
- axis: 차원 전체의 성숙도 (선택, 누락 시 entries에서 추론 가능하지만 명시가 권장)
- relation/constraint: 부여 안 함 (선언이 곧 결정)

## 누락 정책

`lifecycle` 필드는 **optional**. 기존 yaml은 lifecycle 없이도 valid.

| 시점 | 동작 |
|------|------|
| parse | 누락 OK, IR에 `undefined` |
| validate (기본) | `lifecycle-missing` **warning** |
| validate (`--lifecycle-strict`) | `lifecycle-missing` **error** |
| codegen | 누락 entry는 출력에 lifecycle 필드 자체 생략 |
| UI | "(미지정)" 회색 배지 |

**default 값을 자동 부여하지 않는다.** "어떤 entry는 의도적으로 미지정"과 "어떤 entry는 결정 완료(approved)"를 구분 가능해야 하기 때문.

마이그레이션 흐름: yaml에 lifecycle 추가 → warning 사라짐 → 충분히 부여되면 `--lifecycle-strict` CI 게이트 활성화.

## 전이 규칙 (`lifecycle-transition-invalid`)

`validate --lifecycle-strict --base <ref>` 시 git base와 비교, 부적절 전이 감지.

| from | 허용 to |
|------|---------|
| `draft` | `review`, `approved`, `deprecated`, `tbd` |
| `review` | `draft`, `approved`, `deprecated`, `tbd` |
| `approved` | `review`, `deprecated`, `tbd` |
| `deprecated` | `approved`, `archived`, `tbd` (재활성화 허용) |
| `archived` | **불가** — 영구 보관 |
| `tbd` | **모두** — 미정에서 임의 결정 가능 |

`archived → *` 시도 시 error. 그 외 표 외 전이는 warning (실수 가능성 표시).

## decisionLink

entry에 결정 컨텍스트를 연결하는 string. 4 형식:

| 형식 | 예 | 검증 |
|------|-----|------|
| relative path | `./decisions/asset.md` | fs 존재 확인 |
| URI | `https://github.com/.../decisions/123` | 형식만 (fetch 안 함) |
| taxonomy ref | `tax:slug.axis.entry` | [[registry]] resolve |
| decision-flow URI | `decision-flow://decisions/abc` | Stage 3 (미지원, warning) |

검증 실패 시 `decision-link-broken` warning. ref/URI/path 형식 분기는 prefix로 판단 (`./`, `../`, `http://`, `https://`, `tax:`, `decision-flow://`).

Stage 1에서는 단순 string. Stage 3에서 decision-flow 양방향 sync 활성화 시 decision id로 진화.

## placeholderReason

`lifecycle: tbd` entry에 선택적 부여. **왜 미정인지 한 줄 설명**.

```yaml
- { id: cue, address: 12, lifecycle: tbd, placeholderReason: "interaction 정의 미정 — beat과의 경계 결정 필요" }
```

UI에서 tbd 배지 hover 시 표시. validate는 검사하지 않음 (자유 텍스트). 단 `lifecycle: tbd`인데 `placeholderReason`도 `decisionLink`도 없으면 `lifecycle-tbd-orphan` info — "이 미정 entry는 컨텍스트가 없습니다, 추가하세요" 안내.

## DiagnosticCode (신규 4종)

`lifecycle-*` prefix 신설. 전체 카탈로그: [`diagnostics-catalog.md`](./diagnostics-catalog.md).

| code | severity | 언제 | hint |
|------|----------|------|------|
| `lifecycle-missing` | warning (strict: error) | entry/axis에 lifecycle 없음 | `lifecycle: <value>` 추가 |
| `lifecycle-tbd` | info | placeholder entry 감지 (개수 보고) | (없음, 정보성) |
| `lifecycle-transition-invalid` | error | 부적절 전이 (git base 비교 시) | 허용 전이 표 안내 |
| `lifecycle-tbd-orphan` | info | tbd인데 reason/link 둘 다 없음 | `placeholderReason` 또는 `decisionLink` 추가 |
| `decision-link-broken` | warning | decisionLink 해소 실패 | 파일/URI 확인 |

## diff 확장 (Stage 2 일부 선행)

DiffEntry kind 추가:
- `entry-lifecycle-changed` — `{ axis, id, from, to }` — Stage 1에서 추가, Stage 2의 breakingLevel 분류 시 `patch`로 분류.

## 다른 개념과의 관계

- [[entry]] — lifecycle을 가질 수 있는 주된 단위
- [[axis]] — axis 단위 lifecycle (선택)
- [[diagnostic]] — `lifecycle-*` 4 신규
- [[diff]] — `entry-lifecycle-changed` 신규 kind
- [[doctor]] — vocabulary.ts DEF_LIFECYCLE와 taxonomy의 lifecycle 사용을 cross-check (extract-vocab 보강)
- decision-flow (Stage 3) — decisionLink로 양방향 sync 예정

## SSOT 위치

- vocabulary.ts `DEF_LIFECYCLE` — 5 entries (`tbd` 제외) SSOT
- taxonomy-engine schema — `tbd` 합쳐 6 entries 허용
- 두 곳 일치 검증: doctor extract-vocab가 `DEF_LIFECYCLE.entries`를 비교 시 `tbd`만 차이로 보고 (예외 처리)

## 참조

- roadmap Stage 1: `../roadmap.md`
- DEF_LIFECYCLE: `packages/definition-catalog/src/vocabulary.ts`
- 결정 컨텍스트 비전: 메모리 `feedback_decision-context-over-tracking`
- 도그푸딩 케이스 (lesson-builder): `../roadmap.md` §케이스 매핑
