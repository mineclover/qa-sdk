/**
 * Pipe Design Catalog
 * Role / Certainty / Flow 29종 / Edge 8종 / Concern 8종 / 줌 비교 / 실전 패턴
 */

import {
  type PipeGraph,
  type PipeSpec,
  type PipeConnection,
  type PipeFlow,
  type PortRef,
  classifyPipeRole, extractPipeConcerns,
} from "@qa-sdk/core";
import {
  type StandaloneNodeOptions,
  type StandaloneEdgeOptions,
  pipeGraphToSvg,
  standaloneNodeSvg, standaloneEdgeSvg,
  ROLE_TOKENS, CONCERN_TOKENS, EDGE_TOKENS,
} from "viz-core";

// ── 헬퍼 ─────────────────────────────────────────────

function mkPipe(id: string, flow: PipeFlow, extra?: Partial<PipeSpec>): PipeSpec {
  return { pipeId: id, version: "1.0.0", trigger: { eventKey: `${id}.triggered` }, flow, ...extra };
}
function mkGraph(id: string, pipes: PipeSpec[], connections: PipeConnection[], entry: string): PipeGraph {
  return { graphId: id, version: "1.0.0", pipes, connections, entryPipeId: entry };
}
function conn(from: string, to: string, kind: PipeConnection["kind"] = "next", cond?: string): PipeConnection {
  return { from, to, kind, ...(cond ? { condition: cond } : {}) };
}
function portRef(pipeId: string, portId: string): PortRef {
  return { pipeId, portId };
}
function getRequiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (element == null) {
    throw new Error(`필수 카탈로그 컨테이너를 찾을 수 없습니다: ${id}`);
  }
  return element;
}

const step = (id: string): PipeFlow => ({ kind: "step", facet: id });

// ── Role 노드 갤러리 ──────────────────────────────────

function buildRoleGrid() {
  const el = getRequiredElement("role-grid");
  const items: Array<StandaloneNodeOptions & { desc: string }> = [
    { role: "producer",    label: "producer",    desc: "이벤트를 생산<br>emit 중심" },
    { role: "consumer",    label: "consumer",    desc: "이벤트를 소비<br>produces 없음" },
    { role: "transformer", label: "transformer", desc: "입력 → 출력 변환<br>trigger + produces" },
    { role: "router",      label: "router",      desc: "분기 전담<br>branch 중심" },
    { role: "observer",    label: "observer",    desc: "비침투 모니터링<br>tap 중심" },
  ];
  el.innerHTML = items.map(({ desc, ...opts }) => {
    const { fill, stroke } = ROLE_TOKENS[opts.role];
    return `<div class="node-card">
      ${standaloneNodeSvg({ ...opts, width: 130, height: 52 })}
      <div class="label" style="color:${stroke}">${opts.label}</div>
      <div class="desc">${desc}</div>
      <div style="font-size:10px;font-family:monospace;color:#aaa">${fill} · ${stroke}</div>
    </div>`;
  }).join("");
}

// ── Certainty 노드 갤러리 ─────────────────────────────

function buildCertaintyGrid() {
  const el = getRequiredElement("certainty-grid");
  const items: Array<StandaloneNodeOptions & { desc: string }> = [
    { role: "transformer", label: "strict",   certainty: "strict",   desc: "step, sequence<br>실선 테두리" },
    { role: "transformer", label: "flexible", certainty: "flexible", desc: "optional, branch<br>긴 점선 — — —" },
    { role: "transformer", label: "mixed",    certainty: "mixed",    desc: "sequence + optional<br>짧은 점선 - - -" },
  ];
  el.innerHTML = items.map(({ desc, ...opts }) => `
    <div class="node-card">
      ${standaloneNodeSvg({ ...opts, width: 130, height: 52 })}
      <div class="label">${opts.label}</div>
      <div class="desc">${desc}</div>
    </div>`).join("");
}

// ── Entry · Concern · Folded ──────────────────────────

