---
def:
  id: wi-pack-format-def
  address: def_document:v1:2673
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [tier-infra]
  links:
    - target: wi-math
      type: depends_on
---
# PackFormat 포맷 정의

## 목적 ^purpose

shape을 이진 필드에 배치하는 포맷 규칙. 각 PackFormat은 전체 비트 수, 차원별 비트 할당, 인코딩/디코딩 방식을 정의한다.

## 구성 ^overview

PackFormat은 hex 컨테이너의 크기와 구조를 정의하는 불변 객체다.

- **PackFormat** — 포맷 정의 인터페이스
- **defineFormat()** — 검증 팩토리
- **PACK_FORMATS** — 내장 포맷 5종
- **FormatRegistry** — 수평 확장 가능한 포맷 레지스트리

## PackFormat 인터페이스

```typescript
interface PackFormat {
  readonly name:    string;          // 고유 식별 이름
  readonly chars:   number;          // hex 자릿수 (dash 제외)
  readonly bits:    number;          // 비트 수 (= chars × 4)
  readonly label:   string;          // 사람이 읽을 수 있는 설명
  readonly groups?: readonly number[]; // dash 구분 그룹 크기
}
```

`groups`의 합계는 `chars`와 일치해야 한다. 미지정 시 dash 없이 연속 hex.

## 내장 포맷 5종 (PACK_FORMATS)

| 이름 | chars | bits | groups | 용도 |
|------|-------|------|--------|------|
| `int64` | 16 | 64 | — | 64비트 정수 |
| `objectId` | 24 | 96 | — | MongoDB ObjectId |
| `uuid` | 32 | 128 | `[8,4,4,4,12]` | UUID (8-4-4-4-12) |
| `sha1` | 40 | 160 | — | SHA-1 해시 |
| `sha256` | 64 | 256 | — | SHA-256 해시 |

## defineFormat — 검증 팩토리

```typescript
// 커스텀 포맷 생성
defineFormat({ name: "token48", chars: 12, label: "48-bit Token" })
defineFormat({ name: "custom", chars: 20, label: "Custom", groups: [4, 4, 4, 4, 4] })
```

검증 규칙:
- `name` 필수
- `chars > 0`
- `groups` 지정 시 합계 = `chars`, 각 그룹 > 0

결과 객체는 `Object.freeze()`로 불변 보장.

## Layout과의 관계

PackFormat은 컨테이너의 크기만 정의한다. 실제 필드 배치는 `uuid-layout.ts`의 `planLayout`이 결정한다.

```
PackFormat (크기 정의)
    ↓
planLayout (필드 배치)
    ↓
createLayoutProtocol (직렬화 프로토콜 생성)
```

layout은 PackFormat의 chars 예산 내에서 left fields(schema, version)와 right fields(index)를 배치한다. 남는 공간은 gap으로 zero-fill.

## 소스 위치

- `packages/weighted-index/src/protocol/pack-format.ts`
