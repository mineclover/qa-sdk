---
def:
  id: domain-hierarchy-01-migration
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: specification
  links:
    - target: domain-hierarchy-readme
      type: depends_on
status: under-review
date: 2026-04-20
part_of: domain-hierarchy
role: migration
supersedes: -
superseded_by: -
---

# Domain Hierarchy — 마이그레이션 계획

## 목적 ^purpose

[00-design.md](./00-design.md)의 `domain_root` 파생 로직을 실행하기 위한 단계별 계획. 파급 최소화 + 실증 의무 준수.

## 원칙

- 스키마 변경 없음 (기존 링크 그래프만 활용)
- validator는 점진 도입 (warning → 추가 경고 → threshold 조정)
- 각 Phase마다 측정 가능한 성공 기준 명시
- Rollback 가능: Phase N이 실패하면 validator 변경만 되돌리면 됨

---

## Phase 0 — 투자 판단 (0.5일)

### 목표 ^phase-0-goal
실제로 `domain_root` 파생이 중복 좌표를 줄이는지 시뮬레이션으로 검증.

### 작업 ^phase-0-work
1. Ad-hoc 스크립트로 현 DB의 모든 `tier: system` 문서에 대해 파생 시뮬레이션
2. `(tier, scope, layer, aspect, domain_root)` 키로 중복 재집계
3. 줄어드는 중복 수 측정

### 성공 기준 ^phase-0-success
- 현재 30건 중 ≥ 15건이 domain_root로 구별됨 → Phase 1 진행
- < 15건만 구별됨 → 파생 규칙 재검토 또는 대안 제안

### 산출물
`/tmp/domain-root-simulation.md` 또는 본 proposal 디렉토리에 `reviews/2026-04-XX-phase0-simulation.md`

---

## Phase 1 — 파생 로직 구현 (1일)

### 목표 ^phase-1-goal
`deriveDomainRoot()` 함수와 주변 유틸을 `definition-catalog` 패키지에 추가.

### 작업 ^phase-1-work
1. `packages/definition-catalog/src/domain-root.ts` 신규 파일
   - `deriveDomainRoot(doc, registry): string`
   - `deriveAllDomainRoots(registry): Map<docId, domainRootId>`
   - `isDomainTier(doc): boolean`
   - `selectPrimaryParent(candidates, registry): Link`
2. Unit test: `packages/definition-catalog/src/domain-root.test.ts`
   - self-root 케이스
   - 단일 부모 체인
   - 다중 부모 선택 (priority, fallback)
   - 순환 참조 방어
3. Export from `src/index.ts`

### 성공 기준 ^phase-1-success
- 테스트 커버리지 ≥ 80%
- 1,119건 DB에 대해 전수 파생 실행 시간 < 500ms

### 리스크 ^phase-1-risks
- `selectPrimaryParent` 규칙이 실제 데이터에서 비결정적이면 재현 불가 → 테스트 고정 필요

---

## Phase 2 — validator 통합 (1일)

### 목표 ^phase-2-goal
`validate.ts`의 duplicate-coordinate 체크를 `domain_root` 포함 키로 전환.

### 작업 ^phase-2-work
1. `validateGraph()`에서 모든 entry에 대해 `deriveDomainRoot` 미리 계산 (맵으로 캐시)
2. duplicate-coordinate 키를 `tier:scope:layer:aspect:domain_root`로 확장
3. 메시지에 domain_root 표시
   ```
   중복 좌표 (…) + 도메인 루트 apm-system: [apm-schema-system, apm-dsl-spec]
   ```
4. 신규 경고 `multi-domain` 추가 (선택 — P2 후반)
5. `def audit`에 `--by-domain` 리포트 추가

### 성공 기준 ^phase-2-success
- `pnpm exec qa-sdk def validate`로 `duplicate-coordinate` 경고 수 측정
- 목표: 30 → ≤ 15 (Phase 3 실행 전, 링크 미보완 상태)

### 빌드 순서
```bash
pnpm --filter definition-catalog build
pnpm --filter definition-data-source build
pnpm --filter @qa-sdk/cli build
```

---

## Phase 3 — 소속 관계 보완 (2~3일)

### 목표 ^phase-3-goal
`missing-domain-root` 후보 시스템들에 부모 링크 추가. 링크 그래프가 진짜 도메인 구조를 반영하도록 보정.

### 작업 ^phase-3-work

#### 3.1 후보 리스트 생성
```bash
qa-sdk def audit --missing-domain-root > /tmp/missing-roots.txt
```

출력 형식:
```
apm-codegen-system: 부모 없음. id 접두사 "apm-" → 후보 부모 apm-system
apm-runtime-system: 부모 없음. id 접두사 "apm-" → 후보 부모 apm-system
df-analysis-group: 부모 없음. id 접두사 "df-" → 후보 부모 df-system
…
```

