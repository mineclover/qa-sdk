---
def:
  id: domain-hierarchy-selector-review
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

# Selector Review — 탐색 + Code↔Spec 라운드트립 평가 (2026-04-21)

## 목적 ^purpose

2026-04-20 ~ 2026-04-21 세션에서 구축된 3-RFC 파생 인프라(`deriveDomainRoot` / `deriveAspectParent` / `getAspectFamily` helper, `def list --domain-root` / `def list --include-children` / `def audit --rollup-aspect` 등 CLI, 100+ 파일의 `@def.boundary` 주석, 8종 `rule.md`)가 실제 개발 워크플로우 — (1) 신규 contributor의 시스템 탐색, (2) 소스 ↔ 스펙 라운드트립, (3) 규칙 발견성 — 을 얼마나 지원하는지 실측 기반으로 평가한다. 이 문서는 평가 보고서이며, 발견된 gap은 별도 작업으로 해소한다.

---

## §1 요약 (1줄 verdict)

| 시나리오 | 판정 | 요지 |
|---|---|---|
| Scenario 1 — 신규 contributor 탐색 | **Partial** | `context` / `list --domain-root` / `find-by-file`은 강력. 그러나 `topdown` / `children` / `--level=group` 경로가 **대부분 비어있어** entry-point 드릴다운이 단절된다. |
| Scenario 2 — Code→Spec 라운드트립 | **Partial** (2 / 3) | definition-service ✅, gate-service ✅. decode-service는 `@def.boundary`가 **deprecated 스펙**을 가리킴 (stale annotation). |
| Scenario 3 — Rule 발견성 | **Fail** | `*.rule.md` 8건은 좌표/ID만으로는 발견 불가. `aspect-evolution-index`가 유일한 entry hub이며 CLI 인덱스 없음. |

---

## §2 Scenario 1 — 신규 contributor 탐색

### 2.1 가설 워크플로우

"gate-service 일관성 체크를 개선하려면 어디서 시작해야 하는가?"

### 2.2 실측 명령 및 결과

```bash
# 1. 도메인 그룹 파악
$ qa-sdk def audit --by-domain | grep -i gate
[gate-system]  21건
[pipe-gate]  13건
[df-gate-integration]  1건
[df-narrative-proof-core-gates]  1건
[gate-cache-invalidation-test]  1건
[gate-consistency-test]  1건
…
```

→ 상위 루트로 `gate-system` 21건 즉시 식별. **성공**.

```bash
# 2. 루트 컨텍스트
$ qa-sdk def context gate-system
# 컨텍스트: Gate 시스템
svc: gate-service
도메인 루트: self
blast radius: 8건
- [depends_on] gate-consistency <def_document:v1:2217>
…
```

→ depends_on 8건 나열, `gate-consistency`가 이름만으로 타겟 후보로 특정됨. **성공**.

```bash
# 3. 일관성 스펙 드릴다운
$ qa-sdk def context gate-consistency
svc: gate-service  layer: operation
의존 대상: gate-system
영향 범위: gate-api, gate-consistency-test, gate-consistency-cases
```

→ 테스트 + cases 파일이 자동 보인다. **성공**.

```bash
# 4. 구현 위치
$ qa-sdk def body gate-consistency | sed -n '/consumes/,$p'
## ^consumes
- packages/gate-service/src/services/consistency.ts — createConsistencyService
- packages/gate-service/src/lib/gate-service.ts — GateLookupService
- index-meta — GateResult, AddressState
```

→ 4 step으로 스펙 + 테스트 + 구현 경로 모두 확보. **최적 경로 4 step**.

### 2.3 그러나 — 드릴다운 경로 단절

```bash
$ qa-sdk def topdown gate-system
# Gate 시스템
주소 공간의 물리적 유효성을 관리하여 …
(헤더만. 멤버 없음)

$ qa-sdk def children gate-system
[local] gate-system → 0 children

$ qa-sdk def topdown system-root
# QA-SDK 시스템
이벤트를 좌표로 인코딩하여, …
(멤버 없음)

$ qa-sdk def children system-infra
[local] system-infra → 0 children

$ qa-sdk def list --level group
[local] 1-0 / 0건

$ qa-sdk def guide
level: leaf(1241) module(1)
=== 영역 구조 ===     (비어있음)
```

