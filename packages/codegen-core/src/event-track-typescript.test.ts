import { describe, it, expect } from "vitest";
import { generateTrackCode } from "./event-track-typescript.js";
import type { EventDef, EventMapping, PayloadGuide } from "./event-track-typescript.js";

// ── 픽스처 ────────────────────────────────────────────

const EVENTS: EventDef[] = [
  {
    event_key: "page.view",
    event_version: "1.0",
    category: "navigation",
    channel: ["browser"],
    display_name: "페이지 뷰",
    description: "페이지 조회 이벤트",
    auto_collectable: true,
  },
  {
    event_key: "cart.add",
    event_version: "1.0",
    category: "interaction",
    channel: ["browser"],
    display_name: "장바구니 추가",
    description: "장바구니에 상품을 추가",
    auto_collectable: false,
  },
  {
    event_key: "auth.login",
    event_version: "1.0",
    category: "session",
    channel: ["browser", "mobile"],
    display_name: "로그인",
    description: "사용자 로그인",
    auto_collectable: false,
  },
];

const MAPPINGS: EventMapping[] = [
  {
    event_key: "page.view",
    domain: "navigation",
    prefixes: [
      { prefixId: "page_view", dims: { page: { kind: "context", contextKey: "page" } } },
      { prefixId: "tracking", dims: { trackAction: { kind: "fixed", value: "view" } } },
    ],
  },
  {
    event_key: "cart.add",
    domain: "commerce",
    prefixes: [
      { prefixId: "tracking", dims: { trackAction: { kind: "fixed", value: "add_to_cart" } } },
      { prefixId: "cart_event", dims: { action: { kind: "fixed", value: "add" } } },
    ],
  },
  {
    event_key: "auth.login",
    domain: "auth",
    prefixes: [
      { prefixId: "auth_event", dims: { action: { kind: "fixed", value: "login" } } },
    ],
  },
];

const PAYLOAD_GUIDES: PayloadGuide[] = [
  {
    event_key: "page.view",
    fields: [
      { name: "page", required: true, type: "string", description: "페이지 경로" },
      { name: "title", required: false, type: "string", description: "페이지 제목" },
      { name: "referrer", required: false, type: "string", description: "이전 페이지" },
    ],
  },
  {
    event_key: "cart.add",
    fields: [
      { name: "item_id", required: false, type: "number", description: "상품 ID" },
      { name: "quantity", required: false, type: "number", description: "수량" },
    ],
  },
];

const OPTS = { timestamp: "2026-04-02T00:00:00.000Z" };

// ── generateTrackCode ────────────────────────────────

describe("generateTrackCode", () => {
  it("4개 파일 생성", () => {
    const result = generateTrackCode(EVENTS, MAPPINGS, PAYLOAD_GUIDES, OPTS);

    expect(result.files).toHaveLength(4);
    const paths = result.files.map(f => f.path);
    expect(paths).toContain("event-keys.ts");
    expect(paths).toContain("event-payloads.ts");
    expect(paths).toContain("track-functions.ts");
    expect(paths).toContain("index.ts");
  });

  it("contentHash가 결정론적", () => {
    const r1 = generateTrackCode(EVENTS, MAPPINGS, PAYLOAD_GUIDES, OPTS);
    const r2 = generateTrackCode(EVENTS, MAPPINGS, PAYLOAD_GUIDES, OPTS);

    expect(r1.contentHash).toBe(r2.contentHash);
    expect(r1.contentHash).toHaveLength(12);
  });

  it("이벤트 순서 변경해도 같은 hash", () => {
    const reversed = [...EVENTS].reverse();
    const r1 = generateTrackCode(EVENTS, MAPPINGS, PAYLOAD_GUIDES, OPTS);
    const r2 = generateTrackCode(reversed, MAPPINGS, PAYLOAD_GUIDES, OPTS);

    expect(r1.contentHash).toBe(r2.contentHash);
  });

  it("모든 파일에 자동 생성 헤더 포함", () => {
    const result = generateTrackCode(EVENTS, MAPPINGS, PAYLOAD_GUIDES, OPTS);

    for (const file of result.files) {
      expect(file.content).toContain("자동 생성 파일");
      expect(file.content).toContain(result.contentHash);
    }
  });
});

