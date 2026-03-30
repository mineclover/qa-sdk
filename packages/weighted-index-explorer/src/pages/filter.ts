// ═══════════════════════════════════════════════════════════════════════════
//  필터링 페이지 — 특정 권한을 가진 사람 찾아내기
//
//  핵심 통찰: 권한 ID를 비트 위치로 쓰면
//    hasPermission(user, r, a, ro, e) = (bitmask[id >> 3] & (1 << (id & 7))) !== 0
//  O(1) 산술 연산. 문자열 비교 없음.
// ═══════════════════════════════════════════════════════════════════════════

import {
  describeRangeFormula, partialQueryBase,
  createMask, setBit, hasBit, popcount,
  calcAddressRanges,
  type CoordConstraint,
} from "weighted-index";
import {
  SCHEMA_VERSIONS,
  type VersionDef,
} from "../data.js";
import { dimBadge } from "../utils/badge.js";
import { encodeRowsHtml } from "../utils/encode-html.js";

// ─────────────────────────────────────────────────────────────────────────
//  Sample users
// ─────────────────────────────────────────────────────────────────────────

interface SampleUser {
  name:    string;
  icon:    string;
  // envRoles: which role they hold in each env (null = no access)
  envRoles: Partial<Record<string, string>>;
  bitmask: Uint8Array;
}

function buildUserBitmask(
  envRoles: Partial<Record<string, string>>,
  vDef:     VersionDef,
): Uint8Array {
  const mask = createMask(vDef.size);
  const dims = vDef.dims;

  for (const [env, role] of Object.entries(envRoles)) {
    const eIdx  = Array.from(dims.env.values).indexOf(env as string)  + 1;
    const roIdx = Array.from(dims.role.values).indexOf(role as string) + 1;
    if (eIdx <= 0 || roIdx <= 0) continue;

    for (let r = 1; r <= dims.resource.size; r++) {
      for (let a = 1; a <= dims.action.size; a++) {
        // Permission rule: viewer=read only, guest=read only,
        //   editor=read+write, admin=read+write+delete, super_admin=all
        if (!roleAllowsAction(role as string, String(dims.action.values[a - 1]))) continue;
        const id = vDef.wi.encode([r, a, roIdx, eIdx]);
        setBit(mask, id);
      }
    }
  }
  return mask;
}

function roleAllowsAction(role: string, action: string): boolean {
  const map: Record<string, string[]> = {
    guest:       ["read"],
    viewer:      ["read"],
    editor:      ["read", "write"],
    admin:       ["read", "write", "delete"],
    super_admin: ["read", "write", "delete", "manage"],
    owner:       ["read", "write", "delete", "manage"],
  };
  return (map[role] ?? []).includes(action);
}

// ─────────────────────────────────────────────────────────────────────────
//  Public entry point
// ─────────────────────────────────────────────────────────────────────────

export function renderFilter(container: HTMLElement): void {
  const vDef  = SCHEMA_VERSIONS[0]; // v1 as base for the demo
  const users = buildSampleUsers(vDef);

  container.innerHTML = `<div class="concept-wrap">${buildPage(users, vDef)}</div>`;
  wireDemo(container, users, vDef);
}

// ─────────────────────────────────────────────────────────────────────────
//  Build sample users
// ─────────────────────────────────────────────────────────────────────────

function buildSampleUsers(vDef: VersionDef): SampleUser[] {
  const specs: Omit<SampleUser, "bitmask">[] = [
    {
      name: "Alice",
      icon: "👩‍💼",
      envRoles: { production: "super_admin", staging: "super_admin", development: "super_admin" },
    },
    {
      name: "Bob",
      icon: "👨‍💻",
      envRoles: { production: "viewer", staging: "viewer" },
    },
    {
      name: "Charlie",
      icon: "👨‍🔧",
      envRoles: { staging: "editor", development: "editor" },
    },
    {
      name: "Dave",
      icon: "👨‍💼",
      envRoles: { production: "admin", staging: "admin" },
    },
    {
      name: "Eve",
      icon: "👩‍🔬",
      envRoles: { development: "editor", testing: "admin" },
    },
  ];

  return specs.map((s) => Object.assign({}, s, {
    bitmask: buildUserBitmask(s.envRoles, vDef),
  }) as SampleUser);
}

