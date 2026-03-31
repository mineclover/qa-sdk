---
def:
  id: browser-capture-contract
  address: def_document:v2:412802
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: browser-sdk
  tags: [observability, contract, runtime]
  links:
    - target: browser-runtime-system
      type: refines
---

# 브라우저 자동 수집 계약

## 목적 ^purpose

opt-in DOM 이벤트 자동 수집의 함수 시그니처, 수집 모드, cleanup 규칙을 분리해 브라우저 SDK의 수집 경계를 명확히 한다.

## 구성 ^overview

`createAutoCapture(config, emit)` 함수가 DOM 이벤트를 감지해 QA 이벤트로 변환한다. 세 가지 수집 모드(clicks, forms, navigation)를 opt-in 방식으로 선택하고, 반환된 cleanup 함수로 리스너를 일괄 해제한다.

## 수집 모드

### clicks — 클릭 자동 수집

- `document.addEventListener("click", handler, true)` — 캡처 단계 등록
- 대상 제한: `button`, `a`, `[data-qa-event]` — `el.closest()` 로 매칭되는 요소만 수집
- 광범위한 클릭 수집을 방지하기 위해 비대상 요소는 무시
- 수집 payload: `tag`, `text`(100자 제한), `qa_id`(`data-qa-id` 또는 `el.id`), `href`(앵커만), `qa_event`

### forms — 폼 제출 수집

- `document.addEventListener("submit", handler, true)` — 캡처 단계 등록
- `FormData`에서 필드 이름만 추출 (값은 수집하지 않음 — 개인정보 보호)
- 수집 payload: `form_id`, `form_action`, `field_count`

### navigation — 내비게이션 수집

- `popstate` 이벤트 리스너 등록
- `history.pushState` 패치 — 원본 함수를 보존하고 호출 직후 `page_view` 이벤트 발생
- cleanup 시 원본 `history.pushState` 복원
- 수집 payload: `url`(`location.href`), `referrer`(`document.referrer`, popstate만)

## 함수 시그니처

```typescript
type Emitter = (eventKey: string, payload?: Record<string, unknown>) => void;

function createAutoCapture(
  config: AutoCaptureConfig,
  emit: Emitter,
): () => void;  // cleanup 함수 반환
```

- `AutoCaptureConfig`: `{ clicks?: boolean; forms?: boolean; navigation?: boolean }`
- `emit`: QaMonitor가 주입하는 이벤트 발행 함수 — infraContext 자동 주입 가능

## Cleanup 규칙

- 반환값은 등록된 모든 리스너를 해제하는 단일 함수
- `monitor.shutdown()` 에서 호출되어 리스너 중복 등록 방지
- 각 모드별 cleanup이 독립적으로 관리됨 — `cleanups` 배열에 push 후 일괄 실행
- `history.pushState` 패치도 cleanup 시 원본으로 복원

## 설계 제약

- 자동 수집은 명시적으로 켠 이벤트만 기록 — 예기치 않은 데이터 폭증 방지
- 클릭 수집 대상은 의미 있는 인터랙션 요소(`button`, `a`, `[data-qa-event]`)로 제한
- 텍스트 내용은 100자로 truncate — 과도한 payload 방지
- 폼 필드 값은 수집하지 않음 — 필드 이름과 개수만 기록
