---
def:
  tier: component
  id: dkg-constraint
  address: def_document:v2:273550
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [decision, observability, structural]
  links:
    - target: dkg-node-types
      type: constrains
    - target: dkg-queries
      type: constrains
    - target: dkg-skills-system
      type: constrains
---
# DKG 불변식


## 탐색 ^navigation

dkg-system > **dkg-constraint**

형제: `dkg-node-types` · `dkg-edge-types` · `dkg-queries` · `dkg-growth-spiral` · `dkg-skills-system` · `dkg-service-topology` · `dkg-state-store`

## 목적 ^purpose

DKG 그래프의 구조적 불변 조건 7종(CON-001~CON-007). 그래프의 일관성과 좌표 시스템의 안정성을 보장한다.

## 불변 조건 ^constraint

1. **CON-001**: rbac_role과 role 동시 사용 금지
2. **CON-002**: 이벤트 prefix action dim은 *_action 축 사용
3. **CON-003**: DSL 관측/인프라 멤버는 svc_ref 필수
4. **CON-004**: classificationRate ≥ 80%
5. **CON-005**: critical anomaly → auto observation
6. **CON-006**: prefix_ref refEntries 필수. 미정의 → GateEngine reserved
7. **CON-007**: totalSpace > 2^53 → safePrecision=false

## CON-006 구현: SemanticRef (deriveRefEntries / validateRefEntries)

소스: `packages/spec-core/src/dkg/semantic-ref.ts`

refEntries의 원본은 **의미(문자열 조합)**이고, 정수 주소는 **파생**이다. capacity가 바뀌면 `deriveRefEntries`를 재실행하여 정수를 재생성한다. 이것이 "문자열이 원본, 정수는 파생"의 핵심 구현.

### 의미 기반 정의

```typescript
interface SemanticRefEntries {
  prefixId: string;       // 소유 prefix
  version: string;        // 소유 prefix의 version
  dimLabel: string;       // prefix_ref dim label
  refPrefix: string;      // 참조 대상 prefix
  refVersion: string;     // 참조 대상 version
  entries: SemanticRefEntry[];  // 의미값 기반 entry 목록
}

interface SemanticRefEntry {
  values: Record<string, string | number>;  // 참조 prefix의 차원별 의미값
  label?: string;                           // 설명
}
```

### deriveRefEntries(catalog, semantic) → DerivedRefEntries

각 entry의 values를 `encodePrefixByValue`로 인코딩하여 현재 shape 기준의 정수 배열을 반환한다.

### validateRefEntries(catalog, semantic) → RefValidationResult

현재 catalog에 저장된 refEntries 값과 의미 기반 파생 값을 비교한다. mismatch가 있으면 `valid: false`와 함께 각 mismatch의 (index, current, derived, meaning)을 반환.

### 보조 함수

| 함수 | 설명 |
|------|------|
| `recoverSemanticFromAddresses(catalog, prefixId, version, dimLabel, addresses)` | 기존 정수 주소에서 의미값을 역추출. legacy migration용 |
| `findVersionForEntry(catalog, prefixId, dimLabel, entryValue)` | 특정 entry 값을 가진 version을 찾는다 |
| `findRefAddress(catalog, refPrefix, refVersion, values)` | 의미값 조합의 정수 주소를 반환 |
| `getAllSemanticRefs()` | 데모 카탈로그의 전체 SemanticRefEntries 정의 (demo-semantic-refs.ts) |