// ─────────────────────────────────────────────────────────────────────────
//  Static HTML
// ─────────────────────────────────────────────────────────────────────────

function buildPage(users: SampleUser[], vDef: VersionDef): string {
  return `
    ${buildIntro()}
    <div class="concept-dim-sep"></div>
    ${buildFormulaSection(vDef)}
    <div class="concept-dim-sep"></div>
    ${buildRangeSection(vDef)}
    <div class="concept-dim-sep"></div>
    ${buildUsersTable(users, vDef)}
    <div class="concept-dim-sep"></div>
    ${buildDemo(vDef)}
  `;
}

// ── 1. 개요 ───────────────────────────────────────────────────────────────

function buildIntro(): string {
  return `
    <h2 class="concept-section-title">필터링 — 특정 권한을 가진 사람 찾기</h2>
    <p class="concept-desc">
      가중진법의 진정한 힘은 <strong>순수 산술로 필터링</strong>할 수 있다는 점입니다.
      "database를 delete할 수 있는 admin은 누구인가?"라는 질문에
      문자열 비교나 해시맵 없이, 비트 연산 하나로 답할 수 있습니다.
    </p>

    <div class="insight-box">
      <span class="insight-icon">⚡</span>
      <span>
        <strong>전통 방식:</strong> <code>user.perms.includes("database:delete:admin:production")</code> — O(n) 문자열 탐색<br/>
        <strong>가중진법:</strong> <code>mask[id &gt;&gt; 3] &amp; (1 &lt;&lt; (id &amp; 7))</code> — O(1) 비트 연산<br/>
        여기서 <code>id = encode([database, delete, admin, production])</code>
      </span>
    </div>
  `;
}

// ── 2. 수식 설명 ──────────────────────────────────────────────────────────

function buildFormulaSection(vDef: VersionDef): string {
  // Example: database(3)×delete(3)×admin(4)×production(1)
  const r = 3, a = 3, ro = 4, e = 1; // database, delete, admin, production
  const id = vDef.wi.encode([r, a, ro, e]);

  return `
    <h2 class="concept-section-title">단일 권한 조회 수식</h2>
    <p class="concept-desc">
      예시: <strong>admin이 production에서 database를 delete할 수 있는가?</strong>
    </p>

    <div class="concept-block">
      <div class="cb-header">① 권한 ID 계산 <span class="cb-badge">O(1) encode</span></div>
      <div class="cb-body">
        <table class="formula-tbl">
          ${encodeRowsHtml([r, a, ro, e], vDef.weights as number[], id)}
        </table>
        <div class="filter-formula-note">
          ${dimBadge("resource", "database")} × ${dimBadge("action", "delete")} ×
          ${dimBadge("role", "admin")} × ${dimBadge("env", "production")} → id = <strong>${id}</strong>
        </div>
      </div>
    </div>

    <div class="concept-block">
      <div class="cb-header">② 비트 위치 확인 <span class="cb-badge">O(1) bit check</span></div>
      <div class="cb-body">
        <div class="filter-bit-formula">
          <div class="fbf-line">
            <span class="fbf-label">비트 위치</span>
            <code class="fbf-code">id = ${id}</code>
          </div>
          <div class="fbf-line">
            <span class="fbf-label">바이트 인덱스</span>
            <code class="fbf-code">${id} &gt;&gt; 3 = ${id >> 3}</code>
          </div>
          <div class="fbf-line">
            <span class="fbf-label">비트 마스크</span>
            <code class="fbf-code">1 &lt;&lt; (${id} &amp; 7) = 1 &lt;&lt; ${id & 7} = ${1 << (id & 7)}</code>
          </div>
          <div class="fbf-line fbf-check">
            <span class="fbf-label">권한 확인</span>
            <code class="fbf-code">user.bitmask[${id >> 3}] &amp; ${1 << (id & 7)}</code>
            <span class="fbf-comment">// 0이면 없음, 0이 아니면 있음</span>
          </div>
        </div>
      </div>
    </div>

    <div class="concept-block">
      <div class="cb-header">③ 사용자 검색 <span class="cb-badge">O(users)</span></div>
      <div class="cb-body">
        <pre class="filter-code-block">const id = encode([database, delete, admin, production]); // → ${id}

// 특정 권한을 가진 모든 사용자 찾기
const matching = users.filter(user =>
  (user.bitmask[id &gt;&gt; 3] &amp; (1 &lt;&lt; (id &amp; 7))) !== 0
);</pre>
      </div>
    </div>
  `;
}