function buildModifierGrid() {
  const el = getRequiredElement("modifier-grid");
  const items: Array<StandaloneNodeOptions & { desc: string }> = [
    { role: "consumer",    label: "entry node", isEntry: true,
      desc: "그래프 진입점<br>좌측 ▶ 마커" },
    { role: "producer",    label: "resilience+latency",
      concerns: ["resilience", "latency"],
      desc: "concern 2개<br>우측 배지" },
    { role: "transformer", label: "all concerns",
      concerns: ["resilience", "latency", "concurrency", "data-mutation"],
      desc: "concern 최대 4개 표시" },
    { role: "consumer",    label: "folded ×6",
      isFolded: true, foldedCount: 6,
      desc: "접힌 노드<br>이중 테두리 stadium" },
  ];
  el.innerHTML = items.map(({ desc, ...opts }) => `
    <div class="node-card">
      ${standaloneNodeSvg({ ...opts, width: 140, height: 54 })}
      <div class="label">${opts.label}</div>
      <div class="desc">${desc}</div>
    </div>`).join("");
}

// ── Role × Certainty 매트릭스 ─────────────────────────

function buildMatrix() {
  const el = getRequiredElement("matrix-grid");
  const roles: StandaloneNodeOptions["role"][] = ["producer", "consumer", "transformer", "router", "observer"];
  const certs: StandaloneNodeOptions["certainty"][] = ["strict", "flexible", "mixed"];

  const header = `<tr><th></th>${certs.map(c => `<th>${c}</th>`).join("")}</tr>`;
  const rows = roles.map(role => {
    const cells = certs.map(certainty => {
      const svg = standaloneNodeSvg({ role, label: role, certainty, width: 120, height: 46 });
      return `<td>${svg}</td>`;
    }).join("");
    const { stroke } = ROLE_TOKENS[role];
    return `<tr><td class="row-label" style="border-left:3px solid ${stroke}">${role}</td>${cells}</tr>`;
  }).join("");

  el.innerHTML = `<table>${header}${rows}</table>`;
}

// ── PipeFlow 29종 카탈로그 ────────────────────────────

interface FlowEntry {
  kind: string;
  flow: PipeFlow;
  produces?: string[];
  fields: string;
}

