---
def:
  tier: component
  id: wi-format-registry
  address: def_document:v2:68813
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [runtime, structural, entry-point]
  links:
    - target: wi-pack-format-def
      type: depends_on
---
# FormatRegistry

## 목적 ^purpose

PackFormat을 등록/조회하는 수평 확장 레지스트리. 새 포맷을 추가할 때 기존 코드를 수정하지 않고 레지스트리에 등록만 하면 된다.

## 구성 ^overview

FormatRegistry는 `Map<string, PackFormat>` 기반의 등록/조회/열거 컨테이너다.

- **FormatRegistry** 클래스 — 포맷 CRUD + 유연한 해석
- **createFormatRegistry()** 팩토리 — 내장 포맷 5종이 사전 등록된 인스턴스 생성

## FormatRegistry API

| 메서드 | 시그니처 | 설명 |
|--------|----------|------|
| `register` | `(format: PackFormat) → this` | 포맷 등록. 동일 이름이면 덮어쓴다. 체이닝 가능 |
| `get` | `(name: string) → PackFormat \| undefined` | 이름으로 조회 |
| `require` | `(name: string) → PackFormat` | 이름으로 조회. 없으면 `RangeError` |
| `has` | `(name: string) → boolean` | 등록 여부 확인 |
| `remove` | `(name: string) → boolean` | 포맷 제거 (내장도 제거 가능) |
| `list` | `() → PackFormat[]` | chars 오름차순 정렬 목록 |
| `size` | `getter → number` | 등록된 포맷 수 |
| `resolve` | `(ref: PackFormat \| string \| number) → PackFormat` | 유연한 해석 |

## resolve — 유연한 포맷 해석

`resolve(ref)`는 3가지 입력 형태를 통합 처리한다.

| 입력 타입 | 동작 | 예시 |
|-----------|------|------|
| `PackFormat` | 그대로 반환 | `resolve(PACK_FORMATS.uuid)` |
| `string` | 레지스트리에서 이름 조회 | `resolve("uuid")` |
| `number` | 해당 chars의 익명 포맷 생성 | `resolve(20)` → `{ name: "80bit", chars: 20 }` |

이 통합 해석은 `capacity-planner.ts`, `semantic-address.ts` 등에서 포맷 인자를 유연하게 받을 수 있게 한다.

## 사용 패턴

```typescript
// 내장 포맷으로 시작
const reg = createFormatRegistry();

// 커스텀 포맷 추가
reg.register(defineFormat({ name: "cuid", chars: 20, label: "CUID" }));

// 유연한 해석
const fmt = reg.resolve("cuid");    // 이름으로
const fmt2 = reg.resolve(16);       // chars 수로 (익명 포맷)
const fmt3 = reg.resolve(PACK_FORMATS.uuid); // 객체 직접
```

## 설계 원칙

- 내장 포맷(PACK_FORMATS)은 모듈 수준 상수. FormatRegistry는 런타임 확장용
- 내장 포맷도 `remove()`로 제거 가능 — 격리된 테스트 환경 구성에 유용
- `list()`는 chars 오름차순 정렬 — UI 드롭다운, 포맷 비교 등에 사용

## 소스 위치

- `packages/weighted-index/src/protocol/pack-format.ts` (FormatRegistry, PACK_FORMATS, defineFormat)