// ── 3. 범위 쿼리 수식 ─────────────────────────────────────────────────────

function buildRangeSection(vDef: VersionDef): string {
  const weights = vDef.weights as number[];
  const [W1, W2] = weights;
  // admin(ro=4) in production(e=1)
  const ro = 4, e = 1;
  const fixedCoords: Array<number | null> = [null, null, ro, e];
  const base    = partialQueryBase(weights, fixedCoords);
  const formula = describeRangeFormula(weights, fixedCoords, ["resource", "action", "role", "env"]);

  // compute example IDs for admin+production
  const exampleIds: number[] = [];
  for (let r = 1; r <= 2; r++) {
    for (let a = 1; a <= vDef.dims.action.size; a++) {
      exampleIds.push(vDef.wi.encode([r, a, ro, e]));
    }
  }

  return `
    <h2 class="concept-section-title">범위 쿼리 — 역할의 모든 권한 집합</h2>
    <p class="concept-desc">
      "admin이 production에서 가진 <em>모든</em> 권한 ID"를
      루프 없이 수식 하나로 표현할 수 있습니다.
    </p>

    <div class="concept-block">
      <div class="cb-header">admin × production 권한 ID 집합 수식</div>
      <div class="cb-body">
        <div class="filter-range-formula">
          <div class="frf-step">
            <span class="frf-label">고정 기저</span>
            <code>base = partialQueryBase(W, [null, null, ${ro}, ${e}]) = <strong>${base}</strong></code>
          </div>
          <div class="frf-step">
            <span class="frf-label">자유 오프셋</span>
            <code>offset = (r−1)×${W1} + (a−1)×${W2} &nbsp; for r∈[1..${vDef.dims.resource.size}], a∈[1..${vDef.dims.action.size}]</code>
          </div>
          <div class="frf-step frf-step-result">
            <span class="frf-label">ID 집합</span>
            <code>${formula} &nbsp; — &nbsp; ${vDef.dims.resource.size * vDef.dims.action.size}개</code>
          </div>
        </div>
        <p class="mini-note">
          처음 두 resource (r=1,2) 예시:
          ${exampleIds.map((id) => `<code>${id}</code>`).join(", ")} …
        </p>
        <pre class="filter-code-block">// admin의 production 권한 IDs — 루프이지만 공식적 표현 가능
// describeRangeFormula(W, [null,null,${ro},${e}], labels) → "${formula}"
const base = partialQueryBase(W, [null, null, ${ro}, ${e}]); // ${base}

const permIds = [];
for (let r = 1; r &lt;= ${vDef.dims.resource.size}; r++) {
  for (let a = 1; a &lt;= ${vDef.dims.action.size}; a++) {
    permIds.push(base + (r - 1) * ${W1} + (a - 1) * ${W2});
  }
}
// → [${exampleIds.slice(0, 4).join(", ")}, ...]

// 이 사용자가 그 권한들 중 하나라도 가지고 있는가?
const canAny = permIds.some(id => user.bitmask[id &gt;&gt; 3] &amp; (1 &lt;&lt; (id &amp; 7)));</pre>
      </div>
    </div>
  `;
}

// ── 4. 사용자 목록 ────────────────────────────────────────────────────────

