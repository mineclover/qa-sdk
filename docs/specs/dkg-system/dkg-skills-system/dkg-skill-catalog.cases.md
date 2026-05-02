---
def:
  id: dkg-skill-catalog-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [scenario, dkg, skill-catalog]
  links:
    - target: dkg-skill-catalog
      type: refines
    - target: dkg-system
      type: depends_on
---

# DKG Skill 카탈로그 — 소비자 기대 시나리오

## 목적 ^purpose

`dkg-skill-catalog`(SkillNode 등록/조회/실행, targetKinds, specialization, category)이 `dkg-system`에 의존할 때 기대하는 계약. skill catalog 는 dkg-system 이 제공하는 node types(16종), edge types(18종), constraint(CON-001~007), skill registry 위에서 동작한다.

## 시나리오 1: targetKinds 기반 skill 분기 ^overview

**전제**: `dkg-system`의 `dkg-node-types`가 16종 노드 타입을 고정한다.

**동작**: skill 등록 시 `targetKinds: ["prefix", "version"]` 을 선언하고, 실행 시 catalog 가 입력 노드 종류에 맞는 skill 을 선택.

**기대**:
- 등록된 targetKinds 외 노드 입력 → skill 실행 스킵 + warning
- 한 skill 이 여러 targetKinds 선언 가능, 순서 보존
- 노드 타입이 신규 추가되면 catalog 의 validator 가 unknown targetKind 에러

**실패 시 수정 대상**: `dkg-system.md`의 `dkg-node-types` — 16종 고정 선언이 명시적이어야 skill 이 unknown kind 에 대해 임의 기본 동작을 하지 않음.

## 시나리오 2: specialization 우선순위 해소 ^overview

**전제**: `dkg-system`이 SkillNode specialization 메커니즘(공통 skill + 특화 skill 계층)을 제공.

**동작**: 같은 targetKind 에 대해 generic skill A 와 specialized skill B(+ specialization 태그)가 있을 때 catalog 가 B 우선 선택.

**기대**:
- specialization 태그 매칭 시 B 선택
- 매칭 실패 시 A fallback
- 양쪽 없으면 skill 없음 + catalog 가 explicit "no skill found" 반환 (silent pass 금지)

**실패 시 수정 대상**: `dkg-system.md`의 skill 설계 — specialization 해소 우선순위 규칙이 spec 에 없으면 skill 충돌 시 선택이 등록 순서에 의존.

## 시나리오 3: category 기반 읽기/쓰기 분리 ^overview

**전제**: `dkg-system`이 skill category 를 read/write/analysis/chain 4종으로 분류.

**동작**: CI 에서 read-only 모드로 catalog.run() 호출.

**기대**:
- read / analysis category 만 실행, write / chain 은 차단
- 차단된 skill 은 명시적 "blocked by mode" 응답 (silent skip 금지)
- chain 은 내부에 write 포함 가능하므로 read-only 모드에서 전체 차단

**실패 시 수정 대상**: `dkg-system.md`의 category 정의 — 4종 경계가 명문화되지 않으면 chain skill 의 권한 평가가 catalog 마다 다름.

## 시나리오 4: CON 제약 skill 실행 차단 ^overview

**전제**: `dkg-system`의 `dkg-constraint`가 CON-001~007 을 선언 (CON-004: classificationRate ≥ 80% 등).

**동작**: CON-001 위반(rbac_role + role 동시 사용) 가 검출된 상태에서 write skill 실행 시도.

**기대**:
- skill 실행 전 constraint check → 위반 시 reject
- CON-005 (critical anomaly → auto observation) 는 write 가 아닌 자동 트리거
- constraint 실패 로그에 어느 CON 번호 위반인지 포함

**실패 시 수정 대상**: `dkg-system.md`의 `dkg-constraint` — constraint enforcement 시점(write 전 check vs runtime detect)이 애매하면 위반 이벤트가 후향적으로만 감지.
