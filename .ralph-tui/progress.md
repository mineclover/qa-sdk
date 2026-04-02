# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- Pipe flow taxonomy 문서 동기화 패턴: flow kind 분류 축이 바뀌면 `pipe-flow-catalog.spec.md` 집계 표, 29개 `pf-*.spec.md` leaf 설명, `meta-semantic-pipe-impl.spec.md` 상위 방법 문단을 함께 갱신해야 분류 SSOT가 유지된다.
- PipeSpec 확장 패턴: optional 필드를 추가할 때는 `types/pipe-spec.ts` 정의만 바꾸지 말고 `packages/core/src/index.ts`와 `packages/core/src/pipe/index.ts` 공개 export, `validatePipeSpec` 시맨틱 검증, `pipe-serialize` 라운드트립 테스트를 함께 갱신한다.
- PipeConnection endpoint 확장 패턴: pipe-level 소비자(path/analyze/runtime/simulate 등)는 공용 helper로 endpoint를 `pipeId`만 추출해 유지하고, 구조 변환(fold/unfold)만 원래 endpoint shape(`string` vs `PortRef`)를 보존하도록 분리한다.
- Pipe metadata 추론 패턴: 명시 필드(`ports`)와 유도 필드(dataContract 기반)가 공존하면 `resolve*()` helper를 두고, validator/consumer가 optional 필드를 직접 읽지 말고 항상 resolver를 거치게 만든다.
- Pipe role 판정 패턴: `flow.kind`와 `ports`가 같이 있으면 역할 분류는 `resolvePorts()`를 먼저 보고, `tap`/`branch`/`emit` 같은 kind 휴리스틱은 ports가 부족할 때만 fallback으로 남긴다.
- Pipe standalone SVG 확장 패턴: `pipe-svg-shapes.ts`에 새 렌더링 affordance를 추가할 때는 `StandaloneNodeOptions`와 `standaloneNodeSvg` 호출 경로를 함께 갱신하고, `packages/core/src/pipe/index.ts`와 `packages/core/src/index.ts` 공개 export, 전용 shape 테스트를 한 세트로 맞춘다.
- Pipe edge SVG 메타데이터 전달 패턴: `facetType`처럼 connection-level 시각 메타데이터를 그래프 렌더러가 쓰려면 `pipe-svg-shapes.ts`에서 draw helper를 확장하는 것만으로는 부족하고, `pipe-zoom.ts`의 `ZoomEdge`에 값을 보존한 뒤 `pipe-svg.ts`가 그대로 전달하도록 연결해야 한다.
- Pipe PortRef edge 라우팅 패턴: port-aware SVG/D3 렌더링은 `PipeConnection`의 PortRef를 `ZoomEdge.sourcePorts/targetPorts`로 보존하고, 노드 쪽은 `ZoomNode.ports`에 `resolvePorts()` 결과를 싣는다. 실제 anchor 좌표는 `drawPortDots()`와 동일한 방향별 순서/간격 공식을 써서 계산하고, PortRef가 없거나 매칭 포트가 없으면 node center로 fallback한다.
- Workspace dist export 동기화 패턴: downstream 패키지가 `@qa-sdk/core`의 `dist/*.d.ts` export를 바라보므로, 선행 작업에서 core 공개 타입이 바뀌었으면 후속 패키지 타입체크 전에 `pnpm --filter @qa-sdk/core build`로 선언 파일부터 갱신해야 한다.

---

## 2026-04-02 - US-001
- What was implemented
  - `PipePort` 인터페이스와 `PipeSpec.ports?: PipePort[]` optional 필드를 추가했다.
  - `validatePipeSpec`에 같은 방향 내 `portId` 중복 검증을 추가하고, 직렬화/역직렬화 라운드트립 테스트를 보강했다.
  - `PipePort`를 core 공개 export 표면에도 포함했다.
- Files changed
  - `packages/core/src/types/pipe-spec.ts`
  - `packages/core/src/pipe/pipe-validate.ts`
  - `packages/core/src/pipe/pipe-serialize.ts`
  - `packages/core/src/pipe/pipe-validate.test.ts`
  - `packages/core/src/pipe/pipe-serialize.test.ts`
  - `packages/core/src/pipe/index.ts`
  - `packages/core/src/index.ts`
- **Learnings:**
  - Patterns discovered
    - Pipe 관련 스키마 변경은 타입 정의, validator, serializer, 두 개의 export surface, 관련 fixture/테스트를 같이 맞추는 구조다.
  - Gotchas encountered
    - 루트 `pnpm lint`는 이번 변경과 무관한 기존 워크스페이스 lint 오류 때문에 실패했고, 변경 파일 대상 `oxlint`는 0 warning/0 error로 통과했다.
---

