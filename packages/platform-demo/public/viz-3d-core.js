var N = Object.defineProperty;
var A = (t, e, i) => e in t ? N(t, e, { enumerable: !0, configurable: !0, writable: !0, value: i }) : t[e] = i;
var T = (t, e, i) => A(t, typeof e != "symbol" ? e + "" : e, i);
const ne = {
  background: 328968,
  categories: {
    observation: { color: 58879, emissive: 38823 },
    event: { color: 16748800, emissive: 12545024 },
    policy: { color: 58998, emissive: 38436 },
    relation: { color: 11766015, emissive: 8146431 },
    entity: { color: 5533306, emissive: 3622735 },
    table: { color: 16732754, emissive: 12986408 }
  },
  layerColors: [6619098, 16752451, 8150268, 16726112],
  cellOpacity: 0.12,
  activeOpacity: 0.85,
  beamOpacity: 0.4
};
function re(t, e, i, s) {
  var c, h;
  const n = [], r = /* @__PURE__ */ new Map();
  for (const o of t) {
    const _ = [], l = i + s;
    if (o.axes3d) {
      const u = o.axes3d.x.entries, p = ((c = o.axes3d.y) == null ? void 0 : c.entries) ?? ["_"], v = ((h = o.axes3d.z) == null ? void 0 : h.entries) ?? ["_"], m = u.length, w = p.length, f = v.length;
      for (let d = 0; d < m; d++)
        for (let x = 0; x < w; x++)
          for (let y = 0; y < f; y++) {
            const b = -(m - 1) * l / 2 + d * l, k = x * l, $ = -(f - 1) * l / 2 + y * l, I = w > 1 || f > 1 ? [u[d], p[x] !== "_" ? p[x] : null, v[y] !== "_" ? v[y] : null].filter(Boolean).join("/") : u[d], S = `${o.id}/${I}`;
            _.push({ key: S, gridId: o.id, entry: I, localX: b, localY: k, localZ: $, col: d, row: x, depth: y }), r.set(S, { gridId: o.id, entry: I, localX: b, localY: k, localZ: $, layer: o.layer, category: o.category });
          }
      n.push({
        id: o.id,
        category: o.category,
        layer: o.layer,
        cells: _,
        width: m * l,
        height: w * l,
        depth: f * l,
        cols: m,
        rows: w,
        depths: f,
        is3d: w > 1
      });
    } else {
      const u = Math.ceil(o.entries.length / o.cols);
      for (let p = 0; p < o.entries.length; p++) {
        const v = p % o.cols, m = Math.floor(p / o.cols), w = -(o.cols - 1) * l / 2 + v * l, f = -(u - 1) * l / 2 + m * l, d = `${o.id}/${o.entries[p]}`;
        _.push({ key: d, gridId: o.id, entry: o.entries[p], localX: w, localY: 0, localZ: f, col: v, row: m, depth: 0 }), r.set(d, { gridId: o.id, entry: o.entries[p], localX: w, localY: 0, localZ: f, layer: o.layer, category: o.category });
      }
      n.push({
        id: o.id,
        category: o.category,
        layer: o.layer,
        cells: _,
        width: o.cols * l,
        height: l,
        depth: u * l,
        cols: o.cols,
        rows: u,
        depths: 1,
        is3d: !1
      });
    }
  }
  const a = L(t, e, i, s);
  return { grids: n, viewPositions: a, cellMap: r };
}
function L(t, e, i = 0.42, s = 0.1) {
  var p, v, m, w;
  const n = {
    layer: {},
    category: {},
    dsl: {},
    service: {}
  }, r = /* @__PURE__ */ new Map();
  for (const f of t) {
    const d = i + s;
    if (f.axes3d)
      r.set(f.id, { w: f.axes3d.x.entries.length * d, d: (((p = f.axes3d.z) == null ? void 0 : p.entries.length) ?? 1) * d });
    else {
      const x = Math.ceil(f.entries.length / f.cols);
      r.set(f.id, { w: f.cols * d, d: x * d });
    }
  }
  const a = e.map(() => []);
  for (const f of t) (v = a[f.layer]) == null || v.push(f);
  const c = i * 2;
  for (let f = 0; f < a.length; f++) {
    const d = a[f], x = Math.min(d.length, 4);
    for (let y = 0; y < d.length; y++) {
      const b = Math.floor(y / x), k = d.filter((O, M) => Math.floor(M / x) === b);
      let I = -k.reduce((O, M) => {
        var C;
        return O + (((C = r.get(M.id)) == null ? void 0 : C.w) ?? 2) + c;
      }, -c) / 2;
      const S = y - b * x;
      for (let O = 0; O < S; O++)
        I += (((m = r.get(k[O].id)) == null ? void 0 : m.w) ?? 2) + c;
      const K = ((w = r.get(d[y].id)) == null ? void 0 : w.w) ?? 2;
      I += K / 2;
      const P = Math.max(...k.map((O) => {
        var M;
        return ((M = r.get(O.id)) == null ? void 0 : M.d) ?? 2;
      }));
      n.layer[d[y].id] = {
        x: I,
        y: e[f],
        z: b * -(P + c * 2)
      };
    }
  }
  [...new Set(t.map((f) => f.category))].forEach((f, d) => {
    const x = t.filter((k) => k.category === f), y = d % 3, b = Math.floor(d / 3);
    x.forEach((k, $) => {
      n.category[k.id] = { x: -12 + y * 12, y: 4 - $ * 3.5, z: b * -8 };
    });
  });
  const o = [...new Set(t.map((f) => f.dsl).filter(Boolean))], _ = t.filter((f) => !f.dsl);
  o.forEach((f, d) => {
    const x = t.filter((k) => k.dsl === f), y = d % 4, b = Math.floor(d / 4);
    x.forEach((k, $) => {
      n.dsl[k.id] = { x: -18 + y * 12, y: 4 - $ * 3, z: b * -10 };
    });
  }), _.forEach((f, d) => {
    n.dsl[f.id] = { x: 24, y: 4 - d * 3, z: -12 };
  });
  const l = [...new Set(t.map((f) => f.service).filter(Boolean))], u = t.filter((f) => !f.service);
  return l.forEach((f, d) => {
    t.filter((y) => y.service === f).forEach((y, b) => {
      n.service[y.id] = { x: -16 + d * 8, y: 4 - Math.floor(b / 2) * 3.5, z: b % 2 * -5 };
    });
  }), u.forEach((f, d) => {
    n.service[f.id] = { x: 24, y: 4, z: -d * 5 };
  }), n;
}
function ae(t, e) {
  const i = {};
  for (const s of t)
    s.grids.forEach((n, r) => {
      const a = r * s.gap;
      i[n] = {
        x: s.position.x + (s.axis === "x" ? a : 0),
        y: s.position.y + (s.axis === "y" ? a : 0),
        z: s.position.z + (s.axis === "z" ? a : 0)
      };
    });
  return i;
}
function g(t) {
  const e = t >> 16 & 255, i = t >> 8 & 255, s = t & 255;
  return { hex: t, css: `#${t.toString(16).padStart(6, "0")}`, rgb: `${e},${i},${s}` };
}
const z = {
  // Background / Surface
  bgDeep: g(328968),
  bgCard: g(526864),
  bgSurface: g(790036),
  bgGrid1: g(1712176),
  bgGrid2: g(1053984),
  bgAxis: g(1714232),
  // Text
  txtPrimary: g(12634328),
  txtSecondary: g(6715272),
  txtDim: g(3359829),
  txtMuted: g(2241348),
  // Accent
  mint: g(6619098),
  cyan: g(46296),
  amber: g(16752451),
  orange: g(16753922),
  violet: g(8150268),
  purple: g(7101671),
  rose: g(16726112),
  pink: g(15221651),
  green: g(3069299),
  red: g(16739179),
  // State
  connected: g(3069299),
  warning: g(16752451),
  error: g(16726112),
  info: g(6619098)
}, V = {
  observation: { main: g(58879), emissive: g(38823) },
  event: { main: g(16748800), emissive: g(12545024) },
  policy: { main: g(58998), emissive: g(38436) },
  relation: { main: g(11766015), emissive: g(8146431) },
  entity: { main: g(5533306), emissive: g(3622735) },
  table: { main: g(16732754), emissive: g(12986408) }
}, j = [
  g(6619098),
  // L0 UI — mint
  g(16752451),
  // L1 Business — amber
  g(8150268),
  // L2 Infra — violet
  g(16726112)
  // L3 Data — rose
];
function oe() {
  return [
    `--bg:${z.bgDeep.css}`,
    `--card:rgba(${z.bgCard.rgb},0.92)`,
    `--border:rgba(${z.mint.rgb},0.08)`,
    `--mint:${z.mint.css}`,
    `--amber:${z.amber.css}`,
    `--violet:${z.violet.css}`,
    `--rose:${z.rose.css}`,
    `--txt:${z.txtPrimary.css}`,
    `--dim:${z.txtDim.css}`,
    `--green:${z.green.css}`,
    `--red:${z.red.css}`,
    `--cyan:${z.cyan.css}`,
    // Category
    ...Object.entries(V).map(([t, e]) => `--cat-${t}:${e.main.css}`),
    // Layer
    ...j.map((t, e) => `--layer-${e}:${t.css}`)
  ].join(";");
}
function ce(t, e) {
  return {
    type: "scalar",
    prefixId: t,
    mappings: [{ axis: e, channel: "color" }],
    description: `${t}.${e} → 단일 값 표시`
  };
}
function le(t, e) {
  return {
    type: "row",
    prefixId: t,
    mappings: [{ axis: e, channel: "x" }],
    description: `${t}.${e} → 가로 행`
  };
}
function de(t, e, i) {
  return {
    type: "grid",
    prefixId: t,
    mappings: [
      { axis: e, channel: "x" },
      { axis: i, channel: "z" }
    ],
    description: `${t}: ${e}(x) × ${i}(z) → 2D 그리드`
  };
}
function pe(t, e, i, s) {
  return {
    type: "cube",
    prefixId: t,
    mappings: [
      { axis: e, channel: "x" },
      { axis: i, channel: "y" },
      { axis: s, channel: "z" }
    ],
    description: `${t}: ${e}(x) × ${i}(y) × ${s}(z) → 3D 큐브`
  };
}
function he(t, e, i) {
  return {
    type: "spine",
    prefixId: t,
    mappings: [
      { axis: e, channel: "x" },
      ...i.map((s) => ({ axis: s, channel: "collapse" }))
    ],
    description: `${t}: ${e}(x), [${i.join(",")}] 압축 → 확대 시 큐브`
  };
}
function fe(t, e, i, s) {
  return {
    type: "shelf",
    prefixId: t,
    mappings: [
      { axis: e, channel: "group", subPattern: "grid" },
      { axis: i, channel: "x" },
      { axis: s, channel: "z" }
    ],
    description: `${t}: ${e}별 선반, 각 선반 = ${i}(x) × ${s}(z) 그리드`
  };
}
function ue(t, e, i) {
  return {
    type: "nested",
    prefixId: t,
    mappings: [
      { axis: e, channel: "group", subPattern: i }
    ],
    description: `${t}: ${e}별 그룹, 각 그룹 = ${i}`
  };
}
function me(t, e, i = 0.4, s = 0.08) {
  const n = i + s, r = [], a = t.mappings.find((d) => d.channel === "x"), c = t.mappings.find((d) => d.channel === "y"), h = t.mappings.find((d) => d.channel === "z"), o = t.mappings.find((d) => d.channel === "group"), _ = t.mappings.filter((d) => d.channel === "collapse").map((d) => d.axis), l = a ? e[a.axis] || [] : ["_"], u = c ? e[c.axis] || [] : ["_"], p = h ? e[h.axis] || [] : ["_"], v = o ? e[o.axis] || [] : ["_"];
  switch (t.type) {
    case "scalar":
      r.push({ key: `${t.prefixId}/_`, x: 0, y: 0, z: 0 });
      break;
    case "row":
      l.forEach((d, x) => {
        r.push({ key: `${t.prefixId}/${d}`, x: x * n, y: 0, z: 0 });
      });
      break;
    case "grid":
      l.forEach((d, x) => {
        p.forEach((y, b) => {
          r.push({ key: `${t.prefixId}/${d}_${y}`, x: x * n, y: 0, z: b * n });
        });
      });
      break;
    case "cube":
      l.forEach((d, x) => {
        u.forEach((y, b) => {
          p.forEach((k, $) => {
            r.push({ key: `${t.prefixId}/${d}_${y}_${k}`, x: x * n, y: b * n, z: $ * n });
          });
        });
      });
      break;
    case "spine":
      l.forEach((d, x) => {
        const y = {};
        for (const b of _)
          y[b] = `(${(e[b] || []).length} entries)`;
        r.push({ key: `${t.prefixId}/${d}`, x: x * n, y: 0, z: 0, collapsed: y });
      });
      break;
    case "shelf":
      v.forEach((d, x) => {
        const y = x * (p.length * n + n * 2);
        l.forEach((b, k) => {
          p.forEach(($, I) => {
            r.push({
              key: `${t.prefixId}/${d}_${b}_${$}`,
              x: k * n,
              y,
              z: I * n,
              group: d
            });
          });
        });
      });
      break;
    case "nested":
      v.forEach((d, x) => {
        const y = x * (l.length * n + n * 2);
        l.forEach((b, k) => {
          r.push({
            key: `${t.prefixId}/${d}/${b}`,
            x: y + k * n,
            y: 0,
            z: 0,
            group: d
          });
        });
      });
      break;
  }
  const m = r.map((d) => d.x), w = r.map((d) => d.y), f = r.map((d) => d.z);
  return {
    pattern: t,
    cells: r,
    bounds: {
      width: r.length > 0 ? Math.max(...m) - Math.min(...m) + i : 0,
      height: r.length > 0 ? Math.max(...w) - Math.min(...w) + i : 0,
      depth: r.length > 0 ? Math.max(...f) - Math.min(...f) + i : 0
    }
  };
}
function D(t, e) {
  if (e === "prefix_ref" || e === "table_ref") return "context";
  const i = t.toLowerCase();
  return i.includes("step") || i.includes("phase") || i.includes("stage") ? "sequence" : i.includes("variant") || i.includes("version") || i.includes("mode") ? "variant" : i.endsWith("_name") || i === "flow_name" || i === "event_name" || i.endsWith("_type") || i === "resource_type" ? "classify" : (i.includes("action") || i.includes("method") || i.includes("op") || i === "role" || i === "resource", "identity");
}
function ge(t, e) {
  const i = typeof e[0] == "string" ? e.map((p) => ({ label: p, kind: "axis" })) : e, s = i.filter((p) => p.kind === "axis"), n = i.filter((p) => p.kind === "prefix_ref"), r = i.filter((p) => p.kind === "table_ref"), a = s.map((p) => ({ ...p, role: D(p.label, p.kind) })), c = a.filter((p) => p.role === "classify"), h = a.filter((p) => p.role === "sequence"), o = a.filter((p) => p.role === "variant"), _ = a.filter((p) => p.role === "identity"), l = [];
  for (const p of n)
    l.push({ axis: p.label, channel: "collapse", role: "context", dimKind: "prefix_ref" });
  for (const p of r)
    l.push({ axis: p.label, channel: "link", role: "context", dimKind: "table_ref" });
  if (c.length > 0) {
    const p = c[0], v = a.filter((f) => f !== p);
    if (v.length === 0)
      return l.push({ axis: p.label, channel: "x", role: "classify" }), { type: "row", prefixId: t, mappings: l, description: `${t}: ${p.label}(x) → 행` };
    if (v.length === 1)
      return l.push({ axis: p.label, channel: "group", role: "classify", subPattern: "row" }), l.push({ axis: v[0].label, channel: "x", role: v[0].role }), { type: "shelf", prefixId: t, mappings: l, description: `${t}: ${p.label}별 선반, ${v[0].label}(x)` };
    l.push({ axis: p.label, channel: "group", role: "classify", subPattern: "grid" });
    const m = h[0] || v[0], w = o[0] || v.find((f) => f !== m) || v[1];
    return m && l.push({ axis: m.label, channel: "x", role: m.role }), w && w !== m && l.push({ axis: w.label, channel: "z", role: w.role }), { type: "shelf", prefixId: t, mappings: l, description: `${t}: ${p.label}별 선반, ${m == null ? void 0 : m.label}(x) × ${w == null ? void 0 : w.label}(z)` };
  }
  const u = [...h, ..._, ...o];
  return u.length === 0 ? { type: "scalar", prefixId: t, mappings: [{ axis: "_", channel: "color" }], description: `${t}: scalar` } : u.length === 1 ? (l.push({ axis: u[0].label, channel: "x", role: u[0].role }), { type: "row", prefixId: t, mappings: l, description: `${t}: ${u[0].label}(x)` }) : u.length === 2 ? (l.push({ axis: u[0].label, channel: "x", role: u[0].role }), l.push({ axis: u[1].label, channel: "z", role: u[1].role }), { type: "grid", prefixId: t, mappings: l, description: `${t}: ${u[0].label}(x) × ${u[1].label}(z)` }) : (l.push({ axis: u[0].label, channel: "x", role: u[0].role }), l.push({ axis: u[1].label, channel: "y", role: u[1].role }), l.push({ axis: u[2].label, channel: "z", role: u[2].role }), { type: "cube", prefixId: t, mappings: l, description: `${t}: ${u[0].label}(x) × ${u[1].label}(y) × ${u[2].label}(z)` });
}
function _e(t) {
  return Object.entries(t).map(([e, i]) => ({
    label: e,
    kind: i.kind
  }));
}
function ye(t) {
  return Object.entries(t).filter(([, e]) => e.kind === "axis").map(([e]) => e);
}
const xe = {
  context: "어디서",
  trigger: "뭘 했는가",
  channel: "어떤 경로",
  state: "흐름 어디",
  guard: "어떤 조건",
  effect: "결과",
  data: "데이터 접점"
}, ve = {
  context: "#546e7a",
  trigger: "#ff9100",
  channel: "#00e5ff",
  state: "#b388ff",
  guard: "#00e676",
  effect: "#ff5252",
  data: "#fd79a8"
}, H = {
  // context
  service: "context",
  page_view: "context",
  // trigger
  tracking: "trigger",
  cart_event: "trigger",
  auth_event: "trigger",
  order_event: "trigger",
  event: "trigger",
  engine_event: "trigger",
  schema_event: "trigger",
  // channel
  endpoint: "channel",
  // state
  flow_point: "state",
  // guard
  permission: "guard",
  rbac: "guard",
  // effect
  pipeline_point: "effect",
  health_event: "effect",
  deploy_event: "effect",
  data_policy: "effect",
  // data
  members: "data",
  orders: "data",
  items: "data",
  orgs: "data",
  carts: "data",
  cart_items: "data",
  // relation
  relational: "context",
  content: "context"
};
function B(t) {
  return H[t] ?? "trigger";
}
function X(t) {
  const e = {
    context: [],
    trigger: [],
    channel: [],
    state: [],
    guard: [],
    effect: [],
    data: []
  };
  for (const [i, s] of Object.entries(t)) {
    const n = B(i);
    e[n].push({ prefixId: i, serialized: s });
  }
  return e;
}
const be = [
  {
    id: "auth.login",
    name: "로그인",
    description: "사용자 인증 → 세션 생성",
    dsl: "dsl-auth",
    members: [
      { prefixId: "page_view", role: "context", fixedValues: { page: "login" } },
      { prefixId: "tracking", role: "trigger", fixedValues: { trackAction: "submit" } },
      { prefixId: "auth_event", role: "trigger", fixedValues: { action: "login" } },
      { prefixId: "endpoint", role: "channel", fixedValues: { http_method: "POST" } },
      { prefixId: "flow_point", role: "state", fixedValues: { flow_name: "login", flow_step: "entry" } },
      { prefixId: "permission", role: "guard", fixedValues: { role: "customer" } }
    ]
  },
  {
    id: "page.view",
    name: "화면 조회",
    description: "사용자가 페이지를 방문",
    members: [
      { prefixId: "page_view", role: "context" },
      { prefixId: "tracking", role: "trigger", fixedValues: { trackAction: "view" } }
    ]
  },
  {
    id: "api.call",
    name: "API 호출",
    description: "서버 API 요청",
    members: [
      { prefixId: "endpoint", role: "channel" }
    ]
  },
  {
    id: "cart.add",
    name: "장바구니 담기",
    description: "상품을 장바구니에 추가",
    dsl: "dsl-commerce",
    requires: ["auth.login"],
    members: [
      { prefixId: "page_view", role: "context", fixedValues: { page: "product_detail" } },
      { prefixId: "tracking", role: "trigger", fixedValues: { trackAction: "add_to_cart" } },
      { prefixId: "endpoint", role: "channel", fixedValues: { http_method: "POST" } },
      { prefixId: "cart_event", role: "trigger", fixedValues: { action: "add" } }
    ]
  },
  {
    id: "checkout.entry",
    name: "결제 진입",
    description: "결제 페이지 진입",
    dsl: "dsl-checkout",
    requires: ["cart.add"],
    members: [
      { prefixId: "page_view", role: "context", fixedValues: { page: "checkout" } },
      { prefixId: "tracking", role: "trigger", fixedValues: { trackAction: "navigate" } },
      { prefixId: "flow_point", role: "state", fixedValues: { flow_name: "checkout", flow_step: "entry" } },
      { prefixId: "permission", role: "guard", fixedValues: { role: "customer" } }
    ]
  },
  {
    id: "checkout.process",
    name: "주문 생성",
    description: "주문 데이터 생성 + 결제 요청",
    dsl: "dsl-checkout",
    requires: ["checkout.entry"],
    members: [
      { prefixId: "endpoint", role: "channel", fixedValues: { http_method: "POST" } },
      { prefixId: "flow_point", role: "state", fixedValues: { flow_name: "checkout", flow_step: "processing" } },
      { prefixId: "permission", role: "guard", fixedValues: { role: "customer" } },
      { prefixId: "order_event", role: "trigger", fixedValues: { action: "create" } },
      { prefixId: "pipeline_point", role: "effect", fixedValues: { pipeline_phase: "ingest" } }
    ]
  },
  {
    id: "payment.success",
    name: "결제 성공",
    description: "결제 완료 → 주문 확정",
    dsl: "dsl-checkout",
    requires: ["checkout.process"],
    members: [
      { prefixId: "order_event", role: "trigger", fixedValues: { action: "complete" } },
      { prefixId: "flow_point", role: "state", fixedValues: { flow_name: "checkout", flow_step: "success" } },
      { prefixId: "health_event", role: "effect", fixedValues: { health_status: "healthy" } },
      { prefixId: "pipeline_point", role: "effect", fixedValues: { pipeline_phase: "verdict" } }
    ]
  },
  {
    id: "auth.logout",
    name: "로그아웃",
    description: "세션 종료",
    dsl: "dsl-auth",
    members: [
      { prefixId: "tracking", role: "trigger", fixedValues: { trackAction: "close" } },
      { prefixId: "auth_event", role: "trigger", fixedValues: { action: "logout" } },
      { prefixId: "flow_point", role: "state", fixedValues: { flow_name: "browse", flow_step: "exit" } }
    ]
  }
];
function we(t, e) {
  const i = new Set(Object.keys(e)), s = new Set(t.members.map((c) => c.prefixId));
  let n = 0;
  const r = /* @__PURE__ */ new Set();
  for (const c of t.members)
    i.has(c.prefixId) ? n++ : r.add(c.role);
  const a = [...i].filter((c) => !s.has(c) && c !== "service");
  return {
    signalId: t.id,
    valid: n === t.members.length,
    missingRoles: [...r],
    extraPrefixes: a,
    matchedMembers: n,
    totalMembers: t.members.length
  };
}
const ke = {
  // ── Observation ──
  page_view: {
    id: "page_view",
    displayName: "화면 관측",
    description: "어떤 화면을 어떤 사용자가 보는가",
    shape: "cube",
    detailKind: "generic",
    heightRatio: 1,
    source: { module: "demo-snapshot", file: "demo-catalog.ts" }
  },
  tracking: {
    id: "tracking",
    displayName: "행동 추적",
    description: "사용자의 클릭/조회/스크롤 행동을 추적",
    shape: "cube",
    detailKind: "generic",
    heightRatio: 1,
    source: { module: "browser-sdk", file: "auto-capture.ts" }
  },
  endpoint: {
    id: "endpoint",
    displayName: "API 엔드포인트",
    description: "어떤 서비스의 어떤 API가 호출되는가",
    shape: "cube",
    detailKind: "endpoint",
    heightRatio: 1,
    source: { module: "ingest-server", file: "routes/ingest.ts" },
    detail: { routes: [
      { method: "GET", path: "/v1/products", handler: "listProducts" },
      { method: "POST", path: "/v1/orders", handler: "createOrder" },
      { method: "POST", path: "/v1/auth/login", handler: "login" }
    ] }
  },
  flow_point: {
    id: "flow_point",
    displayName: "흐름 관측",
    description: "비즈니스 흐름의 어디에 있는가",
    shape: "cube",
    detailKind: "flow-step",
    heightRatio: 1,
    source: { module: "spec-core", file: "dkg/flow-definition.ts" }
  },
  pipeline_point: {
    id: "pipeline_point",
    displayName: "파이프라인 관측",
    description: "수집 파이프라인의 어떤 단계인가",
    shape: "cube",
    detailKind: "metric",
    heightRatio: 1,
    source: { module: "ingest-server", file: "lib/phase-two-worker.ts" }
  },
  data_policy: {
    id: "data_policy",
    displayName: "데이터 정책",
    description: "마스킹/원본/해시 정책",
    shape: "flat-tile",
    detailKind: "config",
    heightRatio: 0.5,
    source: { module: "sdk", file: "masking.ts" }
  },
  // ── Policy (얇은 바) ──
  permission: {
    id: "permission",
    displayName: "권한",
    description: "서비스별 역할 기반 권한",
    shape: "thin-bar",
    detailKind: "permission",
    heightRatio: 0.3,
    source: { module: "permission-engine", file: "permission-set.ts" },
    detail: { matrix: "perm_svc × role → grant/deny" }
  },
  rbac: {
    id: "rbac",
    displayName: "RBAC",
    description: "역할 × 액션 × 리소스 접근 제어",
    shape: "thin-bar",
    detailKind: "permission",
    heightRatio: 0.3,
    source: { module: "permission-engine", file: "permission-set.ts" }
  },
  // ── Event (납작한 타일) ──
  cart_event: {
    id: "cart_event",
    displayName: "장바구니 이벤트",
    description: "회원이 상품을 장바구니에 담는 행위",
    shape: "flat-tile",
    detailKind: "event-def",
    heightRatio: 0.5,
    source: { module: "demo-snapshot", file: "demo-catalog.ts" },
    detail: { structure: "actor(member) × action × target(item)", slots: [
      { name: "actor", kind: "table_ref", target: "members", description: "행위 주체" },
      { name: "action", kind: "axis", target: "cart_action", description: "add/remove/checkout" },
      { name: "target", kind: "table_ref", target: "items", description: "대상 상품" }
    ] }
  },
  auth_event: {
    id: "auth_event",
    displayName: "인증 이벤트",
    description: "로그인/로그아웃/토큰갱신",
    shape: "flat-tile",
    detailKind: "event-def",
    heightRatio: 0.5,
    source: { module: "demo-snapshot" },
    detail: { structure: "actor(member) × action", slots: [
      { name: "actor", kind: "table_ref", target: "members", description: "사용자" },
      { name: "action", kind: "axis", target: "auth_action", description: "login/logout/token_refresh" }
    ] }
  },
  order_event: {
    id: "order_event",
    displayName: "주문 이벤트",
    description: "주문 생성/취소/환불/완료",
    shape: "flat-tile",
    detailKind: "event-def",
    heightRatio: 0.5,
    source: { module: "demo-snapshot" },
    detail: { structure: "service_ctx × actor(member) × action × order(table)", slots: [
      { name: "service_ctx", kind: "prefix_ref", target: "service", description: "서비스 컨텍스트" },
      { name: "action", kind: "axis", target: "order_action", description: "create/cancel/refund/complete" }
    ] }
  },
  deploy_event: {
    id: "deploy_event",
    displayName: "배포 이벤트",
    description: "서비스 배포/롤백/스케일",
    shape: "flat-tile",
    detailKind: "event-def",
    heightRatio: 0.5,
    source: { module: "spec-core", file: "dkg/bootstrap.ts" }
  },
  health_event: {
    id: "health_event",
    displayName: "헬스 이벤트",
    description: "서비스 상태 변화",
    shape: "flat-tile",
    detailKind: "config",
    heightRatio: 0.5,
    source: { module: "ingest-server" }
  },
  engine_event: {
    id: "engine_event",
    displayName: "엔진 평가",
    description: "제약 연산자 × 판정 결과",
    shape: "flat-tile",
    detailKind: "metric",
    heightRatio: 0.5,
    source: { module: "engine", file: "matching/constraint-evaluator.ts" }
  },
  schema_event: {
    id: "schema_event",
    displayName: "스키마 마이그레이션",
    description: "마이그레이션 패턴 × 배포 행위",
    shape: "flat-tile",
    detailKind: "config",
    heightRatio: 0.5,
    source: { module: "spec-core", file: "dkg/skills/infer-migrator.ts" }
  },
  // ── Entity ──
  service: {
    id: "service",
    displayName: "서비스",
    description: "env × region × svc_name × namespace 4D 서비스 주소",
    shape: "cube",
    detailKind: "config",
    heightRatio: 1,
    source: { module: "demo-snapshot", file: "demo-catalog.ts" },
    detail: { dims: ["env", "region", "svc_name", "namespace"] }
  },
  event: {
    id: "event",
    displayName: "이벤트 로그",
    description: "시스템 이벤트 기록",
    shape: "cube",
    detailKind: "generic",
    heightRatio: 0.8,
    source: { module: "ingest-server" }
  },
  content: {
    id: "content",
    displayName: "콘텐츠",
    description: "tag × category × status × locale × channel",
    shape: "cube",
    detailKind: "generic",
    heightRatio: 1
  },
  relational: {
    id: "relational",
    displayName: "관계 모델",
    description: "subjectKind × predicate × objectKind",
    shape: "sphere",
    detailKind: "generic",
    heightRatio: 1,
    source: { module: "spec-core", file: "dkg/dkg.types.ts" }
  },
  // ── Table (세로 컬럼) ──
  members: {
    id: "members",
    displayName: "회원 테이블",
    description: "사용자 정보",
    shape: "column",
    detailKind: "schema",
    heightRatio: 1.5,
    detail: { table: "members", columns: [
      { name: "id", type: "integer", refKind: "scalar" },
      { name: "name", type: "string", refKind: "scalar" },
      { name: "role", type: "string", refKind: "axis_ref", refTarget: "role" },
      { name: "org_id", type: "integer", refKind: "table_ref", refTarget: "orgs" }
    ] }
  },
  orders: {
    id: "orders",
    displayName: "주문 테이블",
    description: "주문 정보",
    shape: "column",
    detailKind: "schema",
    heightRatio: 1.5,
    detail: { table: "orders", columns: [
      { name: "id", type: "integer", refKind: "scalar" },
      { name: "member_id", type: "integer", refKind: "table_ref", refTarget: "members" },
      { name: "service_addr", type: "integer", refKind: "prefix_ref", refTarget: "service" },
      { name: "status", type: "string", refKind: "axis_ref", refTarget: "order_action" },
      { name: "amount", type: "number", refKind: "scalar" }
    ] }
  },
  items: {
    id: "items",
    displayName: "상품 테이블",
    description: "상품 정보",
    shape: "column",
    detailKind: "schema",
    heightRatio: 1.5,
    detail: { table: "items", columns: [
      { name: "id", type: "integer", refKind: "scalar" },
      { name: "name", type: "string", refKind: "scalar" },
      { name: "category", type: "string", refKind: "axis_ref", refTarget: "category" },
      { name: "warehouse_addr", type: "integer", refKind: "prefix_ref", refTarget: "service" }
    ] }
  },
  orgs: {
    id: "orgs",
    displayName: "조직 테이블",
    description: "조직 정보",
    shape: "column",
    detailKind: "schema",
    heightRatio: 1.5,
    detail: { table: "orgs", columns: [
      { name: "id", type: "integer", refKind: "scalar" },
      { name: "name", type: "string", refKind: "scalar" },
      { name: "region_addr", type: "integer", refKind: "prefix_ref", refTarget: "service" }
    ] }
  },
  carts: {
    id: "carts",
    displayName: "장바구니",
    description: "장바구니",
    shape: "column",
    detailKind: "schema",
    heightRatio: 1.2,
    detail: { table: "carts", columns: [
      { name: "id", type: "integer", refKind: "scalar" },
      { name: "member_id", type: "integer", refKind: "table_ref", refTarget: "members" }
    ] }
  },
  cart_items: {
    id: "cart_items",
    displayName: "장바구니 항목",
    description: "장바구니 내 상품",
    shape: "column",
    detailKind: "schema",
    heightRatio: 1.2,
    detail: { table: "cart_items", columns: [
      { name: "cart_id", type: "integer", refKind: "table_ref", refTarget: "carts" },
      { name: "item_id", type: "integer", refKind: "table_ref", refTarget: "items" },
      { name: "qty", type: "integer", refKind: "scalar" }
    ] }
  }
};
function $e(t, e) {
  var s, n;
  const i = [];
  if (i.push(`<div style="font-size:11px;font-weight:600;color:#e0e4ec">${t.displayName}</div>`), i.push(`<div style="font-size:9px;color:#556;margin:3px 0">${t.description}</div>`), t.source) {
    const r = t.source, a = [];
    r.module && a.push(r.module), r.file && a.push(r.file), r.line && a.push(`L${r.line}`), i.push(`<div style="font-size:8px;color:#334;margin-top:4px">📁 ${a.join(" / ")}</div>`), r.url && i.push(`<div style="font-size:8px"><a href="${r.url}" target="_blank" style="color:#64ffda">📎 docs</a></div>`);
  }
  switch (t.detailKind) {
    case "schema": {
      const r = t.detail;
      if (r != null && r.columns) {
        i.push('<div style="margin-top:6px;font-size:8px;color:#445;letter-spacing:1px">SCHEMA</div>');
        for (const a of r.columns) {
          const c = a.refKind !== "scalar" ? ` <span style="color:${a.refKind === "axis_ref" ? "#00e676" : a.refKind === "table_ref" ? "#ff5252" : "#00e5ff"}">→${a.refTarget}</span>` : "", h = e && a.name === e ? "color:var(--mint);font-weight:600" : "color:#667";
          i.push(`<div style="font-size:9px;${h}">${a.name} <span style="color:#334">${a.type}</span>${c}</div>`);
        }
      }
      break;
    }
    case "event-def": {
      const r = t.detail;
      if (r && (i.push('<div style="margin-top:6px;font-size:8px;color:#445;letter-spacing:1px">EVENT STRUCTURE</div>'), i.push(`<div style="font-size:9px;color:#ff9100">${r.structure}</div>`), r.slots))
        for (const a of r.slots) {
          const c = a.kind === "table_ref" ? "#ff5252" : a.kind === "prefix_ref" ? "#00e5ff" : "#00e676";
          i.push(`<div style="font-size:9px;color:#667">${a.name} <span style="color:${c}">${a.kind}→${a.target}</span></div>`);
        }
      break;
    }
    case "permission":
      i.push('<div style="margin-top:6px;font-size:8px;color:#445;letter-spacing:1px">PERMISSION</div>'), i.push(`<div style="font-size:9px;color:#00e676">${((s = t.detail) == null ? void 0 : s.matrix) || "role-based grant/deny"}</div>`);
      break;
    case "endpoint": {
      const r = (n = t.detail) == null ? void 0 : n.routes;
      if (r) {
        i.push('<div style="margin-top:6px;font-size:8px;color:#445;letter-spacing:1px">ROUTES</div>');
        for (const a of r)
          i.push(`<div style="font-size:9px;color:#667"><span style="color:#00e5ff">${a.method}</span> ${a.path}</div>`);
      }
      break;
    }
  }
  return i.join("");
}
function Te(t, e = 0.42, i = 0.1) {
  const s = e + i, n = t.channels.find((m) => m.channel === "x"), r = t.channels.find((m) => m.channel === "y"), a = t.channels.find((m) => m.channel === "z"), c = t.channels.find((m) => m.channel === "group"), h = t.channels.find((m) => m.channel === "color"), o = (m) => {
    var f;
    return m ? ((f = t.filters) == null ? void 0 : f[m.id]) ?? m.entries : ["_"];
  }, _ = o(n == null ? void 0 : n.axis), l = o(r == null ? void 0 : r.axis), u = o(a == null ? void 0 : a.axis), p = o(c == null ? void 0 : c.axis), v = [];
  for (const m of p) {
    const w = p.indexOf(m) * (_.length * s + s * 3);
    for (const f of _)
      for (const d of l)
        for (const x of u) {
          const y = _.indexOf(f), b = l.indexOf(d), k = u.indexOf(x), $ = {};
          n && ($[n.axis.id] = f), r && ($[r.axis.id] = d), a && ($[a.axis.id] = x), c && m !== "_" && ($[c.axis.id] = m);
          const S = Object.values($).join(":");
          v.push({
            coords: $,
            key: S,
            x: w + y * s,
            y: b * s,
            z: k * s,
            group: m !== "_" ? m : void 0,
            colorValue: h ? $[h.axis.id] : void 0
          });
        }
  }
  return {
    def: t,
    cells: v,
    xEntries: _,
    yEntries: l,
    zEntries: u,
    groups: p.filter((m) => m !== "_"),
    totalCells: v.length,
    bounds: {
      width: (p.length > 1 ? p.length : 1) * _.length * s,
      height: l.length * s,
      depth: u.length * s
    }
  };
}
function Ee(t, e) {
  const i = [];
  for (const s of e.cells) {
    let n = !0;
    for (const [r, a] of Object.entries(s.coords))
      if (t[r] !== a) {
        n = !1;
        break;
      }
    n && i.push(s.key);
  }
  return i;
}
const E = {
  page: { id: "page", name: "페이지", entries: ["home", "product_list", "product_detail", "cart", "checkout", "order_complete", "mypage", "login"], usedBy: ["page_view", "tracking"] },
  flow_step: { id: "flow_step", name: "흐름 단계", entries: ["entry", "processing", "success", "failure", "payment", "complete", "exit"], usedBy: ["flow_point"] },
  flow_name: { id: "flow_name", name: "흐름명", entries: ["checkout", "login", "browse", "payment"], usedBy: ["flow_point"] },
  http_method: { id: "http_method", name: "HTTP 메서드", entries: ["GET", "POST", "PUT", "DELETE", "PATCH"], usedBy: ["endpoint"] },
  verdict_result: { id: "verdict_result", name: "판정 결과", entries: ["pass", "fail", "warn", "degraded", "unknown"], usedBy: ["pipeline_point", "engine_event"] },
  health_status: { id: "health_status", name: "헬스 상태", entries: ["healthy", "degraded", "unhealthy", "maintenance"], usedBy: ["health_event"] },
  pipeline_phase: { id: "pipeline_phase", name: "파이프라인 단계", entries: ["ingest", "reconstruct", "verdict", "aggregate", "propagate"], usedBy: ["pipeline_point"] },
  svc_name: { id: "svc_name", name: "서비스", entries: ["shopping-web", "shopping-backend", "auth", "payment", "gateway"], usedBy: ["service"] },
  role: { id: "role", name: "역할", entries: ["admin", "developer", "operator", "viewer", "customer", "auditor"], usedBy: ["permission"] },
  userType: { id: "userType", name: "사용자유형", entries: ["guest", "member", "premium"], usedBy: ["page_view", "tracking"] },
  trackAction: { id: "trackAction", name: "행동", entries: ["click", "view", "scroll", "submit", "navigate", "add_to_cart", "purchase", "close"], usedBy: ["tracking"] }
}, ze = [
  {
    id: "page-x-flowstep",
    name: "페이지 × 흐름 단계",
    channels: [
      { axis: E.page, channel: "x" },
      { axis: E.flow_step, channel: "z" }
    ]
  },
  {
    id: "method-x-verdict",
    name: "HTTP 메서드 × 판정 결과",
    channels: [
      { axis: E.http_method, channel: "x" },
      { axis: E.verdict_result, channel: "z" }
    ]
  },
  {
    id: "svc-x-phase-x-health",
    name: "서비스 × 파이프라인 × 헬스 (3D 큐브)",
    channels: [
      { axis: E.svc_name, channel: "x" },
      { axis: E.pipeline_phase, channel: "y" },
      { axis: E.health_status, channel: "z" }
    ]
  },
  {
    id: "page-x-action-by-usertype",
    name: "페이지 × 행동, 사용자유형별 그룹",
    channels: [
      { axis: E.userType, channel: "group" },
      { axis: E.page, channel: "x" },
      { axis: E.trackAction, channel: "z" }
    ]
  },
  {
    id: "role-x-method",
    name: "역할 × HTTP 메서드",
    channels: [
      { axis: E.role, channel: "x" },
      { axis: E.http_method, channel: "z" }
    ]
  },
  {
    id: "flow-x-step-by-svc",
    name: "흐름 × 단계, 서비스별",
    channels: [
      { axis: E.svc_name, channel: "group" },
      { axis: E.flow_name, channel: "x" },
      { axis: E.flow_step, channel: "z" }
    ],
    filters: { flow_name: ["checkout", "login", "payment"] }
  }
];
class Ie {
  constructor() {
    T(this, "targets", /* @__PURE__ */ new Map());
    T(this, "positions", {
      layer: {},
      category: {},
      dsl: {},
      service: {}
    });
    T(this, "_currentMode", "layer");
    T(this, "_lerpSpeed", 3);
  }
  get currentMode() {
    return this._currentMode;
  }
  setPositions(e) {
    this.positions = e;
  }
  /** 매트릭스 스택용 커스텀 뷰 모드 추가 */
  addViewMode(e, i) {
    this.positions[e] = i;
  }
  registerGroup(e, i) {
    this.targets.set(e, {
      groupId: e,
      currentX: i.x,
      currentY: i.y,
      currentZ: i.z,
      targetX: i.x,
      targetY: i.y,
      targetZ: i.z
    });
  }
  setMode(e) {
    this._currentMode = e;
    const i = this.positions[e];
    if (i)
      for (const [s, n] of Object.entries(i)) {
        const r = this.targets.get(s);
        r && (r.targetX = n.x, r.targetY = n.y, r.targetZ = n.z);
      }
  }
  /** 매 프레임 호출 — dt 기반 lerp */
  update(e) {
    const i = this._lerpSpeed * e;
    for (const s of this.targets.values())
      s.currentX += (s.targetX - s.currentX) * i, s.currentY += (s.targetY - s.currentY) * i, s.currentZ += (s.targetZ - s.currentZ) * i;
  }
  getPosition(e) {
    const i = this.targets.get(e);
    return i ? { x: i.currentX, y: i.currentY, z: i.currentZ } : void 0;
  }
  getAllPositions() {
    const e = /* @__PURE__ */ new Map();
    for (const [i, s] of this.targets)
      e.set(i, { x: s.currentX, y: s.currentY, z: s.currentZ });
    return e;
  }
}
const Oe = {
  0: "이벤트 발생",
  1: "이벤트 처리",
  2: "이벤트 소비/생산",
  3: "데이터 도달"
}, Y = {
  // T0: 이벤트 발생 (UI 접점)
  page_view: 0,
  tracking: 0,
  // T1: 이벤트 처리 (API/흐름)
  endpoint: 1,
  flow_point: 1,
  permission: 1,
  // T2: 이벤트 소비/생산 (도메인 이벤트)
  cart_event: 2,
  auth_event: 2,
  order_event: 2,
  event: 2,
  deploy_event: 2,
  health_event: 2,
  engine_event: 2,
  schema_event: 2,
  // T1 (인프라 처리)
  pipeline_point: 1,
  data_policy: 1,
  // T1 (컨텍스트)
  service: 1
};
function Z(t) {
  return Y[t] ?? 2;
}
function Se(t, e, i) {
  return t.map((s) => {
    const n = [.../* @__PURE__ */ new Set([...s.ownedPrefixes, ...s.consumedPrefixes])], r = { 0: [], 1: [], 2: [], 3: [] };
    for (const c of n) {
      const h = e.get(c);
      if (!h) continue;
      const o = Z(c);
      r[o].push({
        prefixId: c,
        tier: o,
        entries: h.entries,
        pattern: h.pattern,
        category: h.category
      });
    }
    const a = [];
    if (i)
      for (const c of s.tables) {
        const h = i[c];
        h && a.push(...h);
      }
    return {
      serviceId: s.id,
      serviceName: s.name,
      tiers: r,
      dataEntries: a
    };
  });
}
function Me(t, e, i) {
  const s = i.find((n) => n.axisId === e);
  return s ? s.mode === "show" ? t.filter((n) => s.values.includes(n)) : t.filter((n) => !s.values.includes(n)) : [...t];
}
function Ce(t, e) {
  const i = (e == null ? void 0 : e.containerGap) ?? 12, s = (e == null ? void 0 : e.tierGap) ?? 3;
  return t.map((n, r) => {
    const c = (Object.values(n.tiers).filter((_) => _.length > 0).length + (n.dataEntries.length > 0 ? 1 : 0)) * s, h = Math.max(1, ...Object.values(n.tiers).flatMap((_) => _.map((l) => l.entries.length))), o = Math.max(4, Math.ceil(Math.sqrt(h)) * 1.5);
    return {
      serviceId: n.serviceId,
      position: { x: r * i - (t.length - 1) * i / 2, y: 0, z: 0 },
      size: { width: o, height: c, depth: o },
      tierOffsets: { 0: s * 1.5, 1: s * 0.5, 2: -s * 0.5, 3: -s * 1.5 }
    };
  });
}
const Re = [
  {
    id: "shopping-web",
    name: "쇼핑 웹",
    ownedPrefixes: ["page_view", "tracking"],
    consumedPrefixes: ["endpoint", "flow_point", "permission", "service"],
    tables: ["members"]
  },
  {
    id: "shopping-backend",
    name: "쇼핑 백엔드",
    ownedPrefixes: ["cart_event", "order_event", "permission", "event"],
    consumedPrefixes: ["endpoint", "service"],
    tables: ["orders", "items", "carts", "cart_items"]
  },
  {
    id: "auth",
    name: "인증",
    ownedPrefixes: ["auth_event"],
    consumedPrefixes: ["permission", "endpoint", "service"],
    tables: ["members"]
  },
  {
    id: "payment",
    name: "결제",
    ownedPrefixes: [],
    consumedPrefixes: ["endpoint", "flow_point", "permission", "order_event", "service"],
    tables: ["orders"]
  },
  {
    id: "infra",
    name: "인프라",
    ownedPrefixes: ["deploy_event", "health_event", "pipeline_point", "data_policy", "service", "endpoint"],
    consumedPrefixes: [],
    tables: ["orgs"]
  }
], Ke = {
  prodOnly: { axisId: "env", mode: "show", values: ["prod"] },
  devOnly: { axisId: "env", mode: "show", values: ["dev"] },
  hideTest: { axisId: "env", mode: "hide", values: ["test", "local"] },
  all: { axisId: "env", mode: "show", values: ["dev", "stage", "prod", "test", "local"] }
};
class Pe {
  constructor(e) {
    T(this, "states", /* @__PURE__ */ new Map());
    T(this, "_activeSet", /* @__PURE__ */ new Set());
    T(this, "_layerHits");
    T(this, "_totalHits", 0);
    this._layerHits = new Array(e).fill(0);
  }
  getOrCreate(e) {
    let i = this.states.get(e);
    return i || (i = { glow: 0, hits: 0 }, this.states.set(e, i)), i;
  }
  activate(e, i) {
    const s = this.getOrCreate(e);
    s.glow = 2, s.hits++, this._activeSet.add(e), i >= 0 && i < this._layerHits.length && this._layerHits[i]++, this._totalHits++;
  }
  deactivateAll() {
    this._activeSet.clear();
  }
  /** glow decay — 매 프레임 호출 */
  decay(e, i = 1.2) {
    for (const s of this.states.values())
      s.glow > 0 && (s.glow = Math.max(0, s.glow - e * i));
  }
  isActive(e) {
    return this._activeSet.has(e);
  }
  get activeSet() {
    return this._activeSet;
  }
  get layerHits() {
    return this._layerHits;
  }
  get totalHits() {
    return this._totalHits;
  }
  reset() {
    this.states.clear(), this._activeSet.clear(), this._layerHits.fill(0), this._totalHits = 0;
  }
}
class Ne {
  constructor(e) {
    T(this, "beams");
    T(this, "index", 0);
    this.beams = Array.from({ length: e }, () => ({
      fromX: 0,
      fromY: 0,
      fromZ: 0,
      toX: 0,
      toY: 0,
      toZ: 0,
      color: 16777215,
      life: 0
    }));
  }
  spawn(e, i, s) {
    const n = this.beams[this.index % this.beams.length];
    this.index++, n.fromX = e.x, n.fromY = e.y, n.fromZ = e.z, n.toX = i.x, n.toY = i.y, n.toZ = i.z, n.color = s, n.life = 1;
  }
  decay(e, i = 0.5) {
    for (const s of this.beams)
      s.life > 0 && (s.life = Math.max(0, s.life - e * i));
  }
  getActive() {
    return this.beams.filter((e) => e.life > 0);
  }
  getAll() {
    return this.beams;
  }
}
class Ae {
  constructor(e, i) {
    this.cells = e, this.beams = i;
  }
  /**
   * 셀 키 목록을 활성화하고, 크로스 레이어 빔을 생성한다.
   */
  fire(e, i) {
    this.cells.deactivateAll();
    const s = [];
    for (const n of e) {
      const r = i(n);
      r && (this.cells.activate(n, r.layer), s.push(r));
    }
    for (let n = 0; n < s.length; n++)
      for (let r = n + 1; r < s.length; r++)
        s[n].layer !== s[r].layer && this.beams.spawn(
          { x: s[n].worldX, y: s[n].worldY, z: s[n].worldZ },
          { x: s[r].worldX, y: s[r].worldY, z: s[r].worldZ },
          s[n].categoryColor
        );
    return {
      keys: e,
      source: "manual",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
}
function G(t, e) {
  const i = new Map(e.map((c) => [c.id, c])), s = {};
  let n = 0, r = 0;
  t.grids.forEach((c, h) => {
    const o = i.get(c);
    o && (n = Math.max(n, o.width), r = Math.max(r, o.depth));
    const _ = h * t.gap;
    s[c] = {
      x: t.position.x + (t.axis === "x" ? _ : 0),
      y: t.position.y + (t.axis === "y" ? _ : 0),
      z: t.position.z + (t.axis === "z" ? _ : 0)
    };
  });
  const a = t.grids.length * t.gap;
  return {
    stackId: t.id,
    axis: t.axis,
    gridPositions: s,
    bounds: {
      width: t.axis === "x" ? a : n,
      height: t.axis === "y" ? a : 1,
      depth: t.axis === "z" ? a : r
    }
  };
}
function Le(t, e) {
  const i = [], s = {};
  for (const n of t) {
    const r = G(n, e);
    i.push(r), Object.assign(s, r.gridPositions);
  }
  for (const n of e)
    n.id in s || (s[n.id] = { x: 30, y: 0, z: 0 });
  return { layouts: i, viewPositions: s };
}
const Ve = {
  id: "stack-checkout",
  grids: ["page_view", "endpoint", "flow_point", "permission", "order_event", "orders"],
  axis: "y",
  gap: 3,
  position: { x: 0, y: -4, z: 0 }
}, je = {
  id: "stack-infra",
  grids: ["service", "deploy_event", "health_event", "pipeline_point", "data_policy"],
  axis: "y",
  gap: 3,
  position: { x: 12, y: -4, z: 0 }
};
class De {
  constructor() {
    T(this, "entries", []);
    T(this, "_viewIdx", -1);
  }
  // -1 = latest (live mode)
  push(e) {
    this.entries.push(e), this._viewIdx = -1;
  }
  get length() {
    return this.entries.length;
  }
  get viewIndex() {
    return this._viewIdx === -1 ? this.entries.length - 1 : this._viewIdx;
  }
  get isLive() {
    return this._viewIdx === -1;
  }
  /** 현재 보고 있는 entry */
  current() {
    if (this.entries.length !== 0)
      return this.entries[this.viewIndex];
  }
  /** 이전으로 */
  prev() {
    if (this.entries.length !== 0)
      return this._viewIdx === -1 && (this._viewIdx = this.entries.length - 1), this._viewIdx = Math.max(0, this._viewIdx - 1), this.entries[this._viewIdx];
  }
  /** 다음으로 */
  next() {
    if (this.entries.length !== 0)
      return this._viewIdx === -1 ? this.entries[this.entries.length - 1] : (this._viewIdx = Math.min(this.entries.length - 1, this._viewIdx + 1), this._viewIdx === this.entries.length - 1 && (this._viewIdx = -1), this.entries[this._viewIdx === -1 ? this.entries.length - 1 : this._viewIdx]);
  }
  /** 특정 인덱스로 점프 */
  goTo(e) {
    if (!(e < 0 || e >= this.entries.length))
      return this._viewIdx = e, this.entries[e];
  }
  /** 최신 모드로 */
  goLive() {
    this._viewIdx = -1;
  }
  /** 전체 초기화 */
  clear() {
    this.entries = [], this._viewIdx = -1;
  }
  /** 전체 이력 */
  all() {
    return this.entries;
  }
  /** 특정 prefix를 포함하는 스텝만 필터 */
  filterByPrefix(e) {
    return this.entries.filter(
      (i) => i.keys.some((s) => s.startsWith(e + "/")) || i.flow.some((s) => s.cell.startsWith(e + "/"))
    );
  }
  /** 특정 tier만 포함하는 스텝 필터 */
  filterByTier(e) {
    return this.entries.filter((i) => i.flow.some((s) => s.tier === e));
  }
  /** 표시용 텍스트 */
  indexLabel() {
    return this.entries.length === 0 ? "-/-" : `${this._viewIdx === -1 ? this.entries.length : this._viewIdx + 1}/${this.entries.length}`;
  }
}
const W = {
  near: 15,
  mid: 35
};
function q(t, e = W) {
  return t <= e.near ? "near" : t <= e.mid ? "mid" : "far";
}
function He(t, e, i) {
  const s = /* @__PURE__ */ new Map();
  for (const [n, r] of e) {
    const a = t.x - r.x, c = t.y - r.y, h = t.z - r.z, o = Math.sqrt(a * a + c * c + h * h);
    s.set(n, q(o, i));
  }
  return s;
}
function Be(t) {
  switch (t) {
    case "near":
      return { showLabels: !0, showEdges: !0, showHitCounts: !0, cellOpacityMultiplier: 1 };
    case "mid":
      return { showLabels: !0, showEdges: !1, showHitCounts: !1, cellOpacityMultiplier: 0.9 };
    case "far":
      return { showLabels: !1, showEdges: !1, showHitCounts: !1, cellOpacityMultiplier: 0.7 };
  }
}
class Xe {
  constructor() {
    T(this, "frames", 0);
    T(this, "lastTime", performance.now());
    T(this, "_fps", 0);
    T(this, "_frameTime", 0);
  }
  /** 매 프레임 호출 */
  tick() {
    this.frames++;
    const e = performance.now(), i = e - this.lastTime;
    i >= 1e3 && (this._fps = Math.round(this.frames * 1e3 / i), this._frameTime = Math.round(i / this.frames * 100) / 100, this.frames = 0, this.lastTime = e);
  }
  get fps() {
    return this._fps;
  }
  get frameTime() {
    return this._frameTime;
  }
  /** Three.js renderer.info에서 통계 추출 */
  getStats(e, i, s) {
    return {
      fps: this._fps,
      frameTime: this._frameTime,
      drawCalls: e.render.calls,
      triangles: e.render.triangles,
      points: e.render.points,
      lines: e.render.lines,
      cellCount: i,
      activeCount: s
    };
  }
  /** HUD 표시용 문자열 */
  formatHud(e) {
    return `${e.fps}fps ${e.frameTime}ms | draw:${e.drawCalls} tri:${e.triangles} | cells:${e.cellCount} active:${e.activeCount}`;
  }
}
class Ye {
  constructor(e) {
    T(this, "ws", null);
    T(this, "_connected", !1);
    this.config = e;
  }
  get connected() {
    return this._connected;
  }
  /** WebSocket 연결 */
  connect(e) {
    var i, s, n, r;
    (s = (i = this.config).onConnectionChange) == null || s.call(i, "connecting");
    try {
      this.ws = new WebSocket(e), this.ws.onopen = () => {
        var a, c;
        this._connected = !0, (c = (a = this.config).onConnectionChange) == null || c.call(a, "connected"), this.ws.send(JSON.stringify({ type: "subscribe", scenarioId: "*" }));
      }, this.ws.onmessage = (a) => {
        var c, h;
        try {
          const o = JSON.parse(a.data);
          o.type === "record" && o.data ? this.handleRecord(o.data) : o.type === "subscribed" && ((h = (c = this.config).onConnectionChange) == null || h.call(c, "subscribed"));
        } catch {
        }
      }, this.ws.onerror = () => {
        var a, c;
        (c = (a = this.config).onConnectionChange) == null || c.call(a, "error");
      }, this.ws.onclose = () => {
        var a, c;
        this._connected = !1, (c = (a = this.config).onConnectionChange) == null || c.call(a, "disconnected");
      };
    } catch {
      (r = (n = this.config).onConnectionChange) == null || r.call(n, "failed");
    }
  }
  disconnect() {
    var e, i;
    this.ws && (this.ws.close(), this.ws = null), this._connected = !1, (i = (e = this.config).onConnectionChange) == null || i.call(e, "disconnected");
  }
  /** HTTP로 이벤트 전송 (DEMO용) */
  async sendToIngest(e, i, s, n, r) {
    const a = (/* @__PURE__ */ new Date()).toISOString();
    try {
      await fetch(e, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transmission_id: `tx_${Date.now()}`,
          sent_at: a,
          owner: { owner_type: "workspace", owner_id: "viz-3d" },
          source: { service_name: "viz-3d", sdk_name: "@qa-sdk/viz-3d", sdk_version: "0.1.0" },
          runtime: { platform: "browser" },
          build: { env: "dev" },
          records: [{
            log_id: `l_${Date.now()}_${r}`,
            timestamp: a,
            record_kind: "log",
            trace_id: n,
            span_id: `s_${r}`,
            event_key: s,
            event_version: "001",
            payload_format: "json",
            payload_encoding: "raw",
            payload_masking_applied: !1,
            payload_masked_fields: [],
            payload: { step: s },
            address_context: i
          }]
        })
      });
    } catch {
    }
  }
  handleRecord(e) {
    const i = e.addressContext || e.address_context;
    if (!i || Object.keys(i).length === 0) return;
    const s = [];
    for (const [, n] of Object.entries(i)) {
      const r = this.config.decode(n);
      if (!r) continue;
      const a = this.config.mapToKeys(r.prefix, r.values);
      s.push(...a);
    }
    s.length > 0 && this.config.onActivation(s, i);
  }
}
function Ze(t, e) {
  const i = [];
  if (t === "flow_point" && e.flow_name && e.flow_step)
    i.push(`flow_point/${e.flow_name}/${e.flow_step}`);
  else if (t === "endpoint" && e.http_method && e.resource_type)
    i.push(`endpoint/${e.http_method}/${e.resource_type}`);
  else if (t === "service" && e.svc_name) {
    const s = String(e.svc_name).replace("shopping-", "");
    i.push(`service/${s}`);
  } else
    for (const s of Object.values(e))
      typeof s == "string" && i.push(`${t}/${s}`);
  return i;
}
function U(t, e, i) {
  const s = t[e];
  if (!s) return null;
  const n = [], r = [];
  for (const h of s.labels) {
    const o = s.dims[h];
    if (!o) return null;
    if (o.kind === "axis") {
      n.push(o.capacity ?? o.entries.length);
      const _ = o.entries.indexOf(i[h]);
      if (_ < 0) return null;
      r.push(_);
    } else {
      const _ = o.values;
      n.push(_.length);
      const l = i[h] ?? _[0], u = _.indexOf(l);
      r.push(u < 0 ? 0 : u);
    }
  }
  const a = new Array(n.length);
  a[n.length - 1] = 1;
  for (let h = n.length - 2; h >= 0; h--) a[h] = a[h + 1] * n[h + 1];
  let c = 0;
  for (let h = 0; h < r.length; h++) c += r[h] * a[h];
  return { prefix: e, version: s.version, address: c, serialized: `${e}:${s.version}:${c}` };
}
function F(t, e) {
  const [i, s, n] = e.split(":"), r = t[i];
  if (!r) return null;
  let a = parseInt(n);
  if (isNaN(a)) return null;
  const c = [], h = [];
  for (const l of r.labels) {
    const u = r.dims[l];
    u && (u.kind === "axis" ? c.push(u.capacity ?? u.entries.length) : c.push(u.values.length), h.push({ label: l, dim: u }));
  }
  const o = new Array(c.length);
  o[c.length - 1] = 1;
  for (let l = c.length - 2; l >= 0; l--) o[l] = o[l + 1] * c[l + 1];
  const _ = {};
  for (let l = 0; l < h.length; l++) {
    const u = Math.floor(a / o[l]);
    a %= o[l];
    const { label: p, dim: v } = h[l];
    _[p] = v.kind === "axis" ? v.entries[u] ?? `(${u})` : v.values[u] ?? u;
  }
  return { prefix: i, version: s, values: _ };
}
function J(t, e) {
  const i = {};
  for (const [s, n] of Object.entries(e)) {
    const r = t[s];
    if (!r) continue;
    const a = { ...n };
    for (const h of r.labels) {
      const o = r.dims[h];
      (o == null ? void 0 : o.kind) === "prefix_ref" && !(h in a) && (a[h] = o.values[0]);
    }
    const c = U(t, s, a);
    c && (i[s] = c.serialized);
  }
  return i;
}
function Ge(t, e) {
  const i = {};
  for (const [s, n] of Object.entries(e)) {
    const r = F(t, n);
    r && (i[s] = { prefix: r.prefix, values: r.values });
  }
  return i;
}
function We(t, e) {
  const i = J(t, e), s = X(i);
  return { addressContext: i, byRole: s };
}
const R = {
  service: { version: "v1", labels: ["env", "region", "svc_name", "namespace"], dims: { env: { kind: "axis", entries: ["dev", "stage", "prod", "test", "local"], capacity: 32 }, region: { kind: "axis", entries: ["asia", "usa"], capacity: 32 }, svc_name: { kind: "axis", entries: ["shopping-web", "shopping-backend", "auth", "payment", "gateway"], capacity: 32 }, namespace: { kind: "axis", entries: ["shop", "cms"], capacity: 32 } } },
  page_view: { version: "v2", labels: ["svc_ref", "page", "locale", "userType"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, page: { kind: "axis", entries: ["home", "product_list", "product_detail", "cart", "checkout", "order_complete", "mypage", "login"], capacity: 32 }, locale: { kind: "axis", entries: ["ko", "en", "ja"], capacity: 32 }, userType: { kind: "axis", entries: ["guest", "member", "premium"], capacity: 32 } } },
  tracking: { version: "v2", labels: ["trackAction", "page", "userType"], dims: { trackAction: { kind: "axis", entries: ["click", "view", "scroll", "submit", "navigate", "add_to_cart", "purchase", "close"], capacity: 32 }, page: { kind: "axis", entries: ["home", "product_list", "product_detail", "cart", "checkout", "order_complete", "mypage", "login"], capacity: 32 }, userType: { kind: "axis", entries: ["guest", "member", "premium"], capacity: 32 } } },
  endpoint: { version: "v1", labels: ["svc_ref", "resource_type", "http_method", "api_version"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, resource_type: { kind: "axis", entries: ["api", "page", "webhook", "grpc"], capacity: 32 }, http_method: { kind: "axis", entries: ["GET", "POST", "PUT", "DELETE", "PATCH"], capacity: 32 }, api_version: { kind: "axis", entries: ["v1", "v2"], capacity: 32 } } },
  flow_point: { version: "v2", labels: ["svc_ref", "flow_name", "flow_step", "flow_variant"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, flow_name: { kind: "axis", entries: ["checkout", "signup", "order_cancel", "refund", "login", "browse", "cart_manage", "payment"], capacity: 64 }, flow_step: { kind: "axis", entries: ["entry", "processing", "branch", "success", "failure", "timeout", "payment", "complete", "exit"], capacity: 32 }, flow_variant: { kind: "axis", entries: ["default", "retry", "fallback", "manual"], capacity: 32 } } },
  cart_event: { version: "v1", labels: ["action"], dims: { action: { kind: "axis", entries: ["add", "remove", "checkout"], capacity: 32 } } },
  auth_event: { version: "v1", labels: ["action"], dims: { action: { kind: "axis", entries: ["login", "logout", "token_refresh"], capacity: 32 } } },
  order_event: { version: "v1", labels: ["service_ctx", "action"], dims: { service_ctx: { kind: "prefix_ref", values: [65536, 65568, 65600, 65632, 65664] }, action: { kind: "axis", entries: ["create", "cancel", "refund", "complete"], capacity: 32 } } },
  permission: { version: "v4", labels: ["perm_svc", "role"], dims: { perm_svc: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, role: { kind: "axis", entries: ["admin", "developer", "operator", "viewer", "readonly", "customer", "auditor"], capacity: 32 } } },
  deploy_event: { version: "v1", labels: ["svc_ref", "deploy_action"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 32768, 32800, 32832, 32864, 32896, 65536, 65568, 65600, 65632, 65664] }, deploy_action: { kind: "axis", entries: ["deploy", "rollback", "scale_up", "scale_down", "restart", "canary_start", "canary_promote"], capacity: 32 } } },
  health_event: { version: "v1", labels: ["svc_ref", "health_status"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 32768, 32800, 32832, 32864, 32896, 65536, 65568, 65600, 65632, 65664] }, health_status: { kind: "axis", entries: ["healthy", "degraded", "unhealthy", "maintenance"], capacity: 32 } } },
  pipeline_point: { version: "v1", labels: ["svc_ref", "pipeline_phase", "validation_mode", "verdict_result", "temporal_strategy"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, pipeline_phase: { kind: "axis", entries: ["ingest", "reconstruct", "verdict", "aggregate", "propagate"], capacity: 32 }, validation_mode: { kind: "axis", entries: ["strict", "warn", "off"], capacity: 32 }, verdict_result: { kind: "axis", entries: ["pass", "fail", "warn", "degraded", "unknown"], capacity: 32 }, temporal_strategy: { kind: "axis", entries: ["span_local", "global"], capacity: 32 } } },
  data_policy: { version: "v1", labels: ["svc_ref", "mask_mode"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, mask_mode: { kind: "axis", entries: ["raw", "mask", "drop", "hash"], capacity: 32 } } }
};
async function qe(t) {
  const e = (t == null ? void 0 : t.cacheKey) ?? "qa-sdk-catalog", i = (t == null ? void 0 : t.cacheTtlMs) ?? 300 * 1e3, s = (t == null ? void 0 : t.timeoutMs) ?? 5e3;
  if (t != null && t.registryUrl)
    try {
      const r = await Q(t.registryUrl, s);
      if (r && Object.keys(r).length > 0)
        return te(e, r), {
          catalog: r,
          source: "api",
          prefixCount: Object.keys(r).length,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
    } catch {
    }
  const n = ie(e, i);
  return n ? {
    catalog: n,
    source: "cache",
    prefixCount: Object.keys(n).length,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  } : {
    catalog: R,
    source: "static",
    prefixCount: Object.keys(R).length,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function Q(t, e) {
  const i = new AbortController(), s = setTimeout(() => i.abort(), e);
  try {
    const n = await fetch(`${t}/resolve/active`, { signal: i.signal });
    if (clearTimeout(s), !n.ok) return null;
    const r = await n.json();
    return ee(r);
  } catch {
    return clearTimeout(s), null;
  }
}
function ee(t) {
  var i;
  const e = {};
  for (const [s, n] of Object.entries(t)) {
    if (!n || typeof n != "object") continue;
    const r = n.version ?? n.activeVersion ?? "v1", a = n.labels ?? n.dims ? Object.keys(n.dims) : [], c = {};
    if (n.dims)
      for (const [h, o] of Object.entries(n.dims))
        o.kind === "axis" || o.entries ? c[h] = {
          kind: "axis",
          entries: o.entries ?? [],
          capacity: o.capacity ?? ((i = o.entries) == null ? void 0 : i.length) ?? 32
        } : (o.kind === "prefix_ref" || o.values) && (c[h] = {
          kind: "prefix_ref",
          values: o.values ?? []
        });
    (a.length > 0 || Object.keys(c).length > 0) && (e[s] = { version: r, labels: a, dims: c });
  }
  return e;
}
function te(t, e) {
  try {
    const i = { catalog: e, savedAt: Date.now() };
    localStorage.setItem(t, JSON.stringify(i));
  } catch {
  }
}
function ie(t, e) {
  try {
    const i = localStorage.getItem(t);
    if (!i) return null;
    const s = JSON.parse(i);
    return Date.now() - s.savedAt > e ? null : s.catalog;
  } catch {
    return null;
  }
}
export {
  Ae as ActivationProcessor,
  R as BROWSER_CATALOG,
  Ne as BeamPool,
  V as CATEGORY_COLORS,
  Pe as CellStateManager,
  W as DEFAULT_LOD,
  ne as DEFAULT_THEME,
  ke as DEMO_PREFIX_META,
  Re as DEMO_SERVICES,
  be as DEMO_SIGNALS,
  Ke as ENV_FILTERS,
  De as FlowHistory,
  j as LAYER_COLORS,
  Ye as MonitorAdapter,
  z as PALETTE,
  E as PRESET_AXES,
  ze as PRESET_VIEWS,
  Xe as PerfMonitor,
  ve as SIGNAL_ROLE_COLORS,
  xe as SIGNAL_ROLE_LABELS,
  Ve as STACK_CHECKOUT,
  je as STACK_INFRA,
  Oe as TIER_NAMES,
  Ie as ViewEngine,
  Me as applyFilters,
  re as buildGridPositions,
  Se as buildServiceContainers,
  X as classifyByRole,
  Le as computeAllStacks,
  Te as computeCrossViewLayout,
  He as computeGroupLod,
  q as computeLodLevel,
  me as computePatternLayout,
  Ce as computeScopeLayouts,
  G as computeStackLayout,
  ae as computeStackPositions,
  pe as cube,
  F as decode,
  Ge as decodeContext,
  Ze as defaultKeyMapper,
  U as encode,
  ye as extractAxes,
  _e as extractDims,
  $e as formatDetail,
  oe as generateCssVariables,
  Be as getLodVisibility,
  B as getPrefixRole,
  de as grid,
  ge as inferPattern,
  D as inferRole,
  qe as loadCatalog,
  Ee as matchEventToCells,
  ue as nested,
  le as row,
  ce as scalar,
  fe as shelf,
  he as spine,
  J as track,
  We as trackWithSignal,
  we as validateSignal
};
