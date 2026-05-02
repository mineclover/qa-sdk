// @def.boundary experience-layer-group
// @def.doc experience-layer-group

/**
 * Prefix 제작 — 축 정의 + composite 생성 (인라인 폼)
 *
 * composite의 dims에서 leaf axis 뿐 아니라 다른 composite도 선택 가능.
 * 예: service(composite) = env × region × svc_name × ns
 *     access_log(composite) = service(composite) × event_name(leaf)
 */

import {
  store, notify, loadPreset, resolveAll, availableDims, PRESETS,
  type EnumAxis, type CompositeDef, type ResolvedDef,
} from "../store.js";

let container: HTMLElement;

export function renderPrefixBuilderPage(el: HTMLElement): void {
  container = el;
  if (store.axes.length === 0) loadPreset("qa-sdk-git");
  render();
  store.listeners.add(render);
}

// ── render ───────────────────────────────────────────────────

function render(): void {
  const resolved = resolveAll();
  const dims = availableDims();

  container.innerHTML = `
    <div class="pb-page">
      <div class="pb-toolbar">
        <span class="pb-label">프리셋:</span>
        ${Object.keys(PRESETS).map((k) =>
          `<button class="dsl-btn pb-preset" data-key="${k}">${k}</button>`
        ).join("")}
        <button class="dsl-btn pb-preset" data-key="">비우기</button>
      </div>

      <!-- 참조 구조 요약 -->
      <div class="pb-ref-summary">
        ${renderRefDag(resolved)}
      </div>

      <div class="pb-columns">
        <!-- 좌: Leaf Axis -->
        <div class="pb-col">
          <h2>Leaf Axis (${store.axes.length})</h2>
          ${store.axes.map((a, i) => axisCard(a, i)).join("")}

          <div class="pb-form">
            <h3>축 추가</h3>
            <div class="pb-row">
              <label>ID</label>
              <input class="pb-input" id="pb-ax-id" placeholder="영문 소문자 (예: env)" />
            </div>
            <div class="pb-row">
              <label>엔트리</label>
              <textarea class="pb-textarea" id="pb-ax-entries" rows="3"
                placeholder="한 줄에 하나, 또는 쉼표 구분"></textarea>
            </div>
            <div class="pb-row">
              <label>Capacity</label>
              <input class="pb-input pb-input-num" id="pb-ax-cap" type="number"
                placeholder="자동: entries 수" />
              <span class="pb-hint">비우면 entries 수로 자동 설정</span>
            </div>
            <button class="dsl-btn pb-submit-axis">추가</button>
          </div>
        </div>

        <!-- 우: Composite Prefix -->
        <div class="pb-col">
          <h2>Composite Prefix (${store.composites.length})</h2>
          ${store.composites.map((c, i) => compositeCard(c, i, resolved)).join("")}

          <div class="pb-form">
            <h3>Composite 추가</h3>
            <div class="pb-row">
              <label>ID</label>
              <input class="pb-input" id="pb-comp-id" placeholder="예: access_log" />
            </div>
            <div class="pb-row">
              <label>Owner</label>
              <input class="pb-input" id="pb-comp-owner" placeholder="예: registry" />
            </div>
            <div class="pb-row">
              <label>Dims 선택 (클릭 순서 = 축 배치 순서)</label>
              <div class="pb-dim-picker" id="pb-dim-picker">
                ${dims.map((d) => `
                  <label class="pb-chip-label">
                    <input type="checkbox" class="pb-dim-check" value="${d.id}" />
                    <span class="pb-chip ${d.kind === "composite" ? "pb-chip-comp" : ""}">${d.id}
                      <small>${d.kind === "composite" ? "comp" : "leaf"}</small>
                    </span>
                  </label>
                `).join("")}
              </div>
              <div class="pb-dim-order" id="pb-dim-order">
                <span class="pb-hint">선택한 항목이 순서대로 표시됩니다 (leaf + composite 모두 가능)</span>
              </div>
            </div>
            <button class="dsl-btn pb-submit-comp">추가</button>
          </div>
        </div>
      </div>
    </div>
  `;

  bind();
}

// ── cards ────────────────────────────────────────────────────

