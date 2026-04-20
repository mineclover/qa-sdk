---
def:
  id: rlsc-encoder
  level: leaf
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: rlsc
  links:
    - target: rlsc
      type: depends_on
---

## 목적 ^purpose
RLSCDocument를 RLSC/1.0 마크업 문자열로 직렬화하고, 마크업을 다시 Partial<RLSCDocument>로 파싱한다.
직렬화 결과는 LLM 프롬프트 주입과 라운드트립 복원 양쪽에 사용된다.

## ^defines

### encodeToMarkup(doc: RLSCDocument) → string

RLSCDocument를 RLSC/1.0 마크업 문자열로 직렬화한다.

**마크업 구조** — 섹션은 `---`으로 구분:
1. 헤더: `RLSC/1.0`, `viewport`, `url`, `timestamp`, (선택) `address`
2. `# Tree` — 들여쓰기 기반 노드 트리 (2칸/레벨)
3. `# Grid...` — gridToText 위임
4. `# Layers` — layersToText 위임
5. `# Relations` — relationsToText 위임 (relations.length > 0일 때만)

**노드 직렬화 형식**:
```
[selector] @(x,y) w×h [z:N] [role:R] [display:D] ["text"] [addr:A]
```
- selector: tag, 또는 `#`이 포함된 경우 `__` suffix를 제거한 id
- `z:N`: zIndex가 0이 아닌 경우만 출력
- `display:D`: block/inline 외의 값만 출력
- `"text"`: 큰따옴표 내부 `"` → `\"`로 이스케이프

### parseMarkup(markup: string) → Partial\<RLSCDocument>

RLSC/1.0 마크업 문자열을 파싱하여 부분 문서를 반환한다.

- 섹션 구분자 `---`로 분리, 헤더에서 `viewport`, `url`, `timestamp`, `address` 추출
- **트리 섹션만 파싱** — grid/layers/relations 섹션은 무시 (호출자가 재계산 책임)
- 반환 grid는 `{ cellSize: 0, cols: 0, rows: 0, cells: [] }` 플레이스홀더 (`cellSize: 0` = 재계산 필요 시그널)
- viewport 파싱 실패 시 기본값 `1920×1080`

**노드 라인 파싱 규칙**:
- `[selector]`가 없는 줄은 건너뜀
- 들여쓰기 2칸 = 깊이 1레벨, 스택 기반 부모 추론
- rect 파싱 실패 시 `{ x:0, y:0, width:0, height:0 }`
- position: "static", overflow: "visible", visible: true 고정 복원

## ^consumes
- `types.ts` — RLSCNode, RLSCDocument
- `grid.ts` — gridToText
- `layers.ts` — layersToText
- `relations.ts` — relationsToText