## 2026-04-02 - US-002
- What was implemented
  - `PortRef { pipeId; portId? }`와 `PipeConnection.facetType?`를 추가하고, `from`/`to`를 `string | string[] | PortRef | PortRef[]`로 확장했다.
  - `validatePipeGraph`에 PortRef `portId` 존재 검증을 추가했고, pipe-level 소비자는 공용 endpoint helper를 통해 기존처럼 `pipeId` 기준으로 동작하도록 유지했다.
  - `pipe-fold`의 `normalize()`를 PortRef 입력까지 처리하도록 갱신하고, fold/unfold 재배선에서 endpoint shape와 `facetType`을 보존하도록 보강했다.
  - 직렬화/역직렬화 테스트에 PortRef 라운드트립과 string 연결 하위 호환 케이스를 추가했다.
- Files changed
  - `packages/core/src/types/pipe-spec.ts`
  - `packages/core/src/pipe/pipe-endpoint.ts`
  - `packages/core/src/pipe/pipe-validate.ts`
  - `packages/core/src/pipe/pipe-fold.ts`
  - `packages/core/src/pipe/pipe-serialize.ts`
  - `packages/core/src/pipe/pipe-path.ts`
  - `packages/core/src/pipe/pipe-definition-bridge.ts`
  - `packages/core/src/pipe/pipe-analyze.ts`
  - `packages/core/src/pipe/pipe-gate.ts`
  - `packages/core/src/pipe/path-matcher.ts`
  - `packages/core/src/pipe/pipe-segment.ts`
  - `packages/core/src/pipe/pipe-runtime.ts`
  - `packages/core/src/pipe/pipe-simulate.ts`
  - `packages/core/src/pipe/pipe-validate.test.ts`
  - `packages/core/src/pipe/pipe-fold.test.ts`
  - `packages/core/src/pipe/pipe-serialize.test.ts`
  - `packages/core/src/pipe/index.ts`
  - `packages/core/src/index.ts`
- **Learnings:**
  - Patterns discovered
    - Connection endpoint 타입이 확장되면 validator만 바꾸는 것으로 끝나지 않고, 그래프 순회 계층(path/analyze/runtime/simulate/segment/gate) 전체가 pipeId normalization helper를 공유해야 기존 동작을 유지할 수 있다.
    - fold/unfold처럼 endpoint를 재작성하는 계층은 `pipeId`만 추출하면 안 되고, 원래 endpoint shape와 추가 메타데이터(`facetType`)를 함께 보존해야 한다.
  - Gotchas encountered
    - `PipeConnection["from"]`/`["to"]`는 mixed array를 허용하지 않아서 fold 재배선 시 `string[]`와 `PortRef[]`를 섞어 반환하지 않도록 원본 endpoint shape를 기준으로 다시 조립해야 타입체크가 통과한다.
    - 루트 `pnpm lint`는 이번 작업과 무관한 기존 워크스페이스 전반의 lint 오류로 실패했고, `@qa-sdk/core` 타입체크와 관련 pipe 테스트는 통과했다.
---

## 2026-04-02 - US-003
- What was implemented
  - `inferPortsFromDataContract(pipe)`와 `resolvePorts(pipe)`를 추가해 `PipeStep.dataContract`만으로도 `PipePort[]`를 안정적으로 도출할 수 있게 했다.
  - non-leaf flow는 `collectFlowSteps()`를 통해 하위 step 전체를 순회하며 consumes/produces를 각각 in/out port로 집계하도록 구현했다.
  - `validatePipeGraph`의 PortRef 검증도 `resolvePorts()`를 사용하도록 바꿔, 명시 `ports` 없이도 inferred port를 참조할 수 있게 했다.
