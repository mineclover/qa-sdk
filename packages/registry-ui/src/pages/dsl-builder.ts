/**
 * DSL 빌더 — store의 축/composite를 선택하여 인코딩/디코딩 테스트
 */

import { WeightedIndex, calcWeights } from "weighted-index";
import { store, resolveAll, toSnapshot, fromSnapshot, type ResolvedDef } from "../store.js";

let container: HTMLElement;

export function renderDslBuilderPage(el: HTMLElement): void {
  container = el;
  render();
  store.listeners.add(render);
}

function render(): void {
  const resolved = resolveAll();
  const composites = [...resolved.values()].filter((r) => r.kind === "composite");
  const hasData = composites.length > 0;

  container.innerHTML = `
    <div class="dsl-page">
      <div class="dsl-io-bar" style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <button class="dsl-btn dsl-btn-sm dsl-io-export-json">Export JSON</button>
        <button class="dsl-btn dsl-btn-sm dsl-io-push">Push to Registry</button>
        <button class="dsl-btn dsl-btn-sm dsl-io-pull">Pull from Registry</button>
        <span class="dsl-io-status" id="dsl-io-status" style="font-size:0.85em;color:#666;align-self:center"></span>
      </div>
      ${!hasData ? `
        <div class="dsl-empty">
          <p>Prefix 제작 탭에서 축과 composite를 먼저 만들어 주세요.</p>
        </div>
      ` : `
        <div class="dsl-columns">
          <div class="dsl-col">
            <h2>Composite (${composites.length})</h2>
            ${composites.map((r) => compSummary(r, resolved)).join("")}

            <h2 style="margin-top:16px">Budget</h2>
            <div class="dsl-budget">
              ${composites.map((r) => budgetBar(r)).join("")}
            </div>

            <h2 style="margin-top:16px">축 (${store.axes.length})</h2>
            <div class="dsl-axis-chips">
              ${store.axes.map((a) => {
                const b = Math.ceil(Math.log2(a.capacity || 1));
                return `<span class="dsl-badge">${a.id} <small>${a.entries.length}/${a.capacity.toLocaleString()} ${b}b</small></span>`;
              }).join(" ")}
            </div>
          </div>

          <div class="dsl-col dsl-col-wide">
            <h2>인코딩 / 디코딩</h2>
            ${renderEncoder(composites, resolved)}

            <h2 style="margin-top:20px">버전 호환성 검사</h2>
            ${renderVersionCheck(composites)}
          </div>
        </div>
      `}
    </div>
  `;

  bindIoBar();
  if (hasData) {
    bindEncoder(composites, resolved);
    bindVersionCheck(composites);
  }
}

function compSummary(r: ResolvedDef, allResolved: Map<string, ResolvedDef>): string {
  const safe = r.capacity <= Number.MAX_SAFE_INTEGER;
  const dimLabels = r.dims.map((d) => {
    const dr = allResolved.get(d);
    const k = dr?.kind === "composite" ? "comp" : "leaf";
    return `<span class="dsl-badge ${k === "comp" ? "pb-badge-comp-ref" : ""}">${d}<small>${k}</small></span>`;
  }).join(" × ");

  return `
    <div class="dsl-card">
      <div class="dsl-card-header">
        <strong>${r.id}</strong>
        <span class="dsl-badge">${r.bits}/53b</span>
        <span class="dsl-badge ${safe ? "dsl-badge-ok" : "dsl-badge-err"}">${safe ? "Number" : "BigInt"}</span>
      </div>
      <div class="dsl-card-body">
        <div class="pb-dim-refs">${dimLabels}</div>
        <div>shape: [${r.shape.map((s) => s.toLocaleString()).join(", ")}]</div>
        <div>stride: [${r.strides.map((s) => s.toLocaleString()).join(", ")}]</div>
      </div>
    </div>
  `;
}

function budgetBar(r: ResolvedDef): string {
  const pct = Math.min((r.bits / 53) * 100, 100);
  const cls = r.bits > 53 ? "dsl-bar-over" : r.bits > 42 ? "dsl-bar-warn" : "dsl-bar-ok";
  return `
    <div class="dsl-budget-row">
      <span class="dsl-budget-label">${r.id}</span>
      <div class="dsl-budget-track"><div class="dsl-budget-fill ${cls}" style="width:${pct}%"></div></div>
      <span class="dsl-budget-pct">${r.bits}/53b</span>
    </div>
  `;
}

