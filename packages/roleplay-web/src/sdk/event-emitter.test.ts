import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createEventEmitter } from "./event-emitter.js";
import type { QaBridge } from "./qa-bridge.js";
import type { ChildBridge } from "../iframe/child-bridge.js";

function makeBridge(): QaBridge {
  return {
    startSession: vi.fn().mockReturnValue({ traceId: "trc_test", sessionId: "ses_test" }),
    emitEvent: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  };
}

function makeChildBridge(): ChildBridge {
  return {
    notifyEvent: vi.fn(),
    onContext: vi.fn(),
    destroy: vi.fn(),
  };
}

describe("EventEmitter — attach / 이벤트 수집", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  it("클릭 이벤트가 'click' QA 이벤트로 변환된다", () => {
    const bridge = makeBridge();
    const childBridge = makeChildBridge();
    const emitter = createEventEmitter(bridge, childBridge);
    emitter.attach(container);

    const btn = document.createElement("button");
    btn.id = "submit-btn";
    container.appendChild(btn);
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(bridge.emitEvent).toHaveBeenCalledWith("click", expect.objectContaining({
      target_selector: expect.stringContaining("button"),
    }));
    expect(childBridge.notifyEvent).toHaveBeenCalledWith("click");
  });

  it("클릭 payload에 target_text가 포함된다", () => {
    const bridge = makeBridge();
    const emitter = createEventEmitter(bridge, makeChildBridge());
    emitter.attach(container);

    const btn = document.createElement("button");
    btn.textContent = "결제하기";
    container.appendChild(btn);
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const [, payload] = (bridge.emitEvent as ReturnType<typeof vi.fn>).mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.target_text).toBe("결제하기");
  });

  it("input 이벤트가 'input_change' QA 이벤트로 변환된다", () => {
    const bridge = makeBridge();
    const emitter = createEventEmitter(bridge, makeChildBridge());
    emitter.attach(container);

    const input = document.createElement("input");
    input.name = "email";
    input.value = "user@test.com";
    container.appendChild(input);
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(bridge.emitEvent).toHaveBeenCalledWith("input_change", expect.objectContaining({
      field_name: "email",
      field_value: "user@test.com",
    }));
  });

  it("select change 이벤트도 'input_change'로 수집된다", () => {
    const bridge = makeBridge();
    const emitter = createEventEmitter(bridge, makeChildBridge());
    emitter.attach(container);

    const select = document.createElement("select");
    select.name = "category";
    container.appendChild(select);
    select.dispatchEvent(new Event("change", { bubbles: true }));

    expect(bridge.emitEvent).toHaveBeenCalledWith("input_change", expect.objectContaining({
      field_name: "category",
    }));
  });

  it("form submit이 'form_submit' QA 이벤트로 변환된다", () => {
    const bridge = makeBridge();
    const emitter = createEventEmitter(bridge, makeChildBridge());
    emitter.attach(container);

    const form = document.createElement("form");
    form.id = "login-form";
    container.appendChild(form);
    form.dispatchEvent(new Event("submit", { bubbles: true }));

    expect(bridge.emitEvent).toHaveBeenCalledWith("form_submit", expect.objectContaining({
      form_id: "login-form",
    }));
  });

  it("form submit은 기본 동작(페이지 이동)을 preventDefault한다", () => {
    const bridge = makeBridge();
    const emitter = createEventEmitter(bridge, makeChildBridge());
    emitter.attach(container);

    const form = document.createElement("form");
    container.appendChild(form);

    const submitEvent = new Event("submit", { bubbles: true, cancelable: true });
    const preventDefaultSpy = vi.spyOn(submitEvent, "preventDefault");
    form.dispatchEvent(submitEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});

describe("EventEmitter — detach", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  it("detach() 후에는 이벤트가 수집되지 않는다", () => {
    const bridge = makeBridge();
    const emitter = createEventEmitter(bridge, makeChildBridge());
    emitter.attach(container);
    emitter.detach();

    container.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(bridge.emitEvent).not.toHaveBeenCalled();
  });

  it("attach → detach → attach 순서에서 이벤트가 정확히 1회 수집된다", () => {
    const bridge = makeBridge();
    const emitter = createEventEmitter(bridge, makeChildBridge());

    emitter.attach(container);
    emitter.detach();
    emitter.attach(container);

    container.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(bridge.emitEvent).toHaveBeenCalledTimes(1);
  });

  it("detach() 여러 번 호출해도 에러 없이 안전하게 처리된다 (idempotent)", () => {
    const bridge = makeBridge();
    const emitter = createEventEmitter(bridge, makeChildBridge());
    emitter.attach(container);

    expect(() => {
      emitter.detach();
      emitter.detach();
      emitter.detach();
    }).not.toThrow();
  });
});