const FLOW_CATEGORIES: Array<{
  label: string;
  color: string;
  entries: FlowEntry[];
}> = [
  {
    label: "기본", color: "#546e7a",
    entries: [
      { kind: "step",     flow: { kind: "step", facet: "my-step" },   fields: "facet" },
      { kind: "sequence", flow: { kind: "sequence", steps: [step("a"), step("b")] }, fields: "steps[]" },
    ],
  },
  {
    label: "분기", color: "#1976d2",
    entries: [
      { kind: "branch",   flow: { kind: "branch", condition: "x>0", paths: [step("yes"), step("no")] }, fields: "condition, paths[]" },
      { kind: "optional", flow: { kind: "optional", step: step("maybe") }, fields: "step" },
    ],
  },
  {
    label: "동시성", color: "#7b1fa2",
    entries: [
      { kind: "parallel", flow: { kind: "parallel", steps: [step("a"), step("b")] }, fields: "steps[]" },
      { kind: "race",     flow: { kind: "race",     steps: [step("a"), step("b")] }, fields: "steps[]" },
      // oxlint-disable-next-line unicorn/no-thenable -- PipeAwait 스키마의 표준 필드명이다.
      { kind: "await",    flow: { kind: "await", condition: "ready", timeout: 5000, then: step("next") }, fields: "condition, timeout, then" },
    ],
  },
  {
    label: "내결함", color: "#c62828",
    entries: [
      { kind: "retry",           flow: { kind: "retry",           step: step("op"), maxAttempts: 3, backoff: 500 },      fields: "step, maxAttempts, backoff?" },
      { kind: "fallback",        flow: { kind: "fallback",        try: step("primary"), catch: step("backup") },         fields: "try, catch" },
      { kind: "circuit-breaker", flow: { kind: "circuit-breaker", step: step("call"),  failureThreshold: 5, cooldown: 3000 }, fields: "step, failureThreshold, cooldown" },
    ],
  },
  {
    label: "반복 / 제어", color: "#e65100",
    entries: [
      { kind: "loop",     flow: { kind: "loop",     body: step("item"),  until: "done", maxIterations: 100 },            fields: "body, until, maxIterations?" },
      { kind: "feedback", flow: { kind: "feedback", body: step("check"), feedbackEvent: "retry.triggered", until: "ok" }, fields: "body, feedbackEvent, until" },
    ],
  },
  {
    label: "트랜잭션 / 정리", color: "#ad1457",
    entries: [
      { kind: "compensate", flow: { kind: "compensate", forward: step("charge"), compensate: step("refund") }, fields: "forward, compensate" },
      { kind: "finally",    flow: { kind: "finally",    body: step("exec"),    cleanup: step("cleanup") },    fields: "body, cleanup" },
    ],
  },
  {
    label: "비동기 / 시간", color: "#0288d1",
    entries: [
      { kind: "emit",    flow: { kind: "emit", eventKey: "order.created" }, produces: ["order.created"], fields: "eventKey, payload?" },
      { kind: "timeout", flow: { kind: "timeout", body: step("slow"), duration: 3000, onTimeout: step("abort") }, fields: "body, duration, onTimeout?" },
    ],
  },
  {
    label: "배치", color: "#2e7d32",
    entries: [
      { kind: "map",    flow: { kind: "map",    itemFlow: step("item"), collection: "items", concurrency: 4 }, fields: "itemFlow, collection, concurrency?" },
      { kind: "reduce", flow: { kind: "reduce", step: step("acc"),      initial: "0",        accumulator: "sum" }, fields: "step, initial, accumulator" },
      { kind: "buffer", flow: { kind: "buffer", body: step("batch"),    count: 100,          duration: 1000 },     fields: "body, count?, duration?" },
      { kind: "filter", flow: { kind: "filter", condition: "valid",     step: step("proc") },                      fields: "condition, step" },
    ],
  },
  {
    label: "안정화", color: "#827717",
    entries: [
      { kind: "throttle", flow: { kind: "throttle", step: step("api"),   rate: 100, interval: 1000 }, fields: "step, rate, interval" },
      { kind: "debounce", flow: { kind: "debounce", step: step("search"), wait: 300 },                fields: "step, wait" },
    ],
  },
  {
    label: "데이터 변환", color: "#4e342e",
    entries: [
      { kind: "split",  flow: { kind: "split",  splitBy: "tags",   itemFlow: step("tag") },                           fields: "splitBy, itemFlow" },
      { kind: "enrich", flow: { kind: "enrich", source: "user-db", mergeField: "user", step: step("process") },       fields: "source, mergeField, step" },
    ],
  },
  {
    label: "관측", color: "#37474f",
    entries: [
      { kind: "tap", flow: { kind: "tap", observe: step("monitor"), step: step("main") }, fields: "observe, step" },
    ],
  },
  {
    label: "스트리밍", color: "#00695c",
    entries: [
      { kind: "resequence", flow: { kind: "resequence", orderBy: "seq", windowSize: 50, step: step("emit") }, fields: "orderBy, windowSize, step" },
      { kind: "window",     flow: { kind: "window",     type: "tumbling", size: 60,     body: step("agg") },   fields: "type, size, body, slide?" },
    ],
  },
  {
    label: "상태", color: "#1a237e",
    entries: [
      { kind: "dedup",       flow: { kind: "dedup",       keyField: "id",     ttl: 3600, step: step("pass") }, fields: "keyField, ttl?, step" },
      { kind: "correlation", flow: { kind: "correlation", requestEvent: "req.sent", responseEvent: "res.received", correlationKey: "traceId", onMatch: step("handle") }, fields: "requestEvent, responseEvent, correlationKey, onMatch" },
    ],
  },
];

function buildFlowCatalog() {
  const el = getRequiredElement("flow-catalog");
  el.innerHTML = FLOW_CATEGORIES.map(cat => {
    const cards = cat.entries.map(entry => {
      const pipe = mkPipe(entry.kind, entry.flow, entry.produces ? { produces: entry.produces } : {});
      const role = classifyPipeRole(pipe);
      const concerns = extractPipeConcerns(pipe);
      const { fill, stroke } = ROLE_TOKENS[role];
      const svg = standaloneNodeSvg({ role, label: entry.kind, concerns, width: 130, height: 48 });

      const concernBadges = concerns.slice(0, 4).map(c => {
        const m = CONCERN_TOKENS[c];
        return m ? `<span class="ctag" style="background:${m.color}" title="${c}">${m.letter}</span>` : "";
      }).join("");

      return `<div class="flow-card" style="border-top-color:${cat.color}">
        ${svg}
        <div class="kind" style="color:${cat.color}">${entry.kind}</div>
        <div class="role-tag" style="background:${fill};color:${stroke}">${role}</div>
        ${concerns.length ? `<div class="concern-tags">${concernBadges}</div>` : ""}
        <div class="fields">${entry.fields}</div>
      </div>`;
    }).join("");

    return `<div class="flow-category">
      <div class="flow-category-title" style="background:${cat.color}">${cat.label}</div>
      <div class="flow-grid">${cards}</div>
    </div>`;
  }).join("");
}