function renderEncoder(composites: ResolvedDef[], allResolved: Map<string, ResolvedDef>): string {
  const first = composites[0];
  return `
    <div class="dsl-encoder">
      <div class="dsl-enc-row">
        <label>Composite</label>
        <select class="dsl-enc-comp-select">
          ${composites.map((r) => `<option value="${r.id}">${r.id} (${r.dims.join(" × ")})</option>`).join("")}
        </select>
      </div>
      <div class="dsl-enc-dims" id="dsl-enc-dims">${dimSelects(first, allResolved)}</div>
      <div class="dsl-enc-actions"><button class="dsl-btn dsl-enc-btn">Encode</button></div>
      <div class="dsl-enc-result" id="dsl-enc-result">주소: —</div>

      <div class="dsl-enc-sep"></div>

      <div class="dsl-enc-row">
        <label>주소 → Decode</label>
        <input class="dsl-enc-input" id="dsl-dec-input" type="number" placeholder="정수 주소" />
        <button class="dsl-btn dsl-dec-btn">Decode</button>
      </div>
      <div class="dsl-enc-result" id="dsl-dec-result">좌표: —</div>
    </div>
  `;
}

/**
 * composite의 각 dim에 대한 select 생성.
 * dim이 leaf면 entries에서 선택, composite면 0..capacity-1 범위 직접 입력.
 */
function dimSelects(r: ResolvedDef, allResolved: Map<string, ResolvedDef>): string {
  return r.dims.map((dimId) => {
    const dr = allResolved.get(dimId);
    if (!dr) return `<div class="dsl-enc-dim"><label>${dimId}</label><span class="dsl-muted">없음</span></div>`;

    if (dr.kind === "leaf") {
      const ax = store.axes.find((a) => a.id === dimId);
      if (!ax) return "";
      return `
        <div class="dsl-enc-dim">
          <label>${dimId} <small>leaf</small></label>
          <select class="dsl-enc-select" data-dim="${dimId}">
            ${ax.entries.map((e, i) => `<option value="${i + 1}">${e} (${i + 1})</option>`).join("")}
          </select>
        </div>
      `;
    }

    // composite dim → position 직접 입력 (1-based)
    return `
      <div class="dsl-enc-dim">
        <label>${dimId} <small>comp, cap:${dr.capacity.toLocaleString()}</small></label>
        <input class="dsl-enc-select dsl-enc-input" data-dim="${dimId}"
               type="number" min="1" max="${dr.capacity}" value="1"
               placeholder="1~${dr.capacity}" />
      </div>
    `;
  }).join("");
}

// ── events ───────────────────────────────────────────────────

