# PRD: Facet-Port 모델 — Feynman 인과 다이어그램 기반 Pipe 재설계

## Overview

현재 PipeSpec/PipeGraph는 flow kind(step, sequence 등)를 1차 범주로 삼는다.
올바른 추상 순서는 다음이다:

```
Facet (데이터 변환 단위, atomic)
  ↓ fold topology로 합성
Flow (fold된 복합 패싯 표현)
  ↓ typed port로 연결
PipeGraph (인과 네트워크)
```

Feynman 다이어그램 대응:
- propagator line → 데이터 패싯 (typed line, facetType 명시)
- vertex → transformation (typed port를 가짐)
- external leg → trigger / produces (관측 가능한 실제 데이터)
- vertex type → port 조합으로 결정 (외부 부여 X)

현재 문제:
1. `PipeConnection.from/to`가 pipeId만 참조 → port-level 연결 없음
2. `trigger.eventKey`, `produces: string[]`이 이름만 → facet type 없음
3. `classifyPipeRole`이 flow.kind에서 추론 → port 구성에서 결정되어야 함
4. SVG edge가 "어떤 데이터가 흐르는지" 표현 못함, port가 노드 boundary에 없음
5. flow kind가 fold topology와 동일 추상 레벨로 취급됨

이 PRD는 타입 시스템 → SVG 렌더링 → 스펙 재편 3개 레이어를 순서대로 다룬다.

## Goals

- `PipePort` 타입 도입: typed input/output port를 PipeSpec에 부여
- `PipeConnection` port-level 참조 지원: `{ pipeId, portId? }` 연결
- `StepDataContract.consumes/produces` → `PipePort` 자동 도출 유틸
- `classifyPipeRole`을 port 조합 기반으로 재작성 (flow.kind fallback 유지)
- SVG 노드 boundary에 typed port dot 렌더링
- SVG edge에 facetType 라벨 (Feynman line label)
- flow kind 카탈로그를 fold topology 관점으로 재편 (14종 fold topology, 29 flow kind 전수)

## Quality Gates

- `pnpm --filter @qa-sdk/core build` 통과
- `pnpm --filter @qa-sdk/core test` 전부 통과 (기존 테스트 회귀 없음)
- `pnpm --filter @qa-sdk/viz-web exec tsc --noEmit` 통과
- `pnpm --filter @qa-sdk/pipe-store-sqlite test` 통과 (직렬화 하위 호환)

## User Stories

### US-001: PipePort 타입 + PipeSpec.ports 필드 추가

**Description:** 개발자로서, PipeSpec에 typed input/output port를 선언하여
vertex가 어떤 데이터 패싯을 받고 내보내는지 명시할 수 있다.

**Acceptance Criteria:**
- [ ] `packages/core/src/types/pipe-spec.ts`에 `PipePort` 인터페이스 추가
  ```ts
  interface PipePort {
    portId: string;
    direction: "in" | "out";
    facetType?: string;   // DataSchema id 또는 임의 타입명
    label?: string;
    required?: boolean;
  }
  ```
- [ ] `PipeSpec.ports?: PipePort[]` 필드 추가
- [ ] `validatePipeSpec`에 port 유일성 검증: 같은 방향 내 portId 중복 시 ValidationIssue
- [ ] `serializePipeSpec` / `deserializePipeSpec` ports 필드 포함
- [ ] 기존 테스트 전부 통과 (ports는 optional이므로 하위 호환)

---

### US-002: PortRef 타입 + PipeConnection port-level 연결 확장

**Description:** 개발자로서, PipeConnection을 특정 포트까지 지정하여
"A의 payment_result 포트에서 B의 payment_input 포트로 연결"을 표현할 수 있다.