// ── Edge 갤러리 ───────────────────────────────────────

function buildEdgeGrid() {
  const el = getRequiredElement("edge-grid");
  const kinds: PipeConnection["kind"][] = [
    "next", "conditional", "event", "error", "compensate", "fan-out", "join", "feedback",
  ];
  const descs: Record<string, string> = {
    next:        "일반 순차 흐름. 실선 채운 화살표",
    conditional: "조건 분기. 파란 점선 + 빈 화살표 + 조건 배지",
    event:       "이벤트 경계. 보라 이중 굵은 선 + 큰 채운 화살표",
    error:       "에러 흐름. 빨간 파선 + X 마커",
    compensate:  "보상 트랜잭션. 분홍 점선 + 양끝 원형",
    "fan-out":   "병렬 분기. 하늘 실선 + 빈 화살표",
    join:        "병렬 합류. 초록 실선 + 채운 화살표",
    feedback:    "피드백 루프. 주황 점선 + U턴 arc",
  };
  el.innerHTML = kinds.map(kind => {
    const token = EDGE_TOKENS[kind];
    const condition = kind === "conditional" ? "type=card" : undefined;
    const svg = standaloneEdgeSvg({ kind, condition, width: 300, height: 110 });
    const bg = token.stroke + "18";
    return `<div class="edge-card">
      <div class="edge-header">
        <span class="kind-badge" style="background:${bg};color:${token.stroke}">${kind}</span>
        <span class="color-code">${token.stroke}</span>
      </div>
      ${svg}
      <div class="edge-desc">${descs[kind]}</div>
      <div class="edge-meta">stroke-width: ${token.strokeWidth}${token.strokeDash ? ` · dasharray: ${token.strokeDash}` : ""}</div>
    </div>`;
  }).join("");
}

// ── Port + FacetType 갤러리 ───────────────────────────