function bindEncoder(composites: ResolvedDef[], allResolved: Map<string, ResolvedDef>): void {
  container.querySelector<HTMLSelectElement>(".dsl-enc-comp-select")?.addEventListener("change", (e) => {
    const id = (e.target as HTMLSelectElement).value;
    const r = composites.find((x) => x.id === id);
    if (!r) return;
    const el = container.querySelector("#dsl-enc-dims");
    if (el) el.innerHTML = dimSelects(r, allResolved);
  });

  container.querySelector(".dsl-enc-btn")?.addEventListener("click", () => {
    const compId = container.querySelector<HTMLSelectElement>(".dsl-enc-comp-select")?.value;
    const r = composites.find((x) => x.id === compId);
    if (!r) return;

    const coords = r.dims.map((dimId) => {
      const sel = container.querySelector<HTMLInputElement | HTMLSelectElement>(`.dsl-enc-select[data-dim="${dimId}"]`);
      return Number(sel?.value ?? 1);
    });

    const wi = new WeightedIndex(r.shape);
    const addr = wi.encode(coords);
    const labels = r.dims.map((dimId, i) => {
      const ax = store.axes.find((a) => a.id === dimId);
      const label = ax ? (ax.entries[coords[i] - 1] ?? `pos${coords[i]}`) : `pos${coords[i]}`;
      return `${dimId}=${label}`;
    });

    const el = container.querySelector("#dsl-enc-result");
    if (el) {
      el.innerHTML = `
        <div>주소: <strong>${addr.toLocaleString()}</strong></div>
        <div class="dsl-enc-serial">직렬화: <code>schema:v1:${compId}:${addr}</code></div>
        <div>좌표: [${coords.join(", ")}] → ${labels.join(", ")}</div>
      `;
    }
  });

  container.querySelector(".dsl-dec-btn")?.addEventListener("click", () => {
    const compId = container.querySelector<HTMLSelectElement>(".dsl-enc-comp-select")?.value;
    const r = composites.find((x) => x.id === compId);
    if (!r) return;

    const addr = Number((container.querySelector("#dsl-dec-input") as HTMLInputElement)?.value);
    if (isNaN(addr) || addr < 0) return;

    const wi = new WeightedIndex(r.shape);
    const coords = wi.decode(addr);
    const labels = coords.map((pos, i) => {
      const dimId = r.dims[i];
      const ax = store.axes.find((a) => a.id === dimId);
      const label = ax ? (ax.entries[pos - 1] ?? `pos${pos}`) : `pos${pos}`;
      return `${dimId}=${label}`;
    });

    const el = container.querySelector("#dsl-dec-result");
    if (el) el.innerHTML = `좌표: [${coords.join(", ")}] → ${labels.join(", ")}`;
  });
}

// ── 버전 호환성 검사 ────────────────────────────────────────

function renderVersionCheck(composites: ResolvedDef[]): string {
  if (composites.length === 0) return "";
  return `
    <div class="dsl-vc">
      <p class="dsl-vc-desc">
        dim의 capacity를 변경했을 때 stride가 유지되는지 검사합니다.
        <strong>첫 번째 축(외부)</strong> 확장은 stride 불변, <strong>내부 축</strong> 확장은 stride 변경.
      </p>
      <div class="dsl-vc-form">
        <div class="dsl-enc-row">
          <label>Composite</label>
          <select class="dsl-vc-comp" id="dsl-vc-comp">
            ${composites.map((r) => `<option value="${r.id}">${r.id}</option>`).join("")}
          </select>
        </div>
        <div class="dsl-enc-row">
          <label>변경할 dim</label>
          <select class="dsl-vc-dim" id="dsl-vc-dim">
            ${composites[0].dims.map((d) => `<option value="${d}">${d}</option>`).join("")}
          </select>
        </div>
        <div class="dsl-enc-row">
          <label>새 capacity</label>
          <input class="dsl-enc-input" id="dsl-vc-newcap" type="number" placeholder="예: 2048" />
        </div>
        <button class="dsl-btn dsl-vc-btn">검사</button>
      </div>
      <div class="dsl-enc-result" id="dsl-vc-result">결과가 여기에 표시됩니다</div>
    </div>
  `;
}

// ── IO Bar (Import/Export) ────────────────────────────────

function setIoStatus(msg: string, isError = false) {
  const el = container.querySelector("#dsl-io-status");
  if (el) {
    el.textContent = msg;
    (el as HTMLElement).style.color = isError ? "#c62828" : "#2e7d32";
  }
}

function bindIoBar(): void {
  // Export JSON — 로컬 다운로드
  container.querySelector(".dsl-io-export-json")?.addEventListener("click", () => {
    const snapshot = toSnapshot("export-" + Date.now());
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schema-${snapshot.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setIoStatus("JSON 다운로드 완료");
  });

  // Push to Registry — POST /api/schema/import
  container.querySelector(".dsl-io-push")?.addEventListener("click", async () => {
    const versionId = prompt("버전 ID를 입력하세요 (예: v1)", "v1");
    if (!versionId) return;

    const snapshot = toSnapshot("push-" + Date.now());
    setIoStatus("전송 중...");
    try {
      const res = await fetch("/api/schema/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot, versionId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message ?? `HTTP ${res.status}`);
      }
      const body = await res.json();
      setIoStatus(
        `Push 완료: ${body.imported.axes} axes, ${body.imported.composites} composites (${versionId})`,
      );
    } catch (e) {
      setIoStatus(`Push 실패: ${(e as Error).message}`, true);
    }
  });

  // Pull from Registry — GET /api/schema/export
  container.querySelector(".dsl-io-pull")?.addEventListener("click", async () => {
    const versionId = prompt("가져올 버전 ID (비워두면 active)", "");
    setIoStatus("가져오는 중...");
    try {
      const url = versionId ? `/api/schema/export?versionId=${versionId}` : "/api/schema/export";
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message ?? `HTTP ${res.status}`);
      }
      const snapshot = await res.json();
      fromSnapshot(snapshot);
      setIoStatus(
        `Pull 완료: ${snapshot.axes.length} axes, ${snapshot.composites.length} composites`,
      );
    } catch (e) {
      setIoStatus(`Pull 실패: ${(e as Error).message}`, true);
    }
  });
}