function buildUsersTable(users: SampleUser[], vDef: VersionDef): string {
  const dims = vDef.dims;

  const rows = users.map((u) => {
    const envCells = Array.from(dims.env.values).map((env) => {
      const role = u.envRoles[String(env)];
      if (!role) return `<td class="ut-empty">—</td>`;
      return `<td class="ut-role">${dimBadge("role", role)}</td>`;
    }).join("");

    const bitsSet = popcount(u.bitmask);

    return `
      <tr>
        <td class="ut-user">${u.icon} <strong>${u.name}</strong></td>
        ${envCells}
        <td class="ut-bits">${bitsSet} / ${vDef.size}</td>
      </tr>
    `;
  }).join("");

  const envHeaders = Array.from(dims.env.values).map((env) =>
    `<th>${dimBadge("env", String(env))}</th>`
  ).join("");

  return `
    <h2 class="concept-section-title">샘플 사용자</h2>
    <p class="concept-desc">각 사용자는 환경(env)마다 역할(role)을 갖고, 역할이 허용하는 모든 (resource, action) 조합에 대해 권한 비트가 설정됩니다.</p>

    <div class="concept-block">
      <div class="cb-header">사용자 × 환경 역할 매핑</div>
      <div class="cb-body">
        <table class="ev-tbl ut-table">
          <thead>
            <tr>
              <th>사용자</th>
              ${envHeaders}
              <th>권한 비트 수</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="mini-note">역할별 허용 액션: guest/viewer=read, editor=read+write, admin=read+write+delete, super_admin=all</p>
      </div>
    </div>
  `;
}

// ── 5. 인터랙티브 데모 ─────────────────────────────────────────────────────

