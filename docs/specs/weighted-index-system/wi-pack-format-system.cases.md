---
def:
  id: wi-pack-format-system-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [scenario, weighted-index, pack-format]
  links:
    - target: wi-pack-format-system
      type: refines
    - target: wi-system
      type: depends_on
sources:
  - packages/weighted-index/src/protocol/pack-format.ts
  - packages/weighted-index/src/protocol/pack-format.test.ts
  - packages/weighted-index/src/protocol/capacity-planner.ts
  - packages/weighted-index/src/protocol/capacity-planner.test.ts
  - packages/weighted-index/src/protocol/semantic-address.ts
  - packages/weighted-index/src/protocol/semantic-address.test.ts
---

# WI Pack Format 그룹 — 소비자 기대 시나리오

## 목적 ^purpose

`wi-pack-format-system`(PackFormat 정의, 레지스트리, hex 연산, capacity 계획, SemanticAddress, layout 프로토콜)이 `wi-system`에 의존할 때 기대하는 계약. pack-format 은 wi-system 이 제공하는 mixed-radix math(wi-math), codec 표면(wi-api, wi-codec), constraint(wi-constraint) 위에서만 이진 포맷 직렬화가 결정론적.

## 시나리오 1: PackFormat round-trip 결정성 ^overview

**전제**: `wi-system`의 `wi-math`가 mixed-radix 좌표 인코딩 규약을 고정.

**동작**: shape + layout → encode(pack) → decode(unpack) 왕복.

**기대**:
- 왕복이 identity (같은 입력 → 같은 출력)
- 같은 shape → 같은 pack bits 순서
- shape headroom ≤ 1 → warning, 0 → critical (좌표 컨벤션 준수)

**실패 시 수정 대상**: `wi-system.md`의 `wi-math` — encode/decode 규약이 변경되면 pack-format 의 기존 데이터가 무효화. migration 경로 명시 필요.

## 시나리오 2: PackFormatRegistry 등록 + 충돌 ^overview

**전제**: `wi-system`의 pack-format 이 "수평 확장 레지스트리" 라고 선언.

**동작**: 신규 PackFormat (`uuid-v7-extended`) 등록 시도.

**기대**:
- 이름 중복 → 409 Conflict (silent overwrite 금지)
- 레지스트리 변경 후 기존 pack 데이터 decode 가능 (하위 호환)
- 삭제 불가 (tombstone 만 허용)

**실패 시 수정 대상**: `wi-system.md`의 pack-format 레지스트리 — 수평 확장 정책이 삭제 허용이라면 기존 snapshot decode 실패 risk 고지 필요.

## 시나리오 3: hex 경계 연산 정확도 ^overview

**전제**: `wi-system`의 `wi-api` 가 `PrefixCodec` 을 통해 semantic address 직렬화를 제공.

**동작**: hexBoundary / hexCeil / hexFloor 로 hex 자릿수 경계 계산.

**기대**:
- `hexCeil(n)` = 다음 hex 자릿수의 최솟값 (n <= result)
- `hexFloor(n)` = 이전 hex 자릿수의 최댓값 (n >= result)
- BigInt 영역(> MAX_SAFE_INTEGER) 은 `MetaCodecBig` 경로로 위임, 결과 string 반환

**실패 시 수정 대상**: `wi-system.md`의 `wi-api` — BigInt 분기 규칙이 wi-system 에 명시되지 않으면 pack-format 이 Number 로만 처리하여 capacity overflow.

## 시나리오 4: SemanticAddress layout 프로토콜 선택 ^overview

**전제**: `wi-system`이 SemanticAddress → UUID/hex 컨테이너 packing 을 layout 프로토콜 팩토리로 제공.

**동작**: capacity 요건에 따라 layout 선택 (UUID 128bit vs hex-custom).

**기대**:
- `fitLayout(shape, layout)` 가 shape 용량이 layout 에 들어가는지 판정
- 용량 초과 시 candidate layout 추천 (planCapacity)
- 레이아웃 전환은 migration plan 과 함께만 (in-place 변경 금지)

**실패 시 수정 대상**: `wi-system.md`의 `partial-binder-spec` / `wi-pack-format-def` — layout 전환 정책이 명문화되지 않으면 pack-format 소비자가 runtime 에 layout 변경을 시도해 decode 실패.