function axisCard(a: EnumAxis, idx: number): string {
  const h = a.capacity - a.entries.length;
  const bits = Math.ceil(Math.log2(a.capacity || 1));
  const shown = a.entries.slice(0, 12);
  const more = a.entries.length - shown.length;
  return `
    <div class="dsl-card">
      <div class="dsl-card-header">
        <strong>${a.id}</strong>
        <span class="dsl-badge">${a.entries.length}/${a.capacity.toLocaleString()}</span>
        <span class="dsl-badge dsl-badge-dim">${bits}b</span>
        <span class="dsl-badge">h: ${h.toLocaleString()}</span>
        <button class="dsl-btn-sm pb-del-axis" data-idx="${idx}">x</button>
      </div>
      <div class="dsl-card-body">
        <div class="dsl-entries">
          ${shown.map((e) => `<span class="dsl-entry">${e}</span>`).join("")}
          ${more > 0 ? `<span class="dsl-muted">+${more}</span>` : ""}
        </div>
      </div>
    </div>
  `;
}

function compositeCard(c: CompositeDef, idx: number, resolved: Map<string, ResolvedDef>): string {
  const r = resolved.get(c.id);
  if (!r) return `<div class="dsl-card dsl-card-err">dims 참조 오류: [${c.dims.join(", ")}]</div>`;

  const safe = r.capacity <= Number.MAX_SAFE_INTEGER;
  // dim별 kind 표시
  const dimLabels = c.dims.map((d) => {
    const dr = resolved.get(d);
    const kind = dr?.kind === "composite" ? "comp" : "leaf";
    return `<span class="dsl-badge ${kind === "comp" ? "pb-badge-comp-ref" : ""}">${d} <small>${kind}</small></span>`;
  }).join(" × ");

  return `
    <div class="dsl-card">
      <div class="dsl-card-header">
        <strong>${c.id}</strong>
        <span class="dsl-badge">${r.bits}/53b</span>
        <span class="dsl-badge ${safe ? "dsl-badge-ok" : "dsl-badge-err"}">${safe ? "Number" : "BigInt"}</span>
        <span class="dsl-badge">owner: ${c.owner}</span>
        <button class="dsl-btn-sm pb-del-comp" data-idx="${idx}">x</button>
      </div>
      <div class="dsl-card-body">
        <div class="pb-dim-refs">${dimLabels}</div>
        <div>shape: [${r.shape.map((s) => s.toLocaleString()).join(", ")}]</div>
        <div>stride: [${r.strides.map((s) => s.toLocaleString()).join(", ")}]</div>
        <div>capacity: ${r.capacity.toLocaleString()}</div>
      </div>
      <div class="pb-budget-bar">
        <div class="pb-budget-fill ${r.bits > 53 ? "dsl-bar-over" : r.bits > 42 ? "dsl-bar-warn" : "dsl-bar-ok"}"
             style="width:${Math.min((r.bits / 53) * 100, 100)}%"></div>
      </div>
    </div>
  `;
}

// ── DAG 시각화 ──────────────────────────────────────────────

function renderRefDag(resolved: Map<string, ResolvedDef>): string {
  if (store.composites.length === 0 && store.axes.length === 0) return "";

  // 참조 관계 생성
  const lines: string[] = [];

  for (const c of store.composites) {
    const r = resolved.get(c.id);
    if (!r) continue;
    const safe = r.capacity <= Number.MAX_SAFE_INTEGER;
    const dimParts = c.dims.map((d) => {
      const dr = resolved.get(d);
      const kind = dr?.kind === "composite" ? "comp" : "leaf";
      const cap = dr?.capacity ?? 0;
      return `<span class="pb-dag-ref ${kind === "comp" ? "pb-dag-ref-comp" : ""}">${d}<small>${cap.toLocaleString()}</small></span>`;
    });

    lines.push(`
      <div class="pb-dag-row">
        <span class="pb-dag-node pb-dag-comp-node">${c.id}</span>
        <span class="pb-dag-eq">=</span>
        ${dimParts.join('<span class="pb-dag-op">×</span>')}
        <span class="pb-dag-arrow">→</span>
        <span class="pb-dag-cap">cap: ${r.capacity.toLocaleString()}</span>
        <span class="dsl-badge ${safe ? "dsl-badge-ok" : "dsl-badge-err"}">${r.bits}/53b</span>
      </div>
    `);
  }

  // 독립 leaf (어디서도 참조되지 않는)
  const referencedIds = new Set(store.composites.flatMap((c) => c.dims));
  const orphans = store.axes.filter((a) => !referencedIds.has(a.id));

  return `
    <div class="pb-dag-box">
      <div class="pb-dag-title">
        참조 구조 <small>composite는 dim의 capacity만 참조 — 내부를 펼치지 않음</small>
      </div>
      ${lines.length > 0 ? lines.join("") : '<div class="dsl-muted">composite가 없습니다</div>'}
      ${orphans.length > 0 ? `
        <div class="pb-dag-orphans">
          <small>미참조 leaf:</small>
          ${orphans.map((a) => `<span class="dsl-entry">${a.id}</span>`).join(" ")}
        </div>
      ` : ""}
    </div>
  `;
}

