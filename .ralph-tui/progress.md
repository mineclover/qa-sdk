# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- PipeSpec 확장 패턴: optional 필드를 추가할 때는 `types/pipe-spec.ts` 정의만 바꾸지 말고 `packages/core/src/index.ts`와 `packages/core/src/pipe/index.ts` 공개 export, `validatePipeSpec` 시맨틱 검증, `pipe-serialize` 라운드트립 테스트를 함께 갱신한다.
- PipeConnection endpoint 확장 패턴: pipe-level 소비자(path/analyze/runtime/simulate 등)는 공용 helper로 endpoint를 `pipeId`만 추출해 유지하고, 구조 변환(fold/unfold)만 원래 endpoint shape(`string` vs `PortRef`)를 보존하도록 분리한다.
- Pipe metadata 추론 패턴: 명시 필드(`ports`)와 유도 필드(dataContract 기반)가 공존하면 `resolve*()` helper를 두고, validator/consumer가 optional 필드를 직접 읽지 말고 항상 resolver를 거치게 만든다.
- Pipe role 판정 패턴: `flow.kind`와 `ports`가 같이 있으면 역할 분류는 `resolvePorts()`를 먼저 보고, `tap`/`branch`/`emit` 같은 kind 휴리스틱은 ports가 부족할 때만 fallback으로 남긴다.
- Pipe standalone SVG 확장 패턴: `pipe-svg-shapes.ts`에 새 렌더링 affordance를 추가할 때는 `StandaloneNodeOptions`와 `standaloneNodeSvg` 호출 경로를 함께 갱신하고, `packages/core/src/pipe/index.ts`와 `packages/core/src/index.ts` 공개 export, 전용 shape 테스트를 한 세트로 맞춘다.

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