function bindVersionCheck(composites: ResolvedDef[]): void {
  // composite 선택 → dim 목록 갱신
  container.querySelector<HTMLSelectElement>("#dsl-vc-comp")?.addEventListener("change", (e) => {
    const id = (e.target as HTMLSelectElement).value;
    const r = composites.find((x) => x.id === id);
    if (!r) return;
    const dimSel = container.querySelector<HTMLSelectElement>("#dsl-vc-dim");
    if (dimSel) dimSel.innerHTML = r.dims.map((d) => `<option value="${d}">${d}</option>`).join("");
  });

  container.querySelector(".dsl-vc-btn")?.addEventListener("click", () => {
    const compId = (container.querySelector("#dsl-vc-comp") as HTMLSelectElement)?.value;
    const dimId = (container.querySelector("#dsl-vc-dim") as HTMLSelectElement)?.value;
    const newCap = Number((container.querySelector("#dsl-vc-newcap") as HTMLInputElement)?.value);
    if (!compId || !dimId || !newCap || newCap < 1) return;

    const r = composites.find((x) => x.id === compId);
    if (!r) return;

    const dimIdx = r.dims.indexOf(dimId);
    if (dimIdx < 0) return;

    // 현재 shape / stride
    const oldShape = [...r.shape];
    const oldStrides = [...r.strides];

    // 새 shape
    const newShape = [...oldShape];
    newShape[dimIdx] = newCap;
    const newStrides = calcWeights(newShape);
    const newProduct = newShape.reduce((a, b) => a * b, 1);

    const strideChanged = oldStrides.some((s, i) => s !== newStrides[i]);
    const safe = newProduct <= Number.MAX_SAFE_INTEGER;

    // 좌표 [2,2,...] 로 호환성 테스트
    const testCoords = oldShape.map(() => 2);
    const wi1 = new WeightedIndex(oldShape);
    const wi2 = new WeightedIndex(newShape);
    const addr1 = wi1.encode(testCoords);
    const addr2 = wi2.encode(testCoords);

    const el = container.querySelector("#dsl-vc-result");
    if (el) {
      el.innerHTML = `
        <div><strong>${dimId}</strong> capacity: ${oldShape[dimIdx].toLocaleString()} → ${newCap.toLocaleString()} (dim[${dimIdx}])</div>
        <div>shape: [${oldShape.map((s) => s.toLocaleString()).join(", ")}] → [${newShape.map((s) => s.toLocaleString()).join(", ")}]</div>
        <div>stride: [${oldStrides.map((s) => s.toLocaleString()).join(", ")}] → [${newStrides.map((s) => s.toLocaleString()).join(", ")}]</div>
        <div class="dsl-vc-verdict ${strideChanged ? "dsl-vc-bad" : "dsl-vc-good"}">
          ${strideChanged
            ? `stride 변경됨 → 마이그레이션 필요 (좌표 [${testCoords}]: 주소 ${addr1.toLocaleString()} → ${addr2.toLocaleString()})`
            : `stride 불변 → 기존 주소 호환 (좌표 [${testCoords}]: 주소 ${addr1.toLocaleString()} = ${addr2.toLocaleString()})`
          }
        </div>
        <div>capacity: ${r.capacity.toLocaleString()} → ${newProduct.toLocaleString()}
          <span class="dsl-badge ${safe ? "dsl-badge-ok" : "dsl-badge-err"}">${safe ? "Number OK" : "BigInt 필요"}</span>
        </div>
      `;
    }
  });
}
