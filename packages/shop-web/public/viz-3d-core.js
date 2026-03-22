var D = Object.defineProperty;
var H = (i, e, t) => e in i ? D(i, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : i[e] = t;
var x = (i, e, t) => H(i, typeof e != "symbol" ? e + "" : e, t);
import * as M from "three";
const fe = {
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
  var c, f;
  const n = [], r = /* @__PURE__ */ new Map();
  for (const o of i) {
    const m = [], h = t + s;
    if (o.axes3d) {
      const p = o.axes3d.x.entries, l = ((c = o.axes3d.y) == null ? void 0 : c.entries) ?? ["_"], b = ((f = o.axes3d.z) == null ? void 0 : f.entries) ?? ["_"], g = p.length, k = l.length, u = b.length;
      for (let d = 0; d < g; d++)
        for (let y = 0; y < k; y++)
          for (let v = 0; v < u; v++) {
            const w = -(g - 1) * h / 2 + d * h, $ = y * h, I = -(u - 1) * h / 2 + v * h, S = k > 1 || u > 1 ? [p[d], l[y] !== "_" ? l[y] : null, b[v] !== "_" ? b[v] : null].filter(Boolean).join("/") : p[d], C = `${o.id}/${S}`;
            m.push({ key: C, gridId: o.id, entry: S, localX: w, localY: $, localZ: I, col: d, row: y, depth: v }), r.set(C, { gridId: o.id, entry: S, localX: w, localY: $, localZ: I, layer: o.layer, category: o.category });
          }
      n.push({
        id: o.id,
        category: o.category,
        layer: o.layer,
        cells: m,
        width: g * h,
        height: k * h,
        depth: u * h,
        cols: g,
        rows: k,
        depths: u,
        is3d: k > 1
      });
    } else {
      const p = Math.ceil(o.entries.length / o.cols);
      for (let l = 0; l < o.entries.length; l++) {
        const b = l % o.cols, g = Math.floor(l / o.cols), k = -(o.cols - 1) * h / 2 + b * h, u = -(p - 1) * h / 2 + g * h, d = `${o.id}/${o.entries[l]}`;
        m.push({ key: d, gridId: o.id, entry: o.entries[l], localX: k, localY: 0, localZ: u, col: b, row: g, depth: 0 }), r.set(d, { gridId: o.id, entry: o.entries[l], localX: k, localY: 0, localZ: u, layer: o.layer, category: o.category });
      }
      n.push({
        id: o.id,
        category: o.category,
        layer: o.layer,
        cells: m,
        width: o.cols * h,
        height: h,
        depth: p * h,
        cols: o.cols,
        rows: p,
        depths: 1,
        is3d: !1
      });
    }
  }
  const a = q(i, e, t, s);
  return { grids: n, viewPositions: a, cellMap: r };
}
function q(i, e, t = 0.42, s = 0.1) {
  var l, b, g, k;
  const n = {
    layer: {},
    category: {},
    dsl: {},
    service: {}
  }, r = /* @__PURE__ */ new Map();
  for (const u of i) {
    const d = t + s;
    if (u.axes3d)
      r.set(u.id, { w: u.axes3d.x.entries.length * d, d: (((l = u.axes3d.z) == null ? void 0 : l.entries.length) ?? 1) * d });
    else {
      const y = Math.ceil(u.entries.length / u.cols);
      r.set(u.id, { w: u.cols * d, d: y * d });
    }
  }
  const a = e.map(() => []);
  for (const u of i) (b = a[u.layer]) == null || b.push(u);
  const c = t * 2;
  for (let u = 0; u < a.length; u++) {
    const d = a[u], y = Math.min(d.length, 4);
    for (let v = 0; v < d.length; v++) {
      const w = Math.floor(v / y), $ = d.filter((z, R) => Math.floor(R / y) === w);
      let S = -$.reduce((z, R) => {
        var j;
        return z + (((j = r.get(R.id)) == null ? void 0 : j.w) ?? 2) + c;
      }, -c) / 2;
      const C = v - w * y;
      for (let z = 0; z < C; z++)
        S += (((g = r.get($[z].id)) == null ? void 0 : g.w) ?? 2) + c;
      const V = ((k = r.get(d[v].id)) == null ? void 0 : k.w) ?? 2;
      S += V / 2;
      const N = Math.max(...$.map((z) => {
        var R;
        return ((R = r.get(z.id)) == null ? void 0 : R.d) ?? 2;
      }));
      n.layer[d[v].id] = {
        x: S,
        y: e[u],
        z: w * -(N + c * 2)
      };
    }
  }
  [...new Set(i.map((u) => u.category))].forEach((u, d) => {
    const y = i.filter(($) => $.category === u), v = d % 3, w = Math.floor(d / 3);
    y.forEach(($, I) => {
      n.category[$.id] = { x: -12 + v * 12, y: 4 - I * 3.5, z: w * -8 };
    });
  });
  const o = [...new Set(i.map((u) => u.dsl).filter(Boolean))], m = i.filter((u) => !u.dsl);
  o.forEach((u, d) => {
    const y = i.filter(($) => $.dsl === u), v = d % 4, w = Math.floor(d / 4);
    y.forEach(($, I) => {
      n.dsl[$.id] = { x: -18 + v * 12, y: 4 - I * 3, z: w * -10 };
    });
  }), m.forEach((u, d) => {
    n.dsl[u.id] = { x: 24, y: 4 - d * 3, z: -12 };
  });
  const h = [...new Set(i.map((u) => u.service).filter(Boolean))], p = i.filter((u) => !u.service);
  return h.forEach((u, d) => {
    i.filter((v) => v.service === u).forEach((v, w) => {
      n.service[v.id] = { x: -16 + d * 8, y: 4 - Math.floor(w / 2) * 3.5, z: w % 2 * -5 };
    });
  }), p.forEach((u, d) => {
    n.service[u.id] = { x: 24, y: 4, z: -d * 5 };
  }), n;
}
function ue(i, e) {
  const t = {};
  for (const s of i)
    s.grids.forEach((n, r) => {
      const a = r * s.gap;
      t[n] = {
        x: s.position.x + (s.axis === "x" ? a : 0),
        y: s.position.y + (s.axis === "y" ? a : 0),
        z: s.position.z + (s.axis === "z" ? a : 0)
      };
    });
  return t;
}
function _(i) {
  const e = i >> 16 & 255, t = i >> 8 & 255, s = i & 255;
  return { hex: i, css: `#${i.toString(16).padStart(6, "0")}`, rgb: `${e},${t},${s}` };
}
const E = {
  // Background / Surface
  bgDeep: _(328968),
  bgCard: _(526864),
  bgSurface: _(790036),
  bgGrid1: _(1712176),
  bgGrid2: _(1053984),
  bgAxis: _(1714232),
  // Text
  txtPrimary: _(12634328),
  txtSecondary: _(6715272),
  txtDim: _(3359829),
  txtMuted: _(2241348),
  // Accent
  mint: _(6619098),
  cyan: _(46296),
  amber: _(16752451),
  orange: _(16753922),
  violet: _(8150268),
  purple: _(7101671),
  rose: _(16726112),
  pink: _(15221651),
  green: _(3069299),
  red: _(16739179),
  // State
  connected: _(3069299),
  warning: _(16752451),
  error: _(16726112),
  info: _(6619098)
}, B = {
  observation: { main: _(58879), emissive: _(38823) },
  event: { main: _(16748800), emissive: _(12545024) },
  policy: { main: _(58998), emissive: _(38436) },
  relation: { main: _(11766015), emissive: _(8146431) },
  entity: { main: _(7901340), emissive: _(11583173) },
  state: { main: _(9795021), emissive: _(13747433) },
  table: { main: _(16732754), emissive: _(12986408) }
};
function O(i) {
  return { token: _(i), hex: i };
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
  _(6619098),
  // L0 UI — mint
  _(16752451),
  // L1 Business — amber
  _(8150268),
  // L2 Infra — violet
  _(16726112)
  // L3 Data — rose
];
function me() {
  return [
    `--bg:${E.bgDeep.css}`,
    `--card:rgba(${E.bgCard.rgb},0.92)`,
    `--border:rgba(${E.mint.rgb},0.08)`,
    `--mint:${E.mint.css}`,
    `--amber:${E.amber.css}`,
    `--violet:${E.violet.css}`,
    `--rose:${E.rose.css}`,
    `--txt:${E.txtPrimary.css}`,
    `--dim:${E.txtDim.css}`,
    `--green:${E.green.css}`,
    `--red:${E.red.css}`,
    `--cyan:${E.cyan.css}`,
    // Category
    ...Object.entries(B).map(([i, e]) => `--cat-${i}:${e.main.css}`),
    // Signal Role
    ...Object.entries(U).map(([i, e]) => `--role-${i}:${e.token.css}`),
    // Layer
    ...X.map((i, e) => `--layer-${e}:${i.css}`)
  ].join(";");
}
function ge(i, e) {
  return {
    type: "scalar",
    prefixId: i,
    mappings: [{ axis: e, channel: "color" }],
    description: `${i}.${e} → 단일 값 표시`
  };
}
function _e(i, e) {
  return {
    type: "row",
    prefixId: i,
    mappings: [{ axis: e, channel: "x" }],
    description: `${i}.${e} → 가로 행`
  };
}
function ve(i, e, t) {
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
function ye(i, e, t, s) {
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
function xe(i, e, t) {
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
function ke(i, e, t, s) {
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
function be(i, e, t) {
  return {
    type: "nested",
    prefixId: i,
    mappings: [
      { axis: e, channel: "group", subPattern: t }
    ],
    description: `${i}: ${e}별 그룹, 각 그룹 = ${t}`
  };
}
function we(i, e, t = 0.4, s = 0.08) {
  const n = t + s, r = [], a = i.mappings.find((d) => d.channel === "x"), c = i.mappings.find((d) => d.channel === "y"), f = i.mappings.find((d) => d.channel === "z"), o = i.mappings.find((d) => d.channel === "group"), m = i.mappings.filter((d) => d.channel === "collapse").map((d) => d.axis), h = a ? e[a.axis] || [] : ["_"], p = c ? e[c.axis] || [] : ["_"], l = f ? e[f.axis] || [] : ["_"], b = o ? e[o.axis] || [] : ["_"];
  switch (i.type) {
    case "scalar":
      r.push({ key: `${i.prefixId}/_`, x: 0, y: 0, z: 0 });
      break;
    case "row":
      h.forEach((d, y) => {
        r.push({ key: `${i.prefixId}/${d}`, x: y * n, y: 0, z: 0 });
      });
      break;
    case "grid":
      h.forEach((d, y) => {
        l.forEach((v, w) => {
          r.push({ key: `${i.prefixId}/${d}_${v}`, x: y * n, y: 0, z: w * n });
        });
      });
      break;
    case "cube":
      h.forEach((d, y) => {
        p.forEach((v, w) => {
          l.forEach(($, I) => {
            r.push({ key: `${i.prefixId}/${d}_${v}_${$}`, x: y * n, y: w * n, z: I * n });
          });
        });
      });
      break;
    case "spine":
      h.forEach((d, y) => {
        const v = {};
        for (const w of m)
          v[w] = `(${(e[w] || []).length} entries)`;
        r.push({ key: `${i.prefixId}/${d}`, x: y * n, y: 0, z: 0, collapsed: v });
      });
      break;
    case "shelf":
      b.forEach((d, y) => {
        const v = y * (l.length * n + n * 2);
        h.forEach((w, $) => {
          l.forEach((I, S) => {
            r.push({
              key: `${i.prefixId}/${d}_${w}_${I}`,
              x: $ * n,
              y: v,
              z: S * n,
              group: d
            });
          });
        });
      });
      break;
    case "nested":
      b.forEach((d, y) => {
        const v = y * (h.length * n + n * 2);
        h.forEach((w, $) => {
          r.push({
            key: `${i.prefixId}/${d}/${w}`,
            x: v + $ * n,
            y: 0,
            z: 0,
            group: d
          });
        });
      });
      break;
  }
  const g = r.map((d) => d.x), k = r.map((d) => d.y), u = r.map((d) => d.z);
  return {
    pattern: i,
    cells: r,
    bounds: {
      width: r.length > 0 ? Math.max(...g) - Math.min(...g) + t : 0,
      height: r.length > 0 ? Math.max(...k) - Math.min(...k) + t : 0,
      depth: r.length > 0 ? Math.max(...u) - Math.min(...u) + t : 0
    }
  };
}
function F(i, e) {
  if (e === "prefix_ref" || e === "table_ref") return "context";
  const t = i.toLowerCase();
  return t.includes("step") || t.includes("phase") || t.includes("stage") ? "sequence" : t.includes("variant") || t.includes("version") || t.includes("mode") ? "variant" : t.endsWith("_name") || t === "flow_name" || t === "event_name" || t.endsWith("_type") || t === "resource_type" ? "classify" : (t.includes("action") || t.includes("method") || t.includes("op") || t === "role" || t === "resource", "identity");
}
function $e(i, e) {
  const t = typeof e[0] == "string" ? e.map((l) => ({ label: l, kind: "axis" })) : e, s = t.filter((l) => l.kind === "axis"), n = t.filter((l) => l.kind === "prefix_ref"), r = t.filter((l) => l.kind === "table_ref"), a = s.map((l) => ({ ...l, role: F(l.label, l.kind) })), c = a.filter((l) => l.role === "classify"), f = a.filter((l) => l.role === "sequence"), o = a.filter((l) => l.role === "variant"), m = a.filter((l) => l.role === "identity"), h = [];
  for (const l of n)
    h.push({ axis: l.label, channel: "collapse", role: "context", dimKind: "prefix_ref" });
  for (const l of r)
    h.push({ axis: l.label, channel: "link", role: "context", dimKind: "table_ref" });
  if (c.length > 0) {
    const l = c[0], b = a.filter((u) => u !== l);
    if (b.length === 0)
      return h.push({ axis: l.label, channel: "x", role: "classify" }), { type: "row", prefixId: i, mappings: h, description: `${i}: ${l.label}(x) → 행` };
    if (b.length === 1)
      return h.push({ axis: l.label, channel: "group", role: "classify", subPattern: "row" }), h.push({ axis: b[0].label, channel: "x", role: b[0].role }), { type: "shelf", prefixId: i, mappings: h, description: `${i}: ${l.label}별 선반, ${b[0].label}(x)` };
    h.push({ axis: l.label, channel: "group", role: "classify", subPattern: "grid" });
    const g = f[0] || b[0], k = o[0] || b.find((u) => u !== g) || b[1];
    return g && h.push({ axis: g.label, channel: "x", role: g.role }), k && k !== g && h.push({ axis: k.label, channel: "z", role: k.role }), { type: "shelf", prefixId: i, mappings: h, description: `${i}: ${l.label}별 선반, ${g == null ? void 0 : g.label}(x) × ${k == null ? void 0 : k.label}(z)` };
  }
  const p = [...f, ...m, ...o];
  return p.length === 0 ? { type: "scalar", prefixId: i, mappings: [{ axis: "_", channel: "color" }], description: `${i}: scalar` } : p.length === 1 ? (h.push({ axis: p[0].label, channel: "x", role: p[0].role }), { type: "row", prefixId: i, mappings: h, description: `${i}: ${p[0].label}(x)` }) : p.length === 2 ? (h.push({ axis: p[0].label, channel: "x", role: p[0].role }), h.push({ axis: p[1].label, channel: "z", role: p[1].role }), { type: "grid", prefixId: i, mappings: h, description: `${i}: ${p[0].label}(x) × ${p[1].label}(z)` }) : (h.push({ axis: p[0].label, channel: "x", role: p[0].role }), h.push({ axis: p[1].label, channel: "y", role: p[1].role }), h.push({ axis: p[2].label, channel: "z", role: p[2].role }), { type: "cube", prefixId: i, mappings: h, description: `${i}: ${p[0].label}(x) × ${p[1].label}(y) × ${p[2].label}(z)` });
}
function Ie(i) {
  return Object.entries(i).map(([e, t]) => ({
    label: e,
    kind: t.kind
  }));
}
function Te(i) {
  return Object.entries(i).filter(([, e]) => e.kind === "axis").map(([e]) => e);
}
const Ee = {
  context: "어디서",
  trigger: "뭘 했는가",
  channel: "어떤 경로",
  state: "흐름 어디",
  guard: "어떤 조건",
  effect: "결과",
  data: "데이터 접점"
}, Se = {
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
function ze(i) {
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
const Oe = [
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
function Me(i, e) {
  const t = new Set(Object.keys(e)), s = new Set(i.members.map((c) => c.prefixId));
  let n = 0;
  const r = /* @__PURE__ */ new Set();
  for (const c of i.members)
    t.has(c.prefixId) ? n++ : r.add(c.role);
  const a = [...t].filter((c) => !s.has(c) && c !== "service");
  return {
    signalId: i.id,
    valid: n === i.members.length,
    missingRoles: [...r],
    extraPrefixes: a,
    matchedMembers: n,
    totalMembers: i.members.length
  };
}
const Ce = {
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
function Re(i, e) {
  var s, n;
  const t = [];
  if (t.push(`<div style="font-size:11px;font-weight:600;color:#e0e4ec">${i.displayName}</div>`), t.push(`<div style="font-size:9px;color:#556;margin:3px 0">${i.description}</div>`), i.source) {
    const r = i.source, a = [];
    r.module && a.push(r.module), r.file && a.push(r.file), r.line && a.push(`L${r.line}`), t.push(`<div style="font-size:8px;color:#334;margin-top:4px">📁 ${a.join(" / ")}</div>`), r.url && t.push(`<div style="font-size:8px"><a href="${r.url}" target="_blank" style="color:#64ffda">📎 docs</a></div>`);
  }
  switch (i.detailKind) {
    case "schema": {
      const r = i.detail;
      if (r != null && r.columns) {
        t.push('<div style="margin-top:6px;font-size:8px;color:#445;letter-spacing:1px">SCHEMA</div>');
        for (const a of r.columns) {
          const c = a.refKind !== "scalar" ? ` <span style="color:${a.refKind === "axis_ref" ? "#00e676" : a.refKind === "table_ref" ? "#ff5252" : "#00e5ff"}">→${a.refTarget}</span>` : "", f = e && a.name === e ? "color:var(--mint);font-weight:600" : "color:#667";
          t.push(`<div style="font-size:9px;${f}">${a.name} <span style="color:#334">${a.type}</span>${c}</div>`);
        }
      }
      break;
    }
    case "event-def": {
      const r = i.detail;
      if (r && (t.push('<div style="margin-top:6px;font-size:8px;color:#445;letter-spacing:1px">EVENT STRUCTURE</div>'), t.push(`<div style="font-size:9px;color:#ff9100">${r.structure}</div>`), r.slots))
        for (const a of r.slots) {
          const c = a.kind === "table_ref" ? "#ff5252" : a.kind === "prefix_ref" ? "#00e5ff" : "#00e676";
          t.push(`<div style="font-size:9px;color:#667">${a.name} <span style="color:${c}">${a.kind}→${a.target}</span></div>`);
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
        for (const a of r)
          t.push(`<div style="font-size:9px;color:#667"><span style="color:#00e5ff">${a.method}</span> ${a.path}</div>`);
      }
      break;
    }
  }
  return t.join("");
}
function Pe(i, e = 0.42, t = 0.1) {
  const s = e + t, n = i.channels.find((g) => g.channel === "x"), r = i.channels.find((g) => g.channel === "y"), a = i.channels.find((g) => g.channel === "z"), c = i.channels.find((g) => g.channel === "group"), f = i.channels.find((g) => g.channel === "color"), o = (g) => {
    var u;
    return g ? ((u = i.filters) == null ? void 0 : u[g.id]) ?? g.entries : ["_"];
  }, m = o(n == null ? void 0 : n.axis), h = o(r == null ? void 0 : r.axis), p = o(a == null ? void 0 : a.axis), l = o(c == null ? void 0 : c.axis), b = [];
  for (const g of l) {
    const k = l.indexOf(g) * (m.length * s + s * 3);
    for (const u of m)
      for (const d of h)
        for (const y of p) {
          const v = m.indexOf(u), w = h.indexOf(d), $ = p.indexOf(y), I = {};
          n && (I[n.axis.id] = u), r && (I[r.axis.id] = d), a && (I[a.axis.id] = y), c && g !== "_" && (I[c.axis.id] = g);
          const C = Object.values(I).join(":");
          b.push({
            coords: I,
            key: C,
            x: k + v * s,
            y: w * s,
            z: $ * s,
            group: g !== "_" ? g : void 0,
            colorValue: f ? I[f.axis.id] : void 0
          });
        }
  }
  return {
    def: i,
    cells: b,
    xEntries: m,
    yEntries: h,
    zEntries: p,
    groups: l.filter((g) => g !== "_"),
    totalCells: b.length,
    bounds: {
      width: (l.length > 1 ? l.length : 1) * m.length * s,
      height: h.length * s,
      depth: p.length * s
    }
  };
}
function Ke(i, e) {
  const t = [];
  for (const s of e.cells) {
    let n = !0;
    for (const [r, a] of Object.entries(s.coords))
      if (i[r] !== a) {
        n = !1;
        break;
      }
    n && t.push(s.key);
  }
  return t;
}
const T = {
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
}, je = [
  {
    id: "page-x-flowstep",
    name: "페이지 × 흐름 단계",
    channels: [
      { axis: T.page, channel: "x" },
      { axis: T.flow_step, channel: "z" }
    ]
  },
  {
    id: "method-x-verdict",
    name: "HTTP 메서드 × 판정 결과",
    channels: [
      { axis: T.http_method, channel: "x" },
      { axis: T.verdict_result, channel: "z" }
    ]
  },
  {
    id: "svc-x-phase-x-health",
    name: "서비스 × 파이프라인 × 헬스 (3D 큐브)",
    channels: [
      { axis: T.svc_name, channel: "x" },
      { axis: T.pipeline_phase, channel: "y" },
      { axis: T.health_status, channel: "z" }
    ]
  },
  {
    id: "page-x-action-by-usertype",
    name: "페이지 × 행동, 사용자유형별 그룹",
    channels: [
      { axis: T.userType, channel: "group" },
      { axis: T.page, channel: "x" },
      { axis: T.trackAction, channel: "z" }
    ]
  },
  {
    id: "role-x-method",
    name: "역할 × HTTP 메서드",
    channels: [
      { axis: T.role, channel: "x" },
      { axis: T.http_method, channel: "z" }
    ]
  },
  {
    id: "flow-x-step-by-svc",
    name: "흐름 × 단계, 서비스별",
    channels: [
      { axis: T.svc_name, channel: "group" },
      { axis: T.flow_name, channel: "x" },
      { axis: T.flow_step, channel: "z" }
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
const Le = {
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
function Ve(i, e, t) {
  return i.map((s) => {
    const n = [.../* @__PURE__ */ new Set([...s.ownedPrefixes, ...s.consumedPrefixes])], r = { 0: [], 1: [], 2: [], 3: [] };
    for (const c of n) {
      const f = e.get(c);
      if (!f) continue;
      const o = W(c);
      r[o].push({
        prefixId: c,
        tier: o,
        entries: f.entries,
        pattern: f.pattern,
        category: f.category
      });
    }
    const a = [];
    if (t)
      for (const c of s.tables) {
        const f = t[c];
        f && a.push(...f);
      }
    return {
      serviceId: s.id,
      serviceName: s.name,
      tiers: r,
      dataEntries: a
    };
  });
}
function Ne(i, e, t) {
  const s = t.find((n) => n.axisId === e);
  return s ? s.mode === "show" ? i.filter((n) => s.values.includes(n)) : i.filter((n) => !s.values.includes(n)) : [...i];
}
function De(i, e) {
  const t = (e == null ? void 0 : e.containerGap) ?? 12, s = (e == null ? void 0 : e.tierGap) ?? 3;
  return i.map((n, r) => {
    const c = (Object.values(n.tiers).filter((m) => m.length > 0).length + (n.dataEntries.length > 0 ? 1 : 0)) * s, f = Math.max(1, ...Object.values(n.tiers).flatMap((m) => m.map((h) => h.entries.length))), o = Math.max(4, Math.ceil(Math.sqrt(f)) * 1.5);
    return {
      serviceId: n.serviceId,
      position: { x: r * t - (i.length - 1) * t / 2, y: 0, z: 0 },
      size: { width: o, height: c, depth: o },
      tierOffsets: { 0: s * 1.5, 1: s * 0.5, 2: -s * 0.5, 3: -s * 1.5 }
    };
  });
}
const He = [
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
], qe = {
  prodOnly: { axisId: "env", mode: "show", values: ["prod"] },
  devOnly: { axisId: "env", mode: "show", values: ["dev"] },
  hideTest: { axisId: "env", mode: "hide", values: ["test", "local"] },
  all: { axisId: "env", mode: "show", values: ["dev", "stage", "prod", "test", "local"] }
};
class Be {
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
class Ue {
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
class Xe {
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
function J(i, e) {
  const t = new Map(e.map((c) => [c.id, c])), s = {};
  let n = 0, r = 0;
  i.grids.forEach((c, f) => {
    const o = t.get(c);
    o && (n = Math.max(n, o.width), r = Math.max(r, o.depth));
    const m = f * i.gap;
    s[c] = {
      x: i.position.x + (i.axis === "x" ? m : 0),
      y: i.position.y + (i.axis === "y" ? m : 0),
      z: i.position.z + (i.axis === "z" ? m : 0)
    };
  });
  const a = i.grids.length * i.gap;
  return {
    stackId: i.id,
    axis: i.axis,
    gridPositions: s,
    bounds: {
      width: i.axis === "x" ? a : n,
      height: i.axis === "y" ? a : 1,
      depth: i.axis === "z" ? a : r
    }
  };
}
function Fe(i, e) {
  const t = [], s = {};
  for (const n of i) {
    const r = J(n, e);
    t.push(r), Object.assign(s, r.gridPositions);
  }
  for (const n of e)
    n.id in s || (s[n.id] = { x: 30, y: 0, z: 0 });
  return { layouts: t, viewPositions: s };
}
const Ye = {
  id: "stack-checkout",
  grids: ["page_view", "endpoint", "flow_point", "permission", "order_event", "orders"],
  axis: "y",
  gap: 3,
  position: { x: 0, y: -4, z: 0 }
}, Ge = {
  id: "stack-infra",
  grids: ["service", "deploy_event", "health_event", "pipeline_point", "data_policy"],
  axis: "y",
  gap: 3,
  position: { x: 12, y: -4, z: 0 }
};
class Ze {
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
function We(i, e, t) {
  const s = /* @__PURE__ */ new Map();
  for (const [n, r] of e) {
    const a = i.x - r.x, c = i.y - r.y, f = i.z - r.z, o = Math.sqrt(a * a + c * c + f * f);
    s.set(n, ee(o, t));
  }
  return s;
}
function Je(i) {
  switch (i) {
    case "near":
      return { showLabels: !0, showEdges: !0, showHitCounts: !0, cellOpacityMultiplier: 1 };
    case "mid":
      return { showLabels: !0, showEdges: !1, showHitCounts: !1, cellOpacityMultiplier: 0.9 };
    case "far":
      return { showLabels: !1, showEdges: !1, showHitCounts: !1, cellOpacityMultiplier: 0.7 };
  }
}
class Qe {
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
function et(i, e, t) {
  i.innerHTML = "";
  for (const [s, n] of Object.entries(e)) {
    const r = document.createElement("span");
    r.className = "sl-role sl-active", r.dataset.role = s, r.innerHTML = `<span class="sl-dot" style="background:${n.token.css}"></span>${s}`, t && r.addEventListener("click", () => t(s, r)), i.appendChild(r);
  }
}
function tt(i, e) {
  i.innerHTML = "";
  for (const [t, s] of Object.entries(e)) {
    const n = document.createElement("span");
    n.style.cssText = `font-size:8px;color:${s.main.css};padding:2px 5px;border:1px solid ${s.main.css}33;border-radius:3px`, n.textContent = t, i.appendChild(n);
  }
}
class it {
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
    var t, s, n, r;
    (s = (t = this.config).onConnectionChange) == null || s.call(t, "connecting");
    try {
      this.ws = new WebSocket(e), this.ws.onopen = () => {
        var a, c;
        this._connected = !0, (c = (a = this.config).onConnectionChange) == null || c.call(a, "connected"), this.ws.send(JSON.stringify({ type: "subscribe", scenarioId: "*" }));
      }, this.ws.onmessage = (a) => {
        var c, f;
        try {
          const o = JSON.parse(a.data);
          o.type === "record" && o.data ? this.handleRecord(o.data) : o.type === "subscribed" && ((f = (c = this.config).onConnectionChange) == null || f.call(c, "subscribed"));
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
    var e, t;
    this.ws && (this.ws.close(), this.ws = null), this._connected = !1, (t = (e = this.config).onConnectionChange) == null || t.call(e, "disconnected");
  }
  /** HTTP로 이벤트 전송 (DEMO용) */
  async sendToIngest(e, t, s, n, r) {
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
      const a = this.config.mapToKeys(r.prefix, r.values);
      s.push(...a);
    }
    s.length > 0 && this.config.onActivation(s, t);
  }
}
function st(i, e) {
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
  const n = [], r = [];
  for (const f of s.labels) {
    const o = s.dims[f];
    if (!o)
      return null;
    if (o.kind === "axis") {
      n.push(o.capacity ?? o.entries.length);
      const m = o.entries.indexOf(t[f]);
      if (m < 0)
        return null;
      r.push(m);
    } else {
      const m = o.values;
      n.push(m.length);
      const h = t[f] ?? m[0], p = m.indexOf(h);
      r.push(p < 0 ? 0 : p);
    }
  }
  const a = new Array(n.length);
  a[n.length - 1] = 1;
  for (let f = n.length - 2; f >= 0; f--)
    a[f] = a[f + 1] * n[f + 1];
  let c = 0;
  for (let f = 0; f < r.length; f++)
    c += r[f] * a[f];
  return { prefix: e, version: s.version, address: c, serialized: `${e}:${s.version}:${c}` };
}
function ie(i, e) {
  const t = e.split(":"), [s, n, r] = t.length === 4 ? [t[1], t[2], t[3]] : [t[0], t[1], t[2]], a = i[s];
  if (!a)
    return null;
  let c = parseInt(r);
  if (isNaN(c))
    return null;
  const f = [], o = [];
  for (const p of a.labels) {
    const l = a.dims[p];
    l && (l.kind === "axis" ? f.push(l.capacity ?? l.entries.length) : f.push(l.values.length), o.push({ label: p, dim: l }));
  }
  const m = new Array(f.length);
  m[f.length - 1] = 1;
  for (let p = f.length - 2; p >= 0; p--)
    m[p] = m[p + 1] * f[p + 1];
  const h = {};
  for (let p = 0; p < o.length; p++) {
    const l = Math.floor(c / m[p]);
    c %= m[p];
    const { label: b, dim: g } = o[p];
    h[b] = g.kind === "axis" ? g.entries[l] ?? `(${l})` : g.values[l] ?? l;
  }
  return { prefix: s, version: n, values: h };
}
function se(i, e) {
  const t = {};
  for (const [s, n] of Object.entries(e)) {
    const r = i[s];
    if (!r)
      continue;
    const a = { ...n };
    for (const f of r.labels) {
      const o = r.dims[f];
      (o == null ? void 0 : o.kind) === "prefix_ref" && !(f in a) && (a[f] = o.values[0]);
    }
    const c = te(i, s, a);
    c && (t[s] = c.serialized);
  }
  return t;
}
function nt(i, e) {
  const t = {};
  for (const [s, n] of Object.entries(e)) {
    const r = ie(i, n);
    r && (t[s] = { prefix: r.prefix, values: r.values });
  }
  return t;
}
const ne = {
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
  return ne[i] ?? "trigger";
}
function ae(i) {
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
function rt(i, e) {
  const t = se(i, e), s = ae(t);
  return { addressContext: t, byRole: s };
}
const A = {
  service: { version: "v1", labels: ["env", "region", "svc_name", "namespace"], dims: { env: { kind: "axis", entries: ["dev", "stage", "prod", "test", "local"], capacity: 32 }, region: { kind: "axis", entries: ["asia", "usa"], capacity: 32 }, svc_name: { kind: "axis", entries: ["shopping-web", "shopping-backend", "auth", "payment", "gateway"], capacity: 32 }, namespace: { kind: "axis", entries: ["shop", "cms"], capacity: 32 } } },
  permission: { version: "v4", labels: ["perm_svc", "role"], dims: { perm_svc: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, role: { kind: "axis", entries: ["admin", "developer", "operator", "viewer", "readonly", "customer", "auditor"], capacity: 32 } } },
  event: { version: "v4", labels: ["evt_svc", "event_name", "initiator"], dims: { evt_svc: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 65536, 65568, 65600, 65632, 65664] }, event_name: { kind: "axis", entries: ["user.login", "user.logout", "order.created", "order.paid", "payment.failed", "session.expired", "config.changed", "payment.cancel_requested", "payment.cancel_approved", "payment.refunded"], capacity: 64 }, initiator: { kind: "axis", entries: ["web", "mobile"], capacity: 32 } } },
  rbac: { version: "v1", labels: ["role", "action", "resource"], dims: { role: { kind: "axis", entries: ["admin", "editor", "viewer"], capacity: 32 }, action: { kind: "axis", entries: ["read", "write", "delete", "admin"], capacity: 32 }, resource: { kind: "axis", entries: ["dashboard", "reports", "settings", "users"], capacity: 32 } } },
  content: { version: "v1", labels: ["tag", "category", "status", "locale", "channel"], dims: { tag: { kind: "axis", entries: ["frontend", "backend", "devops", "ai", "database"], capacity: 32 }, category: { kind: "axis", entries: ["tech", "design", "product", "culture"], capacity: 32 }, status: { kind: "axis", entries: ["draft", "published", "archived"], capacity: 32 }, locale: { kind: "axis", entries: ["ko", "en", "ja"], capacity: 32 }, channel: { kind: "axis", entries: ["web", "mobile"], capacity: 32 } } },
  tracking: { version: "v2", labels: ["trackAction", "page", "userType"], dims: { trackAction: { kind: "axis", entries: ["click", "view", "scroll", "submit", "navigate", "add_to_cart", "purchase", "close"], capacity: 32 }, page: { kind: "axis", entries: ["home", "product_list", "product_detail", "cart", "checkout", "order_complete", "mypage", "login"], capacity: 32 }, userType: { kind: "axis", entries: ["guest", "member", "premium"], capacity: 32 } } },
  relational: { version: "v2", labels: ["subjectKind", "predicate", "objectKind"], dims: { subjectKind: { kind: "axis", entries: ["_", "user", "role", "group", "service", "engine"], capacity: 32 }, predicate: { kind: "axis", entries: ["_", "has", "can_access", "belongs_to", "has_capability", "evaluated", "migrated_to"], capacity: 32 }, objectKind: { kind: "axis", entries: ["_", "role", "permission", "group", "resource", "queue", "metric_store", "constraint", "prefix_version"], capacity: 32 } } },
  page_view: { version: "v2", labels: ["svc_ref", "page", "locale", "userType"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, page: { kind: "axis", entries: ["home", "product_list", "product_detail", "cart", "checkout", "order_complete", "mypage", "login"], capacity: 32 }, locale: { kind: "axis", entries: ["ko", "en", "ja"], capacity: 32 }, userType: { kind: "axis", entries: ["guest", "member", "premium"], capacity: 32 } } },
  endpoint: { version: "v1", labels: ["svc_ref", "resource_type", "http_method", "api_version"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, resource_type: { kind: "axis", entries: ["api", "page", "webhook", "grpc"], capacity: 32 }, http_method: { kind: "axis", entries: ["GET", "POST", "PUT", "DELETE", "PATCH"], capacity: 32 }, api_version: { kind: "axis", entries: ["v1", "v2"], capacity: 32 } } },
  flow_point: { version: "v2", labels: ["svc_ref", "flow_name", "flow_step", "flow_variant"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, flow_name: { kind: "axis", entries: ["checkout", "signup", "order_cancel", "refund", "login", "browse", "cart_manage", "payment"], capacity: 64 }, flow_step: { kind: "axis", entries: ["entry", "processing", "branch", "success", "failure", "timeout", "payment", "complete", "exit"], capacity: 32 }, flow_variant: { kind: "axis", entries: ["default", "retry", "fallback", "manual"], capacity: 32 } } },
  engine_event: { version: "v1", labels: ["svc_ref", "constraint_op", "verdict_result"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, constraint_op: { kind: "axis", entries: ["eq", "neq", "exists", "gt", "lt", "contains", "masked"], capacity: 32 }, verdict_result: { kind: "axis", entries: ["pass", "fail", "warn", "degraded", "unknown", "skipped"], capacity: 32 } } },
  schema_event: { version: "v1", labels: ["svc_ref", "migration_pattern", "deploy_action"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 32768, 32800, 32832, 32864, 32896, 65536, 65568, 65600, 65632, 65664] }, migration_pattern: { kind: "axis", entries: ["identity", "reorder", "append_dim", "remove_dim", "composite", "unknown"], capacity: 32 }, deploy_action: { kind: "axis", entries: ["deploy", "rollback", "scale_up", "scale_down", "restart", "canary_start", "canary_promote", "migrate"], capacity: 32 } } },
  schema_validation: { version: "v1", labels: ["svc_ref", "validation_layer", "constraint_rule", "verdict_result"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, validation_layer: { kind: "axis", entries: ["vocabulary", "structural", "constraint"], capacity: 8 }, constraint_rule: { kind: "axis", entries: ["required", "maxCount", "minCount", "requiredIf", "exclusive", "type", "multi", "unknownAxis"], capacity: 32 }, verdict_result: { kind: "axis", entries: ["pass", "fail", "warn", "degraded", "unknown", "skipped"], capacity: 32 } } },
  pipeline_point: { version: "v1", labels: ["svc_ref", "pipeline_phase", "validation_mode", "verdict_result", "temporal_strategy"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, pipeline_phase: { kind: "axis", entries: ["ingest", "reconstruct", "verdict", "aggregate", "propagate"], capacity: 32 }, validation_mode: { kind: "axis", entries: ["strict", "warn", "off"], capacity: 32 }, verdict_result: { kind: "axis", entries: ["pass", "fail", "warn", "degraded", "unknown", "skipped"], capacity: 32 }, temporal_strategy: { kind: "axis", entries: ["span_local", "global"], capacity: 32 } } },
  data_policy: { version: "v1", labels: ["svc_ref", "mask_mode"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, mask_mode: { kind: "axis", entries: ["raw", "mask", "drop", "hash"], capacity: 32 } } },
  deploy_event: { version: "v1", labels: ["svc_ref", "deploy_action"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 32768, 32800, 32832, 32864, 32896, 65536, 65568, 65600, 65632, 65664] }, deploy_action: { kind: "axis", entries: ["deploy", "rollback", "scale_up", "scale_down", "restart", "canary_start", "canary_promote"], capacity: 32 } } },
  health_event: { version: "v1", labels: ["svc_ref", "health_status"], dims: { svc_ref: { kind: "prefix_ref", values: [0, 32, 64, 96, 128, 32768, 32800, 32832, 32864, 32896, 65536, 65568, 65600, 65632, 65664] }, health_status: { kind: "axis", entries: ["healthy", "degraded", "unhealthy", "maintenance"], capacity: 32 } } },
  cart_event: { version: "v1", labels: ["action"], dims: { action: { kind: "axis", entries: ["add", "remove", "checkout"], capacity: 32 } } },
  auth_event: { version: "v1", labels: ["action"], dims: { action: { kind: "axis", entries: ["login", "logout", "token_refresh"], capacity: 32 } } },
  order_event: { version: "v1", labels: ["service_ctx", "action"], dims: { service_ctx: { kind: "prefix_ref", values: [65536, 65568, 65600, 65632, 65664] }, action: { kind: "axis", entries: ["create", "cancel", "refund", "complete"], capacity: 32 } } },
  build_event: { version: "v2", labels: ["qa_pkg", "qa_module", "build_result"], dims: { qa_pkg: { kind: "axis", entries: ["spec-core", "cli", "sdk", "demo-snapshot", "weighted-index", "bit-index", "permission-engine", "index-meta", "platform-demo", "ingest-server", "registry-service", "e2e"], capacity: 32 }, qa_module: { kind: "axis", entries: ["shared", "schema", "export-surface", "spec", "loader", "codegen", "dkg", "dkg-skills", "convergence", "propagation", "store", "visualization", "shopping-flow", "event-pipeline", "iframe-integration", "scenario-selector", "shop-ingest-integration", "anonymous-browse", "cart-abandon", "multi-product-purchase", "_all"], capacity: 32 }, build_result: { kind: "axis", entries: ["success", "failure", "type-error", "skipped"], capacity: 8 } } },
  test_event: { version: "v2", labels: ["qa_pkg", "qa_module", "test_result"], dims: { qa_pkg: { kind: "axis", entries: ["spec-core", "cli", "sdk", "demo-snapshot", "weighted-index", "bit-index", "permission-engine", "index-meta", "platform-demo", "ingest-server", "registry-service", "e2e"], capacity: 32 }, qa_module: { kind: "axis", entries: ["shared", "schema", "export-surface", "spec", "loader", "codegen", "dkg", "dkg-skills", "convergence", "propagation", "store", "visualization", "shopping-flow", "event-pipeline", "iframe-integration", "scenario-selector", "shop-ingest-integration", "anonymous-browse", "cart-abandon", "multi-product-purchase", "_all"], capacity: 32 }, test_result: { kind: "axis", entries: ["passed", "failed", "error", "skipped", "timeout"], capacity: 8 } } },
  dkg_event: { version: "v1", labels: ["dkg_op", "dkg_target_kind"], dims: { dkg_op: { kind: "axis", entries: ["claim", "release", "decide", "observe", "resolve", "link", "refresh", "self-check", "converge", "trace", "promote"], capacity: 16 }, dkg_target_kind: { kind: "axis", entries: ["axis", "prefix", "domain", "dsl-bundle", "decision", "observation", "constraint", "skill", "intent-link", "system"], capacity: 16 } } },
  dkg_decision_event: { version: "v1", labels: ["decision_type", "dkg_target_kind", "node_source"], dims: { decision_type: { kind: "axis", entries: ["capacity", "new-axis", "new-prefix", "dim-add", "merge", "deprecate", "separation"], capacity: 16 }, dkg_target_kind: { kind: "axis", entries: ["axis", "prefix", "domain", "dsl-bundle", "decision", "observation", "constraint", "skill", "intent-link", "system"], capacity: 16 }, node_source: { kind: "axis", entries: ["bootstrap", "manual", "auto"], capacity: 8 } } },
  dkg_observation_event: { version: "v1", labels: ["obs_source", "dkg_target_kind", "lifecycle_state"], dims: { obs_source: { kind: "axis", entries: ["manual", "metric", "runtime", "review"], capacity: 8 }, dkg_target_kind: { kind: "axis", entries: ["axis", "prefix", "domain", "dsl-bundle", "decision", "observation", "constraint", "skill", "intent-link", "system"], capacity: 16 }, lifecycle_state: { kind: "axis", entries: ["draft", "active", "deprecated", "archived", "superseded", "reversed"], capacity: 16 } } },
  skill_execution: { version: "v1", labels: ["skill_id", "skill_category", "skill_outcome"], dims: { skill_id: { kind: "axis", entries: ["skill-trace", "skill-explore-service", "skill-explore-prefix", "skill-explore-dsl", "skill-system-overview", "skill-record-decision", "skill-record-observation", "skill-claim", "skill-release", "skill-lifecycle-transition", "skill-checkout-flow-verify", "skill-commerce-skew-audit", "skill-observation-coverage", "skill-infra-impact-verify", "skill-pipeline-phase-verify", "skill-event-action-check", "skill-svc-binding-check", "skill-safe-entry-add", "skill-decision-scaffold", "skill-analyze-impact", "skill-infer-migrator", "skill-domain-health", "skill-pattern-analysis", "skill-schema-health-audit", "skill-entry-add-chain", "skill-system-health-chain", "skill-converge-chain", "skill-self-check-analyze", "skill-cli-coverage", "skill-promote-scan", "skill-spec-manage", "skill-registry-publish"], capacity: 64 }, skill_category: { kind: "axis", entries: ["read", "write", "analysis", "chain"], capacity: 8 }, skill_outcome: { kind: "axis", entries: ["ok", "warning", "error", "blocked", "skipped"], capacity: 8 } } },
  cli_event: { version: "v1", labels: ["cli_intent", "cli_domain", "cli_subject"], dims: { cli_intent: { kind: "axis", entries: ["query", "analyze", "mutate", "publish", "lifecycle", "init", "backup"], capacity: 16 }, cli_domain: { kind: "axis", entries: ["dkg-graph", "dkg-skill", "convergence", "spec", "coordinate", "registry", "catalog", "self-ref", "system"], capacity: 16 }, cli_subject: { kind: "axis", entries: ["axis", "prefix", "domain", "dsl-bundle", "decision", "observation", "constraint", "skill", "intent-link", "system", "version", "spec", "schema", "catalog"], capacity: 32 } } },
  contract_check: { version: "v1", labels: ["qa_pkg", "api_surface", "test_result"], dims: { qa_pkg: { kind: "axis", entries: ["spec-core", "cli", "sdk", "demo-snapshot", "weighted-index", "bit-index", "permission-engine", "index-meta", "platform-demo", "ingest-server", "registry-service", "e2e", "core", "engine", "store", "gate-service", "query-service", "decode-service", "registry-server", "registry-client", "apm", "browser-sdk", "event-catalog", "pino", "viz-3d", "viz-web", "demo-tests", "weighted-wasm"], capacity: 64 }, api_surface: { kind: "axis", entries: ["encode-decode", "stride-calc", "bitmask-ops", "dim-extract", "perm-grant", "protocol-codec", "state-lifecycle", "query-resolve", "schema-validate", "convergence-analysis", "dkg-graph", "integration"], capacity: 16 }, test_result: { kind: "axis", entries: ["passed", "failed", "error", "skipped", "timeout"], capacity: 8 } } },
  pattern_match: { version: "v1", labels: ["svc_ref", "identification_mode", "behavior_pattern", "pattern_confidence"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, identification_mode: { kind: "axis", entries: ["anonymous", "identified", "pseudonymized", "service"], capacity: 8 }, behavior_pattern: { kind: "axis", entries: ["purchase_complete", "browse_only", "cart_abandon", "checkout_fail", "error_recovery", "return_visit", "anonymous_browse", "anonymous_cart", "api_integration", "bot_crawl", "health_check", "unclassified"], capacity: 32 }, pattern_confidence: { kind: "axis", entries: ["exact", "high", "medium", "low", "unknown"], capacity: 8 } } },
  pattern_anomaly: { version: "v2", labels: ["svc_ref", "anomaly_kind", "behavior_pattern", "anomaly_severity"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, anomaly_kind: { kind: "axis", entries: ["unclassified", "ratio_shift", "volume_spike", "new_sequence", "abnormal_speed", "abnormal_duration"], capacity: 16 }, behavior_pattern: { kind: "axis", entries: ["purchase_complete", "browse_only", "cart_abandon", "checkout_fail", "error_recovery", "return_visit", "anonymous_browse", "anonymous_cart", "api_integration", "bot_crawl", "health_check", "unclassified"], capacity: 32 }, anomaly_severity: { kind: "axis", entries: ["info", "warning", "critical"], capacity: 8 } } },
  version_point: { version: "v1", labels: ["svc_ref", "version_lifecycle"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, version_lifecycle: { kind: "axis", entries: ["draft", "locked", "released", "active", "deprecated"], capacity: 8 } } },
  gate_point: { version: "v1", labels: ["svc_ref", "address_state"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, address_state: { kind: "axis", entries: ["active", "reserved", "inactive", "open"], capacity: 8 } } },
  observation_event: { version: "v1", labels: ["observation_intent", "dkg_target_kind"], dims: { observation_intent: { kind: "axis", entries: ["action_needed", "monitoring", "completed"], capacity: 8 }, dkg_target_kind: { kind: "axis", entries: ["axis", "prefix", "domain", "dsl-bundle", "decision", "observation", "constraint", "skill", "intent-link", "system"], capacity: 16 } } },
  spec_event: { version: "v1", labels: ["spec_type", "lifecycle_state"], dims: { spec_type: { kind: "axis", entries: ["req", "feat", "uc", "evt", "ls", "adr"], capacity: 16 }, lifecycle_state: { kind: "axis", entries: ["draft", "active", "deprecated", "archived", "superseded", "reversed"], capacity: 16 } } },
  edge_activity: { version: "v1", labels: ["edge_type", "dkg_target_kind"], dims: { edge_type: { kind: "axis", entries: ["satisfies", "implements", "tests", "traces-to", "depends-on", "composes", "references", "governs", "justifies", "constrains", "contains", "bridges", "consumes", "binds", "observes", "prompts", "evolves-from", "supersedes"], capacity: 32 }, dkg_target_kind: { kind: "axis", entries: ["axis", "prefix", "domain", "dsl-bundle", "decision", "observation", "constraint", "skill", "intent-link", "system"], capacity: 16 } } },
  execution_context: { version: "v1", labels: ["svc_ref", "execution_mode"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, execution_mode: { kind: "axis", entries: ["live", "test", "synthetic", "replay"], capacity: 8 } } },
  ingest_record: { version: "v1", labels: ["svc_ref", "record_type"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, record_type: { kind: "axis", entries: ["log", "span", "metric"], capacity: 8 } } },
  event_classification: { version: "v1", labels: ["svc_ref", "event_category", "event_lifecycle_stage"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, event_category: { kind: "axis", entries: ["user_action", "system_action", "network_action", "data_action", "agent_action", "sdk_action", "error", "state_change"], capacity: 16 }, event_lifecycle_stage: { kind: "axis", entries: ["interaction", "request", "processing", "result", "side_effect", "completion"], capacity: 16 } } },
  metric_point: { version: "v1", labels: ["svc_ref", "metric_type", "record_type"], dims: { svc_ref: { kind: "prefix_ref", values: [65536, 65537, 65568, 65569, 65600, 65601, 65632, 65633, 65664, 65665] }, metric_type: { kind: "axis", entries: ["counter", "gauge", "histogram", "summary"], capacity: 8 }, record_type: { kind: "axis", entries: ["log", "span", "metric"], capacity: 8 } } }
};
async function at(i) {
  const e = (i == null ? void 0 : i.cacheKey) ?? "qa-sdk-catalog", t = (i == null ? void 0 : i.cacheTtlMs) ?? 300 * 1e3, s = (i == null ? void 0 : i.timeoutMs) ?? 5e3;
  if (i != null && i.registryUrl)
    try {
      const r = await oe(i.registryUrl, s);
      if (r && Object.keys(r).length > 0)
        return le(e, r), {
          catalog: r,
          source: "api",
          prefixCount: Object.keys(r).length,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
    } catch {
    }
  const n = de(e, t);
  return n ? {
    catalog: n,
    source: "cache",
    prefixCount: Object.keys(n).length,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  } : {
    catalog: A,
    source: "static",
    prefixCount: Object.keys(A).length,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function oe(i, e) {
  const t = new AbortController(), s = setTimeout(() => t.abort(), e);
  try {
    const n = await fetch(`${i}/resolve/active`, { signal: t.signal });
    if (clearTimeout(s), !n.ok)
      return null;
    const r = await n.json();
    return ce(r);
  } catch {
    return clearTimeout(s), null;
  }
}
function ce(i) {
  var t;
  const e = {};
  for (const [s, n] of Object.entries(i)) {
    if (!n || typeof n != "object")
      continue;
    const r = n.version ?? n.activeVersion ?? "v1", a = n.labels ?? n.dims ? Object.keys(n.dims) : [], c = {};
    if (n.dims)
      for (const [f, o] of Object.entries(n.dims))
        o.kind === "axis" || o.entries ? c[f] = {
          kind: "axis",
          entries: o.entries ?? [],
          capacity: o.capacity ?? ((t = o.entries) == null ? void 0 : t.length) ?? 32
        } : (o.kind === "prefix_ref" || o.values) && (c[f] = {
          kind: "prefix_ref",
          values: o.values ?? []
        });
    (a.length > 0 || Object.keys(c).length > 0) && (e[s] = { version: r, labels: a, dims: c });
  }
  return e;
}
function le(i, e) {
  try {
    const t = { catalog: e, savedAt: Date.now() };
    localStorage.setItem(i, JSON.stringify(t));
  } catch {
  }
}
function de(i, e) {
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
class ot {
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
    const n = /* @__PURE__ */ new Date(), r = String(n.getHours()).padStart(2, "0") + ":" + String(n.getMinutes()).padStart(2, "0") + ":" + String(n.getSeconds()).padStart(2, "0") + "." + String(n.getMilliseconds()).padStart(3, "0");
    this._entries.push({ prefixId: e, valuesStr: t, role: s, ts: r }), this._entries.length > this._max && this._entries.shift(), this.render();
  }
  /**
   * 컨텍스트 맵을 받아 각 prefix를 decode → 타임라인에 추가.
   * monitor.html의 feedTimeline() 과 동일한 동작.
   */
  feed(e, t, s) {
    for (const [n, r] of Object.entries(e)) {
      const a = s(n), c = t(r), f = c ? Object.entries(c.values).map(([o, m]) => `${o}=${m}`).join(" ") : r;
      this.add(n, f, a);
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
      const r = this._roleColors[n.role] || "#556";
      return `<div class="ft-entry ${this._roleFilter && this._roleFilter !== n.role ? "ft-fading" : ""}"><span class="ft-role-dot" style="background:${r}"></span><div class="ft-body"><div class="ft-prefix" style="color:${r}">${n.prefixId}</div><div class="ft-values">${n.valuesStr}</div><div class="ft-role-tag" style="color:${r}">${n.role}</div></div><div class="ft-time">${n.ts}</div></div>`;
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
class ct {
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
class lt {
  constructor(e) {
    x(this, "lines", []);
    x(this, "index", 0);
    this.options = e;
    for (let t = 0; t < e.maxBeams; t++) {
      const s = new M.BufferGeometry();
      s.setAttribute("position", new M.BufferAttribute(new Float32Array(6), 3));
      const n = new M.LineBasicMaterial({
        color: e.defaultColor,
        transparent: !0,
        opacity: 0
      });
      e.scene.add(new M.Line(s, n)), this.lines.push({ geo: s, mat: n, life: 0, pinned: !1 });
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
  /** 매 프레임 호출 — transient beam fade 처리 */
  update(e) {
    for (const t of this.lines)
      t.pinned || t.life > 0 && (t.life -= e * 0.5, t.mat.opacity = Math.max(0, Math.min(t.life * 0.2, 0.6)));
  }
  setPositions(e, t, s) {
    const n = e.geo.attributes.position.array;
    n[0] = t.x, n[1] = t.y, n[2] = t.z, n[3] = s.x, n[4] = s.y, n[5] = s.z, e.geo.attributes.position.needsUpdate = !0;
  }
}
const P = new M.Color(), K = new M.Color(), L = new M.Color();
function dt(i, e) {
  const { elapsedTime: t, dt: s, glowMul: n, activeSet: r, cellRoleColor: a, roleFilter: c, getRoleFn: f } = e, o = e.glowDecay ?? 0.6;
  for (const m of i) {
    let h = !1;
    P.setHex(m.cc.main.hex);
    for (let p = 0; p < m.count; p++) {
      const l = m.idxToKey[p];
      m.glows[p] > 0 && (m.glows[p] = Math.max(0, m.glows[p] - s * o));
      const g = r.has(l) ? 0.4 + Math.sin(t * 5) * 0.2 : 0, k = Math.max(m.glows[p], g);
      if (k > 0.01) {
        const u = a.get(l), d = f(l), y = c != null && c !== d;
        u && !y ? K.setHex(u) : K.setHex(m.cc.emissive.hex);
        const v = Math.min(y ? k * n * 0.2 : k * n, 1);
        L.copy(P).lerp(K, v), m.iMesh.setColorAt(p, L), h = !0;
      } else
        m.iMesh.setColorAt(p, P), h = !0;
    }
    m.mat.opacity = e.baseOpacity, m.mat.emissiveIntensity = 0.1, h && m.iMesh.instanceColor && (m.iMesh.instanceColor.needsUpdate = !0);
  }
}
function pt() {
  return `tx_${crypto.randomUUID()}`;
}
function ft() {
  return `log_${crypto.randomUUID()}`;
}
function ht() {
  return `trc_${crypto.randomUUID().slice(0, 12)}`;
}
function ut() {
  return `spn_${crypto.randomUUID().slice(0, 8)}`;
}
function mt() {
  return `ses_${crypto.randomUUID().slice(0, 8)}`;
}
export {
  Xe as ActivationProcessor,
  A as BROWSER_CATALOG,
  Ue as BeamPool,
  B as CATEGORY_COLORS,
  Be as CellStateManager,
  Q as DEFAULT_LOD,
  fe as DEFAULT_THEME,
  Ce as DEMO_PREFIX_META,
  He as DEMO_SERVICES,
  Oe as DEMO_SIGNALS,
  ct as DemoRunner,
  qe as ENV_FILTERS,
  Ze as FlowHistory,
  ot as FlowTimeline,
  X as LAYER_COLORS,
  it as MonitorAdapter,
  E as PALETTE,
  T as PRESET_AXES,
  je as PRESET_VIEWS,
  Qe as PerfMonitor,
  U as ROLE_COLORS,
  Se as SIGNAL_ROLE_COLORS,
  Ee as SIGNAL_ROLE_LABELS,
  Ye as STACK_CHECKOUT,
  Ge as STACK_INFRA,
  Le as TIER_NAMES,
  lt as ThreeBeamRenderer,
  Ae as ViewEngine,
  Ne as applyFilters,
  tt as buildCategoryLegend,
  he as buildGridPositions,
  et as buildRoleLegend,
  Ve as buildServiceContainers,
  ze as classifyByRole,
  Fe as computeAllStacks,
  Pe as computeCrossViewLayout,
  We as computeGroupLod,
  ee as computeLodLevel,
  we as computePatternLayout,
  De as computeScopeLayouts,
  J as computeStackLayout,
  ue as computeStackPositions,
  ye as cube,
  ie as decode,
  nt as decodeContext,
  st as defaultKeyMapper,
  te as encode,
  Te as extractAxes,
  Ie as extractDims,
  Re as formatDetail,
  me as generateCssVariables,
  Je as getLodVisibility,
  G as getPrefixRole,
  ve as grid,
  $e as inferPattern,
  F as inferRole,
  at as loadCatalog,
  Ke as matchEventToCells,
  be as nested,
  ft as newLogId,
  mt as newSessionId,
  ut as newSpanId,
  ht as newTraceId,
  pt as newTransmissionId,
  _e as row,
  ge as scalar,
  ke as shelf,
  xe as spine,
  se as track,
  rt as trackWithSignal,
  dt as updateInstancedColors,
  Me as validateSignal
};
