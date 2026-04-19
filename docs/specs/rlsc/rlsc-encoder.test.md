---
def:
  id: rlsc-encoder-test
  level: leaf
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: rlsc
  links:
    - target: rlsc-encoder
      type: refines
  source: packages/rlsc/src/encoder.test.ts
---

## 목적 ^purpose

`encodeToMarkup` ↔ `parseMarkup` 라운드트립 정확성과 RLSC/1.0 마크업 직렬화 규칙을 검증한다.

소스: `packages/rlsc/src/encoder.test.ts`

## 라운드트립

| 시나리오 | 검증 내용 |
|----------|----------|
| viewport 복원 | `parseMarkup(encodeToMarkup(doc)).viewport` = 원본 `{width, height}` |
| url 복원 | parsed.url = 원본 url 문자열 |
| timestamp 복원 | parsed.timestamp = 원본 ISO-8601 문자열 |
| address 필드 있는 문서 | 마크업에 `address: def_document:v2:42` 포함; parsed.address 복원 |
| root.id 복원 | parsed.root 정의됨 |

## textContent 이스케이프

- 노드 textContent에 `"hello"` 포함 → 마크업에 `\"hello\"` 출력

## relations 섹션

- `relations: []` → 마크업에 `# Relations` 섹션 없음
- `relations` 1건 이상 → 마크업에 `# Relations` 포함

## parseMarkup 재계산 플레이스홀더

- `parsed.grid.cellSize === 0` (재계산 필요 시그널. 임의값 아님)
- `parsed.layers` = `[]` (레이어는 재계산 책임)

## addr 노드 수준 직렬화

- 노드에 `address: "evt:v1:7"` → 마크업에 `addr:evt:v1:7` 포함
