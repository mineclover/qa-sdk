---
def:
  id: domain-hierarchy-02-proposals-integration
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
role: integration
supersedes: -
superseded_by: -
---

# Proposals 디렉토리 — 문서 관리체계 편입

## 목적 ^purpose

`docs/proposals/` 는 현재 `def sync`에 편입되어 있으나 22개 제안 문서가 `tier:scope:layer:aspect = none:undefined:none:undefined`로 중복 좌표를 공유해 `duplicate-coordinate` 경고를 발생시킨다. Proposals를 **정식 관리체계 편입** 대상으로 다루되, 정규 스펙과 분리된 특성을 반영하는 규칙을 정립한다.

## 1. 현재 상태

### 1.1 편입 방식
`docs/proposals/README.md` 에 명시된 규칙:
- 모든 제안 문서는 `def:` frontmatter 사용
- `def sync` 그래프에 포함
- `type: knowledge` + `knowledge_kind: proposal`

### 1.2 문제점

| 문제 | 영향 |
|------|------|
| `scope`/`aspect` 누락 | 좌표 `none:undefined:none:undefined`로 22건 덩어리 중복 |
| 도메인 루트 부재 | 각 proposal 디렉토리가 하나의 domain이어야 하는데 링크 미구조 |
| 정규 spec에서 참조 불가 | `depends_on` 등 구조 링크 금지로 역방향 탐색 어려움 |

### 1.3 의도된 특성
- 정규 스펙과 물리적 격리 (재귀 오염 방지)
- 자유로운 탐색 surface
- `accepted` 전까지는 규칙 강제 완화

---

## 2. 설계 방향

### 2.1 Proposals도 도메인이다

각 `docs/proposals/<topic>/` 은 **하나의 도메인**이다. 도메인 루트는 해당 proposal의 `README.md` 또는 `00-design.md`. 내부 문서들은 이 루트에 `depends_on` 또는 `refines`로 연결된다.

예시:
```
tier-redesign/
├── README.md                    ← domain root
├── 00-design.md                 ← depends_on README (or self-root)
├── 01-migration.md              ← depends_on 00-design
├── 03-decisions.md              ← depends_on 00-design
├── mental-models.md             ← depends_on 00-design
├── phase-1a/                    ← sub-group
│   └── *.md                     ← depends_on phase-1a/README (or 01-migration)
├── reviews/                     ← sub-group
├── rules/                       ← sub-group
└── tiers/                       ← sub-group
```

### 2.2 좌표 체계 (명시 약속)

Proposal 문서에 **최소 좌표**를 요구:

```yaml
def:
  id: <proposal-topic>-<role>
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review | draft | accepted | implemented | superseded | rejected
  owner_system: definition-catalog    # 제안 자체의 관리 주체
  projection_plane: intent

  # 좌표 필수:
  scope: meta                         # 새 scope 값 — 메타 설계 제안
  aspect: proposal_design             # 새 aspect 값 — 제안 문서
  depth: overview | specification | validation   # role에 따라
  tier: layout | system | component    # 문서 역할에 따라 (선택)
```

**신규 어휘**:
- `scope: meta` — 메타 설계 제안 (기존 meta가 있으면 재사용)
- `aspect: proposal_design` — 제안 문서 classifier

이 둘은 `docs/specs/system/` 의 어휘집에 추가 필요.

### 2.3 도메인 계층

Proposal 문서의 tier 매핑 제안:

| 역할 | tier | 설명 |
|------|------|------|
| `README.md` | layout | 제안 전체 조망 + refs로 내부 문서 연결 |
| `00-design.md`, `01-migration.md` 등 | system | 핵심 설계/계획 문서 |
| `mental-models.md`, guides | component | 데이터 형태/개념 참조 |
| `phase-1a/*.md`, `reviews/*.md` | system (서브) | `depends_on` 해당 phase 루트 |
| `examples/*.md` | component | 실증 예시 |

### 2.4 링크 정책

