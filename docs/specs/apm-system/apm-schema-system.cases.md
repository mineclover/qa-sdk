---
def:
  id: apm-schema-system-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: cli
  tags: [scenario, schema, dsl]
  links:
    - target: apm-schema-system
      type: refines
    - target: apm-system
      type: depends_on
---

# APM Schema — 소비자 기대 시나리오

## 목적 ^purpose

`apm-schema-system`이 `apm-system`에 의존할 때 기대하는 계약 시나리오. DSL 스키마 도메인 모델과 address_context 포맷이 apm-system의 전체 관측 파이프라인과 어떻게 정합해야 하는지 기술한다.

## 시나리오 1: DSL axis 공유 정책 ^overview

**전제**: 두 개 이상의 prefix 스키마가 동일 axis(role, action)를 공유한다.

**동작**: `dsl-schema-versioning`이 axis 공유 선언을 파싱하여 단일 정의로 합쳐준다.

**기대**:
- 공유 axis는 단일 source-of-truth (같은 entries, 같은 capacity)
- prefix별 capacity override 시도 → 명시적 ValidationError
- 공유 axis의 entry 추가/제거는 모든 소비 prefix에 전파되며 capacity headroom 경고를 발동

**실패 시 수정 대상**: `apm-system`의 `dsl-schema-versioning` 계약에서 공유 axis 정책을 명시화. axis 소유권과 capacity 변경 승인 권한을 분리.

## 시나리오 2: address_context 머지 규칙 ^overview

**전제**: SDK가 EventRecord를 전송할 때 `address_context` 문자열이 여러 레이어에서 주입된다 (SDK → transport → ingest).

**동작**: `address-context-format`의 머지 규칙이 layer 별 주입을 합친다.

**기대**:
- downstream 값이 upstream 값을 덮어쓰지 않는다 (namespace 구분자로 격리)
- 중복 key 충돌 시 ValidationError + 충돌 namespace 표시
- Ingest 저장 시 `address_context`는 canonical 순서로 재정렬되어 저장

**실패 시 수정 대상**: `apm-system`의 `address-context-format` 스펙이 머지 규칙을 명시해야 함. namespace 충돌 정책 결여 → 상위 스펙 수정.

## 시나리오 3: storage 스키마 Zod 호환 ^overview

**전제**: `address-context-storage`가 EventRecord와 TransmissionEnvelope에 추가되는 필드를 Zod 스키마로 정의한다.

**동작**: ingest-server가 EventRecord를 수신하여 Zod parse를 수행한다.

**기대**:
- SDK가 emit 한 모든 address_context 필드가 Zod 스키마에 정의되어 있다
- 미정의 필드는 `.strict()` 모드로 거부 또는 `.passthrough()` 모드로 보존 (모드 선택은 apm-system 결정)
- 저장된 레코드를 재조회 시 round-trip (input → parse → store → fetch → parse) 에서 정보 손실이 없다

**실패 시 수정 대상**: `apm-system`의 `address-context-storage` 스펙이 strict/passthrough 모드를 고정해야 한다. 또한 schema evolution 정책(필드 추가 시 기존 저장 데이터 호환)을 명시.

## 시나리오 4: composite axis 선언 ^overview

**전제**: `dsl-schema-domain-model`이 Git, K8s, APM signal 축과 composite(복합 축)를 지원한다.

**동작**: composite axis를 선언할 때 하위 축들이 이미 정의되어 있어야 한다.

**기대**:
- 하위 축 누락 → codegen 단계가 아닌 스키마 validate 단계에서 에러
- composite capacity = 하위 축 capacity의 곱 (또는 명시 제한)
- composite 엔트리 생성은 자동 파생 (하위 축 entry 조합)

**실패 시 수정 대상**: `apm-system`의 `dsl-schema-domain-model`이 composite 파생 규칙을 명시. capacity 계산 방법과 엔트리 자동 파생 정책이 고정되어야 함.
