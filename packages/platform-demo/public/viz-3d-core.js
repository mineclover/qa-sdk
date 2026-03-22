var L = Object.defineProperty;
var N = (t, e, i) => e in t ? L(t, e, { enumerable: !0, configurable: !0, writable: !0, value: i }) : t[e] = i;
var z = (t, e, i) => N(t, typeof e != "symbol" ? e + "" : e, i);
const re = {
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
function oe(t, e, i, s) {
  var c, p;
  const n = [], a = /* @__PURE__ */ new Map();
  for (const o of t) {
    const _ = [], f = i + s;
    if (o.axes3d) {
      const u = o.axes3d.x.entries, l = ((c = o.axes3d.y) == null ? void 0 : c.entries) ?? ["_"], x = ((p = o.axes3d.z) == null ? void 0 : p.entries) ?? ["_"], m = u.length, b = l.length, h = x.length;
      for (let d = 0; d < m; d++)
        for (let y = 0; y < b; y++)
          for (let v = 0; v < h; v++) {
            const k = -(m - 1) * f / 2 + d * f, w = y * f, $ = -(h - 1) * f / 2 + v * f, O = b > 1 || h > 1 ? [u[d], l[y] !== "_" ? l[y] : null, x[v] !== "_" ? x[v] : null].filter(Boolean).join("/") : u[d], M = `${o.id}/${O}`;
            _.push({ key: M, gridId: o.id, entry: O, localX: k, localY: w, localZ: $, col: d, row: y, depth: v }), a.set(M, { gridId: o.id, entry: O, localX: k, localY: w, localZ: $, layer: o.layer, category: o.category });
          }
      n.push({
        id: o.id,
        category: o.category,
        layer: o.layer,
        cells: _,
        width: m * f,
        height: b * f,
        depth: h * f,
        cols: m,
        rows: b,
        depths: h,
        is3d: b > 1
      });
    } else {
      const u = Math.ceil(o.entries.length / o.cols);
      for (let l = 0; l < o.entries.length; l++) {
        const x = l % o.cols, m = Math.floor(l / o.cols), b = -(o.cols - 1) * f / 2 + x * f, h = -(u - 1) * f / 2 + m * f, d = `${o.id}/${o.entries[l]}`;
        _.push({ key: d, gridId: o.id, entry: o.entries[l], localX: b, localY: 0, localZ: h, col: x, row: m, depth: 0 }), a.set(d, { gridId: o.id, entry: o.entries[l], localX: b, localY: 0, localZ: h, layer: o.layer, category: o.category });
      }
      n.push({
        id: o.id,
        category: o.category,
        layer: o.layer,
        cells: _,
        width: o.cols * f,
        height: f,
        depth: u * f,
        cols: o.cols,
        rows: u,
        depths: 1,
        is3d: !1
      });
    }
  }
  const r = A(t, e, i, s);
  return { grids: n, viewPositions: r, cellMap: a };
}
function A(t, e, i = 0.42, s = 0.1) {
  var l, x, m, b;
  const n = {
    layer: {},
    category: {},
    dsl: {},
    service: {}
  }, a = /* @__PURE__ */ new Map();
  for (const h of t) {
    const d = i + s;
    if (h.axes3d)
      a.set(h.id, { w: h.axes3d.x.entries.length * d, d: (((l = h.axes3d.z) == null ? void 0 : l.entries.length) ?? 1) * d });
    else {
      const y = Math.ceil(h.entries.length / h.cols);
      a.set(h.id, { w: h.cols * d, d: y * d });
    }
  }
  const r = e.map(() => []);
  for (const h of t) (x = r[h.layer]) == null || x.push(h);
  const c = i * 2;
  for (let h = 0; h < r.length; h++) {
    const d = r[h], y = Math.min(d.length, 4);
    for (let v = 0; v < d.length; v++) {
      const k = Math.floor(v / y), w = d.filter((I, C) => Math.floor(C / y) === k);
      let O = -w.reduce((I, C) => {
        var K;
        return I + (((K = a.get(C.id)) == null ? void 0 : K.w) ?? 2) + c;
      }, -c) / 2;
      const M = v - k * y;
      for (let I = 0; I < M; I++)
        O += (((m = a.get(w[I].id)) == null ? void 0 : m.w) ?? 2) + c;
      const P = ((b = a.get(d[v].id)) == null ? void 0 : b.w) ?? 2;
      O += P / 2;
      const j = Math.max(...w.map((I) => {
        var C;
        return ((C = a.get(I.id)) == null ? void 0 : C.d) ?? 2;
      }));
      n.layer[d[v].id] = {
        x: O,
        y: e[h],
        z: k * -(j + c * 2)
      };
    }
  }
  [...new Set(t.map((h) => h.category))].forEach((h, d) => {
    const y = t.filter((w) => w.category === h), v = d % 3, k = Math.floor(d / 3);
    y.forEach((w, $) => {
      n.category[w.id] = { x: -12 + v * 12, y: 4 - $ * 3.5, z: k * -8 };
    });
  });
  const o = [...new Set(t.map((h) => h.dsl).filter(Boolean))], _ = t.filter((h) => !h.dsl);
  o.forEach((h, d) => {
    const y = t.filter((w) => w.dsl === h), v = d % 4, k = Math.floor(d / 4);
    y.forEach((w, $) => {
      n.dsl[w.id] = { x: -18 + v * 12, y: 4 - $ * 3, z: k * -10 };
    });
  }), _.forEach((h, d) => {
    n.dsl[h.id] = { x: 24, y: 4 - d * 3, z: -12 };
  });
  const f = [...new Set(t.map((h) => h.service).filter(Boolean))], u = t.filter((h) => !h.service);
  return f.forEach((h, d) => {
    t.filter((v) => v.service === h).forEach((v, k) => {
      n.service[v.id] = { x: -16 + d * 8, y: 4 - Math.floor(k / 2) * 3.5, z: k % 2 * -5 };
    });
  }), u.forEach((h, d) => {
    n.service[h.id] = { x: 24, y: 4, z: -d * 5 };
  }), n;
}
function ce(t, e) {
  const i = {};
  for (const s of t)
    s.grids.forEach((n, a) => {
      const r = a * s.gap;
      i[n] = {
        x: s.position.x + (s.axis === "x" ? r : 0),
        y: s.position.y + (s.axis === "y" ? r : 0),
        z: s.position.z + (s.axis === "z" ? r : 0)
      };
    });
  return i;
}
function g(t) {
  const e = t >> 16 & 255, i = t >> 8 & 255, s = t & 255;
  return { hex: t, css: `#${t.toString(16).padStart(6, "0")}`, rgb: `${e},${i},${s}` };
}
const E = {
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
  entity: { main: g(7901340), emissive: g(11583173) },
  state: { main: g(9795021), emissive: g(13747433) },
  table: { main: g(16732754), emissive: g(12986408) }
};
function S(t) {
  return { token: g(t), hex: t };
}
const q = {
  context: S(4906624),
  trigger: S(16436245),
  channel: S(6333946),
  state: S(12616956),
  guard: S(16020150),
  effect: S(16486972),
  data: S(9741240)
}, D = [
  g(6619098),
  // L0 UI — mint
  g(16752451),
  // L1 Business — amber
  g(8150268),
  // L2 Infra — violet
  g(16726112)
  // L3 Data — rose
];
function le() {
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
    ...Object.entries(V).map(([t, e]) => `--cat-${t}:${e.main.css}`),
    // Signal Role
    ...Object.entries(q).map(([t, e]) => `--role-${t}:${e.token.css}`),
    // Layer
    ...D.map((t, e) => `--layer-${e}:${t.css}`)
  ].join(";");
}
function de(t, e) {
  return {
    type: "scalar",
    prefixId: t,
    mappings: [{ axis: e, channel: "color" }],
    description: `${t}.${e} → 단일 값 표시`
  };
}
function pe(t, e) {
  return {
    type: "row",
    prefixId: t,
    mappings: [{ axis: e, channel: "x" }],
    description: `${t}.${e} → 가로 행`
  };
}
function fe(t, e, i) {
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
function he(t, e, i, s) {
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
function ue(t, e, i) {
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
function me(t, e, i, s) {
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
function ge(t, e, i) {
  return {
    type: "nested",
    prefixId: t,
    mappings: [
      { axis: e, channel: "group", subPattern: i }
    ],
    description: `${t}: ${e}별 그룹, 각 그룹 = ${i}`
  };
}
function _e(t, e, i = 0.4, s = 0.08) {
  const n = i + s, a = [], r = t.mappings.find((d) => d.channel === "x"), c = t.mappings.find((d) => d.channel === "y"), p = t.mappings.find((d) => d.channel === "z"), o = t.mappings.find((d) => d.channel === "group"), _ = t.mappings.filter((d) => d.channel === "collapse").map((d) => d.axis), f = r ? e[r.axis] || [] : ["_"], u = c ? e[c.axis] || [] : ["_"], l = p ? e[p.axis] || [] : ["_"], x = o ? e[o.axis] || [] : ["_"];
  switch (t.type) {
    case "scalar":
      a.push({ key: `${t.prefixId}/_`, x: 0, y: 0, z: 0 });
      break;
    case "row":
      f.forEach((d, y) => {
        a.push({ key: `${t.prefixId}/${d}`, x: y * n, y: 0, z: 0 });
      });
      break;
    case "grid":
      f.forEach((d, y) => {
        l.forEach((v, k) => {
          a.push({ key: `${t.prefixId}/${d}_${v}`, x: y * n, y: 0, z: k * n });
        });
      });
      break;
    case "cube":
      f.forEach((d, y) => {
        u.forEach((v, k) => {
          l.forEach((w, $) => {
            a.push({ key: `${t.prefixId}/${d}_${v}_${w}`, x: y * n, y: k * n, z: $ * n });
          });
        });
      });
      break;
    case "spine":
      f.forEach((d, y) => {
        const v = {};
        for (const k of _)
          v[k] = `(${(e[k] || []).length} entries)`;
        a.push({ key: `${t.prefixId}/${d}`, x: y * n, y: 0, z: 0, collapsed: v });
      });
      break;
    case "shelf":
      x.forEach((d, y) => {
        const v = y * (l.length * n + n * 2);
        f.forEach((k, w) => {
          l.forEach(($, O) => {
            a.push({
              key: `${t.prefixId}/${d}_${k}_${$}`,
              x: w * n,
              y: v,
              z: O * n,
              group: d
            });
          });
        });
      });
      break;
    case "nested":
      x.forEach((d, y) => {
        const v = y * (f.length * n + n * 2);
        f.forEach((k, w) => {
          a.push({
            key: `${t.prefixId}/${d}/${k}`,
            x: v + w * n,
            y: 0,
            z: 0,
            group: d
          });
        });
      });
      break;
  }
  const m = a.map((d) => d.x), b = a.map((d) => d.y), h = a.map((d) => d.z);
  return {
    pattern: t,
    cells: a,
    bounds: {
      width: a.length > 0 ? Math.max(...m) - Math.min(...m) + i : 0,
      height: a.length > 0 ? Math.max(...b) - Math.min(...b) + i : 0,
      depth: a.length > 0 ? Math.max(...h) - Math.min(...h) + i : 0
    }
  };
}
function H(t, e) {
  if (e === "prefix_ref" || e === "table_ref") return "context";
  const i = t.toLowerCase();
  return i.includes("step") || i.includes("phase") || i.includes("stage") ? "sequence" : i.includes("variant") || i.includes("version") || i.includes("mode") ? "variant" : i.endsWith("_name") || i === "flow_name" || i === "event_name" || i.endsWith("_type") || i === "resource_type" ? "classify" : (i.includes("action") || i.includes("method") || i.includes("op") || i === "role" || i === "resource", "identity");
}
function ve(t, e) {
  const i = typeof e[0] == "string" ? e.map((l) => ({ label: l, kind: "axis" })) : e, s = i.filter((l) => l.kind === "axis"), n = i.filter((l) => l.kind === "prefix_ref"), a = i.filter((l) => l.kind === "table_ref"), r = s.map((l) => ({ ...l, role: H(l.label, l.kind) })), c = r.filter((l) => l.role === "classify"), p = r.filter((l) => l.role === "sequence"), o = r.filter((l) => l.role === "variant"), _ = r.filter((l) => l.role === "identity"), f = [];
  for (const l of n)
    f.push({ axis: l.label, channel: "collapse", role: "context", dimKind: "prefix_ref" });
  for (const l of a)
    f.push({ axis: l.label, channel: "link", role: "context", dimKind: "table_ref" });
  if (c.length > 0) {
    const l = c[0], x = r.filter((h) => h !== l);
    if (x.length === 0)
      return f.push({ axis: l.label, channel: "x", role: "classify" }), { type: "row", prefixId: t, mappings: f, description: `${t}: ${l.label}(x) → 행` };
    if (x.length === 1)
      return f.push({ axis: l.label, channel: "group", role: "classify", subPattern: "row" }), f.push({ axis: x[0].label, channel: "x", role: x[0].role }), { type: "shelf", prefixId: t, mappings: f, description: `${t}: ${l.label}별 선반, ${x[0].label}(x)` };
    f.push({ axis: l.label, channel: "group", role: "classify", subPattern: "grid" });
    const m = p[0] || x[0], b = o[0] || x.find((h) => h !== m) || x[1];
    return m && f.push({ axis: m.label, channel: "x", role: m.role }), b && b !== m && f.push({ axis: b.label, channel: "z", role: b.role }), { type: "shelf", prefixId: t, mappings: f, description: `${t}: ${l.label}별 선반, ${m == null ? void 0 : m.label}(x) × ${b == null ? void 0 : b.label}(z)` };
  }
  const u = [...p, ..._, ...o];
  return u.length === 0 ? { type: "scalar", prefixId: t, mappings: [{ axis: "_", channel: "color" }], description: `${t}: scalar` } : u.length === 1 ? (f.push({ axis: u[0].label, channel: "x", role: u[0].role }), { type: "row", prefixId: t, mappings: f, description: `${t}: ${u[0].label}(x)` }) : u.length === 2 ? (f.push({ axis: u[0].label, channel: "x", role: u[0].role }), f.push({ axis: u[1].label, channel: "z", role: u[1].role }), { type: "grid", prefixId: t, mappings: f, description: `${t}: ${u[0].label}(x) × ${u[1].label}(z)` }) : (f.push({ axis: u[0].label, channel: "x", role: u[0].role }), f.push({ axis: u[1].label, channel: "y", role: u[1].role }), f.push({ axis: u[2].label, channel: "z", role: u[2].role }), { type: "cube", prefixId: t, mappings: f, description: `${t}: ${u[0].label}(x) × ${u[1].label}(y) × ${u[2].label}(z)` });
}
function ye(t) {
  return Object.entries(t).map(([e, i]) => ({
    label: e,
    kind: i.kind
  }));
}
function xe(t) {
  return Object.entries(t).filter(([, e]) => e.kind === "axis").map(([e]) => e);
}
const ke = {
  context: "어디서",
  trigger: "뭘 했는가",
  channel: "어떤 경로",
  state: "흐름 어디",
  guard: "어떤 조건",
  effect: "결과",
  data: "데이터 접점"
}, be = {
  context: "#546e7a",
  trigger: "#ff9100",
  channel: "#00e5ff",
  state: "#b388ff",
  guard: "#00e676",
  effect: "#ff5252",
  data: "#fd79a8"
}, B = {
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
function X(t) {
  return B[t] ?? "trigger";
}
function Y(t) {
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
    const n = X(i);
    e[n].push({ prefixId: i, serialized: s });
  }
  return e;
}
const we = [
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
function $e(t, e) {
  const i = new Set(Object.keys(e)), s = new Set(t.members.map((c) => c.prefixId));
  let n = 0;
  const a = /* @__PURE__ */ new Set();
  for (const c of t.members)
    i.has(c.prefixId) ? n++ : a.add(c.role);
  const r = [...i].filter((c) => !s.has(c) && c !== "service");
  return {
    signalId: t.id,
    valid: n === t.members.length,
    missingRoles: [...a],
    extraPrefixes: r,
    matchedMembers: n,
    totalMembers: t.members.length
  };
}
const ze = {
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
function Te(t, e) {
  var s, n;
  const i = [];
  if (i.push(`<div style="font-size:11px;font-weight:600;color:#e0e4ec">${t.displayName}</div>`), i.push(`<div style="font-size:9px;color:#556;margin:3px 0">${t.description}</div>`), t.source) {
    const a = t.source, r = [];
    a.module && r.push(a.module), a.file && r.push(a.file), a.line && r.push(`L${a.line}`), i.push(`<div style="font-size:8px;color:#334;margin-top:4px">📁 ${r.join(" / ")}</div>`), a.url && i.push(`<div style="font-size:8px"><a href="${a.url}" target="_blank" style="color:#64ffda">📎 docs</a></div>`);
  }
  switch (t.detailKind) {
    case "schema": {
      const a = t.detail;
      if (a != null && a.columns) {
        i.push('<div style="margin-top:6px;font-size:8px;color:#445;letter-spacing:1px">SCHEMA</div>');
        for (const r of a.columns) {
          const c = r.refKind !== "scalar" ? ` <span style="color:${r.refKind === "axis_ref" ? "#00e676" : r.refKind === "table_ref" ? "#ff5252" : "#00e5ff"}">→${r.refTarget}</span>` : "", p = e && r.name === e ? "color:var(--mint);font-weight:600" : "color:#667";
          i.push(`<div style="font-size:9px;${p}">${r.name} <span style="color:#334">${r.type}</span>${c}</div>`);
        }
      }
      break;
    }
    case "event-def": {
      const a = t.detail;
      if (a && (i.push('<div style="margin-top:6px;font-size:8px;color:#445;letter-spacing:1px">EVENT STRUCTURE</div>'), i.push(`<div style="font-size:9px;color:#ff9100">${a.structure}</div>`), a.slots))
        for (const r of a.slots) {
          const c = r.kind === "table_ref" ? "#ff5252" : r.kind === "prefix_ref" ? "#00e5ff" : "#00e676";
          i.push(`<div style="font-size:9px;color:#667">${r.name} <span style="color:${c}">${r.kind}→${r.target}</span></div>`);
        }
      break;
    }
    case "permission":
      i.push('<div style="margin-top:6px;font-size:8px;color:#445;letter-spacing:1px">PERMISSION</div>'), i.push(`<div style="font-size:9px;color:#00e676">${((s = t.detail) == null ? void 0 : s.matrix) || "role-based grant/deny"}</div>`);
      break;
    case "endpoint": {
      const a = (n = t.detail) == null ? void 0 : n.routes;
      if (a) {
        i.push('<div style="margin-top:6px;font-size:8px;color:#445;letter-spacing:1px">ROUTES</div>');
        for (const r of a)
          i.push(`<div style="font-size:9px;color:#667"><span style="color:#00e5ff">${r.method}</span> ${r.path}</div>`);
      }
      break;
    }
  }
  return i.join("");
}
function Ee(t, e = 0.42, i = 0.1) {
  const s = e + i, n = t.channels.find((m) => m.channel === "x"), a = t.channels.find((m) => m.channel === "y"), r = t.channels.find((m) => m.channel === "z"), c = t.channels.find((m) => m.channel === "group"), p = t.channels.find((m) => m.channel === "color"), o = (m) => {
    var h;
    return m ? ((h = t.filters) == null ? void 0 : h[m.id]) ?? m.entries : ["_"];
  }, _ = o(n == null ? void 0 : n.axis), f = o(a == null ? void 0 : a.axis), u = o(r == null ? void 0 : r.axis), l = o(c == null ? void 0 : c.axis), x = [];
  for (const m of l) {
    const b = l.indexOf(m) * (_.length * s + s * 3);
    for (const h of _)
      for (const d of f)
        for (const y of u) {
          const v = _.indexOf(h), k = f.indexOf(d), w = u.indexOf(y), $ = {};
          n && ($[n.axis.id] = h), a && ($[a.axis.id] = d), r && ($[r.axis.id] = y), c && m !== "_" && ($[c.axis.id] = m);
          const M = Object.values($).join(":");
          x.push({
            coords: $,
            key: M,
            x: b + v * s,
            y: k * s,
            z: w * s,
            group: m !== "_" ? m : void 0,
            colorValue: p ? $[p.axis.id] : void 0
          });
        }
  }
  return {
    def: t,
    cells: x,
    xEntries: _,
    yEntries: f,
    zEntries: u,
    groups: l.filter((m) => m !== "_"),
    totalCells: x.length,
    bounds: {
      width: (l.length > 1 ? l.length : 1) * _.length * s,
      height: f.length * s,
      depth: u.length * s
    }
  };
}
function Oe(t, e) {
  const i = [];
  for (const s of e.cells) {
    let n = !0;
    for (const [a, r] of Object.entries(s.coords))
      if (t[a] !== r) {
        n = !1;
        break;
      }
    n && i.push(s.key);
  }
  return i;
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
}, Ie = [
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
class Se {
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
        const a = this.targets.get(s);
        a && (a.targetX = n.x, a.targetY = n.y, a.targetZ = n.z);
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
const Me = {
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
function G(t) {
  return Z[t] ?? 2;
}
function Ce(t, e, i) {
  return t.map((s) => {
    const n = [.../* @__PURE__ */ new Set([...s.ownedPrefixes, ...s.consumedPrefixes])], a = { 0: [], 1: [], 2: [], 3: [] };
    for (const c of n) {
      const p = e.get(c);
      if (!p) continue;
      const o = G(c);
      a[o].push({
        prefixId: c,
        tier: o,
        entries: p.entries,
        pattern: p.pattern,
        category: p.category
      });
    }
    const r = [];
    if (i)
      for (const c of s.tables) {
        const p = i[c];
        p && r.push(...p);
      }
    return {
      serviceId: s.id,
      serviceName: s.name,
      tiers: a,
      dataEntries: r
    };
  });
}
function Ke(t, e, i) {
  const s = i.find((n) => n.axisId === e);
  return s ? s.mode === "show" ? t.filter((n) => s.values.includes(n)) : t.filter((n) => !s.values.includes(n)) : [...t];
}
function Re(t, e) {
  const i = (e == null ? void 0 : e.containerGap) ?? 12, s = (e == null ? void 0 : e.tierGap) ?? 3;
  return t.map((n, a) => {
    const c = (Object.values(n.tiers).filter((_) => _.length > 0).length + (n.dataEntries.length > 0 ? 1 : 0)) * s, p = Math.max(1, ...Object.values(n.tiers).flatMap((_) => _.map((f) => f.entries.length))), o = Math.max(4, Math.ceil(Math.sqrt(p)) * 1.5);
    return {
      serviceId: n.serviceId,
      position: { x: a * i - (t.length - 1) * i / 2, y: 0, z: 0 },
      size: { width: o, height: c, depth: o },
      tierOffsets: { 0: s * 1.5, 1: s * 0.5, 2: -s * 0.5, 3: -s * 1.5 }
    };
  });
}
const Pe = [
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
], je = {
  prodOnly: { axisId: "env", mode: "show", values: ["prod"] },
  devOnly: { axisId: "env", mode: "show", values: ["dev"] },
  hideTest: { axisId: "env", mode: "hide", values: ["test", "local"] },
  all: { axisId: "env", mode: "show", values: ["dev", "stage", "prod", "test", "local"] }
};
class Le {
  constructor(e) {
    z(this, "states", /* @__PURE__ */ new Map());
    z(this, "_activeSet", /* @__PURE__ */ new Set());
    z(this, "_layerHits");
    z(this, "_totalHits", 0);
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
      const a = i(n);
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
function W(t, e) {
  const i = new Map(e.map((c) => [c.id, c])), s = {};
  let n = 0, a = 0;
  t.grids.forEach((c, p) => {
    const o = i.get(c);
    o && (n = Math.max(n, o.width), a = Math.max(a, o.depth));
    const _ = p * t.gap;
    s[c] = {
      x: t.position.x + (t.axis === "x" ? _ : 0),
      y: t.position.y + (t.axis === "y" ? _ : 0),
      z: t.position.z + (t.axis === "z" ? _ : 0)
    };
  });
  const r = t.grids.length * t.gap;
  return {
    stackId: t.id,
    axis: t.axis,
    gridPositions: s,
    bounds: {
      width: t.axis === "x" ? r : n,
      height: t.axis === "y" ? r : 1,
      depth: t.axis === "z" ? r : a
    }
  };
}
function Ve(t, e) {
  const i = [], s = {};
  for (const n of t) {
    const a = W(n, e);
    i.push(a), Object.assign(s, a.gridPositions);
  }
  for (const n of e)
    n.id in s || (s[n.id] = { x: 30, y: 0, z: 0 });
  return { layouts: i, viewPositions: s };
}
const qe = {
  id: "stack-checkout",
  grids: ["page_view", "endpoint", "flow_point", "permission", "order_event", "orders"],
  axis: "y",
  gap: 3,
  position: { x: 0, y: -4, z: 0 }
}, De = {
  id: "stack-infra",
  grids: ["service", "deploy_event", "health_event", "pipeline_point", "data_policy"],
  axis: "y",
  gap: 3,
  position: { x: 12, y: -4, z: 0 }
};
class He {
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
const U = {
  near: 15,
  mid: 35
};
function F(t, e = U) {
  return t <= e.near ? "near" : t <= e.mid ? "mid" : "far";
}
function Be(t, e, i) {
  const s = /* @__PURE__ */ new Map();
  for (const [n, a] of e) {
    const r = t.x - a.x, c = t.y - a.y, p = t.z - a.z, o = Math.sqrt(r * r + c * c + p * p);
    s.set(n, F(o, i));
  }
  return s;
}
function Xe(t) {
  switch (t) {
    case "near":
      return { showLabels: !0, showEdges: !0, showHitCounts: !0, cellOpacityMultiplier: 1 };
    case "mid":
      return { showLabels: !0, showEdges: !1, showHitCounts: !1, cellOpacityMultiplier: 0.9 };
    case "far":
      return { showLabels: !1, showEdges: !1, showHitCounts: !1, cellOpacityMultiplier: 0.7 };
  }
}
class Ye {
  constructor() {
    z(this, "frames", 0);
    z(this, "lastTime", performance.now());
    z(this, "_fps", 0);
    z(this, "_frameTime", 0);
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
function Ze(t, e, i) {
  t.innerHTML = "";
  for (const [s, n] of Object.entries(e)) {
    const a = document.createElement("span");
    a.className = "sl-role sl-active", a.dataset.role = s, a.innerHTML = `<span class="sl-dot" style="background:${n.token.css}"></span>${s}`, i && a.addEventListener("click", () => i(s, a)), t.appendChild(a);
  }
}
function Ge(t, e) {
  t.innerHTML = "";
  for (const [i, s] of Object.entries(e)) {
    const n = document.createElement("span");
    n.style.cssText = `font-size:8px;color:${s.main.css};padding:2px 5px;border:1px solid ${s.main.css}33;border-radius:3px`, n.textContent = i, t.appendChild(n);
  }
}
class We {
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
    var i, s, n, a;
    (s = (i = this.config).onConnectionChange) == null || s.call(i, "connecting");
    try {
      this.ws = new WebSocket(e), this.ws.onopen = () => {
        var r, c;
        this._connected = !0, (c = (r = this.config).onConnectionChange) == null || c.call(r, "connected"), this.ws.send(JSON.stringify({ type: "subscribe", scenarioId: "*" }));
      }, this.ws.onmessage = (r) => {
        var c, p;
        try {
          const o = JSON.parse(r.data);
          o.type === "record" && o.data ? this.handleRecord(o.data) : o.type === "subscribed" && ((p = (c = this.config).onConnectionChange) == null || p.call(c, "subscribed"));
        } catch {
        }
      }, this.ws.onerror = () => {
        var r, c;
        (c = (r = this.config).onConnectionChange) == null || c.call(r, "error");
      }, this.ws.onclose = () => {
        var r, c;
        this._connected = !1, (c = (r = this.config).onConnectionChange) == null || c.call(r, "disconnected");
      };
    } catch {
      (a = (n = this.config).onConnectionChange) == null || a.call(n, "failed");
    }
  }
  disconnect() {
    var e, i;
    this.ws && (this.ws.close(), this.ws = null), this._connected = !1, (i = (e = this.config).onConnectionChange) == null || i.call(e, "disconnected");
  }
  /** HTTP로 이벤트 전송 (DEMO용) */
  async sendToIngest(e, i, s, n, a) {
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
      const a = this.config.decode(n);
      if (!a) continue;
      const r = this.config.mapToKeys(a.prefix, a.values);
      s.push(...r);
    }
    s.length > 0 && this.config.onActivation(s, i);
  }
}
function Ue(t, e) {
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
function J(t, e, i) {
  const s = t[e];
  if (!s) return null;
  const n = [], a = [];
  for (const p of s.labels) {
    const o = s.dims[p];
    if (!o) return null;
    if (o.kind === "axis") {
      n.push(o.capacity ?? o.entries.length);
      const _ = o.entries.indexOf(i[p]);
      if (_ < 0) return null;
      a.push(_);
    } else {
      const _ = o.values;
      n.push(_.length);
      const f = i[p] ?? _[0], u = _.indexOf(f);
      a.push(u < 0 ? 0 : u);
    }
  }
  const r = new Array(n.length);
  r[n.length - 1] = 1;
  for (let p = n.length - 2; p >= 0; p--) r[p] = r[p + 1] * n[p + 1];
  let c = 0;
  for (let p = 0; p < a.length; p++) c += a[p] * r[p];
  return { prefix: e, version: s.version, address: c, serialized: `${e}:${s.version}:${c}` };
}
function Q(t, e) {
  const i = e.split(":"), [s, n, a] = i.length === 4 ? [i[1], i[2], i[3]] : [i[0], i[1], i[2]], r = t[s];
  if (!r) return null;
  let c = parseInt(a);
  if (isNaN(c)) return null;
  const p = [], o = [];
  for (const u of r.labels) {
    const l = r.dims[u];
    l && (l.kind === "axis" ? p.push(l.capacity ?? l.entries.length) : p.push(l.values.length), o.push({ label: u, dim: l }));
  }
  const _ = new Array(p.length);
  _[p.length - 1] = 1;
  for (let u = p.length - 2; u >= 0; u--) _[u] = _[u + 1] * p[u + 1];
  const f = {};
  for (let u = 0; u < o.length; u++) {
    const l = Math.floor(c / _[u]);
    c %= _[u];
    const { label: x, dim: m } = o[u];
    f[x] = m.kind === "axis" ? m.entries[l] ?? `(${l})` : m.values[l] ?? l;
  }
  return { prefix: s, version: n, values: f };
}
function ee(t, e) {
  const i = {};
  for (const [s, n] of Object.entries(e)) {
    const a = t[s];
    if (!a) continue;
    const r = { ...n };
    for (const p of a.labels) {
      const o = a.dims[p];
      (o == null ? void 0 : o.kind) === "prefix_ref" && !(p in r) && (r[p] = o.values[0]);
    }
    const c = J(t, s, r);
    c && (i[s] = c.serialized);
  }
  return i;
}
function Fe(t, e) {
  const i = {};
  for (const [s, n] of Object.entries(e)) {
    const a = Q(t, n);
    a && (i[s] = { prefix: a.prefix, values: a.values });
  }
  return i;
}
function Je(t, e) {
  const i = ee(t, e), s = Y(i);
  return { addressContext: i, byRole: s };
}
const R = {
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
async function Qe(t) {
  const e = (t == null ? void 0 : t.cacheKey) ?? "qa-sdk-catalog", i = (t == null ? void 0 : t.cacheTtlMs) ?? 300 * 1e3, s = (t == null ? void 0 : t.timeoutMs) ?? 5e3;
  if (t != null && t.registryUrl)
    try {
      const a = await te(t.registryUrl, s);
      if (a && Object.keys(a).length > 0)
        return se(e, a), {
          catalog: a,
          source: "api",
          prefixCount: Object.keys(a).length,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
    } catch {
    }
  const n = ne(e, i);
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
async function te(t, e) {
  const i = new AbortController(), s = setTimeout(() => i.abort(), e);
  try {
    const n = await fetch(`${t}/resolve/active`, { signal: i.signal });
    if (clearTimeout(s), !n.ok) return null;
    const a = await n.json();
    return ie(a);
  } catch {
    return clearTimeout(s), null;
  }
}
function ie(t) {
  var i;
  const e = {};
  for (const [s, n] of Object.entries(t)) {
    if (!n || typeof n != "object") continue;
    const a = n.version ?? n.activeVersion ?? "v1", r = n.labels ?? n.dims ? Object.keys(n.dims) : [], c = {};
    if (n.dims)
      for (const [p, o] of Object.entries(n.dims))
        o.kind === "axis" || o.entries ? c[p] = {
          kind: "axis",
          entries: o.entries ?? [],
          capacity: o.capacity ?? ((i = o.entries) == null ? void 0 : i.length) ?? 32
        } : (o.kind === "prefix_ref" || o.values) && (c[p] = {
          kind: "prefix_ref",
          values: o.values ?? []
        });
    (r.length > 0 || Object.keys(c).length > 0) && (e[s] = { version: a, labels: r, dims: c });
  }
  return e;
}
function se(t, e) {
  try {
    const i = { catalog: e, savedAt: Date.now() };
    localStorage.setItem(t, JSON.stringify(i));
  } catch {
  }
}
function ne(t, e) {
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
  Le as CellStateManager,
  U as DEFAULT_LOD,
  re as DEFAULT_THEME,
  ze as DEMO_PREFIX_META,
  Pe as DEMO_SERVICES,
  we as DEMO_SIGNALS,
  je as ENV_FILTERS,
  He as FlowHistory,
  D as LAYER_COLORS,
  We as MonitorAdapter,
  E as PALETTE,
  T as PRESET_AXES,
  Ie as PRESET_VIEWS,
  Ye as PerfMonitor,
  q as ROLE_COLORS,
  be as SIGNAL_ROLE_COLORS,
  ke as SIGNAL_ROLE_LABELS,
  qe as STACK_CHECKOUT,
  De as STACK_INFRA,
  Me as TIER_NAMES,
  Se as ViewEngine,
  Ke as applyFilters,
  Ge as buildCategoryLegend,
  oe as buildGridPositions,
  Ze as buildRoleLegend,
  Ce as buildServiceContainers,
  Y as classifyByRole,
  Ve as computeAllStacks,
  Ee as computeCrossViewLayout,
  Be as computeGroupLod,
  F as computeLodLevel,
  _e as computePatternLayout,
  Re as computeScopeLayouts,
  W as computeStackLayout,
  ce as computeStackPositions,
  he as cube,
  Q as decode,
  Fe as decodeContext,
  Ue as defaultKeyMapper,
  J as encode,
  xe as extractAxes,
  ye as extractDims,
  Te as formatDetail,
  le as generateCssVariables,
  Xe as getLodVisibility,
  X as getPrefixRole,
  fe as grid,
  ve as inferPattern,
  H as inferRole,
  Qe as loadCatalog,
  Oe as matchEventToCells,
  ge as nested,
  pe as row,
  de as scalar,
  me as shelf,
  ue as spine,
  ee as track,
  Je as trackWithSignal,
  $e as validateSignal
};
