var N = Object.defineProperty;
var D = (i, e, t) => e in i ? N(i, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : i[e] = t;
var x = (i, e, t) => D(i, typeof e != "symbol" ? e + "" : e, t);
import * as C from "three";
const me = {
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
function he(i, e, t, s) {
  var o, l;
  const n = [], a = /* @__PURE__ */ new Map();
  for (const c of i) {
    const f = [], m = t + s;
    if (c.axes3d) {
      const u = c.axes3d.x.entries, d = ((o = c.axes3d.y) == null ? void 0 : o.entries) ?? ["_"], k = ((l = c.axes3d.z) == null ? void 0 : l.entries) ?? ["_"], _ = u.length, b = d.length, h = k.length;
      for (let p = 0; p < _; p++)
        for (let y = 0; y < b; y++)
          for (let v = 0; v < h; v++) {
            const w = -(_ - 1) * m / 2 + p * m, $ = y * m, I = -(h - 1) * m / 2 + v * m, S = b > 1 || h > 1 ? [u[p], d[y] !== "_" ? d[y] : null, k[v] !== "_" ? k[v] : null].filter(Boolean).join("/") : u[p], M = `${c.id}/${S}`;
            f.push({ key: M, gridId: c.id, entry: S, localX: w, localY: $, localZ: I, col: p, row: y, depth: v }), a.set(M, { gridId: c.id, entry: S, localX: w, localY: $, localZ: I, layer: c.layer, category: c.category });
          }
      n.push({
        id: c.id,
        category: c.category,
        layer: c.layer,
        cells: f,
        width: _ * m,
        height: b * m,
        depth: h * m,
        cols: _,
        rows: b,
        depths: h,
        is3d: b > 1
      });
    } else {
      const u = Math.ceil(c.entries.length / c.cols);
      for (let d = 0; d < c.entries.length; d++) {
        const k = d % c.cols, _ = Math.floor(d / c.cols), b = -(c.cols - 1) * m / 2 + k * m, h = -(u - 1) * m / 2 + _ * m, p = `${c.id}/${c.entries[d]}`;
        f.push({ key: p, gridId: c.id, entry: c.entries[d], localX: b, localY: 0, localZ: h, col: k, row: _, depth: 0 }), a.set(p, { gridId: c.id, entry: c.entries[d], localX: b, localY: 0, localZ: h, layer: c.layer, category: c.category });
      }
      n.push({
        id: c.id,
        category: c.category,
        layer: c.layer,
        cells: f,
        width: c.cols * m,
        height: m,
        depth: u * m,
        cols: c.cols,
        rows: u,
        depths: 1,
        is3d: !1
      });
    }
  }
  const r = H(i, e, t, s);
  return { grids: n, viewPositions: r, cellMap: a };
}
function H(i, e, t = 0.42, s = 0.1) {
  var d, k, _, b;
  const n = {
    layer: {},
    category: {},
    dsl: {},
    service: {}
  }, a = /* @__PURE__ */ new Map();
  for (const h of i) {
    const p = t + s;
    if (h.axes3d)
      a.set(h.id, { w: h.axes3d.x.entries.length * p, d: (((d = h.axes3d.z) == null ? void 0 : d.entries.length) ?? 1) * p });
    else {
      const y = Math.ceil(h.entries.length / h.cols);
      a.set(h.id, { w: h.cols * p, d: y * p });
    }
  }
  const r = e.map(() => []);
  for (const h of i) (k = r[h.layer]) == null || k.push(h);
  const o = t * 2;
  for (let h = 0; h < r.length; h++) {
    const p = r[h], y = Math.min(p.length, 4);
    for (let v = 0; v < p.length; v++) {
      const w = Math.floor(v / y), $ = p.filter((z, R) => Math.floor(R / y) === w);
      let S = -$.reduce((z, R) => {
        var q;
        return z + (((q = a.get(R.id)) == null ? void 0 : q.w) ?? 2) + o;
      }, -o) / 2;
      const M = v - w * y;
      for (let z = 0; z < M; z++)
        S += (((_ = a.get($[z].id)) == null ? void 0 : _.w) ?? 2) + o;
      const A = ((b = a.get(p[v].id)) == null ? void 0 : b.w) ?? 2;
      S += A / 2;
      const V = Math.max(...$.map((z) => {
        var R;
        return ((R = a.get(z.id)) == null ? void 0 : R.d) ?? 2;
      }));
      n.layer[p[v].id] = {
        x: S,
        y: e[h],
        z: w * -(V + o * 2)
      };
    }
  }
  [...new Set(i.map((h) => h.category))].forEach((h, p) => {
    const y = i.filter(($) => $.category === h), v = p % 3, w = Math.floor(p / 3);
    y.forEach(($, I) => {
      n.category[$.id] = { x: -12 + v * 12, y: 4 - I * 3.5, z: w * -8 };
    });
  });
  const c = [...new Set(i.map((h) => h.dsl).filter(Boolean))], f = i.filter((h) => !h.dsl);
  c.forEach((h, p) => {
    const y = i.filter(($) => $.dsl === h), v = p % 4, w = Math.floor(p / 4);
    y.forEach(($, I) => {
      n.dsl[$.id] = { x: -18 + v * 12, y: 4 - I * 3, z: w * -10 };
    });
  }), f.forEach((h, p) => {
    n.dsl[h.id] = { x: 24, y: 4 - p * 3, z: -12 };
  });
  const m = [...new Set(i.map((h) => h.service).filter(Boolean))], u = i.filter((h) => !h.service);
  return m.forEach((h, p) => {
    i.filter((v) => v.service === h).forEach((v, w) => {
      n.service[v.id] = { x: -16 + p * 8, y: 4 - Math.floor(w / 2) * 3.5, z: w % 2 * -5 };
    });
  }), u.forEach((h, p) => {
    n.service[h.id] = { x: 24, y: 4, z: -p * 5 };
  }), n;
}
function _e(i, e) {
  const t = {};
  for (const s of i)
    s.grids.forEach((n, a) => {
      const r = a * s.gap;
      t[n] = {
        x: s.position.x + (s.axis === "x" ? r : 0),
        y: s.position.y + (s.axis === "y" ? r : 0),
        z: s.position.z + (s.axis === "z" ? r : 0)
      };
    });
  return t;
}
function g(i) {
  const e = i >> 16 & 255, t = i >> 8 & 255, s = i & 255;
  return { hex: i, css: `#${i.toString(16).padStart(6, "0")}`, rgb: `${e},${t},${s}` };
}
const T = {
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
}, B = {
  observation: { main: g(58879), emissive: g(38823) },
  event: { main: g(16748800), emissive: g(12545024) },
  policy: { main: g(58998), emissive: g(38436) },
  relation: { main: g(11766015), emissive: g(8146431) },
  entity: { main: g(7901340), emissive: g(11583173) },
  state: { main: g(9795021), emissive: g(13747433) },
  table: { main: g(16732754), emissive: g(12986408) }
};
function O(i) {
  return { token: g(i), hex: i };
}
const U = {
  context: O(4906624),
  trigger: O(16436245),
  channel: O(6333946),
  state: O(12616956),
  guard: O(16020150),
  effect: O(16486972),
  data: O(9741240)
}, X = [
  g(6619098),
  // L0 UI — mint
  g(16752451),
  // L1 Business — amber
  g(8150268),
  // L2 Infra — violet
  g(16726112)
  // L3 Data — rose
];
function ge() {
  return [
    `--bg:${T.bgDeep.css}`,
    `--card:rgba(${T.bgCard.rgb},0.92)`,
    `--border:rgba(${T.mint.rgb},0.08)`,
    `--mint:${T.mint.css}`,
    `--amber:${T.amber.css}`,
    `--violet:${T.violet.css}`,
    `--rose:${T.rose.css}`,
    `--txt:${T.txtPrimary.css}`,
    `--dim:${T.txtDim.css}`,
    `--green:${T.green.css}`,
    `--red:${T.red.css}`,
    `--cyan:${T.cyan.css}`,
    // Category
    ...Object.entries(B).map(([i, e]) => `--cat-${i}:${e.main.css}`),
    // Signal Role
    ...Object.entries(U).map(([i, e]) => `--role-${i}:${e.token.css}`),
    // Layer
    ...X.map((i, e) => `--layer-${e}:${i.css}`)
  ].join(";");
}
function ve(i, e) {
  return {
    type: "scalar",
    prefixId: i,
    mappings: [{ axis: e, channel: "color" }],
    description: `${i}.${e} → 단일 값 표시`
  };
}
function ye(i, e) {
  return {
    type: "row",
    prefixId: i,
    mappings: [{ axis: e, channel: "x" }],
    description: `${i}.${e} → 가로 행`
  };
}
function xe(i, e, t) {
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
function ke(i, e, t, s) {
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
function be(i, e, t) {
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
function we(i, e, t, s) {
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
function $e(i, e, t) {
  return {
    type: "nested",
    prefixId: i,
    mappings: [
      { axis: e, channel: "group", subPattern: t }
    ],
    description: `${i}: ${e}별 그룹, 각 그룹 = ${t}`
  };
}
function Ie(i, e, t = 0.4, s = 0.08) {
  const n = t + s, a = [], r = i.mappings.find((p) => p.channel === "x"), o = i.mappings.find((p) => p.channel === "y"), l = i.mappings.find((p) => p.channel === "z"), c = i.mappings.find((p) => p.channel === "group"), f = i.mappings.filter((p) => p.channel === "collapse").map((p) => p.axis), m = r ? e[r.axis] || [] : ["_"], u = o ? e[o.axis] || [] : ["_"], d = l ? e[l.axis] || [] : ["_"], k = c ? e[c.axis] || [] : ["_"];
  switch (i.type) {
    case "scalar":
      a.push({ key: `${i.prefixId}/_`, x: 0, y: 0, z: 0 });
      break;
    case "row":
      m.forEach((p, y) => {
        a.push({ key: `${i.prefixId}/${p}`, x: y * n, y: 0, z: 0 });
      });
      break;
    case "grid":
      m.forEach((p, y) => {
        d.forEach((v, w) => {
          a.push({ key: `${i.prefixId}/${p}_${v}`, x: y * n, y: 0, z: w * n });
        });
      });
      break;
    case "cube":
      m.forEach((p, y) => {
        u.forEach((v, w) => {
          d.forEach(($, I) => {
            a.push({ key: `${i.prefixId}/${p}_${v}_${$}`, x: y * n, y: w * n, z: I * n });
          });
        });
      });
      break;
    case "spine":
      m.forEach((p, y) => {
        const v = {};
        for (const w of f)
          v[w] = `(${(e[w] || []).length} entries)`;
        a.push({ key: `${i.prefixId}/${p}`, x: y * n, y: 0, z: 0, collapsed: v });
      });
      break;
    case "shelf":
      k.forEach((p, y) => {
        const v = y * (d.length * n + n * 2);
        m.forEach((w, $) => {
          d.forEach((I, S) => {
            a.push({
              key: `${i.prefixId}/${p}_${w}_${I}`,
              x: $ * n,
              y: v,
              z: S * n,
              group: p
            });
          });
        });
      });
      break;
    case "nested":
      k.forEach((p, y) => {
        const v = y * (m.length * n + n * 2);
        m.forEach((w, $) => {
          a.push({
            key: `${i.prefixId}/${p}/${w}`,
            x: v + $ * n,
            y: 0,
            z: 0,
            group: p
          });
        });
      });
      break;
  }
  const _ = a.map((p) => p.x), b = a.map((p) => p.y), h = a.map((p) => p.z);
  return {
    pattern: i,
    cells: a,
    bounds: {
      width: a.length > 0 ? Math.max(..._) - Math.min(..._) + t : 0,
      height: a.length > 0 ? Math.max(...b) - Math.min(...b) + t : 0,
      depth: a.length > 0 ? Math.max(...h) - Math.min(...h) + t : 0
    }
  };
}
function F(i, e) {
  if (e === "prefix_ref" || e === "table_ref") return "context";
  const t = i.toLowerCase();
  return t.includes("step") || t.includes("phase") || t.includes("stage") ? "sequence" : t.includes("variant") || t.includes("version") || t.includes("mode") ? "variant" : t.endsWith("_name") || t === "flow_name" || t === "event_name" || t.endsWith("_type") || t === "resource_type" ? "classify" : (t.includes("action") || t.includes("method") || t.includes("op") || t === "role" || t === "resource", "identity");
}
function Ee(i, e) {
  const t = typeof e[0] == "string" ? e.map((d) => ({ label: d, kind: "axis" })) : e, s = t.filter((d) => d.kind === "axis"), n = t.filter((d) => d.kind === "prefix_ref"), a = t.filter((d) => d.kind === "table_ref"), r = s.map((d) => Object.assign({}, d, { role: F(d.label, d.kind) })), o = r.filter((d) => d.role === "classify"), l = r.filter((d) => d.role === "sequence"), c = r.filter((d) => d.role === "variant"), f = r.filter((d) => d.role === "identity"), m = [];
  for (const d of n)
    m.push({ axis: d.label, channel: "collapse", role: "context", dimKind: "prefix_ref" });
  for (const d of a)
    m.push({ axis: d.label, channel: "link", role: "context", dimKind: "table_ref" });
  if (o.length > 0) {
    const d = o[0], k = r.filter((h) => h !== d);
    if (k.length === 0)
      return m.push({ axis: d.label, channel: "x", role: "classify" }), { type: "row", prefixId: i, mappings: m, description: `${i}: ${d.label}(x) → 행` };
    if (k.length === 1)
      return m.push({ axis: d.label, channel: "group", role: "classify", subPattern: "row" }), m.push({ axis: k[0].label, channel: "x", role: k[0].role }), { type: "shelf", prefixId: i, mappings: m, description: `${i}: ${d.label}별 선반, ${k[0].label}(x)` };
    m.push({ axis: d.label, channel: "group", role: "classify", subPattern: "grid" });
    const _ = l[0] || k[0], b = c[0] || k.find((h) => h !== _) || k[1];
    return _ && m.push({ axis: _.label, channel: "x", role: _.role }), b && b !== _ && m.push({ axis: b.label, channel: "z", role: b.role }), { type: "shelf", prefixId: i, mappings: m, description: `${i}: ${d.label}별 선반, ${_ == null ? void 0 : _.label}(x) × ${b == null ? void 0 : b.label}(z)` };
  }
  const u = [...l, ...f, ...c];
  return u.length === 0 ? { type: "scalar", prefixId: i, mappings: [{ axis: "_", channel: "color" }], description: `${i}: scalar` } : u.length === 1 ? (m.push({ axis: u[0].label, channel: "x", role: u[0].role }), { type: "row", prefixId: i, mappings: m, description: `${i}: ${u[0].label}(x)` }) : u.length === 2 ? (m.push({ axis: u[0].label, channel: "x", role: u[0].role }), m.push({ axis: u[1].label, channel: "z", role: u[1].role }), { type: "grid", prefixId: i, mappings: m, description: `${i}: ${u[0].label}(x) × ${u[1].label}(z)` }) : (m.push({ axis: u[0].label, channel: "x", role: u[0].role }), m.push({ axis: u[1].label, channel: "y", role: u[1].role }), m.push({ axis: u[2].label, channel: "z", role: u[2].role }), { type: "cube", prefixId: i, mappings: m, description: `${i}: ${u[0].label}(x) × ${u[1].label}(y) × ${u[2].label}(z)` });
}
function Te(i) {
  return Object.entries(i).map(([e, t]) => ({
    label: e,
    kind: t.kind
  }));
}
function Se(i) {
  return Object.entries(i).filter(([, e]) => e.kind === "axis").map(([e]) => e);
}
const ze = {
  context: "어디서",
  trigger: "뭘 했는가",
  channel: "어떤 경로",
  state: "흐름 어디",
  guard: "어떤 조건",
  effect: "결과",
  data: "데이터 접점"
}, Oe = {
  context: "#546e7a",
  trigger: "#ff9100",
  channel: "#00e5ff",
  state: "#b388ff",
  guard: "#00e676",
  effect: "#ff5252",
  data: "#fd79a8"
}, Y = {
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
function G(i) {
  return Y[i] ?? "trigger";
}
function Ce(i) {
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
    const n = G(t);
    e[n].push({ prefixId: t, serialized: s });
  }
  return e;
}
const Me = [
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
    description: "사용자가 페이지를 방문 (generic)",
    members: [
      { prefixId: "page_view", role: "context" },
      { prefixId: "tracking", role: "trigger", fixedValues: { trackAction: "view" } }
    ]
  },
  {
    id: "page.home",
    name: "홈 화면",
    description: "홈 페이지 방문",
    members: [
      { prefixId: "page_view", role: "context", fixedValues: { page: "home" } },
      { prefixId: "tracking", role: "trigger", fixedValues: { trackAction: "view", page: "home" } }
    ]
  },
  {
    id: "page.product",
    name: "상품 상세",
    description: "상품 상세 페이지 방문",
    requires: ["page.home"],
    members: [
      { prefixId: "page_view", role: "context", fixedValues: { page: "product_detail" } },
      { prefixId: "tracking", role: "trigger", fixedValues: { trackAction: "click", page: "product_detail" } },
      { prefixId: "endpoint", role: "channel", fixedValues: { resource_type: "api", http_method: "GET" } }
    ]
  },
  {
    id: "page.mypage",
    name: "마이페이지",
    description: "마이페이지 방문",
    requires: ["auth.login"],
    members: [
      { prefixId: "page_view", role: "context", fixedValues: { page: "mypage" } },
      { prefixId: "tracking", role: "trigger", fixedValues: { trackAction: "view", page: "mypage" } }
    ]
  },
  {
    id: "page.order_complete",
    name: "주문 완료",
    description: "주문 완료 페이지",
    requires: ["payment.success"],
    members: [
      { prefixId: "page_view", role: "context", fixedValues: { page: "order_complete" } },
      { prefixId: "tracking", role: "trigger", fixedValues: { trackAction: "view", page: "order_complete" } }
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
      { prefixId: "endpoint", role: "channel", fixedValues: { resource_type: "page", http_method: "GET" } },
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
      { prefixId: "page_view", role: "context", fixedValues: { page: "checkout" } },
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
      { prefixId: "endpoint", role: "channel", fixedValues: { http_method: "POST" } },
      { prefixId: "flow_point", role: "state", fixedValues: { flow_name: "browse", flow_step: "exit" } }
    ]
  }
];
function Re(i, e) {
  const t = new Set(Object.keys(e)), s = new Set(i.members.map((o) => o.prefixId));
  let n = 0;
  const a = /* @__PURE__ */ new Set();
  for (const o of i.members)
    t.has(o.prefixId) ? n++ : a.add(o.role);
  const r = [...t].filter((o) => !s.has(o) && o !== "service");
  return {
    signalId: i.id,
    valid: n === i.members.length,
    missingRoles: [...a],
    extraPrefixes: r,
    matchedMembers: n,
    totalMembers: i.members.length
  };
}
const Pe = {
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
function Ke(i, e) {
  var s, n;
  const t = [];
  if (t.push(`<div style="font-size:11px;font-weight:600;color:#e0e4ec">${i.displayName}</div>`), t.push(`<div style="font-size:9px;color:#556;margin:3px 0">${i.description}</div>`), i.source) {
    const a = i.source, r = [];
    a.module && r.push(a.module), a.file && r.push(a.file), a.line && r.push(`L${a.line}`), t.push(`<div style="font-size:8px;color:#334;margin-top:4px">📁 ${r.join(" / ")}</div>`), a.url && t.push(`<div style="font-size:8px"><a href="${a.url}" target="_blank" style="color:#64ffda">📎 docs</a></div>`);
  }
  switch (i.detailKind) {
    case "schema": {
      const a = i.detail;
      if (a != null && a.columns) {
        t.push('<div style="margin-top:6px;font-size:8px;color:#445;letter-spacing:1px">SCHEMA</div>');
        for (const r of a.columns) {
          const o = r.refKind !== "scalar" ? ` <span style="color:${r.refKind === "axis_ref" ? "#00e676" : r.refKind === "table_ref" ? "#ff5252" : "#00e5ff"}">→${r.refTarget}</span>` : "", l = e && r.name === e ? "color:var(--mint);font-weight:600" : "color:#667";
          t.push(`<div style="font-size:9px;${l}">${r.name} <span style="color:#334">${r.type}</span>${o}</div>`);
        }
      }
      break;
    }
    case "event-def": {
      const a = i.detail;
      if (a && (t.push('<div style="margin-top:6px;font-size:8px;color:#445;letter-spacing:1px">EVENT STRUCTURE</div>'), t.push(`<div style="font-size:9px;color:#ff9100">${a.structure}</div>`), a.slots))
        for (const r of a.slots) {
          const o = r.kind === "table_ref" ? "#ff5252" : r.kind === "prefix_ref" ? "#00e5ff" : "#00e676";
          t.push(`<div style="font-size:9px;color:#667">${r.name} <span style="color:${o}">${r.kind}→${r.target}</span></div>`);
        }
      break;
    }
    case "permission":
      t.push('<div style="margin-top:6px;font-size:8px;color:#445;letter-spacing:1px">PERMISSION</div>'), t.push(`<div style="font-size:9px;color:#00e676">${((s = i.detail) == null ? void 0 : s.matrix) || "role-based grant/deny"}</div>`);
      break;
    case "endpoint": {
      const a = (n = i.detail) == null ? void 0 : n.routes;
      if (a) {
        t.push('<div style="margin-top:6px;font-size:8px;color:#445;letter-spacing:1px">ROUTES</div>');
        for (const r of a)
          t.push(`<div style="font-size:9px;color:#667"><span style="color:#00e5ff">${r.method}</span> ${r.path}</div>`);
      }
      break;
    }
  }
  return t.join("");
}
function je(i, e = 0.42, t = 0.1) {
  const s = e + t, n = i.channels.find((_) => _.channel === "x"), a = i.channels.find((_) => _.channel === "y"), r = i.channels.find((_) => _.channel === "z"), o = i.channels.find((_) => _.channel === "group"), l = i.channels.find((_) => _.channel === "color"), c = (_) => {
    var h;
    return _ ? ((h = i.filters) == null ? void 0 : h[_.id]) ?? _.entries : ["_"];
  }, f = c(n == null ? void 0 : n.axis), m = c(a == null ? void 0 : a.axis), u = c(r == null ? void 0 : r.axis), d = c(o == null ? void 0 : o.axis), k = [];
  for (const _ of d) {
    const b = d.indexOf(_) * (f.length * s + s * 3);
    for (const h of f)
      for (const p of m)
        for (const y of u) {
          const v = f.indexOf(h), w = m.indexOf(p), $ = u.indexOf(y), I = {};
          n && (I[n.axis.id] = h), a && (I[a.axis.id] = p), r && (I[r.axis.id] = y), o && _ !== "_" && (I[o.axis.id] = _);
          const M = Object.values(I).join(":");
          k.push({
            coords: I,
            key: M,
            x: b + v * s,
            y: w * s,
            z: $ * s,
            group: _ !== "_" ? _ : void 0,
            colorValue: l ? I[l.axis.id] : void 0
          });
        }
  }
  return {
    def: i,
    cells: k,
    xEntries: f,
    yEntries: m,
    zEntries: u,
    groups: d.filter((_) => _ !== "_"),
    totalCells: k.length,
    bounds: {
      width: (d.length > 1 ? d.length : 1) * f.length * s,
      height: m.length * s,
      depth: u.length * s
    }
  };
}
function qe(i, e) {
  const t = [];
  for (const s of e.cells) {
    let n = !0;
    for (const [a, r] of Object.entries(s.coords))
      if (i[a] !== r) {
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
}, Le = [
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
class Ae {
  constructor() {
    x(this, "targets", /* @__PURE__ */ new Map());
    x(this, "positions", {
      layer: {},
      category: {},
      dsl: {},
      service: {}
    });
    x(this, "_currentMode", "layer");
    x(this, "_lerpSpeed", 3);
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
        const a = this.targets.get(s);
        a && (a.targetX = n.x, a.targetY = n.y, a.targetZ = n.z);
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
const Ve = {
  0: "이벤트 발생",
  1: "이벤트 처리",
  2: "이벤트 소비/생산",
  3: "데이터 도달"
}, Z = {
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
function W(i) {
  return Z[i] ?? 2;
}
function Ne(i, e, t) {
  return i.map((s) => {
    const n = [.../* @__PURE__ */ new Set([...s.ownedPrefixes, ...s.consumedPrefixes])], a = { 0: [], 1: [], 2: [], 3: [] };
    for (const o of n) {
      const l = e.get(o);
      if (!l) continue;
      const c = W(o);
      a[c].push({
        prefixId: o,
        tier: c,
        entries: l.entries,
        pattern: l.pattern,
        category: l.category
      });
    }
    const r = [];
    if (t)
      for (const o of s.tables) {
        const l = t[o];
        l && r.push(...l);
      }
    return {
      serviceId: s.id,
      serviceName: s.name,
      tiers: a,
      dataEntries: r
    };
  });
}
function De(i, e, t) {
  const s = t.find((n) => n.axisId === e);
  return s ? s.mode === "show" ? i.filter((n) => s.values.includes(n)) : i.filter((n) => !s.values.includes(n)) : [...i];
}
function He(i, e) {
  const t = (e == null ? void 0 : e.containerGap) ?? 12, s = (e == null ? void 0 : e.tierGap) ?? 3;
  return i.map((n, a) => {
    const o = (Object.values(n.tiers).filter((f) => f.length > 0).length + (n.dataEntries.length > 0 ? 1 : 0)) * s, l = Math.max(1, ...Object.values(n.tiers).flatMap((f) => f.map((m) => m.entries.length))), c = Math.max(4, Math.ceil(Math.sqrt(l)) * 1.5);
    return {
      serviceId: n.serviceId,
      position: { x: a * t - (i.length - 1) * t / 2, y: 0, z: 0 },
      size: { width: c, height: o, depth: c },
      tierOffsets: { 0: s * 1.5, 1: s * 0.5, 2: -s * 0.5, 3: -s * 1.5 }
    };
  });
}
const Be = [
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
], Ue = {
  prodOnly: { axisId: "env", mode: "show", values: ["prod"] },
  devOnly: { axisId: "env", mode: "show", values: ["dev"] },
  hideTest: { axisId: "env", mode: "hide", values: ["test", "local"] },
  all: { axisId: "env", mode: "show", values: ["dev", "stage", "prod", "test", "local"] }
};
class Xe {
  constructor(e) {
    x(this, "states", /* @__PURE__ */ new Map());
    x(this, "_activeSet", /* @__PURE__ */ new Set());
    x(this, "_layerHits");
    x(this, "_totalHits", 0);
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
class Fe {
  constructor(e) {
    x(this, "beams");
    x(this, "index", 0);
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
class Ye {
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
      const a = t(n);
      a && (this.cells.activate(n, a.layer), s.push(a));
    }
    for (let n = 0; n < s.length; n++)
      for (let a = n + 1; a < s.length; a++)
        s[n].layer !== s[a].layer && this.beams.spawn(
          { x: s[n].worldX, y: s[n].worldY, z: s[n].worldZ },
          { x: s[a].worldX, y: s[a].worldY, z: s[a].worldZ },
          s[n].categoryColor
        );
    return {
      keys: e,
      source: "manual",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
}
function J(i, e) {
  const t = new Map(e.map((o) => [o.id, o])), s = {};
  let n = 0, a = 0;
  i.grids.forEach((o, l) => {
    const c = t.get(o);
    c && (n = Math.max(n, c.width), a = Math.max(a, c.depth));
    const f = l * i.gap;
    s[o] = {
      x: i.position.x + (i.axis === "x" ? f : 0),
      y: i.position.y + (i.axis === "y" ? f : 0),
      z: i.position.z + (i.axis === "z" ? f : 0)
    };
  });
  const r = i.grids.length * i.gap;
  return {
    stackId: i.id,
    axis: i.axis,
    gridPositions: s,
    bounds: {
      width: i.axis === "x" ? r : n,
      height: i.axis === "y" ? r : 1,
      depth: i.axis === "z" ? r : a
    }
  };
}
function Ge(i, e) {
  const t = [], s = {};
  for (const n of i) {
    const a = J(n, e);
    t.push(a), Object.assign(s, a.gridPositions);
  }
  for (const n of e)
    n.id in s || (s[n.id] = { x: 30, y: 0, z: 0 });
  return { layouts: t, viewPositions: s };
}
const Ze = {
  id: "stack-checkout",
  grids: ["page_view", "endpoint", "flow_point", "permission", "order_event", "orders"],
  axis: "y",
  gap: 3,
  position: { x: 0, y: -4, z: 0 }
}, We = {
  id: "stack-infra",
  grids: ["service", "deploy_event", "health_event", "pipeline_point", "data_policy"],
  axis: "y",
  gap: 3,
  position: { x: 12, y: -4, z: 0 }
};
class Je {
  constructor() {
    x(this, "entries", []);
    x(this, "_viewIdx", -1);
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
const Q = {
  near: 15,
  mid: 35
};
function ee(i, e = Q) {
  return i <= e.near ? "near" : i <= e.mid ? "mid" : "far";
}
function Qe(i, e, t) {
  const s = /* @__PURE__ */ new Map();
  for (const [n, a] of e) {
    const r = i.x - a.x, o = i.y - a.y, l = i.z - a.z, c = Math.sqrt(r * r + o * o + l * l);
    s.set(n, ee(c, t));
  }
  return s;
}
function et(i) {
  switch (i) {
    case "near":
      return { showLabels: !0, showEdges: !0, showHitCounts: !0, cellOpacityMultiplier: 1 };
    case "mid":
      return { showLabels: !0, showEdges: !1, showHitCounts: !1, cellOpacityMultiplier: 0.9 };
    case "far":
      return { showLabels: !1, showEdges: !1, showHitCounts: !1, cellOpacityMultiplier: 0.7 };
  }
}
class tt {
  constructor() {
    x(this, "frames", 0);
    x(this, "lastTime", performance.now());
    x(this, "_fps", 0);
    x(this, "_frameTime", 0);
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
function it(i, e, t) {
  i.innerHTML = "";
  for (const [s, n] of Object.entries(e)) {
    const a = document.createElement("span");
    a.className = "sl-role sl-active", a.dataset.role = s, a.innerHTML = `<span class="sl-dot" style="background:${n.token.css}"></span>${s}`, t && a.addEventListener("click", () => t(s, a)), i.appendChild(a);
  }
}
function st(i, e) {
  i.innerHTML = "";
  for (const [t, s] of Object.entries(e)) {
    const n = document.createElement("span");
    n.style.cssText = `font-size:8px;color:${s.main.css};padding:2px 5px;border:1px solid ${s.main.css}33;border-radius:3px`, n.textContent = t, i.appendChild(n);
  }
}
class nt {
  constructor(e) {
    x(this, "ws", null);
    x(this, "_connected", !1);
    this.config = e;
  }
  get connected() {
    return this._connected;
  }
  /** WebSocket 연결 */
  connect(e) {
    var t, s, n, a;
    (s = (t = this.config).onConnectionChange) == null || s.call(t, "connecting");
    try {
      this.ws = new WebSocket(e), this.ws.addEventListener("open", () => {
        var r, o, l;
        this._connected = !0, (o = (r = this.config).onConnectionChange) == null || o.call(r, "connected"), (l = this.ws) == null || l.send(JSON.stringify({ type: "subscribe", scenarioId: "*" }));
      }), this.ws.addEventListener("message", (r) => {
        var o, l;
        try {
          const c = JSON.parse(r.data);
          c.type === "record" && c.data ? this.handleRecord(c.data) : c.type === "subscribed" && ((l = (o = this.config).onConnectionChange) == null || l.call(o, "subscribed"));
        } catch {
        }
      }), this.ws.addEventListener("error", () => {
        var r, o;
        (o = (r = this.config).onConnectionChange) == null || o.call(r, "error");
      }), this.ws.addEventListener("close", () => {
        var r, o;
        this._connected = !1, (o = (r = this.config).onConnectionChange) == null || o.call(r, "disconnected");
      });
    } catch {
      (a = (n = this.config).onConnectionChange) == null || a.call(n, "failed");
    }
  }
  disconnect() {
    var e, t;
    this.ws && (this.ws.close(), this.ws = null), this._connected = !1, (t = (e = this.config).onConnectionChange) == null || t.call(e, "disconnected");
  }
  /** HTTP로 이벤트 전송 (DEMO용) */
  async sendToIngest(e, t, s, n, a) {
    const r = (/* @__PURE__ */ new Date()).toISOString();
    try {
      await fetch(e, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transmission_id: `tx_${Date.now()}`,
          sent_at: r,
          owner: { owner_type: "workspace", owner_id: "viz-3d" },
          source: { service_name: "viz-3d", sdk_name: "@qa-sdk/viz-3d", sdk_version: "0.1.0" },
          runtime: { platform: "browser" },
          build: { env: "dev" },
          records: [{
            log_id: `l_${Date.now()}_${a}`,
            timestamp: r,
            record_kind: "log",
            trace_id: n,
            span_id: `s_${a}`,
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
      const a = this.config.decode(n);
      if (!a) continue;
      const r = this.config.mapToKeys(a.prefix, a.values);
      s.push(...r);
    }
    s.length > 0 && this.config.onActivation(s, t);
  }
}
function at(i, e) {
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
function te(i, e, t) {
  const s = i[e];
  if (!s)
    return null;
  const n = [], a = [];
  for (const l of s.labels) {
    const c = s.dims[l];
    if (!c)
      return null;
    if (c.kind === "axis") {
      const f = c.entries ?? [];
      n.push(c.capacity ?? f.length);
      const m = f.indexOf(t[l]);
      if (m < 0)
        return null;
      a.push(m);
    } else {
      const f = c.values ?? [];
      n.push(f.length);
      const m = t[l] ?? f[0], u = f.indexOf(m);
      a.push(u < 0 ? 0 : u);
    }
  }
  const r = new Array(n.length);
  r[n.length - 1] = 1;
  for (let l = n.length - 2; l >= 0; l--)
    r[l] = r[l + 1] * n[l + 1];
  let o = 0;
  for (let l = 0; l < a.length; l++)
    o += a[l] * r[l];
  return {
    prefix: e,
    version: s.version,
    address: o,
    serialized: `${e}:${s.version}:${o}`
  };
}
function ie(i, e) {
  const t = e.split(":"), [s, n, a] = t.length === 4 ? [t[1], t[2], t[3]] : [t[0], t[1], t[2]], r = i[s];
  if (!r)
    return null;
  let o = parseInt(a);
  if (isNaN(o))
    return null;
  const l = [], c = [];
  for (const u of r.labels) {
    const d = r.dims[u];
    if (d) {
      if (d.kind === "axis") {
        const k = d.entries ?? [];
        l.push(d.capacity ?? k.length);
      } else
        l.push((d.values ?? []).length);
      c.push({ label: u, dim: d });
    }
  }
  const f = new Array(l.length);
  f[l.length - 1] = 1;
  for (let u = l.length - 2; u >= 0; u--)
    f[u] = f[u + 1] * l[u + 1];
  const m = {};
  for (let u = 0; u < c.length; u++) {
    const d = Math.floor(o / f[u]);
    o %= f[u];
    const { label: k, dim: _ } = c[u];
    m[k] = _.kind === "axis" ? (_.entries ?? [])[d] ?? `(${d})` : (_.values ?? [])[d] ?? d;
  }
  return { prefix: s, version: n, values: m };
}
function se(i, e) {
  const t = {};
  for (const [s, n] of Object.entries(e)) {
    const a = i[s];
    if (!a)
      continue;
    const r = { ...n };
    for (const l of a.labels) {
      const c = a.dims[l];
      if ((c == null ? void 0 : c.kind) === "prefix_ref" && !(l in r)) {
        const f = c.values ?? [];
        f.length > 0 && (r[l] = f[0]);
      }
    }
    const o = te(i, s, r);
    o && (t[s] = o.serialized);
  }
  return t;
}
function rt(i, e) {
  const t = {};
  for (const [s, n] of Object.entries(e)) {
    const a = ie(i, n);
    a && (t[s] = { prefix: a.prefix, values: a.values });
  }
  return t;
}
function ne(i, e) {
  const t = i.service;
  if (!t)
    throw new Error("service prefix is missing in browser catalog");
  let s = !1;
  const n = { ...t.dims };
  for (const a of t.labels) {
    const r = t.dims[a];
    if (!r)
      continue;
    if (r.kind !== "axis")
      throw new Error(`service.${a} must be an axis dim`);
    const o = e[a];
    if (typeof o != "string")
      continue;
    const l = [...r.entries ?? []];
    if (l.includes(o))
      continue;
    const c = r.capacity ?? l.length;
    if (l.length >= c)
      throw new Error(`service.${a} capacity exceeded: ${l.length}/${c}`);
    l.push(o), n[a] = {
      ...r,
      entries: l
    }, s = !0;
  }
  return s ? {
    ...i,
    service: {
      ...t,
      dims: n
    }
  } : i;
}
const ae = {
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
function re(i) {
  return ae[i] ?? "trigger";
}
function oe(i) {
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
    const n = re(t);
    e[n].push({ prefixId: t, serialized: s });
  }
  return e;
}
function ot(i, e) {
  const t = se(i, e), s = oe(t);
  return { addressContext: t, byRole: s };
}
const ce = {
  service: { version: "v1", labels: ["env", "region", "svc_name", "namespace"], dims: { env: { kind: "axis", entries: ["dev", "stage", "prod", "test", "local"], capacity: 32 }, region: { kind: "axis", entries: ["asia", "usa"], capacity: 32 }, svc_name: { kind: "axis", entries: ["shopping-web", "shopping-backend", "auth", "payment", "gateway", "registry-service", "ingest-server", "platform-demo", "content-service", "infra-controller", "gate-service", "query-service", "decode-service", "platform-demo-api", "roleplay-web", "viteplus-sdk-smoke"], capacity: 32 }, namespace: { kind: "axis", entries: ["shop", "cms"], capacity: 32 } } },
  permission: { version: "v4", labels: ["perm_svc", "role"], dims: { perm_svc: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, role: { kind: "axis", entries: ["admin", "developer", "operator", "viewer", "readonly", "customer", "auditor"], capacity: 32 } } },
  event: { version: "v4", labels: ["evt_svc", "event_name", "initiator"], dims: { evt_svc: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65568, 65600, 65632, 65664, 65537, 65569, 65601, 65633, 65665] }, event_name: { kind: "axis", entries: ["user.login", "user.logout", "order.created", "order.paid", "payment.failed", "session.expired", "config.changed", "payment.cancel_requested", "payment.cancel_approved", "payment.refunded"], capacity: 64 }, initiator: { kind: "axis", entries: ["web", "mobile"], capacity: 32 } } },
  rbac: { version: "v1", labels: ["role", "action", "resource"], dims: { role: { kind: "axis", entries: ["admin", "editor", "viewer"], capacity: 32 }, action: { kind: "axis", entries: ["read", "write", "delete", "admin"], capacity: 32 }, resource: { kind: "axis", entries: ["dashboard", "reports", "settings", "users"], capacity: 32 } } },
  content: { version: "v1", labels: ["tag", "category", "status", "locale", "channel"], dims: { tag: { kind: "axis", entries: ["frontend", "backend", "devops", "ai", "database"], capacity: 32 }, category: { kind: "axis", entries: ["tech", "design", "product", "culture"], capacity: 32 }, status: { kind: "axis", entries: ["draft", "published", "archived"], capacity: 32 }, locale: { kind: "axis", entries: ["ko", "en", "ja"], capacity: 32 }, channel: { kind: "axis", entries: ["web", "mobile"], capacity: 32 } } },
  tracking: { version: "v3", labels: ["svc_ref", "trackAction", "page", "userType"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65568, 65600, 65632, 65664, 65537, 65569, 65601, 65633, 65665] }, trackAction: { kind: "axis", entries: ["click", "view", "scroll", "submit", "navigate", "add_to_cart", "purchase", "close"], capacity: 32 }, page: { kind: "axis", entries: ["home", "product_list", "product_detail", "cart", "checkout", "order_complete", "mypage", "login"], capacity: 32 }, userType: { kind: "axis", entries: ["guest", "member", "premium"], capacity: 32 } } },
  relational: { version: "v2", labels: ["subjectKind", "predicate", "objectKind"], dims: { subjectKind: { kind: "axis", entries: ["_", "user", "role", "group", "service", "engine"], capacity: 32 }, predicate: { kind: "axis", entries: ["_", "has", "can_access", "belongs_to", "has_capability", "evaluated", "migrated_to"], capacity: 32 }, objectKind: { kind: "axis", entries: ["_", "role", "permission", "group", "resource", "queue", "metric_store", "constraint", "prefix_version"], capacity: 32 } } },
  page_view: { version: "v2", labels: ["svc_ref", "page", "locale", "userType"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, page: { kind: "axis", entries: ["home", "product_list", "product_detail", "cart", "checkout", "order_complete", "mypage", "login"], capacity: 32 }, locale: { kind: "axis", entries: ["ko", "en", "ja"], capacity: 32 }, userType: { kind: "axis", entries: ["guest", "member", "premium"], capacity: 32 } } },
  endpoint: { version: "v1", labels: ["svc_ref", "resource_type", "http_method", "api_version"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, resource_type: { kind: "axis", entries: ["api", "page", "webhook", "grpc"], capacity: 32 }, http_method: { kind: "axis", entries: ["GET", "POST", "PUT", "DELETE", "PATCH"], capacity: 32 }, api_version: { kind: "axis", entries: ["v1", "v2"], capacity: 32 } } },
  flow_point: { version: "v2", labels: ["svc_ref", "flow_name", "flow_step", "flow_variant"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, flow_name: { kind: "axis", entries: ["checkout", "signup", "order_cancel", "refund", "login", "browse", "cart_manage", "payment"], capacity: 64 }, flow_step: { kind: "axis", entries: ["entry", "processing", "branch", "success", "failure", "timeout", "payment", "complete", "exit"], capacity: 32 }, flow_variant: { kind: "axis", entries: ["default", "retry", "fallback", "manual"], capacity: 32 } } },
  engine_event: { version: "v1", labels: ["svc_ref", "constraint_op", "verdict_result"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, constraint_op: { kind: "axis", entries: ["eq", "neq", "exists", "gt", "lt", "contains", "masked"], capacity: 32 }, verdict_result: { kind: "axis", entries: ["pass", "fail", "warn", "degraded", "unknown", "skipped"], capacity: 32 } } },
  schema_event: { version: "v1", labels: ["svc_ref", "migration_pattern", "deploy_action"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 32768, 32800, 32832, 32864, 32896, 65536, 65568, 65600, 65632, 65664] }, migration_pattern: { kind: "axis", entries: ["identity", "reorder", "append_dim", "remove_dim", "composite", "unknown"], capacity: 32 }, deploy_action: { kind: "axis", entries: ["deploy", "rollback", "scale_up", "scale_down", "restart", "canary_start", "canary_promote", "migrate"], capacity: 32 } } },
  schema_validation: { version: "v1", labels: ["svc_ref", "validation_layer", "constraint_rule", "verdict_result"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, validation_layer: { kind: "axis", entries: ["vocabulary", "structural", "constraint"], capacity: 8 }, constraint_rule: { kind: "axis", entries: ["required", "maxCount", "minCount", "requiredIf", "exclusive", "type", "multi", "unknownAxis"], capacity: 32 }, verdict_result: { kind: "axis", entries: ["pass", "fail", "warn", "degraded", "unknown", "skipped"], capacity: 32 } } },
  pipeline_point: { version: "v1", labels: ["svc_ref", "pipeline_phase", "validation_mode", "verdict_result", "temporal_strategy"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, pipeline_phase: { kind: "axis", entries: ["ingest", "reconstruct", "verdict", "aggregate", "propagate"], capacity: 32 }, validation_mode: { kind: "axis", entries: ["strict", "warn", "off"], capacity: 32 }, verdict_result: { kind: "axis", entries: ["pass", "fail", "warn", "degraded", "unknown", "skipped"], capacity: 32 }, temporal_strategy: { kind: "axis", entries: ["span_local", "global"], capacity: 32 } } },
  data_policy: { version: "v1", labels: ["svc_ref", "mask_mode"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, mask_mode: { kind: "axis", entries: ["raw", "mask", "drop", "hash"], capacity: 32 } } },
  deploy_event: { version: "v1", labels: ["svc_ref", "deploy_action"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 32768, 32800, 32832, 32864, 32896, 65536, 65568, 65600, 65632, 65664] }, deploy_action: { kind: "axis", entries: ["deploy", "rollback", "scale_up", "scale_down", "restart", "canary_start", "canary_promote"], capacity: 32 } } },
  health_event: { version: "v1", labels: ["svc_ref", "health_status"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 32768, 32800, 32832, 32864, 32896, 65536, 65568, 65600, 65632, 65664] }, health_status: { kind: "axis", entries: ["healthy", "degraded", "unhealthy", "maintenance"], capacity: 32 } } },
  cart_event: { version: "v2", labels: ["svc_ref", "action"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65568, 65600, 65632, 65664, 65537, 65569, 65601, 65633, 65665] }, action: { kind: "axis", entries: ["add", "remove", "checkout"], capacity: 32 } } },
  auth_event: { version: "v2", labels: ["svc_ref", "action"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65568, 65600, 65632, 65664, 65537, 65569, 65601, 65633, 65665] }, action: { kind: "axis", entries: ["login", "logout", "token_refresh"], capacity: 32 } } },
  order_event: { version: "v1", labels: ["service_ctx", "action"], dims: { service_ctx: { kind: "prefix_ref", values: [65536, 65568, 65600, 65632, 65664] }, action: { kind: "axis", entries: ["create", "cancel", "refund", "complete"], capacity: 32 } } },
  build_event: { version: "v2", labels: ["qa_pkg", "qa_module", "build_result"], dims: { qa_pkg: { kind: "axis", entries: ["spec-core", "cli", "sdk", "demo-snapshot", "weighted-index", "bit-index", "permission-engine", "index-meta", "platform-demo", "ingest-server", "registry-service", "e2e"], capacity: 32 }, qa_module: { kind: "axis", entries: ["shared", "schema", "export-surface", "spec", "loader", "codegen", "dkg", "dkg-skills", "convergence", "propagation", "store", "visualization", "shopping-flow", "event-pipeline", "iframe-integration", "scenario-selector", "shop-ingest-integration", "anonymous-browse", "cart-abandon", "multi-product-purchase", "_all"], capacity: 64 }, build_result: { kind: "axis", entries: ["success", "failure", "type-error", "skipped"], capacity: 8 } } },
  test_event: { version: "v2", labels: ["qa_pkg", "qa_module", "test_result"], dims: { qa_pkg: { kind: "axis", entries: ["spec-core", "cli", "sdk", "demo-snapshot", "weighted-index", "bit-index", "permission-engine", "index-meta", "platform-demo", "ingest-server", "registry-service", "e2e"], capacity: 32 }, qa_module: { kind: "axis", entries: ["shared", "schema", "export-surface", "spec", "loader", "codegen", "dkg", "dkg-skills", "convergence", "propagation", "store", "visualization", "shopping-flow", "event-pipeline", "iframe-integration", "scenario-selector", "shop-ingest-integration", "anonymous-browse", "cart-abandon", "multi-product-purchase", "_all"], capacity: 64 }, test_result: { kind: "axis", entries: ["passed", "failed", "error", "skipped", "timeout"], capacity: 16 } } },
  dkg_event: { version: "v1", labels: ["dkg_op", "dkg_target_kind"], dims: { dkg_op: { kind: "axis", entries: ["claim", "release", "decide", "observe", "resolve", "link", "refresh", "self-check", "converge", "trace", "promote"], capacity: 32 }, dkg_target_kind: { kind: "axis", entries: ["axis", "prefix", "spec", "schema", "decision", "version-event", "constraint", "observation", "domain", "consumer", "intent-link", "dsl-bundle", "skill", "transition-spec", "table", "flow-schema", "system"], capacity: 32 } } },
  dkg_decision_event: { version: "v1", labels: ["decision_type", "dkg_target_kind", "node_source"], dims: { decision_type: { kind: "axis", entries: ["capacity", "new-axis", "new-prefix", "dim-add", "merge", "deprecate", "separation"], capacity: 16 }, dkg_target_kind: { kind: "axis", entries: ["axis", "prefix", "spec", "schema", "decision", "version-event", "constraint", "observation", "domain", "consumer", "intent-link", "dsl-bundle", "skill", "transition-spec", "table", "flow-schema", "system"], capacity: 32 }, node_source: { kind: "axis", entries: ["bootstrap", "manual", "auto"], capacity: 8 } } },
  dkg_observation_event: { version: "v1", labels: ["obs_source", "dkg_target_kind", "lifecycle_state"], dims: { obs_source: { kind: "axis", entries: ["manual", "metric", "runtime", "review"], capacity: 8 }, dkg_target_kind: { kind: "axis", entries: ["axis", "prefix", "spec", "schema", "decision", "version-event", "constraint", "observation", "domain", "consumer", "intent-link", "dsl-bundle", "skill", "transition-spec", "table", "flow-schema", "system"], capacity: 32 }, lifecycle_state: { kind: "axis", entries: ["draft", "active", "deprecated", "archived", "superseded", "reversed"], capacity: 16 } } },
  skill_execution: { version: "v1", labels: ["skill_id", "skill_category", "skill_outcome"], dims: { skill_id: { kind: "axis", entries: ["skill-trace", "skill-explore-service", "skill-explore-prefix", "skill-explore-dsl", "skill-system-overview", "skill-record-decision", "skill-record-observation", "skill-claim", "skill-release", "skill-lifecycle-transition", "skill-checkout-flow-verify", "skill-commerce-skew-audit", "skill-observation-coverage", "skill-infra-impact-verify", "skill-pipeline-phase-verify", "skill-event-action-check", "skill-svc-binding-check", "skill-safe-entry-add", "skill-decision-scaffold", "skill-analyze-impact", "skill-infer-migrator", "skill-domain-health", "skill-pattern-analysis", "skill-schema-health-audit", "skill-entry-add-chain", "skill-system-health-chain", "skill-converge-chain", "skill-self-check-analyze", "skill-cli-coverage", "skill-promote-scan", "skill-spec-manage", "skill-registry-publish", "skill-flow-trace", "skill-table-impact", "skill-prefix-capacity-audit", "skill-policy-rule-verify", "skill-gate-refentries-check"], capacity: 64 }, skill_category: { kind: "axis", entries: ["read", "write", "analysis", "chain"], capacity: 8 }, skill_outcome: { kind: "axis", entries: ["ok", "warning", "error", "blocked", "skipped"], capacity: 16 } } },
  cli_event: { version: "v1", labels: ["cli_intent", "cli_domain", "cli_subject"], dims: { cli_intent: { kind: "axis", entries: ["query", "analyze", "mutate", "publish", "lifecycle", "init", "backup"], capacity: 16 }, cli_domain: { kind: "axis", entries: ["dkg-graph", "dkg-skill", "convergence", "spec", "coordinate", "registry", "catalog", "self-ref", "system", "ingest"], capacity: 16 }, cli_subject: { kind: "axis", entries: ["axis", "prefix", "domain", "dsl-bundle", "decision", "observation", "constraint", "skill", "intent-link", "system", "version", "spec", "schema", "catalog", "service", "table"], capacity: 32 } } },
  contract_check: { version: "v1", labels: ["qa_pkg", "api_surface", "test_result"], dims: { qa_pkg: { kind: "axis", entries: ["spec-core", "cli", "sdk", "demo-snapshot", "weighted-index", "bit-index", "permission-engine", "index-meta", "platform-demo", "ingest-server", "registry-service", "e2e", "core", "engine", "store", "gate-service", "query-service", "decode-service", "registry-server", "registry-client", "apm", "browser-sdk", "event-catalog", "pino", "viz-3d", "viz-web", "demo-tests", "weighted-wasm"], capacity: 64 }, api_surface: { kind: "axis", entries: ["encode-decode", "stride-calc", "bitmask-ops", "dim-extract", "perm-grant", "protocol-codec", "state-lifecycle", "query-resolve", "schema-validate", "convergence-analysis", "dkg-graph", "integration"], capacity: 32 }, test_result: { kind: "axis", entries: ["passed", "failed", "error", "skipped", "timeout"], capacity: 16 } } },
  pattern_match: { version: "v1", labels: ["svc_ref", "identification_mode", "behavior_pattern", "pattern_confidence"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, identification_mode: { kind: "axis", entries: ["anonymous", "identified", "pseudonymized", "service"], capacity: 8 }, behavior_pattern: { kind: "axis", entries: ["purchase_complete", "browse_only", "cart_abandon", "checkout_fail", "error_recovery", "return_visit", "anonymous_browse", "anonymous_cart", "api_integration", "bot_crawl", "health_check", "unclassified"], capacity: 32 }, pattern_confidence: { kind: "axis", entries: ["exact", "high", "medium", "low", "unknown"], capacity: 16 } } },
  pattern_anomaly: { version: "v2", labels: ["svc_ref", "anomaly_kind", "behavior_pattern", "anomaly_severity"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, anomaly_kind: { kind: "axis", entries: ["unclassified", "ratio_shift", "volume_spike", "new_sequence", "abnormal_speed", "abnormal_duration"], capacity: 16 }, behavior_pattern: { kind: "axis", entries: ["purchase_complete", "browse_only", "cart_abandon", "checkout_fail", "error_recovery", "return_visit", "anonymous_browse", "anonymous_cart", "api_integration", "bot_crawl", "health_check", "unclassified"], capacity: 32 }, anomaly_severity: { kind: "axis", entries: ["info", "warning", "critical"], capacity: 8 } } },
  version_point: { version: "v1", labels: ["svc_ref", "version_lifecycle"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, version_lifecycle: { kind: "axis", entries: ["draft", "locked", "released", "active", "deprecated"], capacity: 16 } } },
  gate_point: { version: "v1", labels: ["svc_ref", "address_state"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, address_state: { kind: "axis", entries: ["active", "reserved", "inactive", "open"], capacity: 8 } } },
  observation_event: { version: "v1", labels: ["observation_intent", "dkg_target_kind"], dims: { observation_intent: { kind: "axis", entries: ["action_needed", "monitoring", "completed"], capacity: 8 }, dkg_target_kind: { kind: "axis", entries: ["axis", "prefix", "spec", "schema", "decision", "version-event", "constraint", "observation", "domain", "consumer", "intent-link", "dsl-bundle", "skill", "transition-spec", "table", "flow-schema", "system"], capacity: 32 } } },
  spec_event: { version: "v1", labels: ["spec_type", "lifecycle_state"], dims: { spec_type: { kind: "axis", entries: ["req", "feat", "uc", "evt", "ls", "adr"], capacity: 16 }, lifecycle_state: { kind: "axis", entries: ["draft", "active", "deprecated", "archived", "superseded", "reversed"], capacity: 16 } } },
  edge_activity: { version: "v1", labels: ["edge_type", "dkg_target_kind"], dims: { edge_type: { kind: "axis", entries: ["satisfies", "implements", "tests", "traces-to", "depends-on", "composes", "references", "governs", "justifies", "constrains", "contains", "bridges", "consumes", "binds", "observes", "prompts", "evolves-from", "supersedes"], capacity: 32 }, dkg_target_kind: { kind: "axis", entries: ["axis", "prefix", "spec", "schema", "decision", "version-event", "constraint", "observation", "domain", "consumer", "intent-link", "dsl-bundle", "skill", "transition-spec", "table", "flow-schema", "system"], capacity: 32 } } },
  execution_context: { version: "v1", labels: ["svc_ref", "execution_mode"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, execution_mode: { kind: "axis", entries: ["live", "test", "synthetic", "replay"], capacity: 8 } } },
  ingest_record: { version: "v1", labels: ["svc_ref", "record_type"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, record_type: { kind: "axis", entries: ["log", "span", "metric"], capacity: 8 } } },
  event_classification: { version: "v1", labels: ["svc_ref", "event_category", "event_lifecycle_stage"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, event_category: { kind: "axis", entries: ["user_action", "system_action", "network_action", "data_action", "agent_action", "sdk_action", "error", "state_change"], capacity: 16 }, event_lifecycle_stage: { kind: "axis", entries: ["interaction", "request", "processing", "result", "side_effect", "completion"], capacity: 16 } } },
  metric_point: { version: "v1", labels: ["svc_ref", "metric_type", "record_type"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, metric_type: { kind: "axis", entries: ["counter", "gauge", "histogram", "summary"], capacity: 8 }, record_type: { kind: "axis", entries: ["log", "span", "metric"], capacity: 8 } } },
  version_state: { version: "v1", labels: ["svc_ref", "version_lifecycle", "address_state"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, version_lifecycle: { kind: "axis", entries: ["draft", "locked", "released", "active", "deprecated"], capacity: 16 }, address_state: { kind: "axis", entries: ["active", "reserved", "inactive", "open"], capacity: 8 } } },
  metric_aggregate: { version: "v1", labels: ["svc_ref", "metric_type", "execution_mode", "health_status"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, metric_type: { kind: "axis", entries: ["counter", "gauge", "histogram", "summary"], capacity: 8 }, execution_mode: { kind: "axis", entries: ["live", "test", "synthetic", "replay"], capacity: 8 }, health_status: { kind: "axis", entries: ["healthy", "degraded", "unhealthy", "maintenance"], capacity: 32 } } },
  validation_event: { version: "v1", labels: ["svc_ref", "validation_layer", "constraint_op", "verdict_result"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, validation_layer: { kind: "axis", entries: ["vocabulary", "structural", "constraint"], capacity: 8 }, constraint_op: { kind: "axis", entries: ["eq", "neq", "exists", "gt", "lt", "contains", "masked"], capacity: 32 }, verdict_result: { kind: "axis", entries: ["pass", "fail", "warn", "degraded", "unknown", "skipped"], capacity: 32 } } },
  resource_lifecycle: { version: "v1", labels: ["svc_ref", "resource_type", "lifecycle_state", "resource_location"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, resource_type: { kind: "axis", entries: ["api", "page", "webhook", "grpc"], capacity: 32 }, lifecycle_state: { kind: "axis", entries: ["draft", "active", "deprecated", "archived", "superseded", "reversed"], capacity: 16 }, resource_location: { kind: "axis", entries: ["origin", "cache", "queue", "external"], capacity: 8 } } },
  test_coverage: { version: "v1", labels: ["qa_pkg", "qa_module", "test_result", "flow_variant"], dims: { qa_pkg: { kind: "axis", entries: ["spec-core", "cli", "sdk", "demo-snapshot", "weighted-index", "bit-index", "permission-engine", "index-meta", "platform-demo", "ingest-server", "registry-service", "e2e", "core", "engine", "store", "gate-service", "query-service", "decode-service", "registry-server", "registry-client", "apm", "browser-sdk", "event-catalog", "pino", "viz-3d", "viz-web", "demo-tests", "weighted-wasm"], capacity: 64 }, qa_module: { kind: "axis", entries: ["shared", "schema", "export-surface", "spec", "loader", "codegen", "dkg", "dkg-skills", "convergence", "propagation", "store", "visualization", "shopping-flow", "event-pipeline", "iframe-integration", "scenario-selector", "shop-ingest-integration", "anonymous-browse", "cart-abandon", "multi-product-purchase", "_all"], capacity: 64 }, test_result: { kind: "axis", entries: ["passed", "failed", "error", "skipped", "timeout"], capacity: 16 }, flow_variant: { kind: "axis", entries: ["default", "retry", "fallback", "manual"], capacity: 32 } } },
  cli_tracking: { version: "v1", labels: ["cli_intent", "cli_domain", "cli_subject", "skill_outcome"], dims: { cli_intent: { kind: "axis", entries: ["query", "analyze", "mutate", "publish", "lifecycle", "init", "backup"], capacity: 16 }, cli_domain: { kind: "axis", entries: ["dkg-graph", "dkg-skill", "convergence", "spec", "coordinate", "registry", "catalog", "self-ref", "system", "ingest"], capacity: 16 }, cli_subject: { kind: "axis", entries: ["axis", "prefix", "domain", "dsl-bundle", "decision", "observation", "constraint", "skill", "intent-link", "system", "version", "spec", "schema", "catalog", "service", "table"], capacity: 32 }, skill_outcome: { kind: "axis", entries: ["ok", "warning", "error", "blocked", "skipped"], capacity: 16 } } },
  tag_lifecycle: { version: "v1", labels: ["svc_ref", "tag", "resource_type", "lifecycle_state"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, tag: { kind: "axis", entries: ["frontend", "backend", "devops", "ai", "database"], capacity: 32 }, resource_type: { kind: "axis", entries: ["api", "page", "webhook", "grpc"], capacity: 32 }, lifecycle_state: { kind: "axis", entries: ["draft", "active", "deprecated", "archived", "superseded", "reversed"], capacity: 16 } } },
  decision_event: { version: "v1", labels: ["flow_type", "cognitive_phase", "evidence_kind", "confidence_band"], dims: { flow_type: { kind: "axis", entries: ["office_hours", "ceo_review", "eng_review", "design_review", "code_review", "investigation", "ship", "custom"], capacity: 16 }, cognitive_phase: { kind: "axis", entries: ["perceive", "interpret", "evaluate", "decide", "plan", "execute", "reflect"], capacity: 16 }, evidence_kind: { kind: "axis", entries: ["data", "rule", "precedent", "intuition", "external"], capacity: 16 }, confidence_band: { kind: "axis", entries: ["low", "medium", "high", "exact"], capacity: 8 } } },
  decision_path: { version: "v1", labels: ["flow_type", "decision_outcome", "scope_mode"], dims: { flow_type: { kind: "axis", entries: ["office_hours", "ceo_review", "eng_review", "design_review", "code_review", "investigation", "ship", "custom"], capacity: 16 }, decision_outcome: { kind: "axis", entries: ["completed", "abandoned", "blocked", "auto_resolved", "escalated"], capacity: 16 }, scope_mode: { kind: "axis", entries: ["expansion", "selective", "hold", "reduction"], capacity: 8 } } },
  escalation_event: { version: "v1", labels: ["flow_type", "escalation_type", "cognitive_phase"], dims: { flow_type: { kind: "axis", entries: ["office_hours", "ceo_review", "eng_review", "design_review", "code_review", "investigation", "ship", "custom"], capacity: 16 }, escalation_type: { kind: "axis", entries: ["standard_pattern", "completeness", "test_coverage", "observability", "security", "taste"], capacity: 16 }, cognitive_phase: { kind: "axis", entries: ["perceive", "interpret", "evaluate", "decide", "plan", "execute", "reflect"], capacity: 16 } } },
  model_apply: { version: "v1", labels: ["mental_model", "reversibility", "magnitude"], dims: { mental_model: { kind: "axis", entries: ["bezos_doors", "munger_inversion", "jobs_subtraction", "speed_calibration", "proxy_skepticism", "boil_the_lake", "three_layer", "narrative_coherence", "temporal_depth", "founder_mode", "wartime_awareness", "design_trust", "edge_paranoia"], capacity: 32 }, reversibility: { kind: "axis", entries: ["one_way", "two_way"], capacity: 4 }, magnitude: { kind: "axis", entries: ["minor", "moderate", "major", "critical"], capacity: 8 } } },
  forcing_response: { version: "v1", labels: ["forcing_question", "evidence_kind", "confidence_band"], dims: { forcing_question: { kind: "axis", entries: ["demand_reality", "status_quo", "desperate_specificity", "narrowest_wedge", "observation", "future_fit"], capacity: 16 }, evidence_kind: { kind: "axis", entries: ["data", "rule", "precedent", "intuition", "external"], capacity: 16 }, confidence_band: { kind: "axis", entries: ["low", "medium", "high", "exact"], capacity: 8 } } },
  harness_transition: { version: "v1", labels: ["svc_ref", "harness_machine", "harness_state", "harness_trigger"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 32768, 32800, 32832, 32864, 32896, 65536, 65568, 65600, 65632, 65664] }, harness_machine: { kind: "axis", entries: ["doc-lifecycle", "spec-impl", "convention-compliance", "db-sync", "address-state", "version-lifecycle", "decision-flow", "service-status", "event-status", "metric-health", "policy-candidate"], capacity: 16 }, harness_state: { kind: "axis", entries: ["draft", "review", "approved", "deprecated", "archived", "active", "inactive", "open", "reserved", "released", "pending", "completed", "abandoned", "blocked", "retired", "ok", "warning", "critical", "designed", "implementing", "implemented", "verified", "source-referenced", "unverified", "partial", "compliant", "violated", "out-of-sync", "syncing", "synced", "drift-detected", "candidate", "rejected", "modified"], capacity: 64 }, harness_trigger: { kind: "axis", entries: ["user_action", "system_auto", "cascade", "guard_pass", "guard", "notify", "timeout", "error", "schedule", "api_call"], capacity: 16 } } },
  harness_guard: { version: "v1", labels: ["svc_ref", "harness_machine", "harness_state", "harness_verdict"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 32768, 32800, 32832, 32864, 32896, 65536, 65568, 65600, 65632, 65664] }, harness_machine: { kind: "axis", entries: ["doc-lifecycle", "spec-impl", "convention-compliance", "db-sync", "address-state", "version-lifecycle", "decision-flow", "service-status", "event-status", "metric-health", "policy-candidate"], capacity: 16 }, harness_state: { kind: "axis", entries: ["draft", "review", "approved", "deprecated", "archived", "active", "inactive", "open", "reserved", "released", "pending", "completed", "abandoned", "blocked", "retired", "ok", "warning", "critical", "designed", "implementing", "implemented", "verified", "source-referenced", "unverified", "partial", "compliant", "violated", "out-of-sync", "syncing", "synced", "drift-detected", "candidate", "rejected", "modified"], capacity: 64 }, harness_verdict: { kind: "axis", entries: ["pass", "fail"], capacity: 4 } } },
  harness_process_step: { version: "v1", labels: ["svc_ref", "harness_process", "harness_machine", "harness_verdict"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 32768, 32800, 32832, 32864, 32896, 65536, 65568, 65600, 65632, 65664] }, harness_process: { kind: "axis", entries: ["prefix-release", "doc-approval", "service-deprecation"], capacity: 8 }, harness_machine: { kind: "axis", entries: ["doc-lifecycle", "spec-impl", "convention-compliance", "db-sync", "address-state", "version-lifecycle", "decision-flow", "service-status", "event-status", "metric-health", "policy-candidate"], capacity: 16 }, harness_verdict: { kind: "axis", entries: ["pass", "fail"], capacity: 4 } } },
  quality_event: { version: "v1", labels: ["svc_ref", "quality_severity", "quality_kind"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 32768, 32800, 32832, 32864, 32896, 65536, 65568, 65600, 65632, 65664] }, quality_severity: { kind: "axis", entries: ["error", "warning", "info"], capacity: 8 }, quality_kind: { kind: "axis", entries: ["error", "assertion", "mask", "field_check", "policy_violation", "unexpected"], capacity: 8 } } },
  task_event: { version: "v1", labels: ["svc_ref", "task_type", "task_phase"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 32768, 32800, 32832, 32864, 32896, 65536, 65568, 65600, 65632, 65664] }, task_type: { kind: "axis", entries: ["task", "job", "cron", "pipeline"], capacity: 8 }, task_phase: { kind: "axis", entries: ["start", "finish", "retry", "timeout", "cancel"], capacity: 8 } } },
  sdk_lifecycle: { version: "v1", labels: ["svc_ref", "sdk_action", "sdk_channel"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 32768, 32800, 32832, 32864, 32896, 65536, 65568, 65600, 65632, 65664] }, sdk_action: { kind: "axis", entries: ["init", "flush", "error", "reconnect"], capacity: 8 }, sdk_channel: { kind: "axis", entries: ["browser", "node", "mobile", "agent"], capacity: 8 } } },
  rpc_event: { version: "v1", labels: ["svc_ref", "rpc_protocol", "rpc_phase"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 32768, 32800, 32832, 32864, 32896, 65536, 65568, 65600, 65632, 65664] }, rpc_protocol: { kind: "axis", entries: ["grpc", "websocket", "http2"], capacity: 8 }, rpc_phase: { kind: "axis", entries: ["open", "message", "close", "request", "response", "error"], capacity: 8 } } },
  gate_execution: { version: "v1", labels: ["svc_ref", "gate_kind", "gate_scope", "gate_state"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 32768, 32800, 32832, 32864, 32896, 65536, 65568, 65600, 65632, 65664] }, gate_kind: { kind: "axis", entries: ["typecheck", "lint", "static-analysis", "unit-test", "snapshot-test", "integration-test", "transaction-test", "api-contract", "e2e-test", "visual-check", "perf-benchmark", "build", "build-affected", "security-audit", "a11y-check", "doc-build", "license-check", "eval-benchmark", "cost-track"], capacity: 32 }, gate_scope: { kind: "axis", entries: ["static", "unit", "integration", "system", "build", "audit", "ai"], capacity: 16 }, gate_state: { kind: "axis", entries: ["idle", "blocked", "ready", "gathering", "running", "passed", "failed", "stale", "skipped"], capacity: 16 } } },
  bundle_observation: { version: "v1", labels: ["svc_ref", "bundle_state"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 32768, 32800, 32832, 32864, 32896, 65536, 65568, 65600, 65632, 65664] }, bundle_state: { kind: "axis", entries: ["empty", "pending", "gathering", "partial", "complete", "degraded"], capacity: 8 } } },
  transition_event: { version: "v1", labels: ["svc_ref", "effect_kind", "match_mode"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 32768, 32800, 32832, 32864, 32896, 65536, 65568, 65600, 65632, 65664] }, effect_kind: { kind: "axis", entries: ["create", "update", "move", "consume", "open", "close"], capacity: 8 }, match_mode: { kind: "axis", entries: ["single", "ordered", "unordered", "windowed"], capacity: 8 } } },
  convergence_event: { version: "v1", labels: ["svc_ref", "convergence_phase", "convergence_result"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 32768, 32800, 32832, 32864, 32896, 65536, 65568, 65600, 65632, 65664] }, convergence_phase: { kind: "axis", entries: ["buffer", "flush", "aggregate", "classify", "metrics", "observations", "persist"], capacity: 16 }, convergence_result: { kind: "axis", entries: ["ok", "partial", "empty", "error"], capacity: 8 } } },
  graph_event: { version: "v1", labels: ["svc_ref", "def_level", "graph_action", "link_type"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 32768, 32800, 32832, 32864, 32896, 65536, 65568, 65600, 65632, 65664] }, def_level: { kind: "axis", entries: ["group", "module", "leaf"], capacity: 8 }, graph_action: { kind: "axis", entries: ["link_add", "link_remove", "promote", "demote", "split", "merge"], capacity: 8 }, link_type: { kind: "axis", entries: ["depends_on", "implements", "refines", "constrains", "traces_to", "contains", "evolves_from", "supersedes"], capacity: 16 } } },
  test_scenario: { version: "v1", labels: ["test_kind", "test_scope", "test_phase"], dims: { test_kind: { kind: "axis", entries: ["unit", "ui-logic", "ui", "db-transaction", "data-exchange", "auth-flow", "e2e", "simulation"], capacity: 16 }, test_scope: { kind: "axis", entries: ["single", "pair", "multi", "system"], capacity: 8 }, test_phase: { kind: "axis", entries: ["precondition", "fixture", "arrange", "act", "observe", "assert-primary", "assert-side", "assert-negative", "snapshot", "teardown", "report"], capacity: 32 } } },
  ir_module: { version: "v1", labels: ["def_level", "def_layer", "ir_certainty"], dims: { def_level: { kind: "axis", entries: ["group", "module", "leaf"], capacity: 8 }, def_layer: { kind: "axis", entries: ["domain", "operation", "mediation", "experience"], capacity: 8 }, ir_certainty: { kind: "axis", entries: ["strict", "flexible"], capacity: 4 } } },
  ir_data: { version: "v1", labels: ["ir_certainty", "ir_transaction_scope", "ir_retention", "ir_storage_type"], dims: { ir_certainty: { kind: "axis", entries: ["strict", "flexible"], capacity: 4 }, ir_transaction_scope: { kind: "axis", entries: ["local", "distributed"], capacity: 4 }, ir_retention: { kind: "axis", entries: ["ephemeral", "session", "persistent"], capacity: 4 }, ir_storage_type: { kind: "axis", entries: ["memory", "db", "event-stream"], capacity: 4 } } },
  ir_pipe: { version: "v1", labels: ["svc_ref", "ir_pipe_state", "ir_call_kind"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, ir_pipe_state: { kind: "axis", entries: ["pending", "committed", "rolledBack"], capacity: 4 }, ir_call_kind: { kind: "axis", entries: ["method-call", "event-emit", "http-request", "db-query"], capacity: 8 } } },
  ir_intent_path: { version: "v1", labels: ["svc_ref", "ir_call_kind", "ir_pipe_state"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, ir_call_kind: { kind: "axis", entries: ["method-call", "event-emit", "http-request", "db-query"], capacity: 8 }, ir_pipe_state: { kind: "axis", entries: ["pending", "committed", "rolledBack"], capacity: 4 } } }
};
async function ct(i) {
  const e = (i == null ? void 0 : i.cacheKey) ?? "qa-sdk-catalog", t = (i == null ? void 0 : i.cacheTtlMs) ?? 300 * 1e3, s = (i == null ? void 0 : i.timeoutMs) ?? 5e3;
  if (i != null && i.registryUrl)
    try {
      const r = await le(i.registryUrl, s);
      if (r && Object.keys(r).length > 0) {
        const o = P(r, i == null ? void 0 : i.serviceOverlay);
        return pe(e, o), {
          catalog: o,
          source: "api",
          prefixCount: Object.keys(o).length,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
    } catch {
    }
  const n = fe(e, t);
  if (n) {
    const r = P(n, i == null ? void 0 : i.serviceOverlay);
    return {
      catalog: r,
      source: "cache",
      prefixCount: Object.keys(r).length,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  const a = P(ce, i == null ? void 0 : i.serviceOverlay);
  return {
    catalog: a,
    source: "static",
    prefixCount: Object.keys(a).length,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function le(i, e) {
  const t = new AbortController(), s = setTimeout(() => t.abort(), e);
  try {
    const n = await fetch(`${i}/resolve/active`, { signal: t.signal });
    if (clearTimeout(s), !n.ok)
      return null;
    const a = await n.json();
    return de(a);
  } catch {
    return clearTimeout(s), null;
  }
}
function de(i) {
  var t;
  const e = {};
  for (const [s, n] of Object.entries(i)) {
    if (!n || typeof n != "object")
      continue;
    const a = n, r = a.version ?? a.activeVersion ?? "v1", o = a.labels ?? (a.dims ? Object.keys(a.dims) : []), l = {};
    if (a.dims)
      for (const [c, f] of Object.entries(a.dims))
        f.kind === "axis" || f.entries ? l[c] = {
          kind: "axis",
          entries: f.entries ?? [],
          capacity: f.capacity ?? ((t = f.entries) == null ? void 0 : t.length) ?? 32
        } : (f.kind === "prefix_ref" || f.values) && (l[c] = {
          kind: "prefix_ref",
          values: f.values ?? []
        });
    (o.length > 0 || Object.keys(l).length > 0) && (e[s] = { version: r, labels: o, dims: l });
  }
  return e;
}
function pe(i, e) {
  try {
    const t = { catalog: e, savedAt: Date.now() };
    localStorage.setItem(i, JSON.stringify(t));
  } catch {
  }
}
function fe(i, e) {
  try {
    const t = localStorage.getItem(i);
    if (!t)
      return null;
    const s = JSON.parse(t);
    return Date.now() - s.savedAt > e ? null : s.catalog;
  } catch {
    return null;
  }
}
function P(i, e) {
  if (!e)
    return i;
  try {
    return ne(i, e);
  } catch {
    return i;
  }
}
class lt {
  constructor(e) {
    x(this, "_max");
    x(this, "_containerId");
    x(this, "_roleColors");
    x(this, "_entries", []);
    x(this, "_roleFilter", null);
    this._max = e.maxEntries, this._containerId = e.containerId, this._roleColors = e.roleColors;
  }
  /* ── public API ── */
  /** 엔트리 추가 + 자동 렌더 */
  add(e, t, s) {
    const n = /* @__PURE__ */ new Date(), a = String(n.getHours()).padStart(2, "0") + ":" + String(n.getMinutes()).padStart(2, "0") + ":" + String(n.getSeconds()).padStart(2, "0") + "." + String(n.getMilliseconds()).padStart(3, "0");
    this._entries.push({ prefixId: e, valuesStr: t, role: s, ts: a }), this._entries.length > this._max && this._entries.shift(), this.render();
  }
  /**
   * 컨텍스트 맵을 받아 각 prefix를 decode → 타임라인에 추가.
   * monitor.html의 feedTimeline() 과 동일한 동작.
   */
  feed(e, t, s) {
    for (const [n, a] of Object.entries(e)) {
      const r = s(n), o = t(a), l = o ? Object.entries(o.values).map(([c, f]) => `${c}=${f}`).join(" ") : a;
      this.add(n, l, r);
    }
  }
  /** role 필터 설정 (null 이면 전체 표시) */
  setRoleFilter(e) {
    this._roleFilter = e, this.render();
  }
  get roleFilter() {
    return this._roleFilter;
  }
  /** DOM 렌더링 — monitor.html의 renderTimeline() 과 동일 HTML 구조 */
  render() {
    const e = document.getElementById(this._containerId);
    if (!e) return;
    const t = this._entries.map((n) => {
      const a = this._roleColors[n.role] || "#556";
      return `<div class="ft-entry ${this._roleFilter && this._roleFilter !== n.role ? "ft-fading" : ""}"><span class="ft-role-dot" style="background:${a}"></span><div class="ft-body"><div class="ft-prefix" style="color:${a}">${n.prefixId}</div><div class="ft-values">${n.valuesStr}</div><div class="ft-role-tag" style="color:${a}">${n.role}</div></div><div class="ft-time">${n.ts}</div></div>`;
    }).join("");
    e.innerHTML = t;
    const s = e.parentElement;
    s && (s.scrollTop = s.scrollHeight);
  }
  /** 전체 초기화 */
  clear() {
    this._entries.length = 0, this.render();
  }
}
class dt {
  constructor(e) {
    x(this, "_total");
    x(this, "_interval");
    x(this, "_onStep");
    x(this, "_onComplete");
    x(this, "_running", !1);
    x(this, "_index", 0);
    x(this, "_timer", null);
    this._total = e.totalSteps, this._interval = e.intervalMs, this._onStep = e.onStep, this._onComplete = e.onComplete;
  }
  /* ── public API ── */
  /** 데모 재생 시작 (이미 실행 중이면 무시) */
  start() {
    this._running || (this._running = !0, this._index = 0, this._tick());
  }
  /** 재생 중지 */
  stop() {
    this._running = !1, this._timer !== null && (clearTimeout(this._timer), this._timer = null);
  }
  /** 상태 리셋 (중지 + 인덱스 초기화) */
  reset() {
    this.stop(), this._index = 0;
  }
  get isRunning() {
    return this._running;
  }
  get currentIndex() {
    return this._index;
  }
  /* ── internal ── */
  _tick() {
    this._running && (this._index >= this._total && (this._index = 0), this._onStep(this._index), this._index++, this._timer = setTimeout(() => this._tick(), this._interval));
  }
}
class pt {
  constructor(e) {
    x(this, "lines", []);
    x(this, "index", 0);
    this.options = e;
    for (let t = 0; t < e.maxBeams; t++) {
      const s = new C.BufferGeometry();
      s.setAttribute("position", new C.BufferAttribute(new Float32Array(6), 3));
      const n = new C.LineBasicMaterial({
        color: e.defaultColor,
        transparent: !0,
        opacity: 0
      });
      e.scene.add(new C.Line(s, n)), this.lines.push({ geo: s, mat: n, life: 0, pinned: !1 });
    }
  }
  /** transient beam — 시간 지나면 fade */
  spawn(e, t, s) {
    const n = this.lines[this.index++ % this.options.maxBeams];
    n.pinned = !1, this.setPositions(n, e, t), n.mat.color.setHex(s), n.life = 4;
  }
  /** pinned beam — clearPinned() 전까지 유지 */
  spawnPinned(e, t, s) {
    const n = this.lines[this.index++ % this.options.maxBeams];
    n.pinned = !0, this.setPositions(n, e, t), n.mat.color.setHex(s), n.life = 1, n.mat.opacity = 0.6;
  }
  /** 모든 pinned beam 해제 */
  clearPinned() {
    for (const e of this.lines)
      e.pinned && (e.pinned = !1, e.life = 0, e.mat.opacity = 0);
  }
  /** 모든 beam 즉시 제거 (pinned + transient) */
  clearAll() {
    for (const e of this.lines)
      e.pinned = !1, e.life = 0, e.mat.opacity = 0;
  }
  /** 매 프레임 호출 — transient beam fade 처리 */
  update(e) {
    for (const t of this.lines)
      t.pinned || t.life > 0 && (t.life -= e, t.mat.opacity = Math.max(0, Math.min(t.life * 0.3, 0.6)));
  }
  setPositions(e, t, s) {
    const n = e.geo.attributes.position.array;
    n[0] = t.x, n[1] = t.y, n[2] = t.z, n[3] = s.x, n[4] = s.y, n[5] = s.z, e.geo.attributes.position.needsUpdate = !0;
  }
}
const K = new C.Color(), j = new C.Color(), L = new C.Color();
function ft(i, e) {
  const { elapsedTime: t, dt: s, glowMul: n, activeSet: a, cellRoleColor: r, roleFilter: o, getRoleFn: l } = e, c = e.glowDecay ?? 0.6;
  for (const f of i) {
    let m = !1;
    K.setHex(f.cc.main.hex);
    for (let u = 0; u < f.count; u++) {
      const d = f.idxToKey[u];
      f.glows[u] > 0 && (f.glows[u] = Math.max(0, f.glows[u] - s * c));
      const _ = a.has(d) ? 0.4 + Math.sin(t * 5) * 0.2 : 0, b = Math.max(f.glows[u], _);
      if (b > 0.01) {
        const h = r.get(d), p = l(d), y = o != null && o !== p;
        h && !y ? j.setHex(h) : j.setHex(f.cc.emissive.hex);
        const v = Math.min(y ? b * n * 0.2 : b * n, 1);
        L.copy(K).lerp(j, v), f.iMesh.setColorAt(u, L), m = !0;
      } else
        f.iMesh.setColorAt(u, K), m = !0;
    }
    f.mat.opacity = e.baseOpacity, f.mat.emissiveIntensity = 0.1, m && f.iMesh.instanceColor && (f.iMesh.instanceColor.needsUpdate = !0);
  }
}
function ut() {
  return `tx_${crypto.randomUUID()}`;
}
function mt() {
  return `log_${crypto.randomUUID()}`;
}
function ht() {
  return `trc_${crypto.randomUUID().slice(0, 12)}`;
}
function _t() {
  return `spn_${crypto.randomUUID().slice(0, 8)}`;
}
function gt() {
  return `ses_${crypto.randomUUID().slice(0, 8)}`;
}
export {
  Ye as ActivationProcessor,
  ce as BROWSER_CATALOG,
  Fe as BeamPool,
  B as CATEGORY_COLORS,
  Xe as CellStateManager,
  Q as DEFAULT_LOD,
  me as DEFAULT_THEME,
  Pe as DEMO_PREFIX_META,
  Be as DEMO_SERVICES,
  Me as DEMO_SIGNALS,
  dt as DemoRunner,
  Ue as ENV_FILTERS,
  Je as FlowHistory,
  lt as FlowTimeline,
  X as LAYER_COLORS,
  nt as MonitorAdapter,
  T as PALETTE,
  E as PRESET_AXES,
  Le as PRESET_VIEWS,
  tt as PerfMonitor,
  U as ROLE_COLORS,
  Oe as SIGNAL_ROLE_COLORS,
  ze as SIGNAL_ROLE_LABELS,
  Ze as STACK_CHECKOUT,
  We as STACK_INFRA,
  Ve as TIER_NAMES,
  pt as ThreeBeamRenderer,
  Ae as ViewEngine,
  De as applyFilters,
  st as buildCategoryLegend,
  he as buildGridPositions,
  it as buildRoleLegend,
  Ne as buildServiceContainers,
  Ce as classifyByRole,
  Ge as computeAllStacks,
  je as computeCrossViewLayout,
  Qe as computeGroupLod,
  ee as computeLodLevel,
  Ie as computePatternLayout,
  He as computeScopeLayouts,
  J as computeStackLayout,
  _e as computeStackPositions,
  ke as cube,
  ie as decode,
  rt as decodeContext,
  at as defaultKeyMapper,
  te as encode,
  Se as extractAxes,
  Te as extractDims,
  Ke as formatDetail,
  ge as generateCssVariables,
  et as getLodVisibility,
  G as getPrefixRole,
  xe as grid,
  Ee as inferPattern,
  F as inferRole,
  ct as loadCatalog,
  qe as matchEventToCells,
  $e as nested,
  mt as newLogId,
  gt as newSessionId,
  _t as newSpanId,
  ht as newTraceId,
  ut as newTransmissionId,
  ye as row,
  ve as scalar,
  we as shelf,
  be as spine,
  se as track,
  ot as trackWithSignal,
  ft as updateInstancedColors,
  Re as validateSignal
};
