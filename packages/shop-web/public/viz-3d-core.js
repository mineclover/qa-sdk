var C = Object.defineProperty;
var N = (i, e, t) => e in i ? C(i, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : i[e] = t;
var z = (i, e, t) => N(i, typeof e != "symbol" ? e + "" : e, t);
const W = {
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
function F(i, e, t, s) {
  var l, x;
  const n = [], r = /* @__PURE__ */ new Map();
  for (const c of i) {
    const b = [], h = t + s;
    if (c.axes3d) {
      const g = c.axes3d.x.entries, p = ((l = c.axes3d.y) == null ? void 0 : l.entries) ?? ["_"], v = ((x = c.axes3d.z) == null ? void 0 : x.entries) ?? ["_"], f = g.length, w = p.length, d = v.length;
      for (let a = 0; a < f; a++)
        for (let _ = 0; _ < w; _++)
          for (let m = 0; m < d; m++) {
            const y = -(f - 1) * h / 2 + a * h, $ = _ * h, k = -(d - 1) * h / 2 + m * h, T = w > 1 || d > 1 ? [g[a], p[_] !== "_" ? p[_] : null, v[m] !== "_" ? v[m] : null].filter(Boolean).join("/") : g[a], S = `${c.id}/${T}`;
            b.push({ key: S, gridId: c.id, entry: T, localX: y, localY: $, localZ: k, col: a, row: _, depth: m }), r.set(S, { gridId: c.id, entry: T, localX: y, localY: $, localZ: k, layer: c.layer, category: c.category });
          }
      n.push({
        id: c.id,
        category: c.category,
        layer: c.layer,
        cells: b,
        width: f * h,
        height: w * h,
        depth: d * h,
        cols: f,
        rows: w,
        depths: d,
        is3d: w > 1
      });
    } else {
      const g = Math.ceil(c.entries.length / c.cols);
      for (let p = 0; p < c.entries.length; p++) {
        const v = p % c.cols, f = Math.floor(p / c.cols), w = -(c.cols - 1) * h / 2 + v * h, d = -(g - 1) * h / 2 + f * h, a = `${c.id}/${c.entries[p]}`;
        b.push({ key: a, gridId: c.id, entry: c.entries[p], localX: w, localY: 0, localZ: d, col: v, row: f, depth: 0 }), r.set(a, { gridId: c.id, entry: c.entries[p], localX: w, localY: 0, localZ: d, layer: c.layer, category: c.category });
      }
      n.push({
        id: c.id,
        category: c.category,
        layer: c.layer,
        cells: b,
        width: c.cols * h,
        height: h,
        depth: g * h,
        cols: c.cols,
        rows: g,
        depths: 1,
        is3d: !1
      });
    }
  }
  const o = V(i, e, t, s);
  return { grids: n, viewPositions: o, cellMap: r };
}
function V(i, e, t = 0.42, s = 0.1) {
  var p, v, f, w;
  const n = {
    layer: {},
    category: {},
    dsl: {},
    service: {}
  }, r = /* @__PURE__ */ new Map();
  for (const d of i) {
    const a = t + s;
    if (d.axes3d)
      r.set(d.id, { w: d.axes3d.x.entries.length * a, d: (((p = d.axes3d.z) == null ? void 0 : p.entries.length) ?? 1) * a });
    else {
      const _ = Math.ceil(d.entries.length / d.cols);
      r.set(d.id, { w: d.cols * a, d: _ * a });
    }
  }
  const o = e.map(() => []);
  for (const d of i) (v = o[d.layer]) == null || v.push(d);
  const l = t * 2;
  for (let d = 0; d < o.length; d++) {
    const a = o[d], _ = Math.min(a.length, 4);
    for (let m = 0; m < a.length; m++) {
      const y = Math.floor(m / _), $ = a.filter((M, O) => Math.floor(O / _) === y);
      let T = -$.reduce((M, O) => {
        var K;
        return M + (((K = r.get(O.id)) == null ? void 0 : K.w) ?? 2) + l;
      }, -l) / 2;
      const S = m - y * _;
      for (let M = 0; M < S; M++)
        T += (((f = r.get($[M].id)) == null ? void 0 : f.w) ?? 2) + l;
      const P = ((w = r.get(a[m].id)) == null ? void 0 : w.w) ?? 2;
      T += P / 2;
      const R = Math.max(...$.map((M) => {
        var O;
        return ((O = r.get(M.id)) == null ? void 0 : O.d) ?? 2;
      }));
      n.layer[a[m].id] = {
        x: T,
        y: e[d],
        z: y * -(R + l * 2)
      };
    }
  }
  [...new Set(i.map((d) => d.category))].forEach((d, a) => {
    const _ = i.filter(($) => $.category === d), m = a % 3, y = Math.floor(a / 3);
    _.forEach(($, k) => {
      n.category[$.id] = { x: -12 + m * 12, y: 4 - k * 3.5, z: y * -8 };
    });
  });
  const c = [...new Set(i.map((d) => d.dsl).filter(Boolean))], b = i.filter((d) => !d.dsl);
  c.forEach((d, a) => {
    const _ = i.filter(($) => $.dsl === d), m = a % 4, y = Math.floor(a / 4);
    _.forEach(($, k) => {
      n.dsl[$.id] = { x: -18 + m * 12, y: 4 - k * 3, z: y * -10 };
    });
  }), b.forEach((d, a) => {
    n.dsl[d.id] = { x: 24, y: 4 - a * 3, z: -12 };
  });
  const h = [...new Set(i.map((d) => d.service).filter(Boolean))], g = i.filter((d) => !d.service);
  return h.forEach((d, a) => {
    i.filter((m) => m.service === d).forEach((m, y) => {
      n.service[m.id] = { x: -16 + a * 8, y: 4 - Math.floor(y / 2) * 3.5, z: y % 2 * -5 };
    });
  }), g.forEach((d, a) => {
    n.service[d.id] = { x: 24, y: 4, z: -a * 5 };
  }), n;
}
function U(i, e) {
  const t = {};
  for (const s of i)
    s.grids.forEach((n, r) => {
      const o = r * s.gap;
      t[n] = {
        x: s.position.x + (s.axis === "x" ? o : 0),
        y: s.position.y + (s.axis === "y" ? o : 0),
        z: s.position.z + (s.axis === "z" ? o : 0)
      };
    });
  return t;
}
function u(i) {
  const e = i >> 16 & 255, t = i >> 8 & 255, s = i & 255;
  return { hex: i, css: `#${i.toString(16).padStart(6, "0")}`, rgb: `${e},${t},${s}` };
}
const I = {
  // Background / Surface
  bgDeep: u(328968),
  bgCard: u(526864),
  bgSurface: u(790036),
  bgGrid1: u(1712176),
  bgGrid2: u(1053984),
  bgAxis: u(1714232),
  // Text
  txtPrimary: u(12634328),
  txtSecondary: u(6715272),
  txtDim: u(3359829),
  txtMuted: u(2241348),
  // Accent
  mint: u(6619098),
  cyan: u(46296),
  amber: u(16752451),
  orange: u(16753922),
  violet: u(8150268),
  purple: u(7101671),
  rose: u(16726112),
  pink: u(15221651),
  green: u(3069299),
  red: u(16739179),
  // State
  connected: u(3069299),
  warning: u(16752451),
  error: u(16726112),
  info: u(6619098)
}, L = {
  observation: { main: u(58879), emissive: u(38823) },
  event: { main: u(16748800), emissive: u(12545024) },
  policy: { main: u(58998), emissive: u(38436) },
  relation: { main: u(11766015), emissive: u(8146431) },
  entity: { main: u(5533306), emissive: u(3622735) },
  table: { main: u(16732754), emissive: u(12986408) }
}, A = [
  u(6619098),
  // L0 UI — mint
  u(16752451),
  // L1 Business — amber
  u(8150268),
  // L2 Infra — violet
  u(16726112)
  // L3 Data — rose
];
function J() {
  return [
    `--bg:${I.bgDeep.css}`,
    `--card:rgba(${I.bgCard.rgb},0.92)`,
    `--border:rgba(${I.mint.rgb},0.08)`,
    `--mint:${I.mint.css}`,
    `--amber:${I.amber.css}`,
    `--violet:${I.violet.css}`,
    `--rose:${I.rose.css}`,
    `--txt:${I.txtPrimary.css}`,
    `--dim:${I.txtDim.css}`,
    `--green:${I.green.css}`,
    `--red:${I.red.css}`,
    `--cyan:${I.cyan.css}`,
    // Category
    ...Object.entries(L).map(([i, e]) => `--cat-${i}:${e.main.css}`),
    // Layer
    ...A.map((i, e) => `--layer-${e}:${i.css}`)
  ].join(";");
}
function Q(i, e) {
  return {
    type: "scalar",
    prefixId: i,
    mappings: [{ axis: e, channel: "color" }],
    description: `${i}.${e} → 단일 값 표시`
  };
}
function ee(i, e) {
  return {
    type: "row",
    prefixId: i,
    mappings: [{ axis: e, channel: "x" }],
    description: `${i}.${e} → 가로 행`
  };
}
function te(i, e, t) {
  return {
    type: "grid",
    prefixId: i,
    mappings: [
      { axis: e, channel: "x" },
      { axis: t, channel: "z" }
    ],
    description: `${i}: ${e}(x) × ${t}(z) → 2D 그리드`
  };
}
function ie(i, e, t, s) {
  return {
    type: "cube",
    prefixId: i,
    mappings: [
      { axis: e, channel: "x" },
      { axis: t, channel: "y" },
      { axis: s, channel: "z" }
    ],
    description: `${i}: ${e}(x) × ${t}(y) × ${s}(z) → 3D 큐브`
  };
}
function se(i, e, t) {
  return {
    type: "spine",
    prefixId: i,
    mappings: [
      { axis: e, channel: "x" },
      ...t.map((s) => ({ axis: s, channel: "collapse" }))
    ],
    description: `${i}: ${e}(x), [${t.join(",")}] 압축 → 확대 시 큐브`
  };
}
function ne(i, e, t, s) {
  return {
    type: "shelf",
    prefixId: i,
    mappings: [
      { axis: e, channel: "group", subPattern: "grid" },
      { axis: t, channel: "x" },
      { axis: s, channel: "z" }
    ],
    description: `${i}: ${e}별 선반, 각 선반 = ${t}(x) × ${s}(z) 그리드`
  };
}
function re(i, e, t) {
  return {
    type: "nested",
    prefixId: i,
    mappings: [
      { axis: e, channel: "group", subPattern: t }
    ],
    description: `${i}: ${e}별 그룹, 각 그룹 = ${t}`
  };
}
function oe(i, e, t = 0.4, s = 0.08) {
  const n = t + s, r = [], o = i.mappings.find((a) => a.channel === "x"), l = i.mappings.find((a) => a.channel === "y"), x = i.mappings.find((a) => a.channel === "z"), c = i.mappings.find((a) => a.channel === "group"), b = i.mappings.filter((a) => a.channel === "collapse").map((a) => a.axis), h = o ? e[o.axis] || [] : ["_"], g = l ? e[l.axis] || [] : ["_"], p = x ? e[x.axis] || [] : ["_"], v = c ? e[c.axis] || [] : ["_"];
  switch (i.type) {
    case "scalar":
      r.push({ key: `${i.prefixId}/_`, x: 0, y: 0, z: 0 });
      break;
    case "row":
      h.forEach((a, _) => {
        r.push({ key: `${i.prefixId}/${a}`, x: _ * n, y: 0, z: 0 });
      });
      break;
    case "grid":
      h.forEach((a, _) => {
        p.forEach((m, y) => {
          r.push({ key: `${i.prefixId}/${a}_${m}`, x: _ * n, y: 0, z: y * n });
        });
      });
      break;
    case "cube":
      h.forEach((a, _) => {
        g.forEach((m, y) => {
          p.forEach(($, k) => {
            r.push({ key: `${i.prefixId}/${a}_${m}_${$}`, x: _ * n, y: y * n, z: k * n });
          });
        });
      });
      break;
    case "spine":
      h.forEach((a, _) => {
        const m = {};
        for (const y of b)
          m[y] = `(${(e[y] || []).length} entries)`;
        r.push({ key: `${i.prefixId}/${a}`, x: _ * n, y: 0, z: 0, collapsed: m });
      });
      break;
    case "shelf":
      v.forEach((a, _) => {
        const m = _ * (p.length * n + n * 2);
        h.forEach((y, $) => {
          p.forEach((k, T) => {
            r.push({
              key: `${i.prefixId}/${a}_${y}_${k}`,
              x: $ * n,
              y: m,
              z: T * n,
              group: a
            });
          });
        });
      });
      break;
    case "nested":
      v.forEach((a, _) => {
        const m = _ * (h.length * n + n * 2);
        h.forEach((y, $) => {
          r.push({
            key: `${i.prefixId}/${a}/${y}`,
            x: m + $ * n,
            y: 0,
            z: 0,
            group: a
          });
        });
      });
      break;
  }
  const f = r.map((a) => a.x), w = r.map((a) => a.y), d = r.map((a) => a.z);
  return {
    pattern: i,
    cells: r,
    bounds: {
      width: r.length > 0 ? Math.max(...f) - Math.min(...f) + t : 0,
      height: r.length > 0 ? Math.max(...w) - Math.min(...w) + t : 0,
      depth: r.length > 0 ? Math.max(...d) - Math.min(...d) + t : 0
    }
  };
}
function j(i, e) {
  if (e === "prefix_ref" || e === "table_ref") return "context";
  const t = i.toLowerCase();
  return t.includes("step") || t.includes("phase") || t.includes("stage") ? "sequence" : t.includes("variant") || t.includes("version") || t.includes("mode") ? "variant" : t.endsWith("_name") || t === "flow_name" || t === "event_name" || t.endsWith("_type") || t === "resource_type" ? "classify" : (t.includes("action") || t.includes("method") || t.includes("op") || t === "role" || t === "resource", "identity");
}
function ae(i, e) {
  const t = typeof e[0] == "string" ? e.map((p) => ({ label: p, kind: "axis" })) : e, s = t.filter((p) => p.kind === "axis"), n = t.filter((p) => p.kind === "prefix_ref"), r = t.filter((p) => p.kind === "table_ref"), o = s.map((p) => ({ ...p, role: j(p.label, p.kind) })), l = o.filter((p) => p.role === "classify"), x = o.filter((p) => p.role === "sequence"), c = o.filter((p) => p.role === "variant"), b = o.filter((p) => p.role === "identity"), h = [];
  for (const p of n)
    h.push({ axis: p.label, channel: "collapse", role: "context", dimKind: "prefix_ref" });
  for (const p of r)
    h.push({ axis: p.label, channel: "link", role: "context", dimKind: "table_ref" });
  if (l.length > 0) {
    const p = l[0], v = o.filter((d) => d !== p);
    if (v.length === 0)
      return h.push({ axis: p.label, channel: "x", role: "classify" }), { type: "row", prefixId: i, mappings: h, description: `${i}: ${p.label}(x) → 행` };
    if (v.length === 1)
      return h.push({ axis: p.label, channel: "group", role: "classify", subPattern: "row" }), h.push({ axis: v[0].label, channel: "x", role: v[0].role }), { type: "shelf", prefixId: i, mappings: h, description: `${i}: ${p.label}별 선반, ${v[0].label}(x)` };
    h.push({ axis: p.label, channel: "group", role: "classify", subPattern: "grid" });
    const f = x[0] || v[0], w = c[0] || v.find((d) => d !== f) || v[1];
    return f && h.push({ axis: f.label, channel: "x", role: f.role }), w && w !== f && h.push({ axis: w.label, channel: "z", role: w.role }), { type: "shelf", prefixId: i, mappings: h, description: `${i}: ${p.label}별 선반, ${f == null ? void 0 : f.label}(x) × ${w == null ? void 0 : w.label}(z)` };
  }
  const g = [...x, ...b, ...c];
  return g.length === 0 ? { type: "scalar", prefixId: i, mappings: [{ axis: "_", channel: "color" }], description: `${i}: scalar` } : g.length === 1 ? (h.push({ axis: g[0].label, channel: "x", role: g[0].role }), { type: "row", prefixId: i, mappings: h, description: `${i}: ${g[0].label}(x)` }) : g.length === 2 ? (h.push({ axis: g[0].label, channel: "x", role: g[0].role }), h.push({ axis: g[1].label, channel: "z", role: g[1].role }), { type: "grid", prefixId: i, mappings: h, description: `${i}: ${g[0].label}(x) × ${g[1].label}(z)` }) : (h.push({ axis: g[0].label, channel: "x", role: g[0].role }), h.push({ axis: g[1].label, channel: "y", role: g[1].role }), h.push({ axis: g[2].label, channel: "z", role: g[2].role }), { type: "cube", prefixId: i, mappings: h, description: `${i}: ${g[0].label}(x) × ${g[1].label}(y) × ${g[2].label}(z)` });
}
function ce(i) {
  return Object.entries(i).map(([e, t]) => ({
    label: e,
    kind: t.kind
  }));
}
function le(i) {
  return Object.entries(i).filter(([, e]) => e.kind === "axis").map(([e]) => e);
}
const de = {
  context: "어디서",
  trigger: "뭘 했는가",
  channel: "어떤 경로",
  state: "흐름 어디",
  guard: "어떤 조건",
  effect: "결과",
  data: "데이터 접점"
}, pe = {
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
function D(i) {
  return H[i] ?? "trigger";
}
function he(i) {
  const e = {
    context: [],
    trigger: [],
    channel: [],
    state: [],
    guard: [],
    effect: [],
    data: []
  };
  for (const [t, s] of Object.entries(i)) {
    const n = D(t);
    e[n].push({ prefixId: t, serialized: s });
  }
  return e;
}
const fe = [
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
function ue(i, e) {
  const t = new Set(Object.keys(e)), s = new Set(i.members.map((l) => l.prefixId));
  let n = 0;
  const r = /* @__PURE__ */ new Set();
  for (const l of i.members)
    t.has(l.prefixId) ? n++ : r.add(l.role);
  const o = [...t].filter((l) => !s.has(l) && l !== "service");
  return {
    signalId: i.id,
    valid: n === i.members.length,
    missingRoles: [...r],
    extraPrefixes: o,
    matchedMembers: n,
    totalMembers: i.members.length
  };
}
const ge = {
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
function me(i, e) {
  var s, n;
  const t = [];
  if (t.push(`<div style="font-size:11px;font-weight:600;color:#e0e4ec">${i.displayName}</div>`), t.push(`<div style="font-size:9px;color:#556;margin:3px 0">${i.description}</div>`), i.source) {
    const r = i.source, o = [];
    r.module && o.push(r.module), r.file && o.push(r.file), r.line && o.push(`L${r.line}`), t.push(`<div style="font-size:8px;color:#334;margin-top:4px">📁 ${o.join(" / ")}</div>`), r.url && t.push(`<div style="font-size:8px"><a href="${r.url}" target="_blank" style="color:#64ffda">📎 docs</a></div>`);
  }
  switch (i.detailKind) {
    case "schema": {
      const r = i.detail;
      if (r != null && r.columns) {
        t.push('<div style="margin-top:6px;font-size:8px;color:#445;letter-spacing:1px">SCHEMA</div>');
        for (const o of r.columns) {
          const l = o.refKind !== "scalar" ? ` <span style="color:${o.refKind === "axis_ref" ? "#00e676" : o.refKind === "table_ref" ? "#ff5252" : "#00e5ff"}">→${o.refTarget}</span>` : "", x = e && o.name === e ? "color:var(--mint);font-weight:600" : "color:#667";
          t.push(`<div style="font-size:9px;${x}">${o.name} <span style="color:#334">${o.type}</span>${l}</div>`);
        }
      }
      break;
    }
    case "event-def": {
      const r = i.detail;
      if (r && (t.push('<div style="margin-top:6px;font-size:8px;color:#445;letter-spacing:1px">EVENT STRUCTURE</div>'), t.push(`<div style="font-size:9px;color:#ff9100">${r.structure}</div>`), r.slots))
        for (const o of r.slots) {
          const l = o.kind === "table_ref" ? "#ff5252" : o.kind === "prefix_ref" ? "#00e5ff" : "#00e676";
          t.push(`<div style="font-size:9px;color:#667">${o.name} <span style="color:${l}">${o.kind}→${o.target}</span></div>`);
        }
      break;
    }
    case "permission":
      t.push('<div style="margin-top:6px;font-size:8px;color:#445;letter-spacing:1px">PERMISSION</div>'), t.push(`<div style="font-size:9px;color:#00e676">${((s = i.detail) == null ? void 0 : s.matrix) || "role-based grant/deny"}</div>`);
      break;
    case "endpoint": {
      const r = (n = i.detail) == null ? void 0 : n.routes;
      if (r) {
        t.push('<div style="margin-top:6px;font-size:8px;color:#445;letter-spacing:1px">ROUTES</div>');
        for (const o of r)
          t.push(`<div style="font-size:9px;color:#667"><span style="color:#00e5ff">${o.method}</span> ${o.path}</div>`);
      }
      break;
    }
  }
  return t.join("");
}
function xe(i, e = 0.42, t = 0.1) {
  const s = e + t, n = i.channels.find((f) => f.channel === "x"), r = i.channels.find((f) => f.channel === "y"), o = i.channels.find((f) => f.channel === "z"), l = i.channels.find((f) => f.channel === "group"), x = i.channels.find((f) => f.channel === "color"), c = (f) => {
    var d;
    return f ? ((d = i.filters) == null ? void 0 : d[f.id]) ?? f.entries : ["_"];
  }, b = c(n == null ? void 0 : n.axis), h = c(r == null ? void 0 : r.axis), g = c(o == null ? void 0 : o.axis), p = c(l == null ? void 0 : l.axis), v = [];
  for (const f of p) {
    const w = p.indexOf(f) * (b.length * s + s * 3);
    for (const d of b)
      for (const a of h)
        for (const _ of g) {
          const m = b.indexOf(d), y = h.indexOf(a), $ = g.indexOf(_), k = {};
          n && (k[n.axis.id] = d), r && (k[r.axis.id] = a), o && (k[o.axis.id] = _), l && f !== "_" && (k[l.axis.id] = f);
          const S = Object.values(k).join(":");
          v.push({
            coords: k,
            key: S,
            x: w + m * s,
            y: y * s,
            z: $ * s,
            group: f !== "_" ? f : void 0,
            colorValue: x ? k[x.axis.id] : void 0
          });
        }
  }
  return {
    def: i,
    cells: v,
    xEntries: b,
    yEntries: h,
    zEntries: g,
    groups: p.filter((f) => f !== "_"),
    totalCells: v.length,
    bounds: {
      width: (p.length > 1 ? p.length : 1) * b.length * s,
      height: h.length * s,
      depth: g.length * s
    }
  };
}
function _e(i, e) {
  const t = [];
  for (const s of e.cells) {
    let n = !0;
    for (const [r, o] of Object.entries(s.coords))
      if (i[r] !== o) {
        n = !1;
        break;
      }
    n && t.push(s.key);
  }
  return t;
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
}, ye = [
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
class ve {
  constructor() {
    z(this, "targets", /* @__PURE__ */ new Map());
    z(this, "positions", {
      layer: {},
      category: {},
      dsl: {},
      service: {}
    });
    z(this, "_currentMode", "layer");
    z(this, "_lerpSpeed", 3);
  }
  get currentMode() {
    return this._currentMode;
  }
  setPositions(e) {
    this.positions = e;
  }
  /** 매트릭스 스택용 커스텀 뷰 모드 추가 */
  addViewMode(e, t) {
    this.positions[e] = t;
  }
  registerGroup(e, t) {
    this.targets.set(e, {
      groupId: e,
      currentX: t.x,
      currentY: t.y,
      currentZ: t.z,
      targetX: t.x,
      targetY: t.y,
      targetZ: t.z
    });
  }
  setMode(e) {
    this._currentMode = e;
    const t = this.positions[e];
    if (t)
      for (const [s, n] of Object.entries(t)) {
        const r = this.targets.get(s);
        r && (r.targetX = n.x, r.targetY = n.y, r.targetZ = n.z);
      }
  }
  /** 매 프레임 호출 — dt 기반 lerp */
  update(e) {
    const t = this._lerpSpeed * e;
    for (const s of this.targets.values())
      s.currentX += (s.targetX - s.currentX) * t, s.currentY += (s.targetY - s.currentY) * t, s.currentZ += (s.targetZ - s.currentZ) * t;
  }
  getPosition(e) {
    const t = this.targets.get(e);
    return t ? { x: t.currentX, y: t.currentY, z: t.currentZ } : void 0;
  }
  getAllPositions() {
    const e = /* @__PURE__ */ new Map();
    for (const [t, s] of this.targets)
      e.set(t, { x: s.currentX, y: s.currentY, z: s.currentZ });
    return e;
  }
}
const we = {
  0: "이벤트 발생",
  1: "이벤트 처리",
  2: "이벤트 소비/생산",
  3: "데이터 도달"
}, X = {
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
function B(i) {
  return X[i] ?? 2;
}
function be(i, e, t) {
  return i.map((s) => {
    const n = [.../* @__PURE__ */ new Set([...s.ownedPrefixes, ...s.consumedPrefixes])], r = { 0: [], 1: [], 2: [], 3: [] };
    for (const l of n) {
      const x = e.get(l);
      if (!x) continue;
      const c = B(l);
      r[c].push({
        prefixId: l,
        tier: c,
        entries: x.entries,
        pattern: x.pattern,
        category: x.category
      });
    }
    const o = [];
    if (t)
      for (const l of s.tables) {
        const x = t[l];
        x && o.push(...x);
      }
    return {
      serviceId: s.id,
      serviceName: s.name,
      tiers: r,
      dataEntries: o
    };
  });
}
function $e(i, e, t) {
  const s = t.find((n) => n.axisId === e);
  return s ? s.mode === "show" ? i.filter((n) => s.values.includes(n)) : i.filter((n) => !s.values.includes(n)) : [...i];
}
function ke(i, e) {
  const t = (e == null ? void 0 : e.containerGap) ?? 12, s = (e == null ? void 0 : e.tierGap) ?? 3;
  return i.map((n, r) => {
    const l = (Object.values(n.tiers).filter((b) => b.length > 0).length + (n.dataEntries.length > 0 ? 1 : 0)) * s, x = Math.max(1, ...Object.values(n.tiers).flatMap((b) => b.map((h) => h.entries.length))), c = Math.max(4, Math.ceil(Math.sqrt(x)) * 1.5);
    return {
      serviceId: n.serviceId,
      position: { x: r * t - (i.length - 1) * t / 2, y: 0, z: 0 },
      size: { width: c, height: l, depth: c },
      tierOffsets: { 0: s * 1.5, 1: s * 0.5, 2: -s * 0.5, 3: -s * 1.5 }
    };
  });
}
const ze = [
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
], Ee = {
  prodOnly: { axisId: "env", mode: "show", values: ["prod"] },
  devOnly: { axisId: "env", mode: "show", values: ["dev"] },
  hideTest: { axisId: "env", mode: "hide", values: ["test", "local"] },
  all: { axisId: "env", mode: "show", values: ["dev", "stage", "prod", "test", "local"] }
};
class Ie {
  constructor(e) {
    z(this, "states", /* @__PURE__ */ new Map());
    z(this, "_activeSet", /* @__PURE__ */ new Set());
    z(this, "_layerHits");
    z(this, "_totalHits", 0);
    this._layerHits = new Array(e).fill(0);
  }
  getOrCreate(e) {
    let t = this.states.get(e);
    return t || (t = { glow: 0, hits: 0 }, this.states.set(e, t)), t;
  }
  activate(e, t) {
    const s = this.getOrCreate(e);
    s.glow = 2, s.hits++, this._activeSet.add(e), t >= 0 && t < this._layerHits.length && this._layerHits[t]++, this._totalHits++;
  }
  deactivateAll() {
    this._activeSet.clear();
  }
  /** glow decay — 매 프레임 호출 */
  decay(e, t = 1.2) {
    for (const s of this.states.values())
      s.glow > 0 && (s.glow = Math.max(0, s.glow - e * t));
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
class Te {
  constructor(e) {
    z(this, "beams");
    z(this, "index", 0);
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
  spawn(e, t, s) {
    const n = this.beams[this.index % this.beams.length];
    this.index++, n.fromX = e.x, n.fromY = e.y, n.fromZ = e.z, n.toX = t.x, n.toY = t.y, n.toZ = t.z, n.color = s, n.life = 1;
  }
  decay(e, t = 0.5) {
    for (const s of this.beams)
      s.life > 0 && (s.life = Math.max(0, s.life - e * t));
  }
  getActive() {
    return this.beams.filter((e) => e.life > 0);
  }
  getAll() {
    return this.beams;
  }
}
class Me {
  constructor(e, t) {
    this.cells = e, this.beams = t;
  }
  /**
   * 셀 키 목록을 활성화하고, 크로스 레이어 빔을 생성한다.
   */
  fire(e, t) {
    this.cells.deactivateAll();
    const s = [];
    for (const n of e) {
      const r = t(n);
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
function Y(i, e) {
  const t = new Map(e.map((l) => [l.id, l])), s = {};
  let n = 0, r = 0;
  i.grids.forEach((l, x) => {
    const c = t.get(l);
    c && (n = Math.max(n, c.width), r = Math.max(r, c.depth));
    const b = x * i.gap;
    s[l] = {
      x: i.position.x + (i.axis === "x" ? b : 0),
      y: i.position.y + (i.axis === "y" ? b : 0),
      z: i.position.z + (i.axis === "z" ? b : 0)
    };
  });
  const o = i.grids.length * i.gap;
  return {
    stackId: i.id,
    axis: i.axis,
    gridPositions: s,
    bounds: {
      width: i.axis === "x" ? o : n,
      height: i.axis === "y" ? o : 1,
      depth: i.axis === "z" ? o : r
    }
  };
}
function Se(i, e) {
  const t = [], s = {};
  for (const n of i) {
    const r = Y(n, e);
    t.push(r), Object.assign(s, r.gridPositions);
  }
  for (const n of e)
    n.id in s || (s[n.id] = { x: 30, y: 0, z: 0 });
  return { layouts: t, viewPositions: s };
}
const Oe = {
  id: "stack-checkout",
  grids: ["page_view", "endpoint", "flow_point", "permission", "order_event", "orders"],
  axis: "y",
  gap: 3,
  position: { x: 0, y: -4, z: 0 }
}, Ke = {
  id: "stack-infra",
  grids: ["service", "deploy_event", "health_event", "pipeline_point", "data_policy"],
  axis: "y",
  gap: 3,
  position: { x: 12, y: -4, z: 0 }
};
class Pe {
  constructor() {
    z(this, "entries", []);
    z(this, "_viewIdx", -1);
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
      (t) => t.keys.some((s) => s.startsWith(e + "/")) || t.flow.some((s) => s.cell.startsWith(e + "/"))
    );
  }
  /** 특정 tier만 포함하는 스텝 필터 */
  filterByTier(e) {
    return this.entries.filter((t) => t.flow.some((s) => s.tier === e));
  }
  /** 표시용 텍스트 */
  indexLabel() {
    return this.entries.length === 0 ? "-/-" : `${this._viewIdx === -1 ? this.entries.length : this._viewIdx + 1}/${this.entries.length}`;
  }
}
const Z = {
  near: 15,
  mid: 35
};
function G(i, e = Z) {
  return i <= e.near ? "near" : i <= e.mid ? "mid" : "far";
}
function Re(i, e, t) {
  const s = /* @__PURE__ */ new Map();
  for (const [n, r] of e) {
    const o = i.x - r.x, l = i.y - r.y, x = i.z - r.z, c = Math.sqrt(o * o + l * l + x * x);
    s.set(n, G(c, t));
  }
  return s;
}
function Ce(i) {
  switch (i) {
    case "near":
      return { showLabels: !0, showEdges: !0, showHitCounts: !0, cellOpacityMultiplier: 1 };
    case "mid":
      return { showLabels: !0, showEdges: !1, showHitCounts: !1, cellOpacityMultiplier: 0.9 };
    case "far":
      return { showLabels: !1, showEdges: !1, showHitCounts: !1, cellOpacityMultiplier: 0.7 };
  }
}
class Ne {
  constructor() {
    z(this, "frames", 0);
    z(this, "lastTime", performance.now());
    z(this, "_fps", 0);
    z(this, "_frameTime", 0);
  }
  /** 매 프레임 호출 */
  tick() {
    this.frames++;
    const e = performance.now(), t = e - this.lastTime;
    t >= 1e3 && (this._fps = Math.round(this.frames * 1e3 / t), this._frameTime = Math.round(t / this.frames * 100) / 100, this.frames = 0, this.lastTime = e);
  }
  get fps() {
    return this._fps;
  }
  get frameTime() {
    return this._frameTime;
  }
  /** Three.js renderer.info에서 통계 추출 */
  getStats(e, t, s) {
    return {
      fps: this._fps,
      frameTime: this._frameTime,
      drawCalls: e.render.calls,
      triangles: e.render.triangles,
      points: e.render.points,
      lines: e.render.lines,
      cellCount: t,
      activeCount: s
    };
  }
  /** HUD 표시용 문자열 */
  formatHud(e) {
    return `${e.fps}fps ${e.frameTime}ms | draw:${e.drawCalls} tri:${e.triangles} | cells:${e.cellCount} active:${e.activeCount}`;
  }
}
class Ve {
  constructor(e) {
    z(this, "ws", null);
    z(this, "_connected", !1);
    this.config = e;
  }
  get connected() {
    return this._connected;
  }
  /** WebSocket 연결 */
  connect(e) {
    var t, s, n, r;
    (s = (t = this.config).onConnectionChange) == null || s.call(t, "connecting");
    try {
      this.ws = new WebSocket(e), this.ws.onopen = () => {
        var o, l;
        this._connected = !0, (l = (o = this.config).onConnectionChange) == null || l.call(o, "connected"), this.ws.send(JSON.stringify({ type: "subscribe", scenarioId: "*" }));
      }, this.ws.onmessage = (o) => {
        var l, x;
        try {
          const c = JSON.parse(o.data);
          c.type === "record" && c.data ? this.handleRecord(c.data) : c.type === "subscribed" && ((x = (l = this.config).onConnectionChange) == null || x.call(l, "subscribed"));
        } catch {
        }
      }, this.ws.onerror = () => {
        var o, l;
        (l = (o = this.config).onConnectionChange) == null || l.call(o, "error");
      }, this.ws.onclose = () => {
        var o, l;
        this._connected = !1, (l = (o = this.config).onConnectionChange) == null || l.call(o, "disconnected");
      };
    } catch {
      (r = (n = this.config).onConnectionChange) == null || r.call(n, "failed");
    }
  }
  disconnect() {
    var e, t;
    this.ws && (this.ws.close(), this.ws = null), this._connected = !1, (t = (e = this.config).onConnectionChange) == null || t.call(e, "disconnected");
  }
  /** HTTP로 이벤트 전송 (DEMO용) */
  async sendToIngest(e, t, s, n, r) {
    const o = (/* @__PURE__ */ new Date()).toISOString();
    try {
      await fetch(e, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transmission_id: `tx_${Date.now()}`,
          sent_at: o,
          owner: { owner_type: "workspace", owner_id: "viz-3d" },
          source: { service_name: "viz-3d", sdk_name: "@qa-sdk/viz-3d", sdk_version: "0.1.0" },
          runtime: { platform: "browser" },
          build: { env: "dev" },
          records: [{
            log_id: `l_${Date.now()}_${r}`,
            timestamp: o,
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
            address_context: t
          }]
        })
      });
    } catch {
    }
  }
  handleRecord(e) {
    const t = e.addressContext || e.address_context;
    if (!t || Object.keys(t).length === 0) return;
    const s = [];
    for (const [, n] of Object.entries(t)) {
      const r = this.config.decode(n);
      if (!r) continue;
      const o = this.config.mapToKeys(r.prefix, r.values);
      s.push(...o);
    }
    s.length > 0 && this.config.onActivation(s, t);
  }
}
function Le(i, e) {
  const t = [];
  if (i === "flow_point" && e.flow_name && e.flow_step)
    t.push(`flow_point/${e.flow_name}/${e.flow_step}`);
  else if (i === "endpoint" && e.http_method && e.resource_type)
    t.push(`endpoint/${e.http_method}/${e.resource_type}`);
  else if (i === "service" && e.svc_name) {
    const s = String(e.svc_name).replace("shopping-", "");
    t.push(`service/${s}`);
  } else
    for (const s of Object.values(e))
      typeof s == "string" && t.push(`${i}/${s}`);
  return t;
}
export {
  Me as ActivationProcessor,
  Te as BeamPool,
  L as CATEGORY_COLORS,
  Ie as CellStateManager,
  Z as DEFAULT_LOD,
  W as DEFAULT_THEME,
  ge as DEMO_PREFIX_META,
  ze as DEMO_SERVICES,
  fe as DEMO_SIGNALS,
  Ee as ENV_FILTERS,
  Pe as FlowHistory,
  A as LAYER_COLORS,
  Ve as MonitorAdapter,
  I as PALETTE,
  E as PRESET_AXES,
  ye as PRESET_VIEWS,
  Ne as PerfMonitor,
  pe as SIGNAL_ROLE_COLORS,
  de as SIGNAL_ROLE_LABELS,
  Oe as STACK_CHECKOUT,
  Ke as STACK_INFRA,
  we as TIER_NAMES,
  ve as ViewEngine,
  $e as applyFilters,
  F as buildGridPositions,
  be as buildServiceContainers,
  he as classifyByRole,
  Se as computeAllStacks,
  xe as computeCrossViewLayout,
  Re as computeGroupLod,
  G as computeLodLevel,
  oe as computePatternLayout,
  ke as computeScopeLayouts,
  Y as computeStackLayout,
  U as computeStackPositions,
  ie as cube,
  Le as defaultKeyMapper,
  le as extractAxes,
  ce as extractDims,
  me as formatDetail,
  J as generateCssVariables,
  Ce as getLodVisibility,
  D as getPrefixRole,
  te as grid,
  ae as inferPattern,
  j as inferRole,
  _e as matchEventToCells,
  re as nested,
  ee as row,
  Q as scalar,
  ne as shelf,
  se as spine,
  ue as validateSignal
};
