// ═══════════════════════════════════════════════════════════════════════════
//  버전 변경 — v1 / v2 비교 및 API 프로토콜 설명
// ═══════════════════════════════════════════════════════════════════════════
//
// 이 시트는 v1→v2 마이그레이션의 교육 목적으로 정적 데이터를 사용합니다.
// 동적 API 호출 대신 하드코딩하여 변경 사항을 명확하게 대비하여 보여줍니다.
// (역할 차원 5→6, 이벤트 차원 7→9, 기능 분리 등의 차이를 한눈에 비교)
//

// ── Static data ─────────────────────────────────────────────────────────────

const ROLES_V1 = [
  { id: "admin",     ko: "관리자",   isNew: false },
  { id: "developer", ko: "개발자",   isNew: false },
  { id: "operator",  ko: "운영자",   isNew: false },
  { id: "viewer",    ko: "뷰어",     isNew: false },
  { id: "readonly",  ko: "읽기전용", isNew: false },
];

const ROLES_V2 = [
  { id: "admin",     ko: "관리자",   isNew: false },
  { id: "developer", ko: "개발자",   isNew: false },
  { id: "operator",  ko: "운영자",   isNew: false },
  { id: "customer",  ko: "고객",     isNew: true  },
  { id: "viewer",    ko: "뷰어",     isNew: false },
  { id: "readonly",  ko: "읽기전용", isNew: false },
];

const EVENTS_V1 = [
  { id: "user.login",      ko: "로그인",   isNew: false },
  { id: "user.logout",     ko: "로그아웃", isNew: false },
  { id: "order.created",   ko: "주문 생성", isNew: false },
  { id: "order.paid",      ko: "주문 결제", isNew: false },
  { id: "payment.failed",  ko: "결제 실패", isNew: false },
  { id: "session.expired", ko: "세션 만료", isNew: false },
  { id: "config.changed",  ko: "설정 변경", isNew: false },
];

const EVENTS_V2 = [
  { id: "user.login",               ko: "로그인",    isNew: false },
  { id: "user.logout",              ko: "로그아웃",  isNew: false },
  { id: "order.created",            ko: "주문 생성",  isNew: false },
  { id: "order.paid",               ko: "주문 결제",  isNew: false },
  { id: "payment.failed",           ko: "결제 실패",  isNew: false },
  { id: "session.expired",          ko: "세션 만료",  isNew: false },
  { id: "config.changed",           ko: "설정 변경",  isNew: false },
  { id: "payment.cancel_requested", ko: "취소 요청",  isNew: true  },
  { id: "payment.cancel_approved",  ko: "취소 승인",  isNew: true  },
];

// permission × specific roles at payment svc (permSvcPos=7) for address examples
const PERM_EXAMPLES = [
  { role: "operator", roleKo: "운영자", v1Pos: 3, v2Pos: 3 },
  { role: "customer", roleKo: "고객",   v1Pos: null, v2Pos: 4 },
  { role: "viewer",   roleKo: "뷰어",   v1Pos: 4, v2Pos: 5 },
];

const FEATURES_V1 = [
  { id: "product_list",    name: "상품 목록 조회", grantedRoles: ["admin","developer","operator","viewer","readonly"] },
  { id: "order_list",      name: "주문 목록 조회", grantedRoles: ["admin","developer","operator","viewer"] },
  { id: "payment_history", name: "결제 내역 조회", grantedRoles: ["admin","developer","operator"] },
  { id: "payment_cancel",  name: "결제 취소",      grantedRoles: ["admin","developer","operator"] },
  { id: "user_mgmt",       name: "사용자 관리",    grantedRoles: ["admin"] },
  { id: "config_change",   name: "설정 변경",      grantedRoles: ["admin"] },
];