- Files changed
  - `packages/core/src/pipe/pipe-port.ts`
  - `packages/core/src/pipe/pipe-port.test.ts`
  - `packages/core/src/pipe/pipe-validate.ts`
  - `packages/core/src/pipe/index.ts`
  - `packages/core/src/index.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - 선택적 명시 필드와 추론 필드가 같이 존재할 때는 `resolve*()`를 SSOT로 두고, validator까지 그 resolver를 사용하게 연결해야 downstream 동작이 일관된다.
  - Gotchas encountered
    - inferred port를 export만 하고 validator가 `pipe.ports`만 직접 보면 PortRef 검증이 계속 실패하므로, utility 추가와 소비자 교체를 한 세트로 처리해야 한다.
---

## 2026-04-02 - US-004
- What was implemented
  - `classifyPipeRole()`을 `resolvePorts()` 우선 판정으로 재작성해, 명시/inferred port shape가 있으면 그것을 먼저 사용하고 `tap`/`branch`/`emit`은 fallback으로만 사용하게 바꿨다.
  - 출력 포트 기반 `producer`, 입력+출력 포트 기반 `transformer`, input-only/no-port fallback `consumer` 규칙을 정리하면서 레거시 `PipeSpec.produces` 기반 transformer 승격은 유지했다.
  - `pipe-interpret.test.ts`에 명시 `ports`가 `flow.kind` 기반 분류보다 우선함을 검증하는 회귀 테스트를 추가했다.
- Files changed
  - `packages/core/src/pipe/pipe-interpret.ts`
  - `packages/core/src/pipe/pipe-interpret.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - 역할 분류처럼 schema-derived 메타데이터와 flow 휴리스틱이 같이 존재하는 경우에도, 명시/추론 메타데이터 resolver를 먼저 보고 레거시 휴리스틱은 뒤로 미루는 순서가 회귀를 줄인다.
  - Gotchas encountered
    - 루트 `pnpm lint`는 이번 변경과 무관한 워크스페이스 전반의 기존 lint 오류 때문에 실패했고, 변경 파일 대상 `oxlint`는 0 warning/0 error로 통과했다.
---
## 2026-04-02 - US-005
- What was implemented
  - `drawPortDots(x, y, w, h, ports)`를 추가해 input 포트는 왼쪽 경계, output 포트는 오른쪽 경계에 균등 분배된 typed dot으로 렌더링되게 했다.
  - port dot은 `facetType` 해시 기반 색상과 fallback `#90a4ae`를 사용하고, 방향별 `◀/▶` 스타일 삼각형과 SVG `title` tooltip을 포함한다.
  - `StandaloneNodeOptions.ports?: PipePort[]`를 추가하고 `standaloneNodeSvg`가 unfolded 노드에서 port dot을 렌더링하도록 연결했다.
  - `drawPortDots`를 core 공개 export surface에 추가하고, shape 전용 테스트를 새로 작성했다.
- Files changed
  - `packages/core/src/pipe/pipe-svg-shapes.ts`
  - `packages/core/src/pipe/pipe-svg-shapes.test.ts`
  - `packages/core/src/pipe/index.ts`
  - `packages/core/src/index.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - standalone SVG affordance를 확장할 때는 shape 구현만 바꾸지 말고 `StandaloneNodeOptions`, `standaloneNodeSvg`, 두 export surface, 전용 렌더링 테스트를 같이 업데이트해야 downstream catalog 소비자가 바로 쓸 수 있다.
  - Gotchas encountered
    - 루트 `pnpm lint`는 인자와 무관하게 `packages/` 전체를 검사하므로 기존 워크스페이스 lint 이슈와 섞인다. 변경 범위 확인은 `pnpm exec oxlint <files...>`로 따로 실행해야 신호가 깨끗하다.
---
## 2026-04-02 - US-006
- What was implemented
  - `EdgePathOptions`와 `StandaloneEdgeOptions`에 `facetType?: string`을 추가하고, `drawEdgePath()`가 cubic edge 중간점에 facet pill 라벨을 렌더링하도록 확장했다.
  - `pipe-zoom.ts`의 `ZoomEdge`가 `PipeConnection.facetType`을 보존하도록 바꾸고, `pipe-svg.ts`가 이를 `drawEdgePath()`로 전달하게 연결했다.
  - `pipe-svg.test.ts`와 `pipe-svg-shapes.test.ts`에 facet edge 라벨 회귀 테스트를 추가했고, touched file lint 경고도 함께 정리했다.
- Files changed
  - `packages/core/src/pipe/pipe-svg-shapes.ts`
  - `packages/core/src/pipe/pipe-svg.ts`
  - `packages/core/src/pipe/pipe-zoom.ts`
  - `packages/core/src/pipe/pipe-svg.test.ts`
  - `packages/core/src/pipe/pipe-svg-shapes.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - edge label 같은 connection-level SVG affordance는 zoom/layout 이후에 그려지므로, graph renderer가 쓰는 intermediate edge 타입(`ZoomEdge`)에 메타데이터를 먼저 보존하고 최종 shape helper에 전달하는 흐름이 재사용 가능하다.
  - Gotchas encountered
    - feedback edge는 실제 path가 cubic arc라서 단순 `(x1+x2)/2, (y1+y2)/2` 직선 중점을 쓰면 라벨이 잘못된 위치에 놓인다. cubic midpoint를 계산해야 edge 위에 자연스럽게 붙는다.