#### 3.2 자동 제안 생성
각 후보에 대해 frontmatter patch 제안:
```yaml
# apm-codegen-system.spec.md
links:
  - target: apm-system
    type: depends_on      # ← 신규
```

#### 3.3 수동 검토
일괄 적용 전 사람이 검토:
- 정말 부모가 맞는지
- `depends_on` vs `refines` 어느 쪽이 의미론적으로 맞는지
- 다중 후보 부모면 어느 쪽이 주 도메인인지

#### 3.4 커밋 단위
도메인별 점진 적용:
- `fix(def): apm 서브시스템 도메인 루트 연결`
- `fix(def): df 서브시스템 도메인 루트 연결`
- `fix(def): wi/cq 서브시스템 도메인 루트 연결`

### 성공 기준 ^phase-3-success
- `missing-domain-root` 경고 0건
- `duplicate-coordinate` 30 → ≤ 8건
- 각 도메인의 계층 구조가 `def-topdown`으로 드릴다운 가능

### 리스크 ^phase-3-risks
- 후보 자동 추론이 틀린 경우 (접두사만으로 판단하면 오류 가능)
- 도메인 루트 자체가 모호한 경우 (예: scope-nesting-system은 APM인가 coord system인가?)

---

## Phase 4 — 도메인 루트 layout 정비 (1~2일)

### 목표 ^phase-4-goal
모든 도메인 루트가 최상위 layout에서 `refs`로 참조되도록 보강. orphan 해소와 동시 진행.

### 작업 ^phase-4-work
1. `system-root-layout.md` (또는 유사 루트 layout) 식별/생성
2. 각 도메인 루트(`apm-system`, `df-system`, `wi-system`, `gate-system`, …)를 `refs`로 등록
3. 기존 layout(`system-infra`, `system-libraries`, …)과 교차 정렬
4. 필요시 도메인별 중간 layout 생성:
   - `apm-domain-layout.md`: refs = apm 관련 시스템 전부
   - `df-domain-layout.md`: refs = df 관련 시스템 전부
   - …

### 성공 기준 ^phase-4-success
- `orphan` 경고 중 `*-system`, `*-system-root` 패턴 0건
- 루트 layout에서 `def topdown`으로 모든 도메인 도달 가능

---

## Phase 5 — 내용 중복 제거 (1~2일, 병행)

### 목표 ^phase-5-goal
Phase 2 후 "같은 domain_root + 같은 좌표"로 남은 5~8건의 진짜 중복 후보를 사람 리뷰 후 정리.

### 작업 ^phase-5-work

#### 5.1 후보 페어 추출
`duplicate-coordinate` 경고에 남은 쌍들.

예상 후보:
- `decode-api` vs `decode-service-spec` (같은 decode 도메인, 같은 API 좌표)
- `decode-service-spec` vs `decode-system` (같은 decode 도메인)
- `motion-workspace-service` vs `motion-workspace-system`

#### 5.2 쌍별 판정
각 쌍에 대해:
1. `def context <id>` + `def context <peer>`로 두 문서 본문 비교
2. 판정:
   - **완전 중복**: 하위 lifecycle=deprecated, 상위에 body merge
   - **추상화 차이**: 상위를 `tier: layout` 또는 `refines` 관계로 정리
   - **다른 관점** (API 계약 vs 구현): `traces_to`로 관계 명시
3. 커밋 단위: `refactor(def): decode 도메인 중복 정리`

#### 5.3 성공 기준
- `duplicate-coordinate` 경고 0건 또는 의도된 의미 공유만 남음 (cross-domain 태그 부여)
- 문서 수 감소 but 정보 손실 없음 (merge 시 본문 보존)

---

## Phase 5.5 — 기대 시나리오 커버리지 (2~3일)

### 목표 ^phase-5-5-goal
`depends_on` 링크마다 기대 시나리오를 명세화하여 **의존성 계약 품질**을 측정 가능하게 만든다. 00-design §2.5 정책의 실행 단계.

### 작업 ^phase-5-5-work

#### 5.5.1 의존 링크 인벤토리
```bash
qa-sdk def audit --coverage > /tmp/dep-coverage.txt
```

출력 예상:
```
apm-schema-system depends_on apm-system
  - 시나리오 문서: 없음 ❌
  - 권장: apm-system.test.md 또는 apm-schema-system.cases.md

decode-service-spec depends_on registry-service
  - 시나리오 문서: decode-service-spec.cases.md ✓
  - 커버 시나리오: 3건
  - 검증: decode-service-spec.test.ts (5/5 pass)
```