const FEATURES_V2 = [
  { id: "product_list",          name: "상품 목록 조회", grantedRoles: ["admin","developer","operator","customer","viewer","readonly"], status: "unchanged" },
  { id: "order_list",            name: "주문 목록 조회", grantedRoles: ["admin","developer","operator","viewer"],                       status: "unchanged" },
  { id: "payment_history",       name: "결제 내역 조회", grantedRoles: ["admin","developer","operator"],                               status: "unchanged" },
  { id: "payment_cancel_req",    name: "결제 취소 요청", grantedRoles: ["admin","customer"],                                           status: "added"     },
  { id: "payment_cancel_approve",name: "결제 취소 승인", grantedRoles: ["admin","operator"],                                           status: "added"     },
  { id: "user_mgmt",             name: "사용자 관리",    grantedRoles: ["admin"],                                                     status: "unchanged" },
  { id: "config_change",         name: "설정 변경",      grantedRoles: ["admin"],                                                     status: "unchanged" },
];

const ALL_ROLES_V1 = ["admin","developer","operator","viewer","readonly"];
const ALL_ROLES_V2 = ["admin","developer","operator","customer","viewer","readonly"];

function evtTagClass(id: string): string {
  if (id.startsWith("user."))    return "evt-tag evt-tag-user";
  if (id.startsWith("order."))   return "evt-tag evt-tag-order";
  if (id.startsWith("payment.")) return "evt-tag evt-tag-payment";
  if (id.startsWith("session.")) return "evt-tag evt-tag-session";
  if (id.startsWith("config."))  return "evt-tag evt-tag-config";
  return "evt-tag";
}

// ── Section builders ─────────────────────────────────────────────────────────

function buildRolesSection(ver: "v1" | "v2"): HTMLElement {
  const sec = document.createElement("div");
  sec.className = "vd-section";

  const roles = ver === "v1" ? ROLES_V1 : ROLES_V2;
  const count = roles.length;

  sec.innerHTML = `
    <div class="vd-sec-header">
      <span class="vd-sec-icon">👤</span>
      <span class="vd-sec-title">역할 (role) 차원</span>
      <span class="vd-shape-badge">${count}개 항목</span>
      ${ver === "v2" ? '<span class="vd-tag-new">+1 추가</span>' : ""}
    </div>
    <div class="vd-sec-body">
      <div class="vd-dim-list">
        ${roles.map((r, i) => `
          <div class="vd-dim-row ${r.isNew ? "vd-row-added" : ""}">
            <span class="vd-dim-pos">${i + 1}</span>
            <span class="role-tag role-tag-${r.id}">${r.id}</span>
            <span class="vd-dim-ko">${r.ko}</span>
            ${r.isNew ? '<span class="vd-badge-new">NEW</span>' : ""}
          </div>
        `).join("")}
      </div>
    </div>
  `;
  return sec;
}

function buildEventsSection(ver: "v1" | "v2"): HTMLElement {
  const sec = document.createElement("div");
  sec.className = "vd-section";

  const events = ver === "v1" ? EVENTS_V1 : EVENTS_V2;
  const count = events.length;

  sec.innerHTML = `
    <div class="vd-sec-header">
      <span class="vd-sec-icon">◈</span>
      <span class="vd-sec-title">이벤트명 (event_name) 차원</span>
      <span class="vd-shape-badge">${count}개 항목</span>
      ${ver === "v2" ? '<span class="vd-tag-new">+2 추가</span>' : ""}
    </div>
    <div class="vd-sec-body">
      <div class="vd-dim-list">
        ${events.map((e, i) => `
          <div class="vd-dim-row ${e.isNew ? "vd-row-added" : ""}">
            <span class="vd-dim-pos">${i + 1}</span>
            <span class="${evtTagClass(e.id)}">${e.id}</span>
            <span class="vd-dim-ko">${e.ko}</span>
            ${e.isNew ? '<span class="vd-badge-new">NEW</span>' : ""}
          </div>
        `).join("")}
      </div>
    </div>
  `;
  return sec;
}

