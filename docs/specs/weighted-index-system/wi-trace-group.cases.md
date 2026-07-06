---
def:
  id: wi-trace-group-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [scenario, weighted-index, trace]
  links:
    - target: wi-trace-group
      type: refines
    - target: wi-system
      type: depends_on
sources:
  - packages/weighted-index/src/vocab/label-registry.ts
  - packages/weighted-index/src/vocab/label-registry.test.ts
  - packages/weighted-index/src/vocab/prefix-registry.ts
  - packages/weighted-index/src/vocab/prefix-registry.test.ts
  - packages/weighted-index/src/vocab/partial-binder.ts
  - packages/weighted-index/src/vocab/partial-binder.test.ts
---

# WI Trace 그룹 — 소비자 기대 시나리오

## 목적 ^purpose

`wi-trace-group`(추적성 3축, 변경 유형별 전파, 수정 프로토콜)이 `wi-system`에 의존할 때 기대하는 계약. trace 그룹은 wi-system 이 제공하는 버전 고정(version id), constraint(wi-constraint), pack-format 의 shape/capacity 규칙 위에서만 변경 추적을 결정론적으로 수행한다.

## 시나리오 1: 주소 항등성 보존 (버전 격리) ^overview

**전제**: `wi-system`이 `wi-api`의 PrefixCodec 으로 `prefix:version:address` 형식 semantic address 직렬화를 제공.

**동작**: version v1 에서 encode 된 주소가 v2 capacity 변경 후에도 v1 디코드 경로로 복원.

**기대**:
- v1 주소는 v1 codec 으로만 decode (cross-version 금지)
- 버전 전환 시 `MigrateAddress` 가 명시적 변환 수행
- version id 가 주소 prefix 에 포함되어 구분 가능

**실패 시 수정 대상**: `wi-system.md`의 `wi-api` / `wi-codec` — 버전 격리 규칙이 spec 에 없으면 trace 가 cross-version decode 를 시도하여 silent drift.

## 시나리오 2: 변경 유형 분류 (additive/reductive/structural) ^overview

**전제**: `wi-trace-propagation`이 변경 유형별 전파 경로를 3종(additive/reductive/structural)으로 분류.

**동작**: catalog 에 axis entry 추가 (additive) vs entry 제거 (reductive) vs axis 자체 재정의 (structural).

**기대**:
- additive → 기존 주소 불변 + 새 entry 에 신규 bit 할당
- reductive → tombstone 으로 유지 (bit 재사용 금지)
- structural → 새 version id 필수, migration plan 강제

**실패 시 수정 대상**: `wi-system.md`의 `wi-trace-axes` — 변경 유형 분류가 spec 에 없으면 consumer 가 reductive 를 additive 처럼 처리하여 기존 주소 decode 결과가 바뀜.

## 시나리오 3: 3-tier 핀 구조 (stride/capacity/shape) ^overview

**전제**: `wi-trace-axes`가 stride/capacity/shape 3-tier 핀 구조로 변경 감지 경계를 제공.

**동작**: catalog 변경 시 gate check 가 어느 tier 에서 차이를 감지했는지 리포트.

**기대**:
- stride 변경만 → 주소 공간에 무의미(feedback 규약), warning 없이 allow
- capacity 변경 → headroom 재평가, headroom 0 시 critical
- shape 변경 → 버전 bump 강제, 자동 승인 금지

**실패 시 수정 대상**: `wi-system.md` §"wi-trace-axes" — stride/capacity/shape 경계가 모호하면 변경이 불필요한 migration 을 트리거하거나 실제 breaking change 를 놓침.

## 시나리오 4: 수정 프로토콜 승인 체크포인트 ^overview

**전제**: `wi-trace-protocol`이 producer/consumer/auditor 3 역할별 수정 프로토콜을 정의.

**동작**: producer 가 shape 변경 PR 제출 → consumer review → auditor 승인 경로.

**기대**:
- 역할별 approval 없이 structural 변경 병합 불가
- prodcuer 제안 단계에서 wi-capacity-planning 결과 첨부 강제
- auditor 가 CON-007(totalSpace > 2^53 → safePrecision=false) 위반 여부 확인

**실패 시 수정 대상**: `wi-system.md`의 `wi-constraint` + `wi-trace-protocol` — 승인 체크포인트가 없으면 shape 변경이 auditor 감수 없이 병합되어 BigInt precision 사고 가능.
