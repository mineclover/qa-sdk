# AutoCapture

> opt-in DOM 이벤트 자동 수집. `createAutoCapture(config, emit)` 로 리스너를 등록하고,
> 반환된 cleanup 함수로 정리한다.

## 상태

implemented

---

## 함수 시그니처

```typescript
function createAutoCapture(
  config: AutoCaptureConfig,
  emit: (eventKey: string, payload?: Record<string, unknown>) => void,
): () => void; // cleanup 함수
```

```typescript
interface AutoCaptureConfig {
  clicks?: boolean;      // button, a, [data-qa-event] 클릭
  forms?: boolean;       // form submit
  navigation?: boolean;  // history.pushState + popstate
}
```

모든 필드가 `false` / 미지정이면 어떤 DOM 이벤트도 수집하지 않는다.

---

## 수집 모드별 계약

### `clicks: true` — 클릭 수집

**리스너 등록:**

```typescript
document.addEventListener("click", onClick, true); // capture phase
```

capture phase를 사용하여 이벤트 전파가 중단된 경우에도 수집.

**대상 요소 (`closest` 탐색):**

```
클릭 발생 → target.closest("button, a, [data-qa-event]")
```

| 요소 | 수집 여부 |
|---|---|
| `<button>` | O |
| `<a>` | O |
| `[data-qa-event]` 속성을 가진 모든 요소 | O |
| 위 요소의 자손 클릭 (`closest` 로 상위 탐색) | O |
| 일반 `<div>`, `<span>` 등 | X |

**발생 이벤트:** `"click"`

**Payload 필드:**

| 필드 | 타입 | 값 | 누락 조건 |
|---|---|---|---|
| `tag` | string | `el.tagName.toLowerCase()` | 없음 |
| `text` | string | `el.textContent?.trim().slice(0, 100) ?? ""` | 없음 (빈 문자열) |
| `qa_id` | string \| undefined | `el.dataset["qaId"] ?? el.id ?? undefined` | 없음 |
| `href` | string \| undefined | `el.href` (HTMLAnchorElement 한정) | `<a>` 아닌 경우 |
| `qa_event` | string \| undefined | `el.dataset["qaEvent"] ?? undefined` | `data-qa-event` 없는 경우 |

**커스텀 식별자 프로토콜 (`data-qa-*`):**

```html
<!-- qa_id로 수집 -->
<button data-qa-id="submit-checkout">결제하기</button>

<!-- qa_event로 수집 (임의 이벤트 키 태깅) -->
<div data-qa-event="promo_banner_click">배너</div>

<!-- 두 속성 동시 사용 -->
<button data-qa-id="add-to-cart" data-qa-event="product_cta_click">담기</button>
```

---

### `forms: true` — 폼 제출 수집

**리스너 등록:**

```typescript
document.addEventListener("submit", onSubmit, true); // capture phase
```

**발생 이벤트:** `"form_submit"`

**Payload 필드:**

| 필드 | 타입 | 값 | 누락 조건 |
|---|---|---|---|
| `form_id` | string \| undefined | `form.id || undefined` | `id` 없는 경우 |
| `form_action` | string \| undefined | `form.action || undefined` | `action` 없는 경우 |
| `field_count` | number | `FormData` 키 개수 | 없음 |

**주의:** `field_count` 는 form 필드 이름 수 (`data.forEach((_, key) => ...)`). 동일 이름 복수 값은 1개로 카운트.

---

### `navigation: true` — 페이지 전환 수집

SPA의 URL 전환을 추적한다. 두 메커니즘을 모두 감지:

**① `history.pushState` 패치:**

```typescript
const originalPush = history.pushState;           // 원본 저장 (bind 없이)
history.pushState = function(...args) {
  originalPush.call(history, ...args);             // 원본 실행
  emit("page_view", { url: location.href });       // 이후 emit
};
```

cleanup 시 `history.pushState = originalPush` 로 원본 복원.

**② `popstate` 리스너:**

```typescript
window.addEventListener("popstate", onPopState);
// onPopState: emit("page_view", { url: location.href, referrer: document.referrer })
```

브라우저 뒤로가기/앞으로가기 감지.

**발생 이벤트:** `"page_view"`

**Payload 필드:**

| 필드 | 타입 | 값 | 출처 |
|---|---|---|---|
| `url` | string | `location.href` (전환 후 URL) | pushState / popstate |
| `referrer` | string | `document.referrer` | popstate 한정 |

---

## Cleanup

`createAutoCapture` 가 반환하는 함수를 호출하면 등록된 모든 리스너가 제거된다:

```typescript
const destroy = createAutoCapture(config, emit);

// 정리 시
destroy();
// clicks   → document.removeEventListener("click", onClick, true)
// forms    → document.removeEventListener("submit", onSubmit, true)
// navigation →
//   window.removeEventListener("popstate", onPopState)
//   history.pushState = originalPush  (원본 복원)
```

**idempotency:** cleanup 함수는 1회 호출만 보장. `QaMonitor.shutdown()` 이 정확히 1회 호출한다.

---

## 제약 조건

- `clicks: true` 는 `closest("button, a, [data-qa-event]")` 에 매칭되지 않는 요소를 수집하지 않는다.
  광범위한 클릭 수집(모든 요소)이 필요하면 `monitor.emit("click", ...)` 을 수동으로 호출해야 한다.
- `navigation: true` 는 SPA 전용이다. MPA에서는 페이지 로드마다 monitor가 재생성되므로 불필요.
- `history.pushState` 패치는 전역 상태 변경이다. 같은 탭에서 monitor 인스턴스를 여러 개 생성하면 패치가 중첩된다.
  → `QaMonitor` 는 탭당 1회만 생성할 것 (`lifecycle.spec.md` 참조).
- `text` 필드는 100자로 잘린다. 긴 버튼 텍스트는 truncate됨.
- `href` 는 브라우저가 정규화한 절대 URL이다. `"https://example.com"` 은 `"https://example.com/"` 이 될 수 있음.

---

## 테스트 커버리지

`packages/browser-sdk/src/auto-capture.test.ts`:

- `clicks`: `<button>` / `<a>` / `[data-qa-event]` 클릭 → `"click"` 이벤트 payload 검증
- `clicks`: 매칭 안 되는 요소 클릭 → emit 미호출
- `clicks`: cleanup 후 클릭 → emit 미호출
- `forms`: `<form>` submit → `"form_submit"` + field_count 검증
- `navigation`: `history.pushState` 호출 → `"page_view"` + url 검증
- `navigation`: `popstate` 이벤트 → `"page_view"` + referrer 검증
- `navigation`: cleanup → `history.pushState` 원본 동일성(identity) 검증
- `navigation`: cleanup → `popstate` emit 미호출 검증