function buildIndexShapeSection(ver: "v1" | "v2"): HTMLElement {
  const sec = document.createElement("div");
  sec.className = "vd-section";

  const perm = ver === "v1"
    ? { shape: "[10, 5]", slots: 50,  stride: 5,  formula: "(perm_svc−1)×5 + (role−1)",  max: 49,  prefix: "permission:v1" }
    : { shape: "[10, 6]", slots: 60,  stride: 6,  formula: "(perm_svc−1)×6 + (role−1)",  max: 59,  prefix: "permission:v2" };

  const evt = ver === "v1"
    ? { shape: "[10, 7, 2]", slots: 140, stride: 14, formula: "(svc−1)×14 + (event−1)×2 + (initiator−1)", max: 139, prefix: "event:v1" }
    : { shape: "[10, 9, 2]", slots: 180, stride: 18, formula: "(svc−1)×18 + (event−1)×2 + (initiator−1)", max: 179, prefix: "event:v2" };

  const changed = ver === "v2";

  sec.innerHTML = `
    <div class="vd-sec-header">
      <span class="vd-sec-icon">⊙</span>
      <span class="vd-sec-title">인덱스 형상 (Index Shape)</span>
      ${changed ? '<span class="vd-tag-changed">공식 변경</span>' : ""}
    </div>
    <div class="vd-sec-body">
      <div class="vd-index-grid">

        <div class="vd-index-card ${changed ? "vd-card-changed" : ""}">
          <div class="vd-index-card-header">
            <code class="vd-addr-prefix">${perm.prefix}</code>
            <span class="vd-shape-badge">${perm.shape}</span>
            <span class="vd-slot-count">${perm.slots}슬롯</span>
          </div>
          <div class="vd-formula-box">
            <span class="vd-formula-label">encode</span>
            <span class="vd-formula-expr">${perm.formula}</span>
          </div>
          <div class="vd-formula-meta">
            max value = <strong>${perm.max}</strong>
            &nbsp;·&nbsp; role stride = <strong>×${perm.stride}</strong>
          </div>
        </div>

        <div class="vd-index-card ${changed ? "vd-card-changed" : ""}">
          <div class="vd-index-card-header">
            <code class="vd-addr-prefix">${evt.prefix}</code>
            <span class="vd-shape-badge">${evt.shape}</span>
            <span class="vd-slot-count">${evt.slots}슬롯</span>
          </div>
          <div class="vd-formula-box">
            <span class="vd-formula-label">encode</span>
            <span class="vd-formula-expr">${evt.formula}</span>
          </div>
          <div class="vd-formula-meta">
            max value = <strong>${evt.max}</strong>
            &nbsp;·&nbsp; svc stride = <strong>×${evt.stride}</strong>
          </div>
        </div>

        <div class="vd-index-card">
          <div class="vd-index-card-header">
            <code class="vd-addr-prefix">service:v1</code>
            <span class="vd-shape-badge">[5, 2, 5, 2]</span>
            <span class="vd-slot-count">100슬롯</span>
          </div>
          <div class="vd-formula-box">
            <span class="vd-formula-label">encode</span>
            <span class="vd-formula-expr">(env−1)×20 + (region−1)×10 + (svc−1)×2 + (ns−1)</span>
          </div>
          <div class="vd-formula-meta">
            max value = <strong>99</strong>
            &nbsp;·&nbsp; <span style="color:#27ae60;font-weight:600">v1 유지 (변경 없음)</span>
          </div>
        </div>

      </div>
    </div>
  `;
  return sec;
}