function buildPortFacetGrid() {
  const portEl = getRequiredElement("port-grid");
  const facetEdgeEl = getRequiredElement("facet-edge-grid");

  const portItems: Array<{
    title: string;
    desc: string;
    node: StandaloneNodeOptions;
    facets?: string[];
  }> = [
    {
      title: "input-only",
      desc: "왼쪽 경계에 input port만 배치",
      node: {
        role: "consumer",
        label: "ingest",
        ports: [{ portId: "orderData", direction: "in", facetType: "OrderData" }],
      },
      facets: ["OrderData"],
    },
    {
      title: "output-only",
      desc: "오른쪽 경계에 output port만 배치",
      node: {
        role: "producer",
        label: "emit",
        ports: [{ portId: "paymentResult", direction: "out", facetType: "PaymentResult" }],
      },
      facets: ["PaymentResult"],
    },
    {
      title: "input + output",
      desc: "양방향 handoff를 동시에 표시",
      node: {
        role: "transformer",
        label: "payment",
        ports: [
          { portId: "orderData", direction: "in", facetType: "OrderData" },
          { portId: "paymentResult", direction: "out", facetType: "PaymentResult" },
        ],
      },
      facets: ["OrderData", "PaymentResult"],
    },
    {
      title: "typed facetType 4종",
      desc: "facetType 해시 색상이 port dot마다 독립 적용",
      node: {
        role: "transformer",
        label: "router",
        ports: [
          { portId: "orderData", direction: "in", facetType: "OrderData" },
          { portId: "auditTrail", direction: "in", facetType: "AuditTrail" },
          { portId: "paymentResult", direction: "out", facetType: "PaymentResult" },
          { portId: "notificationCommand", direction: "out", facetType: "NotificationCommand" },
        ],
      },
      facets: ["OrderData", "AuditTrail", "PaymentResult", "NotificationCommand"],
    },
  ];

  const edgeItems: Array<StandaloneEdgeOptions & { title: string; desc: string }> = [
    {
      title: "next",
      desc: "기본 handoff도 facetType pill로 payload를 명시",
      kind: "next",
      facetType: "PaymentResult",
    },
    {
      title: "event",
      desc: "이벤트 경계를 넘는 연결에도 facetType 라벨 유지",
      kind: "event",
      facetType: "OrderConfirmed",
    },
    {
      title: "conditional",
      desc: "조건 배지와 facetType pill이 동시에 공존",
      kind: "conditional",
      facetType: "PaymentRoute",
      condition: "amount>100000",
    },
    {
      title: "fan-out",
      desc: "멀티 채널 분기에서도 공통 facetType을 공유",
      kind: "fan-out",
      facetType: "NotificationCommand",
    },
  ];

  portEl.innerHTML = portItems.map(({ title, desc, node, facets }) => `
    <div class="mini-card">
      ${standaloneNodeSvg({ ...node, width: 138, height: 54, padding: 22 })}
      <div class="mini-title">${title}</div>
      <div class="mini-desc">${desc}</div>
      ${facets?.length
        ? `<div class="facet-list">${facets.map(facet => `<span class="facet-pill">${facet}</span>`).join("")}</div>`
        : ""}
    </div>
  `).join("");

  facetEdgeEl.innerHTML = edgeItems.map(({ title, desc, ...edge }) => `
    <div class="mini-card">
      ${standaloneEdgeSvg({ ...edge, width: 252, height: 96, padding: 24 })}
      <div class="mini-title">${title}</div>
      <div class="mini-desc">${desc}</div>
    </div>
  `).join("");
}

// ── Concern 배지 갤러리 ───────────────────────────────

function buildConcernGrid() {
  const el = getRequiredElement("concern-grid");
  const hints: Record<string, string> = {
    resilience:       "retry, fallback, circuit-breaker",
    latency:          "timeout, await, throttle, debounce",
    concurrency:      "parallel, race",
    "data-mutation":  "accesses write/readwrite",
    "data-read":      "accesses read/readwrite",
    "async-coupling": "emit, correlation",
    "data-filtering": "dedup, filter, resequence",
    observability:    "tap",
  };
  el.innerHTML = (Object.entries(CONCERN_TOKENS) as [string, { color: string; letter: string }][])
    .map(([key, meta]) => `
      <div class="concern-item">
        <div class="concern-circle" style="background:${meta.color}">${meta.letter}</div>
        <div class="concern-info">
          <div class="name">${key}</div>
          <div class="hint">${hints[key] ?? ""}</div>
        </div>
      </div>`).join("");
}

// ── 줌 레벨 비교 ─────────────────────────────────────

function buildZoomCompare() {
  const el = getRequiredElement("zoom-compare");

  const pipes = [
    mkPipe("auth",       { kind: "step", facet: "auth" }),
    mkPipe("fetch",      { kind: "retry", step: step("fetch-data"), maxAttempts: 3 }),
    mkPipe("transform",  { kind: "map", itemFlow: step("item"), collection: "results" }, { produces: ["data.ready"] }),
    mkPipe("validate",   { kind: "filter", condition: "valid", step: step("check") }),
    mkPipe("cache",      { kind: "dedup", keyField: "id", step: step("store") }),
    mkPipe("emit",       { kind: "emit", eventKey: "processed" }, { produces: ["processed"] }),
    mkPipe("monitor",    { kind: "tap", observe: step("log"), step: step("pass") }),
    mkPipe("respond",    { kind: "step", facet: "response" }),
  ];
  const graph = mkGraph("zoom-demo", pipes, [
    conn("auth", "fetch"), conn("fetch", "transform"), conn("transform", "validate"),
    conn("validate", "cache"), conn("cache", "emit", "event"), conn("validate", "monitor"),
    conn("monitor", "respond"), conn("emit", "respond"),
  ], "auth");

  const levels = [
    { level: "group" as const, title: "group 줌", desc: "체인/SCC → 접힌 노드로 축약" },
    { level: "module" as const, title: "module 줌", desc: "중간 해상도 — 주요 구조 표시" },
    { level: "leaf" as const,  title: "leaf 줌",   desc: "전체 펼침 — 모든 파이프 표시" },
  ];

  el.innerHTML = levels.map(({ level, title, desc }) => {
    const svg = pipeGraphToSvg(graph, level, { padding: 32 });
    return `<div class="zoom-card">
      <h4>${title}</h4>
      <div class="zdesc">${desc}</div>
      ${svg}
    </div>`;
  }).join("");
}