**원인**: `system-root`, `system-infra`, `gate-system` 모두 멤버 관계가 `refs` 혹은 `depends_on`으로 선언되어 있다. `def topdown` / `def children`은 **`contains` 링크**만 따라가므로 제목+purpose 뒤에 멤버가 나오지 않는다. `def list --level group`도 0건으로, 데이터 상 1000건 중 group / module 레벨이 각각 0 / 1건 뿐이다 (`def stats`, `def guide`).

`def-topdown` 스킬 문서에는 `qa-sdk def topdown gate-system`이 예시로 박혀 있어, 실행하면 빈 응답을 받고 막힌다. 스킬 문서가 실제 데이터 상태를 반영하지 않는다.

**대안 경로** (실측 성공):

```bash
qa-sdk def audit --by-domain                     # 도메인 루트 발견
qa-sdk def list --domain-root gate-system        # 21건 listing
qa-sdk def context <docId>                       # 드릴다운
qa-sdk def body <docId>                          # 구현 경로
```

이 4-step이 실질적 workflow. `def-topdown` 스킬은 현재 스키마와 불일치.

### 2.4 점수

- 도메인 탐색 (by-domain + domain-root): **성공** — 신규 contributor가 4-step으로 gate 도메인 구조 파악 가능.
- 그룹 탐색 (topdown + children): **실패** — 빈 출력만 반복.
- Code 포인터 (body + find-by-file): **성공** — 스펙의 `^consumes` 섹션 + `find-by-file`로 양방향 확인.

---

## §3 Scenario 2 — Code→Spec 라운드트립 (3 샘플)

### 3.1 Sample 1 — `packages/definition-service/src/main.ts`

```
// @def.boundary definition-service-system
```

- DB 조회: `definition-service-system | approved` ✅
- `def context`: `svc: definition-service`, `scope: feature/func_def`, purpose 포함 ✅
- 역방향 (`def find-by-file`):
  ```
  authoritative boundary: definition-service-system <def_document:v2:68622>
  source-map support (2건):
    - definition-service <def_document:v1:6457>
    * definition-service-system <def_document:v2:68622>
  ```

→ **완전 왕복 성공**. annotation + frontmatter `source:` 기반 매핑 모두 존재.

### 3.2 Sample 2 — `packages/gate-service/src/server.ts`

```
// @def.boundary gate-system
```

- DB 조회: `gate-system | approved` ✅
- 스펙 내용: server/runtime 전체 gate lifecycle 기술 ✅
- 역방향: authoritative boundary = gate-system, source-map 1건 ✅

→ **완전 왕복 성공**.

### 3.3 Sample 3 — `packages/decode-service/src/server.ts`

```
// @def.boundary decode-service-spec
```

- DB 조회: `decode-service-spec | **deprecated**` ⚠️
- `def context decode-service-spec`:
  ```
  # 컨텍스트: Decode Service Spec (Deprecated)
  새 작업은 decode-service-system 참조.
  blast radius: 0건
  ```

→ annotation이 **deprecated 스펙**을 여전히 가리킴. 실제 권위 문서는 `decode-service-system`. `find-by-file`도 `decode-service-spec`을 authoritative boundary로 반환하므로 코드 주석만 바라보면 잘못된 문서로 유입된다.

**라운드트립은 기술적으로 작동** (코드→스펙→DB→다시 코드) 하지만 **시맨틱은 깨져있다**.

### 3.4 역방향 샘플 — Spec → Code

| 스펙 ID | `@def.boundary`로 역참조되는 파일 수 |
|---|---:|
| `apm-codegen-system` | **0** |
| `decode-api` | **0** |
| `registry-system` | 189 |

`apm-codegen-system` / `decode-api`는 approved 스펙이지만 어떤 소스 파일도 이를 boundary로 선언하지 않는다. 코드가 없는 것이 아니라, **annotation 누락 혹은 boundary가 하위 서브스펙에 분산**되어 있는 상황.

`registry-system`은 189건으로 과도하게 넓음 — 거의 모든 registry-service 소스가 단일 boundary로 귀속. 세부 subsystem ID (예: `registry-axes`, `registry-draft-workspace`)로 split 미진행.

### 3.5 전체 커버리지 (`def code-link-gaps`)

```
total: 1649 | linked: 1340 | unlinked: 309 | coverage: 81.3%
```