// ── events ───────────────────────────────────────────────────

function bind(): void {
  // 프리셋
  container.querySelectorAll<HTMLButtonElement>(".pb-preset").forEach((btn) =>
    btn.addEventListener("click", () => {
      const key = btn.dataset.key ?? "";
      if (key) loadPreset(key);
      else { store.axes = []; store.composites = []; notify(); }
    }),
  );

  // 축 삭제
  container.querySelectorAll<HTMLButtonElement>(".pb-del-axis").forEach((btn) =>
    btn.addEventListener("click", () => {
      store.axes.splice(Number(btn.dataset.idx), 1);
      notify();
    }),
  );

  // 축 추가
  container.querySelector(".pb-submit-axis")?.addEventListener("click", () => {
    const id = (container.querySelector("#pb-ax-id") as HTMLInputElement).value.trim();
    const raw = (container.querySelector("#pb-ax-entries") as HTMLTextAreaElement).value;
    if (!id || !raw) return;
    const entries = raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    const capVal = Number((container.querySelector("#pb-ax-cap") as HTMLInputElement).value);
    const cap = capVal > 0 ? Math.max(capVal, entries.length) : entries.length;
    if (store.axes.some((a) => a.id === id) || store.composites.some((c) => c.id === id)) {
      return alert(`'${id}'가 이미 존재합니다`);
    }
    store.axes.push({ id, entries, capacity: cap });
    notify();
  });

  // Composite dim 선택 — 클릭 순서 추적
  const orderEl = container.querySelector("#pb-dim-order");
  const selected: string[] = [];

  container.querySelectorAll<HTMLInputElement>(".pb-dim-check").forEach((ch) => {
    ch.addEventListener("change", () => {
      if (ch.checked) {
        selected.push(ch.value);
      } else {
        const i = selected.indexOf(ch.value);
        if (i >= 0) selected.splice(i, 1);
      }
      updateDimOrder(orderEl, selected);
    });
  });

  // Composite 추가
  container.querySelector(".pb-submit-comp")?.addEventListener("click", () => {
    const id = (container.querySelector("#pb-comp-id") as HTMLInputElement).value.trim();
    const owner = (container.querySelector("#pb-comp-owner") as HTMLInputElement).value.trim() || "default";
    if (!id) return alert("ID를 입력하세요");
    if (selected.length === 0) return alert("최소 1개 dim을 선택하세요");
    if (store.axes.some((a) => a.id === id) || store.composites.some((c) => c.id === id)) {
      return alert(`'${id}'가 이미 존재합니다`);
    }
    store.composites.push({ id, dims: [...selected], owner });
    notify();
  });

  // Composite 삭제
  container.querySelectorAll<HTMLButtonElement>(".pb-del-comp").forEach((btn) =>
    btn.addEventListener("click", () => {
      store.composites.splice(Number(btn.dataset.idx), 1);
      notify();
    }),
  );
}

function updateDimOrder(el: Element | null, selected: string[]): void {
  if (!el) return;
  if (selected.length === 0) {
    el.innerHTML = '<span class="pb-hint">선택한 항목이 순서대로 표시됩니다 (leaf + composite 모두 가능)</span>';
    return;
  }

  const resolved = resolveAll();
  const parts = selected.map((d, i) => {
    const r = resolved.get(d);
    const kind = r?.kind === "composite" ? "comp" : "leaf";
    const cap = r?.capacity ?? 0;
    return `<span class="dsl-badge ${kind === "comp" ? "pb-badge-comp-ref" : ""}">${i}: ${d} (${cap.toLocaleString()})</span>`;
  });

  // 실시간 shape/capacity 미리보기
  const caps = selected.map((d) => resolved.get(d)?.capacity ?? 1);
  const product = caps.reduce((a, b) => a * b, 1);
  const bits = Math.ceil(Math.log2(product || 1));
  const safe = product <= Number.MAX_SAFE_INTEGER;

  el.innerHTML = `
    <div>${parts.join(" → ")}</div>
    <div class="pb-preview">
      shape: [${caps.map((c) => c.toLocaleString()).join(", ")}]
      · capacity: ${product.toLocaleString()}
      · ${bits}/53b
      <span class="dsl-badge ${safe ? "dsl-badge-ok" : "dsl-badge-err"}">${safe ? "OK" : "BigInt"}</span>
    </div>
  `;
}