function buildDemo(vDef: VersionDef): string {
  const dims = vDef.dims;

  const opt = (vals: readonly string[], placeholder: string) =>
    `<option value="">${placeholder}</option>` +
    Array.from(vals).map((v) => `<option value="${v}">${v}</option>`).join("");

  return `
    <h2 class="concept-section-title">인터랙티브 — 권한으로 사용자 찾기</h2>
    <p class="concept-desc">조건을 선택하면 그 권한을 가진 사용자를 즉시 필터링합니다.</p>

    <div class="concept-block">
      <div class="cb-header">권한 조건 선택</div>
      <div class="cb-body">
        <div class="filter-demo-row">
          <label class="filter-demo-label">resource</label>
          <select class="filter-demo-sel" id="fd-resource">
            ${opt(dims.resource.values, "전체")}
          </select>
          <label class="filter-demo-label">action</label>
          <select class="filter-demo-sel" id="fd-action">
            ${opt(dims.action.values, "전체")}
          </select>
          <label class="filter-demo-label">env</label>
          <select class="filter-demo-sel" id="fd-env">
            ${opt(dims.env.values, "전체")}
          </select>
        </div>
        <div id="fd-result" class="filter-demo-result"></div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────
//  Demo wiring
// ─────────────────────────────────────────────────────────────────────────

function wireDemo(container: HTMLElement, users: SampleUser[], vDef: VersionDef): void {
  const resSel = container.querySelector<HTMLSelectElement>("#fd-resource");
  const actSel = container.querySelector<HTMLSelectElement>("#fd-action");
  const envSel = container.querySelector<HTMLSelectElement>("#fd-env");
  const result = container.querySelector<HTMLDivElement>("#fd-result");
  if (!resSel || !actSel || !envSel || !result) return;

  function run(): void {
    const resVal = resSel.value;
    const actVal = actSel.value;
    const envVal = envSel.value;
    const dims   = vDef.dims;

    // Build CoordConstraint array and compute address ranges via calcAddressRanges
    const rIdx = resVal ? Array.from(dims.resource.values).indexOf(resVal) + 1 : null;
    const aIdx = actVal ? Array.from(dims.action.values).indexOf(actVal) + 1 : null;
    const eIdx = envVal ? Array.from(dims.env.values).indexOf(envVal) + 1 : null;

    const constraints: CoordConstraint[] = [
      rIdx !== null ? String(rIdx) : null,  // resource
      aIdx !== null ? String(aIdx) : null,  // action
      null,                                  // role (always free)
      eIdx !== null ? String(eIdx) : null,  // env
    ];
    const shape = [...vDef.shape];
    const ranges = calcAddressRanges(shape, constraints);

    // Count total addresses covered by ranges
    const totalAddresses = ranges.reduce((sum, [f, t]) => sum + (t - f + 1), 0);

    // Find matching users: check if any bit in their bitmask falls within the computed ranges
    const matched = users.filter((u) => {
      for (const [from, to] of ranges) {
        for (let addr = from; addr <= to; addr++) {
          if (hasBit(u.bitmask, addr)) return true;
        }
      }
      return false;
    });

    // Build formula explanation
    const nDims = [
      resVal ? `r=${rIdx}(${resVal})` : `r∈[1..${dims.resource.size}]`,
      actVal ? `a=${aIdx}(${actVal})` : `a∈[1..${dims.action.size}]`,
      `ro∈[1..${dims.role.size}]`,
      envVal ? `e=${eIdx}(${envVal})` : `e∈[1..${dims.env.size}]`,
    ];

    const formulaLine = `IDs = { encode([${nDims.join(", ")}]) } — ${totalAddresses}개 ID`;

    // Build weight formula using engine's describeRangeFormula
    const fixedCoords: Array<number | null> = [
      rIdx,
      aIdx,
      null, // role is always free in the filter query
      eIdx,
    ];
    const compactFormula = describeRangeFormula(
      vDef.weights as number[], fixedCoords, ["resource", "action", "role", "env"]
    );

    // Format ranges for display
    const rangeStr = ranges.length > 0
      ? ranges.map(([f, t]) => f === t ? `${f}` : `${f}-${t}`).join(", ")
      : "(없음)";

    result.innerHTML = `
      <div class="fd-formula-box">
        <div class="fd-formula-title">검색 수식</div>
        <code class="fd-formula-code">${formulaLine}</code>
        <code class="fd-formula-code">id = ${compactFormula}</code>
        <code class="fd-formula-code" style="font-size:0.68rem;color:var(--text-muted)">address ranges: [${rangeStr}] (${ranges.length}개 구간)</code>
        <div class="fd-bit-check">
          hasPermission = <code>user.bitmask[id &gt;&gt; 3] &amp; (1 &lt;&lt; (id &amp; 7))</code>
        </div>
      </div>
      <div class="fd-user-results">
        <div class="fd-result-title">
          매칭 사용자 <span class="fd-count">${matched.length} / ${users.length}명</span>
        </div>
        <div class="fd-user-list">
          ${users.map((u) => {
            const isMatch = matched.includes(u);
            // find which envs+roles contribute to the match
            const matchDetails: string[] = [];
            if (isMatch) {
              for (const [env, role] of Object.entries(u.envRoles)) {
                if (!role) continue;
                const envIdx  = Array.from(dims.env.values).indexOf(env)  + 1;
                const roIdx = Array.from(dims.role.values).indexOf(role) + 1;
                const checkEnv = envVal ? [envVal] : [env];
                if (!checkEnv.includes(env)) continue;
                // Build per-user range check: fix role and env, free resource and action per filter
                const userConstraints: CoordConstraint[] = [
                  rIdx !== null ? String(rIdx) : null,
                  aIdx !== null ? String(aIdx) : null,
                  String(roIdx),
                  String(envIdx),
                ];
                const userRanges = calcAddressRanges(shape, userConstraints);
                // Check if user has any bit set in these ranges
                let found = false;
                for (const [from, to] of userRanges) {
                  for (let addr = from; addr <= to; addr++) {
                    if (hasBit(u.bitmask, addr)) {
                      matchDetails.push(`${env}/${role}`);
                      found = true;
                      break;
                    }
                  }
                  if (found) break;
                }
              }
            }
            const uniqDetails = [...new Set(matchDetails)];

            return `
              <div class="fd-user-card ${isMatch ? "fd-match" : "fd-no-match"}">
                <span class="fd-user-icon">${u.icon}</span>
                <span class="fd-user-name">${u.name}</span>
                ${isMatch
                  ? `<span class="fd-user-via">via ${uniqDetails.map((d) => {
                      const [env, role] = d.split("/");
                      return `${dimBadge("env", env)} ${dimBadge("role", role)}`;
                    }).join(" · ")}</span>`
                  : '<span class="fd-user-none">권한 없음</span>'
                }
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  resSel.addEventListener("change", run);
  actSel.addEventListener("change", run);
  envSel.addEventListener("change", run);
  run();
}