// ── event-keys.ts ────────────────────────────────────

describe("event-keys.ts", () => {
  it("EventKey 유니온 타입 생성", () => {
    const result = generateTrackCode(EVENTS, MAPPINGS, PAYLOAD_GUIDES, OPTS);
    const content = result.files.find(f => f.path === "event-keys.ts")!.content;

    expect(content).toContain('export type EventKey =');
    expect(content).toContain('"page.view"');
    expect(content).toContain('"cart.add"');
    expect(content).toContain('"auth.login"');
  });

  it("카테고리별 유니온 타입 생성", () => {
    const result = generateTrackCode(EVENTS, MAPPINGS, PAYLOAD_GUIDES, OPTS);
    const content = result.files.find(f => f.path === "event-keys.ts")!.content;

    expect(content).toContain("NavigationEventKey");
    expect(content).toContain("InteractionEventKey");
    expect(content).toContain("SessionEventKey");
  });

  it("EVENT_KEYS const 배열 생성", () => {
    const result = generateTrackCode(EVENTS, MAPPINGS, PAYLOAD_GUIDES, OPTS);
    const content = result.files.find(f => f.path === "event-keys.ts")!.content;

    expect(content).toContain("export const EVENT_KEYS");
    expect(content).toContain('"page.view"');
  });
});

// ── event-payloads.ts ────────────────────────────────

describe("event-payloads.ts", () => {
  it("이벤트별 payload 인터페이스 생성", () => {
    const result = generateTrackCode(EVENTS, MAPPINGS, PAYLOAD_GUIDES, OPTS);
    const content = result.files.find(f => f.path === "event-payloads.ts")!.content;

    expect(content).toContain("export interface PageViewPayload");
    expect(content).toContain("export interface CartAddPayload");
    expect(content).toContain("export interface AuthLoginPayload");
  });

  it("필드 타입과 optional 정확히 반영", () => {
    const result = generateTrackCode(EVENTS, MAPPINGS, PAYLOAD_GUIDES, OPTS);
    const content = result.files.find(f => f.path === "event-payloads.ts")!.content;

    // page는 required → optional 없음
    expect(content).toMatch(/page: string;/);
    // title은 optional
    expect(content).toMatch(/title\?: string;/);
    // item_id는 optional number
    expect(content).toMatch(/item_id\?: number;/);
  });

  it("payload 가이드 없는 이벤트 → index signature", () => {
    const result = generateTrackCode(EVENTS, MAPPINGS, PAYLOAD_GUIDES, OPTS);
    const content = result.files.find(f => f.path === "event-payloads.ts")!.content;

    // auth.login에는 payload 가이드 없음
    // AuthLoginPayload에 [key: string]: unknown 포함
    const authSection = content.slice(content.indexOf("AuthLoginPayload"));
    expect(authSection).toContain("[key: string]: unknown;");
  });

  it("EventPayloadMap 인터페이스 생성", () => {
    const result = generateTrackCode(EVENTS, MAPPINGS, PAYLOAD_GUIDES, OPTS);
    const content = result.files.find(f => f.path === "event-payloads.ts")!.content;

    expect(content).toContain("export interface EventPayloadMap");
    expect(content).toContain('"page.view": PageViewPayload');
    expect(content).toContain('"cart.add": CartAddPayload');
  });
});

// ── track-functions.ts ───────────────────────────────