---
## 2026-04-02 - US-007
- What was implemented
  - `ZoomEdge`에 `sourcePorts`/`targetPorts`, `ZoomNode`에 resolved `ports`를 보존하도록 바꿔 PortRef 연결 메타데이터가 zoom/layout 이후에도 유지되게 했다.
  - `pipe-svg.ts`가 PortRef edge일 때 node rect + port index 기반으로 시작/종료 좌표를 계산하도록 바꾸고, 일반 string 연결은 기존 node center 기준을 그대로 유지했다.
  - `pipeGraphToD3`/`zoomViewToD3`가 `D3Link.sourcePorts`/`targetPorts`를 내보내도록 확장했고, SVG/D3 회귀 테스트를 추가했다.
- Files changed
  - `packages/core/src/pipe/pipe-zoom.ts`
  - `packages/core/src/pipe/pipe-svg.ts`
  - `packages/core/src/pipe/pipe-zoom-view.test.ts`
  - `packages/core/src/pipe/pipe-svg.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - PortRef 기반 edge routing은 `pipeGraphToSvg`에서 원본 connection을 다시 파싱하기보다, zoom intermediate 타입(`ZoomEdge`, `ZoomNode`)에 필요한 메타데이터를 보존해 SVG와 D3가 같은 anchor 계산 로직을 공유하게 만드는 편이 회귀에 강하다.
  - Gotchas encountered
  - `computeZoomView()`가 endpoint를 단순 `pipeId`로만 정규화하면 `pipeGraphToSvg`/`pipeGraphToD3` 단계에서는 PortRef를 복구할 방법이 없다. PortRef를 쓰는 시각 기능은 zoom 단계에서 메타데이터를 같이 실어 보내야 한다.
  - 루트 `pnpm lint`는 여전히 워크스페이스 전체 기존 이슈와 섞이므로, 이번 작업 검증은 변경 파일 대상 `oxlint`와 `@qa-sdk/core` 타입체크/관련 테스트로 확인했다.
---
## 2026-04-02 - US-008
- What was implemented
  - `pipe-design.html` TOC에 `Port & FacetType` 섹션을 추가하고, 포트 갤러리와 facetType edge 갤러리를 위한 카드 레이아웃/반응형 스타일을 보강했다.
  - `pipe-design.ts`에 input-only, output-only, input+output, typed facetType 4종 포트 dot 시연과 next/event/conditional/fan-out facetType edge 라벨 시연을 추가했다.
  - 실전 패턴 갤러리에 `OrderData → [payment] → PaymentResult → [notification]` 예시를 추가해 PortRef endpoint와 facetType edge label이 함께 보이도록 구성했다.
- Files changed
  - `packages/viz-web/pipe-design.html`
  - `packages/viz-web/src/pipe-design.ts`
- **Learnings:**
  - Patterns discovered
    - viz-web처럼 downstream 패키지가 workspace 라이브러리의 `dist` export를 직접 소비하면, 선행 story에서 core 타입이 바뀐 뒤 후속 story의 `tsc --noEmit`를 돌리기 전에 먼저 해당 라이브러리를 build해서 declaration을 갱신해야 한다.
  - Gotchas encountered
    - `@qa-sdk/core` 공개 타입은 source가 아니라 `dist/index.d.ts`를 통해 해석되므로, core를 빌드하지 않으면 `PortRef`, `ports`, `facetType`가 이미 소스에 있어도 viz-web 타입체크에서는 없는 것으로 보인다.
    - `PipeAwait.then`은 도메인 스키마의 정식 필드라서 lint의 `unicorn/no-thenable`과 충돌한다. 카탈로그 fixture에서는 해당 줄만 명시적으로 예외 처리해야 changed-file lint가 통과한다.
---

## 2026-04-02 - US-009
- What was implemented
  - `pipe-flow-catalog.spec.md`에 14개 fold topology 분류와 topology별 port 구성 패턴(입력/출력/특이사항) 표를 추가했다.
  - `pf-*.spec.md` 29개 모두에 `## fold topology` 섹션을 넣어 각 flow kind가 어떤 합성 패턴에 속하는지와 이유를 문서화했다.
  - `meta-semantic-pipe-impl.spec.md`의 `^method`/위임 설명을 fold topology 관점까지 확장했다.
- Files changed
  - `docs/specs/meta-semantic/pipe-impl/pipe-flow-catalog.spec.md`
  - `docs/specs/meta-semantic/meta-semantic-pipe-impl.spec.md`
  - `docs/specs/meta-semantic/pipe-impl/flows/pf-*.spec.md` (29 files)
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Pipe flow taxonomy 문서는 카탈로그 요약, 개별 leaf 설명, 상위 module `^method`가 함께 움직여야 분류 기준이 drift하지 않는다.
  - Gotchas encountered
    - 현재 타입 소스에는 `transition-scope`까지 포함되어 30종처럼 보이지만, 이번 story 범위와 leaf 문서 체계는 여전히 29개 `pf-*` 기준이라 추가 문서를 만들지 않고 지정된 집합만 재분류해야 한다.
---