function buildFeaturesSection(ver: "v1" | "v2"): HTMLElement {
  const sec = document.createElement("div");
  sec.className = "vd-section";

  const allRoles = ver === "v1" ? ALL_ROLES_V1 : ALL_ROLES_V2;

  sec.innerHTML = `
    <div class="vd-sec-header">
      <span class="vd-sec-icon">⊡</span>
      <span class="vd-sec-title">기능 × 역할 접근 배정</span>
      ${ver === "v2" ? '<span class="vd-tag-changed">구조 변경</span>' : ""}
    </div>
    <div class="vd-sec-body">
      <div style="overflow-x:auto">
        <table class="vd-feat-table">
          <thead>
            <tr>
              <th class="vd-feat-name-col">기능</th>
              ${allRoles.map((r) => `<th><span class="role-tag role-tag-${r}">${r}</span></th>`).join("")}
              ${ver === "v2" ? '<th class="vd-feat-status-col">상태</th>' : ""}
            </tr>
          </thead>
          <tbody>
            ${ver === "v1"
              ? FEATURES_V1.map((f) => `
                <tr>
                  <td class="vd-feat-name">${f.name}</td>
                  ${ALL_ROLES_V1.map((r) => {
                    const has = f.grantedRoles.includes(r);
                    return `<td class="vd-feat-cell ${has ? "vd-cell-ok" : "vd-cell-no"}">${has ? "✓" : "✗"}</td>`;
                  }).join("")}
                </tr>
              `).join("")
              : FEATURES_V2.map((f) => {
                  const v1Feature = FEATURES_V1.find((fv1) =>
                    fv1.id === f.id || (f.id.startsWith("payment_cancel") && fv1.id === "payment_cancel")
                  );
                  const rowClass = f.status === "added" ? "vd-row-added" : "";
                  return `
                    <tr class="${rowClass}">
                      <td class="vd-feat-name">${f.name}</td>
                      ${ALL_ROLES_V2.map((r) => {
                        const has = f.grantedRoles.includes(r);
                        const had = v1Feature?.grantedRoles.includes(r) ?? null;
                        let cls = has ? "vd-cell-ok" : "vd-cell-no";
                        if (f.status === "added") cls += " vd-cell-new";
                        else if (had !== null && had !== has) cls = has ? "vd-cell-ok vd-cell-gained" : "vd-cell-no vd-cell-lost";
                        return `<td class="vd-feat-cell ${cls}">${has ? "✓" : "✗"}</td>`;
                      }).join("")}
                      <td class="vd-feat-status">
                        ${f.status === "added"
                          ? '<span class="vd-badge-new">NEW</span>'
                          : '<span class="vd-badge-unchanged">유지</span>'}
                      </td>
                    </tr>
                  `;
                }).join("")
            }
            ${ver === "v1" ? "" : `
              <tr class="vd-row-removed">
                <td class="vd-feat-name" style="text-decoration:line-through;color:var(--text-muted)">결제 취소 (payment_cancel)</td>
                ${ALL_ROLES_V2.map(() => `<td class="vd-feat-cell vd-cell-no">—</td>`).join("")}
                <td class="vd-feat-status"><span class="vd-badge-removed">분리됨</span></td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `;
  return sec;
}

function buildAddressExamplesSection(ver: "v1" | "v2"): HTMLElement {
  const sec = document.createElement("div");
  sec.className = "vd-section";

  // permission: payment (permSvcPos=7)
  const permExamples = [
    { role: "operator", ko: "운영자", v1: (7-1)*5+(3-1), v2: (7-1)*6+(3-1) },
    { role: "customer", ko: "고객",   v1: null,           v2: (7-1)*6+(4-1) },
    { role: "viewer",   ko: "뷰어",   v1: (7-1)*5+(4-1), v2: (7-1)*6+(5-1) },
  ];

  // event: order.paid × payment:prod × web
  const evtExamples = [
    { name: "order.paid × payment:prod × web",    ko: "주문 결제",  v1: (9-1)*14+(4-1)*2+0, v2: (9-1)*18+(4-1)*2+0 },
    { name: "payment.cancel_requested × payment:prod × web", ko: "취소 요청", v1: null, v2: (9-1)*18+(8-1)*2+0 },
    { name: "payment.cancel_approved × payment:prod × web",  ko: "취소 승인", v1: null, v2: (9-1)*18+(9-1)*2+0 },
  ];

  const showV2 = ver === "v2";

  sec.innerHTML = `
    <div class="vd-sec-header">
      <span class="vd-sec-icon">🔢</span>
      <span class="vd-sec-title">주소 값 예시 — payment 서비스 (permSvcPos=7, evtSvcPos=9)</span>
    </div>
    <div class="vd-sec-body">
      <div class="vd-addr-title">permission 주소 (역할별)</div>
      <div class="vd-addr-table-wrap">
        <table class="vd-addr-table">
          <thead>
            <tr>
              <th>역할</th>
              <th>논리 의미</th>
              <th class="${showV2 ? "vd-col-dimmed" : ""}">permission:v1</th>
              <th class="${showV2 ? "vd-col-active" : ""}">permission:v2</th>
            </tr>
          </thead>
          <tbody>
            ${permExamples.map((ex) => `
              <tr class="${ex.v1 === null ? "vd-row-added" : ""}">
                <td><span class="role-tag role-tag-${ex.role}">${ex.role}</span></td>
                <td class="vd-addr-desc">payment × ${ex.ko}</td>
                <td class="${showV2 ? "vd-col-dimmed" : ""}">
                  ${ex.v1 !== null
                    ? `<code class="vd-addr-chip">permission:v1:${ex.v1}</code>`
                    : `<span style="color:var(--text-muted)">존재 안 함</span>`}
                </td>
                <td class="${showV2 ? "vd-col-active" : ""}">
                  ${ex.v2 !== null
                    ? `<code class="vd-addr-chip ${showV2 ? "vd-chip-active" : ""}">${`permission:v2:${ex.v2}`}</code>`
                    : `<span style="color:var(--text-muted)">—</span>`}
                  ${ex.v1 !== null && ex.v2 !== null && ex.v1 !== ex.v2 && showV2
                    ? `<span class="vd-addr-diff">(v1: ${ex.v1})</span>`
                    : ""}
                  ${ex.v1 === null && showV2 ? '<span class="vd-badge-new">NEW</span>' : ""}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div class="vd-addr-title" style="margin-top:14px">event 주소 (payment:prod 서비스)</div>
      <div class="vd-addr-table-wrap">
        <table class="vd-addr-table">
          <thead>
            <tr>
              <th>이벤트</th>
              <th>설명</th>
              <th class="${showV2 ? "vd-col-dimmed" : ""}">event:v1</th>
              <th class="${showV2 ? "vd-col-active" : ""}">event:v2</th>
            </tr>
          </thead>
          <tbody>
            ${evtExamples.map((ex) => `
              <tr class="${ex.v1 === null ? "vd-row-added" : ""}">
                <td><span class="evt-tag evt-tag-payment">${ex.ko}</span></td>
                <td class="vd-addr-desc" style="font-size:0.72rem">${ex.name}</td>
                <td class="${showV2 ? "vd-col-dimmed" : ""}">
                  ${ex.v1 !== null
                    ? `<code class="vd-addr-chip">event:v1:${ex.v1}</code>`
                    : `<span style="color:var(--text-muted)">존재 안 함</span>`}
                </td>
                <td class="${showV2 ? "vd-col-active" : ""}">
                  ${ex.v2 !== null
                    ? `<code class="vd-addr-chip ${showV2 ? "vd-chip-active" : ""}">${`event:v2:${ex.v2}`}</code>`
                    : `<span style="color:var(--text-muted)">—</span>`}
                  ${ex.v1 !== null && ex.v2 !== null && ex.v1 !== ex.v2 && showV2
                    ? `<span class="vd-addr-diff">(v1: ${ex.v1})</span>`
                    : ""}
                  ${ex.v1 === null && showV2 ? '<span class="vd-badge-new">NEW</span>' : ""}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
  return sec;
}

function buildProtocolSection(): HTMLElement {
  const sec = document.createElement("div");
  sec.className = "vd-section vd-section-protocol";

  sec.innerHTML = `
    <div class="vd-sec-header">
      <span class="vd-sec-icon">📡</span>
      <span class="vd-sec-title">API 프로토콜 변경 설명</span>
      <span class="vd-tag-changed">Breaking Change</span>
    </div>
    <div class="vd-sec-body">

      <div class="vd-protocol-grid">

        <div class="vd-protocol-card">
          <div class="vd-protocol-card-title">① 주소 prefix 변경</div>
          <div class="vd-protocol-card-body">
            <div class="vd-proto-row">
              <span class="vd-proto-label">권한 주소</span>
              <code class="vd-addr-chip vd-chip-old">permission:v1:X</code>
              <span class="vd-proto-arrow">→</span>
              <code class="vd-addr-chip vd-chip-active">permission:v2:X</code>
            </div>
            <div class="vd-proto-row">
              <span class="vd-proto-label">이벤트 주소</span>
              <code class="vd-addr-chip vd-chip-old">event:v1:X</code>
              <span class="vd-proto-arrow">→</span>
              <code class="vd-addr-chip vd-chip-active">event:v2:X</code>
            </div>
            <div class="vd-proto-row">
              <span class="vd-proto-label">서비스 주소</span>
              <code class="vd-addr-chip">service:v1:X</code>
              <span class="vd-proto-note">변경 없음</span>
            </div>
            <div class="vd-protocol-note">
              v1과 v2 주소는 동일한 숫자라도 <strong>다른 논리 의미</strong>를 가집니다.<br/>
              예) <code>permission:v1:33</code> = payment × viewer,
              <code>permission:v2:33</code> = payment × customer
            </div>
          </div>
        </div>

        <div class="vd-protocol-card">
          <div class="vd-protocol-card-title">② 인코딩 공식 변경</div>
          <div class="vd-protocol-card-body">
            <div class="vd-formula-diff">
              <div class="vd-formula-old">
                <span class="vd-formula-ver">v1</span>
                <span class="vd-formula-expr">(perm_svc−1) × <strong>5</strong> + (role−1)</span>
              </div>
              <div class="vd-formula-new">
                <span class="vd-formula-ver vd-ver-new">v2</span>
                <span class="vd-formula-expr">(perm_svc−1) × <strong>6</strong> + (role−1)</span>
              </div>
            </div>
            <div class="vd-formula-diff">
              <div class="vd-formula-old">
                <span class="vd-formula-ver">v1</span>
                <span class="vd-formula-expr">(svc−1) × <strong>14</strong> + (evt−1)×2 + (init−1)</span>
              </div>
              <div class="vd-formula-new">
                <span class="vd-formula-ver vd-ver-new">v2</span>
                <span class="vd-formula-expr">(svc−1) × <strong>18</strong> + (evt−1)×2 + (init−1)</span>
              </div>
            </div>
            <div class="vd-protocol-note">
              role 차원이 5→6개로 늘어나 permission stride가 5→6으로 변경.<br/>
              event 차원이 7→9개로 늘어나 event stride가 14(=7×2)→18(=9×2)으로 변경.
            </div>
          </div>
        </div>

        <div class="vd-protocol-card">
          <div class="vd-protocol-card-title">③ 기능 분리 (Breaking)</div>
          <div class="vd-protocol-card-body">
            <div class="vd-split-diagram">
              <div class="vd-split-old">
                <code class="vd-feat-chip vd-chip-old">payment_cancel</code>
                <div class="vd-split-old-roles">admin · developer · operator</div>
              </div>
              <div class="vd-split-arrow">분리 ↓</div>
              <div class="vd-split-new">
                <div class="vd-split-row">
                  <code class="vd-feat-chip vd-chip-active">payment_cancel_req</code>
                  <span class="vd-split-roles">admin · <span class="role-tag role-tag-customer">customer</span></span>
                </div>
                <div class="vd-split-row">
                  <code class="vd-feat-chip vd-chip-active">payment_cancel_approve</code>
                  <span class="vd-split-roles">admin · <span class="role-tag role-tag-operator">operator</span></span>
                </div>
              </div>
            </div>
            <div class="vd-protocol-note">
              developer는 v1에서 결제 취소 권한을 보유했으나<br/>
              v2에서는 두 기능 모두에서 <strong>의도적으로 제외</strong>됩니다.
            </div>
          </div>
        </div>

        <div class="vd-protocol-card">
          <div class="vd-protocol-card-title">④ 마이그레이션 영향</div>
          <div class="vd-protocol-card-body">
            <div class="vd-migration-list">
              <div class="vd-migration-row vd-mig-breaking">
                <span class="vd-mig-icon">⚠</span>
                <span>저장된 <code>permission:v1:X</code> 주소를 v2 주소로 재계산 필요</span>
              </div>
              <div class="vd-migration-row vd-mig-breaking">
                <span class="vd-mig-icon">⚠</span>
                <span>저장된 <code>event:v1:X</code> 주소를 v2 주소로 재계산 필요</span>
              </div>
              <div class="vd-migration-row vd-mig-breaking">
                <span class="vd-mig-icon">⚠</span>
                <span><code>payment_cancel</code> featureId 참조를 두 개로 분리</span>
              </div>
              <div class="vd-migration-row vd-mig-ok">
                <span class="vd-mig-icon">✓</span>
                <span><code>service:v1:X</code> 주소 변경 없음</span>
              </div>
              <div class="vd-migration-row vd-mig-ok">
                <span class="vd-mig-icon">✓</span>
                <span>기존 5개 역할의 상대적 순서 유지 (customer는 operator 다음 삽입)</span>
              </div>
              <div class="vd-migration-row vd-mig-ok">
                <span class="vd-mig-icon">✓</span>
                <span>기존 7개 이벤트명의 position 유지 (신규 2개는 뒤에 추가)</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;
  return sec;
}

// ── Main render ──────────────────────────────────────────────────────────────

export function renderVersionPage(
  container: HTMLElement,
  onVersionChange?: (ver: "v1" | "v2") => void,
  initialVer: "v1" | "v2" = "v2",
): void {
  container.innerHTML = "";

  let activeVer: "v1" | "v2" = initialVer;

  // ── Version selector bar ──
  const verBar = document.createElement("div");
  verBar.className = "vd-ver-bar";
  verBar.innerHTML = `
    <span class="vd-ver-label">스키마 버전</span>
    <button class="vd-ver-btn${initialVer === "v1" ? " vd-ver-btn-active" : ""}" data-ver="v1">v1</button>
    <button class="vd-ver-btn${initialVer === "v2" ? " vd-ver-btn-active" : ""}" data-ver="v2">v2</button>
    <span class="vd-ver-hint">v2에는 신규 항목이 강조 표시됩니다</span>
  `;
  container.appendChild(verBar);

  // ── Content area ──
  const content = document.createElement("div");
  content.className = "vd-content";
  container.appendChild(content);

  function render(ver: "v1" | "v2"): void {
    content.innerHTML = "";

    const twoCol = document.createElement("div");
    twoCol.className = "vd-two-col";

    const leftCol = document.createElement("div");
    leftCol.className = "vd-col";
    leftCol.appendChild(buildRolesSection(ver));
    leftCol.appendChild(buildEventsSection(ver));

    const rightCol = document.createElement("div");
    rightCol.className = "vd-col";
    rightCol.appendChild(buildIndexShapeSection(ver));
    rightCol.appendChild(buildAddressExamplesSection(ver));

    twoCol.appendChild(leftCol);
    twoCol.appendChild(rightCol);
    content.appendChild(twoCol);
    content.appendChild(buildFeaturesSection(ver));
    content.appendChild(buildProtocolSection());
  }

  verBar.querySelectorAll<HTMLButtonElement>(".vd-ver-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeVer = btn.dataset["ver"] as "v1" | "v2";
      verBar.querySelectorAll<HTMLButtonElement>(".vd-ver-btn").forEach((b) => {
        b.classList.toggle("vd-ver-btn-active", b.dataset["ver"] === activeVer);
      });
      render(activeVer);
      onVersionChange?.(activeVer);
    });
  });

  render(activeVer);
}
