import { BROWSER_CATALOG as u } from './qa-browser-sdk.js';
async function O(t) {
  const r = (t == null ? void 0 : t.cacheKey) ?? 'qa-sdk-catalog',
    a = (t == null ? void 0 : t.cacheTtlMs) ?? 300 * 1e3,
    s = (t == null ? void 0 : t.timeoutMs) ?? 5e3;
  if (t != null && t.registryUrl)
    try {
      const n = await y(t.registryUrl, s);
      if (n && Object.keys(n).length > 0)
        return (
          h(r, n),
          {
            catalog: n,
            source: 'api',
            prefixCount: Object.keys(n).length,
            timestamp: /* @__PURE__ */ new Date().toISOString(),
          }
        );
    } catch {}
  const e = d(r, a);
  return e
    ? {
        catalog: e,
        source: 'cache',
        prefixCount: Object.keys(e).length,
        timestamp: /* @__PURE__ */ new Date().toISOString(),
      }
    : {
        catalog: u,
        source: 'static',
        prefixCount: Object.keys(u).length,
        timestamp: /* @__PURE__ */ new Date().toISOString(),
      };
}
async function y(t, r) {
  const a = new AbortController(),
    s = setTimeout(() => a.abort(), r);
  try {
    const e = await fetch(`${t}/resolve/active`, { signal: a.signal });
    if ((clearTimeout(s), !e.ok)) return null;
    const n = await e.json();
    return m(n);
  } catch {
    return (clearTimeout(s), null);
  }
}
function m(t) {
  var a;
  const r = {};
  for (const [s, e] of Object.entries(t)) {
    if (!e || typeof e != 'object') continue;
    const n = e.version ?? e.activeVersion ?? 'v1',
      l = (e.labels ?? e.dims) ? Object.keys(e.dims) : [],
      o = {};
    if (e.dims)
      for (const [i, c] of Object.entries(e.dims))
        c.kind === 'axis' || c.entries
          ? (o[i] = {
              kind: 'axis',
              entries: c.entries ?? [],
              capacity: c.capacity ?? ((a = c.entries) == null ? void 0 : a.length) ?? 32,
            })
          : (c.kind === 'prefix_ref' || c.values) &&
            (o[i] = {
              kind: 'prefix_ref',
              values: c.values ?? [],
            });
    (l.length > 0 || Object.keys(o).length > 0) && (r[s] = { version: n, labels: l, dims: o });
  }
  return r;
}
function h(t, r) {
  try {
    const a = { catalog: r, savedAt: Date.now() };
    localStorage.setItem(t, JSON.stringify(a));
  } catch {}
}
function d(t, r) {
  try {
    const a = localStorage.getItem(t);
    if (!a) return null;
    const s = JSON.parse(a);
    return Date.now() - s.savedAt > r ? null : s.catalog;
  } catch {
    return null;
  }
}
export { O as loadCatalog };
//# sourceMappingURL=catalog-loader-8xiUKhkX.js.map