현 규칙 "정규 docs에서 proposals를 prose 링크만 사용" 유지하되:
- Proposal 내부 문서끼리는 **`depends_on` / `refines` 허용** (도메인 구조를 표현)
- Proposal → 정규 spec 참조도 **prose 링크**로 유지 (비대칭)
- 정규 spec → proposal 참조는 **prose 링크만** (기존 규칙 유지 — 규칙의 재귀 오염 방지)

---

## 3. 마이그레이션

### 3.1 스키마 확장

1. `docs/specs/system/` 어휘집 (scope/aspect 정의 문서) 에 `meta` / `proposal_design` 추가
2. `frontmatter.ts` 의 `VALID_SCOPES`, `VALID_ASPECTS` 상수 업데이트
3. `packages/definition-catalog` 재빌드

### 3.2 기존 proposal 업데이트 (tier-redesign 22건)

각 파일 frontmatter에 `scope`, `aspect`, (선택) `tier`, `depth` 추가:

```yaml
# before (현재)
def:
  id: tier-redesign-00-design
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent

# after
def:
  id: tier-redesign-00-design
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  depth: overview
  tier: system                    # design doc는 system
  links:
    - target: tier-redesign-readme
      type: depends_on             # 도메인 루트 연결
```

### 3.3 domain_hierarchy 제안 자체 업데이트

본 proposal 의 3개 문서도 동일 규칙 적용:
- `README.md` → tier: layout, refs 내부 문서
- `00-design.md`, `01-migration.md`, `02-proposals-integration.md` → tier: system, depends_on README

### 3.4 `_template/` 업데이트

`docs/proposals/_template/00-design.md` 등에 scope/aspect 기본값 포함시켜 신규 proposal이 처음부터 규격 맞게 작성되도록.

### 3.5 README 규칙 업데이트

`docs/proposals/README.md` § "규칙" 섹션에 추가:
- Proposal 문서는 `scope: meta`, `aspect: proposal_design` 기본 사용
- Proposal 내부는 `depends_on`/`refines` 링크 허용 (도메인 구조 표현)
- Proposal → spec: prose 링크만
- spec → proposal: prose 링크만

---

## 4. 검증

### 4.1 성공 기준

- `duplicate-coordinate` 경고에서 `none:undefined:none:undefined` 22건 소거
- `scope: meta` + `aspect: proposal_design`로 재분류되어, 각 proposal 디렉토리의 domain_root가 해당 proposal의 README로 파생됨
- `def list --scope meta` 로 모든 proposal 문서 조회 가능
- `def list --domain-root tier-redesign-readme` 로 특정 proposal 전체 조회 가능

### 4.2 Side effect 검증

- 정규 spec의 `depends_on`/`contains` 그래프에는 변화 없음
- `pnpm exec qa-sdk def validate` 에서 기존 에러/경고 수 변동 없음 (새 경고만 감소)
- 기존 proposal README의 "prose 링크만" 원칙 여전히 유효

---

## 5. 미결 사항

- [ ] `meta` scope이 기존에 존재하는지 확인 (없으면 신규)
- [ ] 각 proposal 내부의 `depends_on` 허용이 `_template/` 문서 가이드와 충돌하지 않는지
- [ ] Phase 3 마이그레이션 이후 archive 디렉토리 문서도 같은 규칙 적용할지 (accepted/implemented/rejected 상태에 따라)
- [ ] `lifecycle: review | draft | accepted | …` vs. def 기본 lifecycle (`draft | approved | deprecated`) 의 매핑 규칙

---

## 6. 구현 순서

domain-hierarchy 전체 계획에서의 위치:

```
Phase 0 (투자 판단) ─┬─> Phase 1 (파생 로직)
                    │
                    └─> 본 문서 (proposals integration)
                         └─> 22개 proposal 문서 업데이트
                              └─> Phase 2 validator 통합 시 함께 검증
```

즉 Phase 1과 병행 가능하며, Phase 2 직전 완료 권장 (validator가 새 scope/aspect 포함한 상태에서 전수 검증).

## 다음 읽기

- [00-design.md](./00-design.md) — 설계 개요
- [01-migration.md](./01-migration.md) — Phase 0~6 마이그레이션
- [../README.md](../README.md) — proposals 전체 규칙