**Acceptance Criteria:**
- [ ] `PortRef { pipeId: string; portId?: string }` 타입 추가
- [ ] `PipeConnection.from`, `to`를 `string | string[] | PortRef | PortRef[]`로 확장
- [ ] `PipeConnection.facetType?: string` 필드 추가 (이 line이 운반하는 데이터 타입)
- [ ] string 형태 그대로 쓰면 기존 동작 동일 (portId 없음 = pipe-level 연결)
- [ ] `validatePipeGraph`에서 portRef.portId가 해당 pipe.ports에 존재하는지 검증
- [ ] `normalize(from)` 유틸이 `PortRef[]` 처리 가능하도록 업데이트
- [ ] 기존 직렬화/역직렬화 하위 호환 (string 입력은 그대로 string으로 저장)

---

### US-003: inferPortsFromDataContract 유틸

**Description:** 개발자로서, PipeStep에 이미 선언된 dataContract를 바탕으로
PipePort를 자동으로 도출하여 명시적 ports 선언 없이도 port 정보를 얻을 수 있다.

**Acceptance Criteria:**
- [ ] `inferPortsFromDataContract(pipe: PipeSpec): PipePort[]` 함수 추가
  - `step.dataContract.consumes` 각 필드 → `{ direction: "in", portId: fieldName, facetType: field.type }`
  - `step.dataContract.produces` 각 필드 → `{ direction: "out", portId: fieldName, facetType: field.type }`
  - `pipe.ports` 명시 선언이 있으면 우선, 없으면 dataContract에서 도출
- [ ] `resolvePorts(pipe: PipeSpec): PipePort[]` — 명시 ports 우선, 없으면 dataContract에서 도출
- [ ] leaf 아닌 flow (sequence, parallel 등)에서는 하위 step들의 ports를 집계
- [ ] 테스트: dataContract만 있는 pipe → ports 도출 결과 검증

---

### US-004: classifyPipeRole port 기반 재작성

**Description:** 개발자로서, classifyPipeRole이 port 구성을 1차 기준으로 삼아
"이 vertex에 어떤 line이 붙어있나"로 역할을 결정하도록 한다.

**Acceptance Criteria:**
- [ ] `classifyPipeRole` 판정 로직 — port shape 우선 + legacy fallback:
  1. `resolvePorts(pipe)` 호출
  2. input ports + output ports 모두 있음 → transformer
  3. output ports만 있음 → producer
  4. tap flow 포함 + legacy produces 없음 + emit 없음 → observer
  5. branch flow 포함 + ports 없음 → router
  6. legacy produces 있음 → transformer
  7. emit 있음 → producer
  8. fallback → consumer
  - TODO: ports 명시된 pipe에서는 port-only 판정 우선, legacy fallback 단계적 deprecation 예정
- [ ] 기존 23 tests 전부 통과
- [ ] 신규 테스트: `ports` 명시 선언이 flow.kind 추론보다 우선함을 검증

---

### US-005: SVG 노드 boundary에 typed port dot 렌더링

**Description:** 개발자로서, SVG 노드의 왼쪽(input)·오른쪽(output) 경계에
typed port dot이 표시되어 어떤 데이터가 들어오고 나가는지 시각적으로 파악할 수 있다.