// ── 실전 패턴 갤러리 ──────────────────────────────────

function buildSampleGrid() {
  const el = getRequiredElement("sample-grid");

  const samples: Array<{ name: string; desc: string; graph: PipeGraph }> = [
    {
      name: "OrderData → [payment] → PaymentResult → [notification]",
      desc: "PortRef endpoint와 facetType edge label을 모두 명시한 실전 handoff 패턴",
      graph: mkGraph("port-facet-handoff", [
        mkPipe("order-data", step("order-data"), {
          ports: [
            { portId: "orderData", direction: "out", facetType: "OrderData", required: true },
          ],
        }),
        mkPipe("payment", { kind: "retry", step: step("payment-api"), maxAttempts: 3 }, {
          ports: [
            { portId: "orderData", direction: "in", facetType: "OrderData", required: true },
            { portId: "paymentResult", direction: "out", facetType: "PaymentResult", required: true },
          ],
        }),
        mkPipe("notification", { kind: "emit", eventKey: "notification.sent" }, {
          ports: [
            { portId: "paymentResult", direction: "in", facetType: "PaymentResult", required: true },
          ],
          produces: ["notification.sent"],
        }),
      ], [
        {
          from: portRef("order-data", "orderData"),
          to: portRef("payment", "orderData"),
          kind: "next",
          facetType: "OrderData",
        },
        {
          from: portRef("payment", "paymentResult"),
          to: portRef("notification", "paymentResult"),
          kind: "event",
          facetType: "PaymentResult",
        },
      ], "order-data"),
    },
    {
      name: "결제 분기 + 보상 트랜잭션",
      desc: "conditional → error → compensate 패턴",
      graph: mkGraph("payment", [
        mkPipe("checkout", step("checkout")),
        mkPipe("pay-card",  { kind: "retry", step: step("card-api"), maxAttempts: 3 }, { produces: ["payment.done"] }),
        mkPipe("pay-bank",  step("bank-api")),
        mkPipe("on-error",  step("err-handler")),
        mkPipe("refund",    { kind: "compensate", forward: step("deduct"), compensate: step("refund-exec") }),
        mkPipe("confirm",   { kind: "emit", eventKey: "order.confirmed" }, { produces: ["order.confirmed"] }),
      ], [
        conn("checkout", "pay-card", "conditional", "method=card"),
        conn("checkout", "pay-bank", "conditional", "method=bank"),
        conn("pay-card", "on-error", "error"),
        conn("on-error", "refund", "compensate"),
        conn("pay-card", "confirm"), conn("pay-bank", "confirm"), conn("refund", "confirm"),
      ], "checkout"),
    },
    {
      name: "팬아웃 알림 + 합류",
      desc: "fan-out → 병렬 채널 → join 합류",
      graph: mkGraph("notify", [
        mkPipe("trigger",    step("trigger")),
        mkPipe("send-email", step("email-svc")),
        mkPipe("send-sms",   step("sms-svc")),
        mkPipe("send-push",  step("push-svc")),
        mkPipe("log-result", { kind: "tap", observe: step("audit"), step: step("log") }),
      ], [
        conn("trigger", "send-email", "fan-out"),
        conn("trigger", "send-sms",   "fan-out"),
        conn("trigger", "send-push",  "fan-out"),
        conn("send-email", "log-result", "join"),
        conn("send-sms",   "log-result", "join"),
        conn("send-push",  "log-result", "join"),
      ], "trigger"),
    },
    {
      name: "스트림 처리 파이프라인",
      desc: "window → dedup → map → emit",
      graph: mkGraph("stream", [
        mkPipe("ingest",  step("kafka-in")),
        mkPipe("window",  { kind: "window",  type: "tumbling", size: 60, body: step("collect") }),
        mkPipe("dedup",   { kind: "dedup",   keyField: "eventId", ttl: 300, step: step("check") }),
        mkPipe("process", { kind: "map",     itemFlow: step("transform"), collection: "events", concurrency: 8 }, { produces: ["batch.ready"] }),
        mkPipe("emit",    { kind: "emit",    eventKey: "batch.processed" }, { produces: ["batch.processed"] }),
        mkPipe("monitor", { kind: "tap",     observe: step("metrics"), step: step("pass") }),
      ], [
        conn("ingest", "window"), conn("window", "dedup"), conn("dedup", "process"),
        conn("process", "emit", "event"), conn("process", "monitor"),
      ], "ingest"),
    },
    {
      name: "Circuit Breaker + Fallback",
      desc: "circuit-breaker → fallback → timeout 중첩",
      graph: mkGraph("resilience", [
        mkPipe("entry",      step("entry")),
        mkPipe("cb-call",    { kind: "circuit-breaker", step: { kind: "timeout", body: step("remote-api"), duration: 2000 }, failureThreshold: 5, cooldown: 10000 }),
        mkPipe("on-fail",    { kind: "fallback", try: step("cache-read"), catch: step("default-val") }),
        mkPipe("throttle",   { kind: "throttle", step: step("rate-limited"), rate: 50, interval: 1000 }),
        mkPipe("response",   { kind: "emit", eventKey: "response.ready" }, { produces: ["response.ready"] }),
      ], [
        conn("entry", "cb-call"), conn("cb-call", "on-fail", "error"),
        conn("cb-call", "throttle"), conn("on-fail", "response"), conn("throttle", "response"),
      ], "entry"),
    },
    {
      name: "Request-Response Correlation",
      desc: "correlation으로 비동기 요청-응답 매칭",
      graph: mkGraph("correlation", [
        mkPipe("sender",  { kind: "emit", eventKey: "req.sent" }, { produces: ["req.sent"] }),
        mkPipe("await",   { kind: "correlation",
          requestEvent: "req.sent", responseEvent: "res.received",
          correlationKey: "traceId", timeout: 5000,
          onMatch: step("handle-match"),
          onTimeout: step("handle-timeout"),
        }),
        mkPipe("enrich",  { kind: "enrich", source: "user-db", mergeField: "user", step: step("merge"), timeout: 1000 }),
        mkPipe("output",  { kind: "emit", eventKey: "result.ready" }, { produces: ["result.ready"] }),
      ], [
        conn("sender", "await", "event"),
        conn("await", "enrich"), conn("enrich", "output"),
      ], "sender"),
    },
    {
      name: "이벤트 체인 + 피드백 루프",
      desc: "event 전이 + feedback 반복 제어",
      graph: mkGraph("event-feedback", [
        mkPipe("order",        { kind: "emit", eventKey: "order.placed" }, { produces: ["order.placed"] }),
        mkPipe("reserve",      step("reserve-stock")),
        mkPipe("validate",     { kind: "filter", condition: "available", step: step("check") }),
        mkPipe("retry-decide", step("decide")),
        mkPipe("ship",         { kind: "emit", eventKey: "shipped" }, { produces: ["shipped"] }),
      ], [
        conn("order", "reserve", "event"),
        conn("reserve", "validate"),
        conn("validate", "ship"),
        conn("validate", "retry-decide", "conditional", "available=false"),
        conn("retry-decide", "reserve", "feedback"),
      ], "order"),
    },
  ];

  el.innerHTML = samples.map(s => {
    const svg = pipeGraphToSvg(s.graph, "leaf", { padding: 36 });
    return `<div class="sample-card">
      <h3>${s.name}</h3>
      <div class="sdesc">${s.desc}</div>
      ${svg}
    </div>`;
  }).join("");
}

// ── 초기화 ────────────────────────────────────────────

buildRoleGrid();
buildCertaintyGrid();
buildModifierGrid();
buildMatrix();
buildFlowCatalog();
buildEdgeGrid();
buildPortFacetGrid();
buildConcernGrid();
buildZoomCompare();
buildSampleGrid();
