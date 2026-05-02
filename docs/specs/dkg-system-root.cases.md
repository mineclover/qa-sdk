---
def:
  id: dkg-system-root-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: dkg
  tags: [scenario, dkg, integration]
  links:
    - target: dkg-system-root
      type: refines
    - target: dkg-system
      type: depends_on
---

# DKG System Root — 소비자 기대 시나리오

## 목적 ^purpose

`dkg-system-root`(DKG umbrella entry) 가 `dkg-system`에 의존할 때 기대하는 통합 계약. root 는 상태 저장(State Store), 노드/엣지 정의, 성장 나선(Spiral Growth) 프로세스를 조합하여 "설계 시점 메타데이터 그래프" 를 단일 진입점으로 관장한다.

## 시나리오 1: State Store 영속과 in-memory 재조합 ^overview

**전제**: `dkg-system`의 `dkg-state-store`가 로컬 SQLite 기반 상태를 선언하고, usage/version/meta 테이블 구조를 고정.

**동작**: CLI 세션이 dkg-system-root 를 entry 로 참조해 `usage` 이벤트 기록 후 재시작, meta 를 다시 로드.

**기대**:
- 세션 종료 후 usage/version/meta 가 SQLite 에 flush 되어 다음 세션에서 복구
- in-memory 그래프가 meta 테이블 스냅샷으로 재구성 (결정론적)
- root 는 state-store 구현체(SQLite)를 교체하더라도 entry 인터페이스 고정

**실패 시 수정 대상**: `dkg-system.md`의 `dkg-state-store` — 영속 테이블의 schema 가 root 진입 시 보장되지 않으면 재시작 후 이전 세션의 성장 나선 기록이 소실.

## 시나리오 2: 16 노드 × 18 엣지 타입 스키마 일관성 ^overview

**전제**: `dkg-system`의 `dkg-node-types`(16종) 와 `dkg-edge-types`(18종) 가 그래프 구성 요소의 discriminated union 으로 선언됨.

**동작**: 외부 도구(skill, viz, definition-catalog)가 root 를 entry 로 그래프를 읽어 노드/엣지를 열거.

**기대**:
- 정의되지 않은 노드/엣지 타입 주입 → validate 단계에서 reject
- 노드 타입 추가 → 관련 skill/viz 가 unknown 타입을 graceful 하게 skip (forward-compatible)
- root 가 현재 스키마 버전을 metadata 로 노출 (skill 이 호환성 체크 가능)

**실패 시 수정 대상**: `dkg-system.md`의 `dkg-node-types` / `dkg-edge-types` 목록 — discriminated union 이 닫힌 집합으로 선언되지 않으면 외부 도구가 알 수 없는 타입을 생성하여 그래프 오염.

## 시나리오 3: 7 CON 제약(dkg-constraint) 런타임 위반 감지 ^overview

**전제**: `dkg-system`의 `dkg-constraint` 가 CON-001~CON-007 7종 구조적 불변 조건을 선언.

**동작**: root 를 통과한 신규 이벤트(prefix 추가, role 등록 등)가 constraint 검증 파이프라인을 경유.

**기대**:
- CON 위반 이벤트는 graph ingest 전에 차단 (예: CON-001 rbac_role ↔ role 동시 사용)
- CON-006 (prefix_ref refEntries 필수) 미충족 → GateEngine 이 reserved 처리
- 위반 건수 카운트가 audit 리포트에 기록 (skill 이 주기적으로 확인)

**실패 시 수정 대상**: `dkg-system.md`의 `dkg-constraint` — CON 목록이 enum 으로 선언되지 않으면 root 가 위반을 식별할 수 없음.

## 시나리오 4: 성장 나선(Spiral Growth) 의 회전 경계 ^overview

**전제**: `dkg-system`의 `dkg-growth-spiral`이 "고정 축 정의 → 운용 → 새 기능 발견 → 새 고정 축" 순환 모델을 선언.

**동작**: 한 회전에서 운용 이벤트가 기록되고 새 prefix 후보가 제안됨.

**기대**:
- 회전마다 "왜 닫았는가" 가 구조적으로 보존 (dkg-queries 에서 역추적 가능)
- 성장 나선 회전이 idempotent (같은 이벤트 재처리해도 이중 등록 없음)
- 완료된 회전은 immutable (이전 고정 축의 의미 변경 금지)

**실패 시 수정 대상**: `dkg-system.md`의 `dkg-growth-spiral` — 회전의 경계(완료 기준) 가 명시되지 않으면 root 가 현재 회전이 끝났는지 판정 불가.