81.3%는 나쁘지 않으나 309건의 orphan code가 존재. 주요 orphan 패키지:
- `packages/bench/src/*` (11건) — 전량 orphan
- `packages/browser-codec/src/*` (4건)
- `packages/browser-sdk/src/*` (6건)
- `packages/codegen-core/src/*` (7건)
- `packages/convergence/src/*` (17건) — 전량 orphan

이들은 boundary가 **상위 스펙(예: bench-system, convergence-system)** 에만 있고 개별 파일 annotation이 없어, 소스→스펙 직접 조회가 불가능.

### 3.6 점수

- definition-service: **Pass**
- gate-service: **Pass**
- decode-service: **Partial** (라운드트립 작동하나 타겟이 deprecated)
- Spec→Code 역방향: **Partial** (핵심 스펙 일부는 0 파일로 연결됨)
- 전체 커버리지: **81.3%** — 합격선이지만 convergence / bench / browser-codec은 체계적 누락.

---

## §4 Scenario 3 — Rule 발견성

### 4.1 실측

```bash
$ ls docs/specs/system/*.rule.md
aspect-naming-convention.rule.md
cases-md-convention.rule.md
catalog-purity-bridge.rule.md
change-simulation-precedence.rule.md
facet-test-isolation.rule.md
link-type-usage.rule.md
test-md-convention.rule.md
validator-suppression-tags.rule.md
```

```bash
$ qa-sdk def list --aspect tech_constraint | head -5
address-separation-decision  constraint/tech_constraint  …
address-separation-group     constraint/tech_constraint  …
address-separation-rollout   constraint/tech_constraint  …
adr-merge-dedup              constraint/tech_constraint  …
```

90건 중 `aspect-naming-convention`은 스크롤해야 보이며, `rule.md`가 별도 문서 타입으로 분류되지 않는다 (`def list` 출력에는 type/확장자 구분 없음).

```bash
$ qa-sdk def context aspect-naming-convention
scope: constraint/tech_constraint  depth: specification
purpose: DEF_ASPECT 에 신규 aspect 값을 추가할 때의 네이밍/매핑 규율 …
blast radius: 1건
- [refs] aspect-evolution-index
```

→ 단건 조회는 명확하지만 **역방향 — "aspect를 추가하려면?"** 검색 경로가 없다. rule 인덱스 문서 없음.

```bash
$ qa-sdk def search "aspect 추가"
5건 반환:
- definition-gate-derivation    (aspect 매핑 규칙 언급)
- definition-addressing         (주소 체계, aspect와 무관)
- aspect-naming-convention      ← 정답
- aspect-schema-hierarchy-00-design
- domain-hierarchy-phase5-5-wave2
```

3번째 결과로 나옴. 정답은 있으나 첫 hit이 아니다.

### 4.2 entry hub 존재 여부

`docs/proposals/aspect-evolution-index.md`가 세션 산출물에 대한 유일한 index이며 8 rule 중 6개를 refs 링크로 묶는다. 다만:
- CLI로 이 index를 발견하려면 id `aspect-evolution-index`를 미리 알아야 한다.
- `def list --aspect proposal_design`으로 접근 가능하지만 이 좌표 자체가 rule 문서 전용이 아님.
- `docs/specs/system/`에는 index 문서 없음 (README 없음).

### 4.3 점수

- 좌표 기반 탐색: **실패** — `.rule.md` 확장자를 필터링하는 CLI 플래그 없음.
- Search 기반: **Partial** — 3번째 hit에서 발견.
- 진입 index: **존재하나 hidden** — `aspect-evolution-index`는 proposals 아래 있고 system 디렉토리에는 연결 없음.

---

## §5 발견된 gap (ranked)

