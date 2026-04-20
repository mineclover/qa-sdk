---
def:
  tier: component
  id: schema-layer-architecture-spec
  scope: data
  aspect: domain_data
  depth: specification
  svc: weighted-index
  lifecycle: approved
  layer: domain
  tags: [data, structural, runtime]
  links:
    - target: schema-layer-spec
      type: refines
---

# Schema Layer — 4-Layer 아키텍처

## 목적 ^purpose

스키마 시스템의 4계층(Vocabulary → Coordinate → Schema → Semantic) 구조를 정의한다.
각 Layer의 책임 범위와 Layer 간 경계 규칙을 명시하여, 관심사 분리를 보장한다.

## 4-Layer 아키텍처

```
Layer 0. Vocabulary    축별 값 사전. 의미를 거의 모른다. 값 테이블.
                       ✅ 구현 완료 (VersionedAxis + entries + capacity)

Layer 1. Coordinate    축 조합을 좌표로 표현. 형식적 표현만 담당.
                       ✅ 구현 완료 (encode/decode + prefix + prefix_ref)

Layer 2. Schema        구조 클래스 정의. 어떤 축 조합이 허용되는지.
                       ○ 다음 단계

Layer 3. Semantic      구조의 의미 해석. 규칙, 정책, 추론.
                       ○ 외부 시스템. 플러그인.
```

### Layer 간 경계

| 경계 | 허용 | 금지 |
|---|---|---|
| L0 → L1 | vocabulary 값을 좌표 position으로 사용 | L0이 좌표 구조를 알 필요 없음 |
| L1 → L2 | 좌표 구조를 schema의 기반으로 사용 | L1이 schema 제약을 강제하지 않음 |
| L2 → L3 | schema 구조를 semantic rule의 입력으로 제공 | L2가 의미 추론을 수행하지 않음 |

---

## Layer 0: Vocabulary (✅ 구현 완료)

축별 값 사전. 의미를 거의 모른다. 정해진 값 테이블.

```typescript
// 현재 구현: VersionedAxis
interface AxisVersionSnapshot {
  entries: readonly string[];
  capacity?: number;
  ko?: Record<string, string>;
}

interface VersionedAxis {
  id: string;
  name: string;
  versions: Record<string, AxisVersionSnapshot>;
}
```

축 분류 (coordinate-states.md에서 정의):

| 분류 | 경우의 수 | 관리 | 좌표 인코딩 |
|---|---|---|---|
| 정적 축 | 고정 | 코드 | ✓ |
| 동적 enum 축 | 유한, 변동 | DB 카테고리 테이블 | ✓ |
| 무한 인스턴스 | 무한 | DB 엔티티 테이블 | ✗ (ref로 처리) |

---

## Layer 1: Coordinate (✅ 구현 완료)

축 조합을 좌표로 표현. 형식적 표현만 담당.

```typescript
// 현재 구현: PrefixDef (Layer 1 부분)
// encode({ env: 2, region: 0, svc_name: 0, namespace: 0 }) → 40
// decode(40) → { env: "prod", region: "asia", svc_name: "shopping-web", namespace: "shop" }
```

Layer 1의 DimRef는 2종만:

| DimRef | 역할 | 좌표 인코딩 |
|---|---|---|
| `axis` | vocabulary 값 직접 참조 | ✓ |
| `prefix_ref` | 다른 좌표 공간 참조 | ✓ |

`table_ref`는 Layer 1이 아니라 Layer 2의 관심사.