#### 5.5.2 시나리오 문서 생성 우선순위
- `lifecycle: approved` + 핵심 도메인 의존 → 최우선 (예상 ~30건)
- `lifecycle: approved` + 주변 도메인 의존 → 2순위
- `lifecycle: draft` → 선택 (본 단계 생략 가능)

#### 5.5.3 생성 규칙
각 우선 의존성에 대해:

**공급자 소유 .test.md**: 공급 시스템이 자체 보장하는 시나리오. 여러 소비자 공통.
```yaml
# apm-system.test.md
def:
  id: apm-system-test
  type: spec
  tier: system
  owner_system: apm-system
  links:
    - target: apm-system
      type: verifies
```

**소비자 소유 .cases.md**: 특정 소비자의 요구 (consumer-driven).
```yaml
# decode-service-spec.cases.md
def:
  id: decode-service-spec-cases
  type: spec
  tier: system
  owner_system: decode-service
  links:
    - target: registry-service
      type: depends_on
    - target: decode-service-spec
      type: traces_to
```

#### 5.5.4 기존 `.test.md` 감사
이미 존재하는 테스트 문서를 먼저 활용. 미연결된 기존 테스트 문서가 있으면 `verifies` 링크 추가.

### 성공 기준 ^phase-5-5-success
- `def audit --coverage` 에서 `approved + 핵심 도메인` 범위의 의존성 시나리오 커버리지 ≥ 80%
- `dependency-without-scenario` 경고 ≤ 20건 (나머지는 draft 또는 의도된 생략)

### 리스크 ^phase-5-5-risks
- 시나리오 정의가 단순한 "API doc 복붙"으로 전락 → 의미 없음
- 대응: 리뷰 단계에서 "이 시나리오가 실패하면 구현 어디를 고쳐야 하는가?" 질문이 명확히 답 가능한지 체크

---

## Phase 6 — CLI/skills 확장 (1일)

### 목표 ^phase-6-goal
`domain_root` 기반 탐색을 일상 워크플로우로 통합.

### 작업 ^phase-6-work
1. `qa-sdk def list --domain-root <id>` 구현
2. `qa-sdk def context <id>`에 "도메인 루트: apm-system" 표시
3. `def-topdown` skill에 `--from-domain-root` 인자 추가
4. `def-explore` skill에 도메인 필터 가이드 추가
5. `def-audit` skill에 `by-domain` 섹션 언급

### 성공 기준 ^phase-6-success
- 새 도메인에서 작업 시 `def list --domain-root <domain>`로 한 번에 탐색 가능
- skills 문서에 domain_root 사용법 명시

---

## 전체 일정 요약

| Phase | 기간 | 리스크 | 롤백 난이도 |
|-------|------|--------|-------------|
| 0 — 투자 판단 | 0.5일 | 낮음 | N/A (투자 결정) |
| 1 — 파생 로직 | 1일 | 낮음 | 패키지 버전 복원 |
| 2 — validator 통합 | 1일 | 낮음 | validator 이전 커밋 revert |
| 3 — 의존 관계 보완 | 2~3일 | 중간 (링크 추가 오류) | 커밋별 revert |
| 4 — layout 정비 | 1~2일 | 낮음 | layout 파일 revert |
| 5 — 내용 중복 제거 | 1~2일 | 높음 (사람 판단 필수) | 문서 복원 (git) |
| 5.5 — 기대 시나리오 커버리지 | 2~3일 | 중간 (시나리오 품질) | 시나리오 문서 revert |
| 6 — CLI/skills | 1일 | 낮음 | CLI 버전 복원 |
| **총계** | **8~13일** | — | — |

**Phase 5.5는 Phase 4 이후 독립 진행 가능**. 의존성 보완이 끝난 시점부터 시나리오 정의 작업 착수 — Phase 5(내용 중복 제거)와 병행 가능.

---

## 실증 의무 (Empirical Validation)

Phase 3 중 실제 도메인 1개를 **섀도우 리팩토링**하여 실효성 검증:
- 후보: `apm-*` 시스템군 (APM 도메인 전체)
- 검증 항목:
  - 링크 보완 후 `domain_root` 파생이 `apm-system`을 정확히 반환하는지
  - `duplicate-coordinate` 경고가 APM 도메인 내에서 해소되는지
  - `def list --domain-root apm-system` 출력이 관찰 대상 전체를 포함하는지
- 실패 시 → 파생 규칙 또는 부모 선택 규칙 수정 후 재시도

---

## 오픈 이슈 트래킹

[00-design.md § 5 미결 사항](./00-design.md) 참조. Phase별로 대응.

## 다음 읽기

- [02-proposals-integration.md](./02-proposals-integration.md) — proposals 문서 관리체계 편입
- [00-design.md](./00-design.md) — 설계 개요
