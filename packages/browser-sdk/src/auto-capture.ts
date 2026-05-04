/** @def.boundary browser-runtime-system */
import type { AutoCaptureConfig } from "./types.js";

type Emitter = (eventKey: string, payload?: Record<string, unknown>) => void;

/**
 * DOM 이벤트를 감지해 QA 이벤트로 자동 변환한다.
 * 반환값은 cleanup 함수 — monitor.shutdown() 시 호출하면 리스너가 제거된다.
 */
export function createAutoCapture(config: AutoCaptureConfig, emit: Emitter): () => void {
  const cleanups: Array<() => void> = [];

  if (config.clicks) {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // button, a, [data-qa-event] 에 한정 — 광범위한 클릭 수집 방지
      const el = target.closest("button, a, [data-qa-event]") as HTMLElement | null;
      if (!el) return;

      emit("click", {
        tag: el.tagName.toLowerCase(),
        text: el.textContent?.trim().slice(0, 100) ?? "",
        qa_id: el.dataset["qaId"] ?? el.id ?? undefined,
        href: el instanceof HTMLAnchorElement ? el.href : undefined,
        qa_event: el.dataset["qaEvent"] ?? undefined,
      });
    };

    document.addEventListener("click", onClick, true);
    cleanups.push(() => document.removeEventListener("click", onClick, true));
  }

  if (config.forms) {
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement | null;
      if (!form) return;

      const data = new FormData(form);
      const fields: string[] = [];
      data.forEach((_, key) => fields.push(key));

      emit("form_submit", {
        form_id: form.id || undefined,
        form_action: form.action || undefined,
        field_count: fields.length,
      });
    };

    document.addEventListener("submit", onSubmit, true);
    cleanups.push(() => document.removeEventListener("submit", onSubmit, true));
  }

  if (config.navigation) {
    const onPopState = () => {
      emit("page_view", { url: location.href, referrer: document.referrer });
    };
    window.addEventListener("popstate", onPopState);
    cleanups.push(() => window.removeEventListener("popstate", onPopState));

    // history.pushState는 이벤트를 발생시키지 않으므로 패치
    const originalPush = history.pushState;
    history.pushState = function (...args: Parameters<typeof history.pushState>) {
      originalPush.call(history, ...args);
      emit("page_view", { url: location.href });
    };
    cleanups.push(() => {
      history.pushState = originalPush;
    });
  }

  return () => cleanups.forEach((fn) => fn());
}