| # | Gap | 심각도 | effort | 종류 |
|---|-----|:---:|:---:|:---:|
| 1 | `system-root` / `system-infra` / 도메인 루트에 **contains 링크 부재** → `def topdown` / `def children` / `def list --level=group` 모두 빈 결과. 스킬 예시가 작동하지 않음 | **High** | 3~5d | data (frontmatter 보강) |
| 2 | `decode-service/src/server.ts` @def.boundary → **deprecated 스펙** | **High** | 30m | data (annotation 교체) |
| 3 | `apm-codegen-system`, `decode-api` 등 핵심 스펙의 **역참조 0건** — subsystem별 `@def.boundary` 주석 미부여 | Med | 1~2d | data (주석 추가) |
| 4 | `registry-system` 단일 boundary 아래 189 파일 — 세부 서브시스템 boundary가 없어 해석 가치 감소 | Med | 2~3d | data (boundary split) |
| 5 | `*.rule.md` 전용 **인덱스/entry hub 부재** + CLI filter 부재 (예: `def list --type=rule`) | Med | 2h CLI + 1h 문서 | CLI + docs |
| 6 | `code-link-gaps` 309건 중 `convergence` (17) / `bench` (11) / `browser-codec` / `browser-sdk` 패키지 **전량 orphan** | Med | 1~2d | data |
| 7 | `def list --help` 출력이 비어있음 (`qa-sdk def list --help` → `qa-sdk def list`만 표시). flags 자가 문서화 부재 | Low | 1d | CLI |
| 8 | `def-topdown` SKILL.md가 현재 데이터(`contains` 부재)와 불일치 — 신규 contributor에게 잘못된 entry 예시 제공 | Low | 30m | docs |
| 9 | `def guide`의 "영역 구조" 섹션이 empty — `def children <area>`에 의존하나 자체가 0 children | Low | 좌표 데이터 gap 1 해소 시 자동 해결 | data |
| 10 | `def audit --by-domain` 524 루트 중 1~2건짜리 루트가 대량 (top-level 귀속 필요) | Low | 관찰 진행 중 | data |

---

## §6 권장 개선

### 6.1 즉시 (1주 이내)

1. **[Gap #2]** `packages/decode-service/src/server.ts` 의 `@def.boundary decode-service-spec` → `decode-service-system`으로 교체. 동시에 `decode-service-spec`을 DB에서 archive/tombstone. 30분 작업.
2. **[Gap #8]** `skills/def-topdown/SKILL.md` 현재 데이터 상태 반영: 예시를 `qa-sdk def list --domain-root <rootId>` 중심으로 재작성. 30분 작업.
3. **[Gap #7]** `def list` subcommand help 텍스트 주입 — `--tier/--scope/--aspect/--domain-root/--level/--include-children` flag 자가 설명.

### 6.2 중기 (2~4주)

4. **[Gap #1]** entry 문서들(`system-root`, `system-infra`, `system-support`, `gate-system`, `registry-system`, `ingest-system` 등)에 `contains` 링크 보강. 현재 `refs`로 선언된 멤버십을 `contains`로 전환하는 마이그레이션. 단, `contains` 시 validator의 multi-parent / depth 규칙 영향을 `def validate`로 재검증해야 함.
5. **[Gap #5]** `docs/specs/system/README.md` 생성 — 8 `*.rule.md` 인덱스 + CLI 플래그 `def list --type=rule` 추가.
6. **[Gap #3]** `apm-codegen-system`, `decode-api`를 boundary로 선언한 서브시스템 코드 파일 식별. 최소 entry 파일 5개씩이라도 annotation 추가.

### 6.3 장기 (1~3달)

7. **[Gap #4]** `registry-system`을 `registry-axes`, `registry-prefixes`, `registry-versions`, `registry-workspace`, `registry-catalog`, `registry-services` 등 subsystem boundary로 분할. `find-by-file`이 세밀한 컨텍스트를 반환하도록.
8. **[Gap #6]** `bench` / `convergence` / `browser-codec` / `browser-sdk` 4개 패키지 orphan 해소. Self-proof: spec 문서의 `^consumes` 섹션 최신화 → `def sync` → `find-by-file`로 검증.
9. `def find-by-file` 결과에 **boundary freshness 경고** 추가 — 참조된 스펙이 `deprecated` lifecycle이면 stderr로 경고.

---

## §7 참조

- [aspect-evolution-index](../../aspect-evolution-index.md) — 3-RFC 통합 인덱스
- [docs/skills/README.md](../../../skills/README.md) — skills navigation hub
- [skills/def-topdown/SKILL.md](../../../../skills/def-topdown/SKILL.md) — topdown 스킬 정의 (gap #8 대상)
- [skills/def-explore/SKILL.md](../../../../skills/def-explore/SKILL.md) — explore 스킬 정의
- 세션 명령 실적: `qa-sdk def audit --by-domain`, `def list --domain-root`, `def context`, `def find-by-file`, `def code-link-gaps`, `def guide`