describe("track-functions.ts", () => {
  it("이벤트별 track 함수 생성", () => {
    const result = generateTrackCode(EVENTS, MAPPINGS, PAYLOAD_GUIDES, OPTS);
    const content = result.files.find(f => f.path === "track-functions.ts")!.content;

    expect(content).toContain("export function trackPageView");
    expect(content).toContain("export function trackCartAdd");
    expect(content).toContain("export function trackAuthLogin");
  });

  it("제네릭 track 함수 생성", () => {
    const result = generateTrackCode(EVENTS, MAPPINGS, PAYLOAD_GUIDES, OPTS);
    const content = result.files.find(f => f.path === "track-functions.ts")!.content;

    expect(content).toContain("export function track<K extends EventKey>");
  });

  it("Tracker 인터페이스 정의", () => {
    const result = generateTrackCode(EVENTS, MAPPINGS, PAYLOAD_GUIDES, OPTS);
    const content = result.files.find(f => f.path === "track-functions.ts")!.content;

    expect(content).toContain("export interface Tracker");
    expect(content).toContain("track(eventKey: string");
  });

  it("필수 필드 있는 이벤트 → payload 필수 파라미터", () => {
    const result = generateTrackCode(EVENTS, MAPPINGS, PAYLOAD_GUIDES, OPTS);
    const content = result.files.find(f => f.path === "track-functions.ts")!.content;

    // page.view는 required 필드(page)가 있으므로 payload 필수
    expect(content).toMatch(/trackPageView\(tracker: Tracker, payload: PageViewPayload\)/);
  });

  it("필수 필드 없는 이벤트 → payload 선택 파라미터", () => {
    const result = generateTrackCode(EVENTS, MAPPINGS, PAYLOAD_GUIDES, OPTS);
    const content = result.files.find(f => f.path === "track-functions.ts")!.content;

    // cart.add는 required 필드 없으므로 payload?
    expect(content).toMatch(/trackCartAdd\(tracker: Tracker, payload\?: CartAddPayload\)/);
  });
});

// ── index.ts ─────────────────────────────────────────

describe("index.ts (barrel)", () => {
  it("모든 타입과 함수 re-export", () => {
    const result = generateTrackCode(EVENTS, MAPPINGS, PAYLOAD_GUIDES, OPTS);
    const content = result.files.find(f => f.path === "index.ts")!.content;

    expect(content).toContain("EventKey");
    expect(content).toContain("EVENT_KEYS");
    expect(content).toContain("EventPayloadMap");
    expect(content).toContain("track");
    expect(content).toContain("trackPageView");
    expect(content).toContain("trackCartAdd");
    expect(content).toContain("Tracker");
  });
});

// ── 매핑 없는 이벤트 필터링 ──────────────────────────

describe("매핑 필터링", () => {
  it("매핑 없는 이벤트는 track 함수 생성 안 함", () => {
    const eventsWithExtra: EventDef[] = [
      ...EVENTS,
      {
        event_key: "no.mapping",
        event_version: "1.0",
        category: "infrastructure",
        channel: ["backend"],
        display_name: "매핑 없음",
        description: "매핑이 없는 이벤트",
        auto_collectable: false,
      },
    ];

    const result = generateTrackCode(eventsWithExtra, MAPPINGS, PAYLOAD_GUIDES, OPTS);
    const trackContent = result.files.find(f => f.path === "track-functions.ts")!.content;
    const keysContent = result.files.find(f => f.path === "event-keys.ts")!.content;

    // 매핑이 없는 이벤트는 제외
    expect(trackContent).not.toContain("trackNoMapping");
    expect(keysContent).not.toContain('"no.mapping"');
  });
});

// ── 빈 입력 ──────────────────────────────────────────

describe("빈 입력", () => {
  it("이벤트 0개 → 빈 파일 생성", () => {
    const result = generateTrackCode([], [], [], OPTS);

    expect(result.files).toHaveLength(4);
    const keysContent = result.files.find(f => f.path === "event-keys.ts")!.content;
    expect(keysContent).toContain("자동 생성 파일");
  });
});
