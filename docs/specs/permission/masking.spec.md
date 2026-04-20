---
def:
  tier: component
  id: masking-spec
  address: def_document:v2:274562
  scope: constraint
  aspect: biz_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: ingest-server
  tags: [security]
  links:
    - target: perm-codec-system
      type: constrains
    - target: perm-permission-code
      type: constrains
---

# applyMasking

## 목적 ^purpose

클라이언트 측 payload의 민감정보를 마스킹해 전송 전 노출을 줄이는 보안 규칙과 적용 범위를 정의한다.

## 구성 ^overview

- **4가지 마스킹 모드**: raw(원본 유지), mask(존재 여부만 보존), drop(필드 삭제), hash(비가역 해시 변환)
- **MaskingRule 인터페이스**: field(대상 필드명) + mode(변환 방식)로 규칙 선언
- **hash 구현**: `simpleHash()` non-cryptographic 해시, `h_<8자리 hex>` 형식, deterministic 단방향
- **반환값**: masked(변환된 payload shallow copy) + maskedFields(적용된 필드명 배열, raw 포함)
- **제약**: top-level 필드만 지원, nested path 미지원, payload에 없는 field의 rule은 무시

## 상태

implemented

## 인터페이스

```typescript
interface MaskingRule {
  field: string;
  mode: "raw" | "mask" | "drop" | "hash";
}

function applyMasking(
  payload: Record<string, unknown>,
  rules: MaskingRule[],
): { masked: Record<string, unknown>; maskedFields: string[] };
```

## 동작

각 rule의 `field`가 payload에 존재하면 `mode`에 따라 변환:

| 모드 | 변환 | 결과 예시 |
|---|---|---|
| `raw` | 원본 유지 | `"email": "a@b.com"` |
| `mask` | 값 제거, 존재 여부만 | `"email": { "_masked": true, "_present": true }` |
| `drop` | 필드 삭제 | (필드 없음) |
| `hash` | 비가역 해시 | `"email": "h_3a7f2b01"` |

반환값:
- `masked`: 변환된 payload (원본의 shallow copy)
- `maskedFields`: 마스킹이 적용된 필드명 배열 (`raw` 포함)

## hash 구현

- `simpleHash()` — non-cryptographic 해시
- 형식: `h_<8자리 hex>`
- 동일 입력 → 동일 출력 (deterministic)
- 역변환 불가 (단방향)

## 제약 조건

- top-level 필드만 지원 (nested path 미지원, e.g. `"address.city"` 불가)
- payload에 없는 field의 rule은 무시
- `mask` 모드의 `_present: false`는 값이 `undefined` 또는 `null`일 때
- `drop` 모드 적용 시 `maskedFields`에는 포함되지만 결과 payload에서는 삭제
- `raw` 모드도 `maskedFields`에 포함됨 (마스킹 대상으로 선언되었지만 원본 유지)
