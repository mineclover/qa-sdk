---
def:
  id: rlsc-monitor
  level: leaf
  scope: feature
  aspect: runtime_behavior
  depth: specification
  lifecycle: draft
  layer: domain
  svc: rlsc
  links:
    - target: rlsc
      type: depends_on
    - target: rlsc-intent
      type: depends_on
---

^purpose

MutationObserver + ResizeObserver로 DOM 변화를 감지하고,
변경 발생 시 레이아웃을 재수집하여 선언된 LayoutPattern와의 적합성을 실시간으로 재검증한다.
화면이 의도한 레이아웃으로 구현됐는지 지속적으로 확인하는 관측 루프를 담당한다.

^defines

**타입**

- `MonitorOptions` — 모니터 생성 옵션
  - `intent?: LayoutPattern` — 적합성 검증에 사용할 의도 선언 (없으면 변화 감지만)
  - `debounceMs?: number` — DOM 변화 후 재수집 대기 시간, 기본 200ms
  - `collectOptions?: CollectorOptions` — collectLayout 전달 옵션

- `LayoutMonitor` (인터페이스는 `types.ts`에 존재, 아래 확장)
  - `start(): void` — MutationObserver + ResizeObserver 등록
  - `stop(): void` — 관측자 disconnect, 변화 이력 보존
  - `snapshot(): RLSCDocument` — 현재 DOM 즉시 수집 (start 없이도 호출 가능)
  - `readonly changes: readonly LayoutChange[]` — 감지된 변화 이력 (시간순)
  - `onConformanceChange?: (result: ConformanceResult) => void` — 재검증 콜백
    - intent 있고 재수집 완료 시마다 호출
    - score 변화 없어도 매번 호출 (diff 판단은 소비자 책임)

**함수**

- `packages/rlsc/src/monitor.ts:createLayoutMonitor` — `(root?: Element, options?: MonitorOptions) → LayoutMonitor`
  - `root` 기본값: `document.body`
  - 반환 객체는 `start()` 전까지 비활성 상태
  - 브라우저 전용: `typeof MutationObserver === "undefined"` 시 에러

**내부 동작 흐름**

```
DOM 변화 (mutation/resize)
  └─ debounce(debounceMs)
       └─ collectLayout(root, collectOptions)  → RLSCDocument
            └─ diffDocuments(prev, current)    → LayoutChange[]
                 ├─ changes 배열에 append
                 └─ intent 있으면 checkConformance(doc, intent)
                       └─ onConformanceChange(result) 호출
```

**MutationObserver 설정**

- `{ subtree: true, childList: true, attributes: true, attributeFilter: ["style", "class"] }`
- style/class 변화가 레이아웃에 영향을 줄 수 있으므로 포함
- DOM 텍스트 변화(characterData)는 레이아웃 무관하므로 제외

**ResizeObserver 설정**

- `root` 요소와 `document.documentElement` 동시 관찰
- 뷰포트 크기 변화 + 루트 내 크기 변화 모두 감지

**LayoutChange 생성 규칙**

- `diffDocuments(before, after)` 결과의 각 diff 항목을 `LayoutChange`로 변환
- `timestamp: new Date().toISOString()` (재수집 시점)

^consumes

- `packages/rlsc/src/types.ts` — LayoutMonitor, LayoutChange, MonitorOptions, CollectorOptions, ConformanceResult
- `packages/rlsc/src/collector.ts` — collectLayout
- `packages/rlsc/src/query.ts` — diffDocuments
- `packages/rlsc/src/intent.ts` — checkConformance

## 구현 항목

- [ ] `MonitorOptions` 타입 — `types.ts`에 추가
- [ ] `LayoutMonitor`에 `onConformanceChange` 콜백 필드 추가 — `types.ts`
- [ ] `monitor.ts` 파일 생성 — `createLayoutMonitor` 구현
- [ ] `index.ts` — `createLayoutMonitor`, `MonitorOptions` export 추가
- [ ] `monitor.test.ts` — 브라우저 없이 테스트 가능한 부분 검증
  - `createLayoutMonitor` 브라우저 환경 가드 (MutationObserver 없는 환경 → 에러)
  - debounce 로직 단위 테스트 (타이머 mock)