**Acceptance Criteria:**
- [ ] `drawPortDots(x, y, w, h, ports: PipePort[]): string` 함수 추가 (`pipe-svg-shapes.ts`)
  - input ports: 노드 왼쪽 경계 y 균등 분배, `◀` 스타일 dot
  - output ports: 오른쪽 경계 y 균등 분배, `▶` 스타일 dot
  - dot 색상: facetType 해시 기반 (없으면 #90a4ae)
  - dot에 hover title: `portId (facetType)`
- [ ] `StandaloneNodeOptions.ports?: PipePort[]` 필드 추가
- [ ] `standaloneNodeSvg`가 ports 있으면 `drawPortDots` 호출
- [ ] 기존 SVG 테스트 전부 통과 (ports 없으면 기존 동작 동일)

---

### US-006: SVG edge에 facetType 라벨 렌더링

**Description:** 개발자로서, PipeConnection에 facetType이 있는 edge는
edge 중간에 작은 라벨을 렌더링하여 "어떤 데이터가 흐르는지" 다이어그램에서 직접 읽을 수 있다.

**Acceptance Criteria:**
- [ ] `drawEdgePath`에 `facetType?: string` 옵션 추가
- [ ] facetType 있으면 edge 중간점에 pill-style 라벨 렌더링
  - 배경: 반투명 흰색 rect (border-radius 3px)
  - 텍스트: 10px monospace, edge 색상 계열
- [ ] `standaloneEdgeSvg`에 `facetType?` 옵션 추가
- [ ] `EdgePathOptions`에 facetType 필드 추가
- [ ] `pipeGraphToSvg` — PipeConnection.facetType이 있으면 edge에 전달

---

### US-007: pipeGraphToSvg PortRef 기반 엣지 라우팅

**Description:** 개발자로서, PortRef 연결이 있는 경우 edge가 port dot 위치에서
출발/도착하여 정확한 인과 구조를 표현할 수 있다.

**Acceptance Criteria:**
- [ ] `pipeGraphToSvg` 내부에서 connection.from/to가 PortRef이면
  해당 port dot의 (x, y) 좌표에서 edge path 시작/종료
- [ ] port 위치 계산: `computeLayout` 결과 노드 rect + port index 기반
- [ ] PortRef 없는 기존 연결은 노드 중앙 기준 (기존 동작 동일)
- [ ] `D3Link`에 `sourcePorts?: string[]`, `targetPorts?: string[]` 추가
- [ ] `pipeGraphToD3` 업데이트: PortRef 정보 D3Link에 포함

---

### US-008: pipe-design.ts 카탈로그 업데이트 — port + facetType 시연

**Description:** 디자인 카탈로그(`pipe-design.html`)에 port dot와 facetType 라벨이
실제로 렌더링되는 예시를 추가하여 시각 스펙을 완성한다.

**Acceptance Criteria:**
- [ ] 새 섹션 "Port & FacetType" 추가 (`pipe-design.html` TOC 포함)
- [ ] port dot 갤러리: input-only / output-only / both / typed facet type 4종
- [ ] facetType edge 갤러리: facetType 있는 edge 4종 (next/event/conditional/fan-out)
- [ ] 실전 패턴 1종 추가: payment 결제 flow — OrderData → [payment] → PaymentResult → [notification]
  - 각 연결에 facetType 명시, port dot 표시
- [ ] `pnpm --filter @qa-sdk/viz-web exec tsc --noEmit` 통과

---

### US-009: flow catalog fold topology 재편

**Description:** 개발자로서, 30종 flow kind가 "fold topology" 관점으로 재분류되어
각 flow kind가 "어떻게 패싯들을 합성하는가"의 기술자로 이해된다.

**Acceptance Criteria:**
- [ ] `pipe-flow-catalog.spec.md`에 fold topology 분류 섹션 추가 (14종, 30 flow kind 전수):
  - atomic(1): step
  - linear(1): sequence
  - conditional(2): branch, optional
  - concurrent(3): parallel, race, await
  - resilient(3): retry, fallback, circuit-breaker
  - iterative(2): loop, feedback
  - transactional(3): compensate, finally, transition-scope
  - signaling(1): emit
  - temporal(3): timeout, throttle, debounce
  - batch(4): map, reduce, buffer, filter
  - transformation(2): split, enrich
  - streaming(2): resequence, window
  - stateful(2): dedup, correlation
  - observational(1): tap
- [ ] 각 topology 분류에 "port 구성 패턴" 추가 (입력 포트 수, 출력 포트 수, 특이사항)
- [ ] `pf-*.spec.md` 각각 `## fold topology` 섹션 추가 (1-2줄: 어떤 topology에 속하고 왜)
