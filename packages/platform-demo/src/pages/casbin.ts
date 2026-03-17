// ═══════════════════════════════════════════════════════════════════════════
//  Casbin 권한 모델 해설 — qa-sdk 주소 체계 ↔ Casbin 대비
// ═══════════════════════════════════════════════════════════════════════════

import {
  fetchGrantTable,
  fetchFeatures,
  type GrantRow,
  type FeaturesResponse,
} from "../registry.js";

// ── Step navigation ───────────────────────────────────────────────────────

type StepId = "ours" | "casbin-rbac" | "casbin-abac";

const STEPS: { id: StepId; num: string; title: string; desc: string }[] = [
  { id: "ours",        num: "1", title: "qa-sdk가 이미 하고 있는 것",     desc: "weighted-index 기반 정수 주소 인코딩" },
  { id: "casbin-rbac", num: "2", title: "같은 것을 Casbin으로 표현하면",   desc: "RBAC 모델 + 정책 CSV 매핑" },
  { id: "casbin-abac", num: "3", title: "ABAC로 확장하면",               desc: "객체 속성 기반 다차원 권한 검사" },
];

// ── Render helpers ────────────────────────────────────────────────────────

function renderStepNav(active: StepId, onSwitch: (id: StepId) => void): HTMLElement {
  const nav = document.createElement("div");
  nav.className = "cb-step-nav";
  for (const s of STEPS) {
    const btn = document.createElement("button");
    btn.className = `cb-step-btn${s.id === active ? " cb-step-active" : ""}`;
    btn.innerHTML = `<span class="cb-step-num">${s.num}</span><span class="cb-step-label">${s.title}</span>`;
    btn.addEventListener("click", () => onSwitch(s.id));
    nav.appendChild(btn);
  }
  return nav;
}

// ── Step 1: qa-sdk 기존 시스템 ────────────────────────────────────────────

function renderStepOurs(rows: GrantRow[], features: FeaturesResponse): HTMLElement {
  const el = document.createElement("div");
  el.className = "cb-step-content cb-fade-in";

  // 인코딩 설명
  const intro = document.createElement("div");
  intro.className = "cb-card";
  intro.innerHTML = `
    <div class="cb-card-head">
      <span class="cb-card-icon">⊞</span>
      <span class="cb-card-title">weighted-index: 다차원 좌표 → 정수 주소</span>
    </div>
    <div class="cb-card-body">
      <p class="cb-desc">qa-sdk는 <strong>mixed-radix 인코딩</strong>으로 다차원 좌표를 하나의 정수로 압축합니다.</p>
      <div class="cb-formula-box">
        <div class="cb-formula-label">서비스 인코딩</div>
        <code class="cb-formula">encode([env, region, svc_name, ns]) = (env-1)×20 + (region-1)×10 + (svc_name-1)×2 + (ns-1)</code>
        <div class="cb-formula-example">예: [prod, asia, payment, shop] → (3-1)×20 + (1-1)×10 + (4-1)×2 + (1-1) = <strong>46</strong></div>
      </div>
      <div class="cb-formula-box">
        <div class="cb-formula-label">권한 인코딩 (v2)</div>
        <code class="cb-formula">permAddr = (perm_svc - 1) × 6 + (role - 1)</code>
        <div class="cb-formula-example">예: perm_svc=9 (결제/쇼핑), role=4 (고객) → 8×6 + 3 = <strong>51</strong></div>
      </div>
    </div>
  `;
  el.appendChild(intro);

  // 실제 grant 데이터로 매트릭스 미리보기
  const matrix = document.createElement("div");
  matrix.className = "cb-card";
  matrix.innerHTML = `
    <div class="cb-card-head">
      <span class="cb-card-icon">⊡</span>
      <span class="cb-card-title">grant 매트릭스 (현재 상태)</span>
    </div>
  `;
  const matBody = document.createElement("div");
  matBody.className = "cb-card-body";

  // 매트릭스 테이블 빌드
  const tbl = document.createElement("table");
  tbl.className = "cb-matrix-table";

  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  const thCorner = document.createElement("th");
  thCorner.textContent = "기능 \\ 역할";
  hr.appendChild(thCorner);
  for (const role of features.roles) {
    const th = document.createElement("th");
    th.innerHTML = `<span class="role-tag role-tag-${role.id}">${role.ko}</span>`;
    hr.appendChild(th);
  }
  thead.appendChild(hr);
  tbl.appendChild(thead);

  const tbody = document.createElement("tbody");
  features.features.forEach((feat, fi) => {
    const tr = document.createElement("tr");
    const tdName = document.createElement("td");
    tdName.className = "cb-matrix-feat";
    tdName.textContent = feat.name;
    tr.appendChild(tdName);

    features.roles.forEach((role, ri) => {
      const td = document.createElement("td");
      td.className = "cb-matrix-cell";
      const granted = features.matrix[fi]?.[ri] ?? false;
      td.textContent = granted ? "✓" : "✗";
      td.style.color = granted ? "#27ae60" : "#c0392b";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);
  matBody.appendChild(tbl);
  matrix.appendChild(matBody);

  // 주소 매핑 예시 (실제 데이터에서 추출)
  const examples = rows.filter(r => r.featureId === "payment_history").slice(0, 3);
  if (examples.length > 0) {
    const addrCard = document.createElement("div");
    addrCard.className = "cb-addr-examples";
    addrCard.innerHTML = `<div class="cb-addr-title">결제 내역 조회 — 주소 매핑 예시</div>`;
    for (const ex of examples) {
      const row = document.createElement("div");
      row.className = `cb-addr-row ${ex.granted ? "cb-addr-ok" : "cb-addr-denied"}`;
      row.innerHTML = `
        <span class="scenario-addr-chip">${ex.permAddr}</span>
        <span class="cb-addr-svc">${ex.svcNameKo}</span>
        <span class="cb-addr-sep">×</span>
        <span class="role-tag role-tag-${ex.role}">${ex.roleKo}</span>
        <span class="cb-addr-result">${ex.granted ? "✓ 부여됨" : "✗ 미부여"}</span>
      `;
      addrCard.appendChild(row);
    }
    matBody.appendChild(addrCard);
  }

  el.appendChild(matrix);

  // 특성 요약
  const traits = document.createElement("div");
  traits.className = "cb-card";
  traits.innerHTML = `
    <div class="cb-card-head">
      <span class="cb-card-icon">◈</span>
      <span class="cb-card-title">특성 요약</span>
    </div>
    <div class="cb-card-body">
      <div class="cb-trait-grid">
        <div class="cb-trait">
          <div class="cb-trait-label">저장</div>
          <div class="cb-trait-val">정수 주소 기반 grant/deny 비트맵</div>
        </div>
        <div class="cb-trait">
          <div class="cb-trait-label">확장</div>
          <div class="cb-trait-val">shape 변경으로 차원 자동 확장 (v1→v2: role 5→6)</div>
        </div>
        <div class="cb-trait">
          <div class="cb-trait-label">직렬화</div>
          <div class="cb-trait-val">protobuf varint — 단일 정수 전송</div>
        </div>
        <div class="cb-trait">
          <div class="cb-trait-label">조회 성능</div>
          <div class="cb-trait-val">O(1) 정수 비교</div>
        </div>
      </div>
    </div>
  `;
  el.appendChild(traits);

  return el;
}

// ── Step 2: Casbin RBAC ───────────────────────────────────────────────────

function renderStepCasbinRbac(features: FeaturesResponse): HTMLElement {
  const el = document.createElement("div");
  el.className = "cb-step-content cb-fade-in";

  // model.conf
  const modelCard = document.createElement("div");
  modelCard.className = "cb-card";
  modelCard.innerHTML = `
    <div class="cb-card-head">
      <span class="cb-card-icon">&#x2699;</span>
      <span class="cb-card-title">model.conf — RBAC 모델 정의</span>
    </div>
    <div class="cb-card-body">
      <p class="cb-desc">Casbin은 <strong>모델</strong>(규칙의 형태)과 <strong>정책</strong>(데이터)을 분리합니다.</p>
      <pre class="cb-code"><span class="cb-code-comment"># request_definition: 누가, 무엇에, 어떤 행동을</span>
[request_definition]
r = sub, obj, act

<span class="cb-code-comment"># policy_definition: 허용 규칙</span>
[policy_definition]
p = sub, obj, act

<span class="cb-code-comment"># role_definition: 역할 계층 (admin ⊃ operator ⊃ viewer)</span>
[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

<span class="cb-code-comment"># matchers: 요청이 정책에 부합하는지 판단</span>
[matchers]
m = g(r.sub, p.sub) && r.obj == p.obj && r.act == p.act</pre>
    </div>
  `;
  el.appendChild(modelCard);

  // policy.csv — 실제 grant 데이터에서 생성
  const policyCard = document.createElement("div");
  policyCard.className = "cb-card";

  let policyLines = `<span class="cb-code-comment"># ── 역할 계층 (role hierarchy) ──</span>\n`;
  policyLines += `g, admin, operator\n`;
  policyLines += `g, operator, viewer\n`;
  policyLines += `g, developer, viewer\n\n`;
  policyLines += `<span class="cb-code-comment"># ── 권한 정책: grant 매트릭스에서 자동 변환 ──</span>\n`;

  features.features.forEach((feat) => {
    const granted = features.roles
      .filter((_, ri) => features.matrix[features.features.indexOf(feat)]?.[ri])
      .map(r => r.id);
    for (const role of granted) {
      policyLines += `p, ${role}, ${feat.id}, read\n`;
    }
  });

  policyCard.innerHTML = `
    <div class="cb-card-head">
      <span class="cb-card-icon">&#x1F4CB;</span>
      <span class="cb-card-title">policy.csv — grant 매트릭스 → Casbin 정책</span>
    </div>
    <div class="cb-card-body">
      <p class="cb-desc">qa-sdk의 grant 매트릭스를 Casbin 정책으로 1:1 변환하면 다음과 같습니다.</p>
      <pre class="cb-code">${policyLines.trimEnd()}</pre>
    </div>
  `;
  el.appendChild(policyCard);

  // enforce 예시
  const enforceCard = document.createElement("div");
  enforceCard.className = "cb-card";
  enforceCard.innerHTML = `
    <div class="cb-card-head">
      <span class="cb-card-icon">&#x25B6;</span>
      <span class="cb-card-title">enforce() 호출 예시</span>
    </div>
    <div class="cb-card-body">
      <pre class="cb-code"><span class="cb-code-kw">import</span> { <span class="cb-code-fn">newEnforcer</span> } <span class="cb-code-kw">from</span> <span class="cb-code-str">'casbin'</span>;

<span class="cb-code-kw">const</span> e = <span class="cb-code-kw">await</span> <span class="cb-code-fn">newEnforcer</span>(<span class="cb-code-str">'model.conf'</span>, <span class="cb-code-str">'policy.csv'</span>);

<span class="cb-code-comment">// viewer가 결제 내역을 볼 수 있는가?</span>
<span class="cb-code-kw">await</span> e.<span class="cb-code-fn">enforce</span>(<span class="cb-code-str">'viewer'</span>, <span class="cb-code-str">'payment_history'</span>, <span class="cb-code-str">'read'</span>);
<span class="cb-code-comment">// → true (직접 부여됨)</span>

<span class="cb-code-comment">// customer가 결제 취소 승인을 할 수 있는가?</span>
<span class="cb-code-kw">await</span> e.<span class="cb-code-fn">enforce</span>(<span class="cb-code-str">'customer'</span>, <span class="cb-code-str">'payment_cancel_approve'</span>, <span class="cb-code-str">'read'</span>);
<span class="cb-code-comment">// → false (admin, operator만 가능)</span>

<span class="cb-code-comment">// admin은 operator 역할을 상속 → operator 권한도 자동 허용</span>
<span class="cb-code-kw">await</span> e.<span class="cb-code-fn">enforce</span>(<span class="cb-code-str">'admin'</span>, <span class="cb-code-str">'payment_cancel_req'</span>, <span class="cb-code-str">'read'</span>);
<span class="cb-code-comment">// → true (g, admin, operator 계층 상속)</span></pre>
      <div class="cb-note">
        <strong>Casbin 특유 기능:</strong> <code>g, admin, operator</code> 한 줄로 역할 계층을 정의합니다.
        qa-sdk에서는 각 역할에 개별 grant를 부여해야 하지만, Casbin은 상위 역할이 하위 역할의 권한을 자동 상속합니다.
      </div>
    </div>
  `;
  el.appendChild(enforceCard);

  // 비교 테이블
  const cmpCard = document.createElement("div");
  cmpCard.className = "cb-card";
  cmpCard.innerHTML = `
    <div class="cb-card-head">
      <span class="cb-card-icon">&#x2194;</span>
      <span class="cb-card-title">qa-sdk vs Casbin RBAC 비교</span>
    </div>
    <div class="cb-card-body">
      <table class="cb-cmp-table">
        <thead>
          <tr><th></th><th>qa-sdk (weighted-index)</th><th>Casbin RBAC</th></tr>
        </thead>
        <tbody>
          <tr>
            <td class="cb-cmp-key">주소 체계</td>
            <td>(svc × role) → 정수 주소</td>
            <td>(sub, obj, act) 문자열 트리플</td>
          </tr>
          <tr>
            <td class="cb-cmp-key">정책 저장</td>
            <td class="cb-cmp-pro"><span class="cb-badge cb-badge-pro">PRO</span> grant/deny 비트맵 — 컴팩트</td>
            <td class="cb-cmp-con"><span class="cb-badge cb-badge-con">CON</span> 정책 행 수 = 규칙 수만큼 증가</td>
          </tr>
          <tr>
            <td class="cb-cmp-key">역할 계층</td>
            <td class="cb-cmp-con"><span class="cb-badge cb-badge-con">CON</span> 각 역할에 개별 grant 필요</td>
            <td class="cb-cmp-pro"><span class="cb-badge cb-badge-pro">PRO</span> <code>g(admin, operator)</code> 한 줄로 상속</td>
          </tr>
          <tr>
            <td class="cb-cmp-key">조회 성능</td>
            <td class="cb-cmp-pro"><span class="cb-badge cb-badge-pro">PRO</span> O(1) 정수 비교</td>
            <td class="cb-cmp-con"><span class="cb-badge cb-badge-con">CON</span> O(n) 정책 순회 매칭</td>
          </tr>
          <tr>
            <td class="cb-cmp-key">차원 확장</td>
            <td class="cb-cmp-pro"><span class="cb-badge cb-badge-pro">PRO</span> shape 변경으로 자동 확장</td>
            <td class="cb-cmp-con"><span class="cb-badge cb-badge-con">CON</span> model.conf 재정의 필요</td>
          </tr>
          <tr>
            <td class="cb-cmp-key">직렬화 크기</td>
            <td class="cb-cmp-pro"><span class="cb-badge cb-badge-pro">PRO</span> varint 1~2 bytes</td>
            <td class="cb-cmp-con"><span class="cb-badge cb-badge-con">CON</span> 문자열 그대로 전송</td>
          </tr>
          <tr>
            <td class="cb-cmp-key">가독성</td>
            <td class="cb-cmp-con"><span class="cb-badge cb-badge-con">CON</span> 정수 주소 → 디코딩 필요</td>
            <td class="cb-cmp-pro"><span class="cb-badge cb-badge-pro">PRO</span> 사람이 읽을 수 있는 문자열</td>
          </tr>
          <tr>
            <td class="cb-cmp-key">에코시스템</td>
            <td class="cb-cmp-con"><span class="cb-badge cb-badge-con">CON</span> 자체 구현 — 학습 곡선</td>
            <td class="cb-cmp-pro"><span class="cb-badge cb-badge-pro">PRO</span> 다수 언어 지원, 커뮤니티</td>
          </tr>
        </tbody>
      </table>
      <div class="cb-verdict">
        <div class="cb-verdict-col">
          <div class="cb-verdict-title cb-verdict-qa">weighted-index 선택 기준</div>
          <ul class="cb-verdict-list">
            <li>서버간 고성능 통신 (마이크로서비스 이벤트 버스)</li>
            <li>대량 로그 태깅 — 주소 1~2 bytes로 압축</li>
            <li>shape 기반 버전 관리가 필요한 경우</li>
          </ul>
        </div>
        <div class="cb-verdict-col">
          <div class="cb-verdict-title cb-verdict-casbin">Casbin RBAC 선택 기준</div>
          <ul class="cb-verdict-list">
            <li>API 게이트웨이 접근 제어</li>
            <li>역할 계층이 복잡한 조직 구조</li>
            <li>비개발자도 정책을 편집해야 하는 경우</li>
          </ul>
        </div>
      </div>
    </div>
  `;
  el.appendChild(cmpCard);

  return el;
}

// ── Step 3: Casbin ABAC ───────────────────────────────────────────────────

function renderStepCasbinAbac(): HTMLElement {
  const el = document.createElement("div");
  el.className = "cb-step-content cb-fade-in";

  // ABAC 개념
  const conceptCard = document.createElement("div");
  conceptCard.className = "cb-card";
  conceptCard.innerHTML = `
    <div class="cb-card-head">
      <span class="cb-card-icon">&#x1F50D;</span>
      <span class="cb-card-title">ABAC: 객체 속성 기반 권한 검사</span>
    </div>
    <div class="cb-card-body">
      <p class="cb-desc">
        RBAC는 "누가" 기준이지만, ABAC는 <strong>"누가 + 어떤 조건에서"</strong> 를 판단합니다.<br/>
        qa-sdk의 다차원 좌표 (env, region, svc, ns)를 Casbin ABAC의 속성 비교로 표현할 수 있습니다.
      </p>
      <div class="cb-abac-diagram">
        <div class="cb-abac-box cb-abac-qa">
          <div class="cb-abac-box-title">qa-sdk 방식</div>
          <code>permAddr = encode([prod, asia, payment, shop, operator])</code>
          <div class="cb-abac-arrow">→ 정수 51</div>
        </div>
        <div class="cb-abac-vs">vs</div>
        <div class="cb-abac-box cb-abac-casbin">
          <div class="cb-abac-box-title">Casbin ABAC 방식</div>
          <code>enforce(user, resource, "read")</code>
          <div class="cb-abac-arrow">→ matcher에서 속성 비교</div>
        </div>
      </div>
    </div>
  `;
  el.appendChild(conceptCard);

  // ABAC model.conf
  const modelCard = document.createElement("div");
  modelCard.className = "cb-card";
  modelCard.innerHTML = `
    <div class="cb-card-head">
      <span class="cb-card-icon">&#x2699;</span>
      <span class="cb-card-title">ABAC model.conf — 다차원 속성 매칭</span>
    </div>
    <div class="cb-card-body">
      <pre class="cb-code">[request_definition]
r = sub, obj, act

[policy_definition]
p = sub_role, obj_env, obj_region, obj_svc, act

[policy_effect]
e = some(where (p.eft == allow))

<span class="cb-code-comment"># matcher: 요청 객체의 속성과 정책의 속성을 직접 비교</span>
[matchers]
m = r.sub.role == p.sub_role \\
 && r.obj.env == p.obj_env \\
 && r.obj.region == p.obj_region \\
 && r.obj.svc == p.obj_svc \\
 && r.act == p.act</pre>
      <div class="cb-note">
        <strong>핵심:</strong> <code>r.sub</code>, <code>r.obj</code>가 문자열이 아닌 <strong>객체</strong>로 전달됩니다.
        matcher에서 <code>r.sub.role</code>, <code>r.obj.env</code> 같은 속성에 직접 접근합니다.
      </div>
    </div>
  `;
  el.appendChild(modelCard);

  // enforce 코드
  const codeCard = document.createElement("div");
  codeCard.className = "cb-card";
  codeCard.innerHTML = `
    <div class="cb-card-head">
      <span class="cb-card-icon">&#x25B6;</span>
      <span class="cb-card-title">ABAC enforce() — qa-sdk 차원을 속성으로 표현</span>
    </div>
    <div class="cb-card-body">
      <pre class="cb-code"><span class="cb-code-kw">const</span> user = {
  id: <span class="cb-code-str">'u-1042'</span>,
  role: <span class="cb-code-str">'operator'</span>,       <span class="cb-code-comment">// qa-sdk role 차원</span>
};

<span class="cb-code-kw">const</span> resource = {
  type: <span class="cb-code-str">'payment_history'</span>,
  env: <span class="cb-code-str">'prod'</span>,              <span class="cb-code-comment">// qa-sdk env 차원</span>
  region: <span class="cb-code-str">'asia'</span>,           <span class="cb-code-comment">// qa-sdk region 차원</span>
  svc: <span class="cb-code-str">'payment'</span>,           <span class="cb-code-comment">// qa-sdk svc_name 차원</span>
};

<span class="cb-code-comment">// qa-sdk: permAddr 51에 grant 있는지 O(1) 체크</span>
<span class="cb-code-comment">// Casbin: matcher가 각 속성을 정책 행과 매칭</span>
<span class="cb-code-kw">await</span> e.<span class="cb-code-fn">enforce</span>(user, resource, <span class="cb-code-str">'read'</span>);
<span class="cb-code-comment">// → true (policy에 operator, prod, asia, payment, read 행 존재)</span></pre>
    </div>
  `;
  el.appendChild(codeCard);

  // 소유자 규칙 확장
  const ownerCard = document.createElement("div");
  ownerCard.className = "cb-card";
  ownerCard.innerHTML = `
    <div class="cb-card-head">
      <span class="cb-card-icon">&#x1F513;</span>
      <span class="cb-card-title">ABAC 확장: 소유자 규칙 + 조건부 권한</span>
    </div>
    <div class="cb-card-body">
      <p class="cb-desc">matcher에 임의의 조건을 추가할 수 있어 qa-sdk 단독으로는 표현하기 어려운 규칙도 가능합니다.</p>
      <pre class="cb-code"><span class="cb-code-comment"># 소유자 규칙: 본인 주문만 취소 요청 가능</span>
[matchers]
m = r.sub.role == p.sub_role \\
 && r.obj.env == p.obj_env \\
 && r.act == p.act \\
 && (r.sub.role != <span class="cb-code-str">"customer"</span> || r.obj.ownerId == r.sub.id)
 <span class="cb-code-comment">#    ↑ customer일 때만 소유자 검사 적용</span></pre>
    </div>
  `;
  el.appendChild(ownerCard);

  // Trade-off 비교
  const tradeoffCard = document.createElement("div");
  tradeoffCard.className = "cb-card";
  tradeoffCard.innerHTML = `
    <div class="cb-card-head">
      <span class="cb-card-icon">&#x2696;</span>
      <span class="cb-card-title">Trade-off: weighted-index vs ABAC</span>
    </div>
    <div class="cb-card-body">
      <table class="cb-cmp-table">
        <thead>
          <tr><th></th><th>weighted-index</th><th>Casbin ABAC</th></tr>
        </thead>
        <tbody>
          <tr>
            <td class="cb-cmp-key">성능</td>
            <td class="cb-cmp-pro"><span class="cb-badge cb-badge-pro">PRO</span> O(1) 정수 비교, varint 직렬화</td>
            <td class="cb-cmp-con"><span class="cb-badge cb-badge-con">CON</span> O(n) 정책 순회, 문자열 비교</td>
          </tr>
          <tr>
            <td class="cb-cmp-key">정책 크기</td>
            <td class="cb-cmp-pro"><span class="cb-badge cb-badge-pro">PRO</span> shape 기반 압축 — 60개 슬롯</td>
            <td class="cb-cmp-con"><span class="cb-badge cb-badge-con">CON</span> 차원 조합 × 역할 수만큼 행 증가</td>
          </tr>
          <tr>
            <td class="cb-cmp-key">유연성</td>
            <td class="cb-cmp-con"><span class="cb-badge cb-badge-con">CON</span> shape 내 고정 차원만 가능</td>
            <td class="cb-cmp-pro"><span class="cb-badge cb-badge-pro">PRO</span> 임의 속성 조건 (소유자, 시간대, IP 등)</td>
          </tr>
          <tr>
            <td class="cb-cmp-key">역할 계층</td>
            <td class="cb-cmp-con"><span class="cb-badge cb-badge-con">CON</span> 역할마다 개별 grant 필요</td>
            <td class="cb-cmp-pro"><span class="cb-badge cb-badge-pro">PRO</span> g() 함수로 계층 자동 상속</td>
          </tr>
          <tr>
            <td class="cb-cmp-key">동적 규칙</td>
            <td class="cb-cmp-con"><span class="cb-badge cb-badge-con">CON</span> 런타임 조건 표현 불가</td>
            <td class="cb-cmp-pro"><span class="cb-badge cb-badge-pro">PRO</span> matcher에 함수 호출 가능 (시간, 소유자)</td>
          </tr>
          <tr>
            <td class="cb-cmp-key">버전 관리</td>
            <td class="cb-cmp-pro"><span class="cb-badge cb-badge-pro">PRO</span> shape 마이그레이션 내장</td>
            <td class="cb-cmp-con"><span class="cb-badge cb-badge-con">CON</span> 정책 파일 외부 관리 필요</td>
          </tr>
          <tr>
            <td class="cb-cmp-key">디버깅</td>
            <td class="cb-cmp-con"><span class="cb-badge cb-badge-con">CON</span> 정수 주소 → decode 필요</td>
            <td class="cb-cmp-pro"><span class="cb-badge cb-badge-pro">PRO</span> 정책 행이 곧 문서 — 자체 설명적</td>
          </tr>
          <tr>
            <td class="cb-cmp-key">범위 쿼리</td>
            <td class="cb-cmp-pro"><span class="cb-badge cb-badge-pro">PRO</span> 와일드카드 범위 탐색 O(1)</td>
            <td class="cb-cmp-con"><span class="cb-badge cb-badge-con">CON</span> 전체 정책 필터링 필요</td>
          </tr>
        </tbody>
      </table>
      <div class="cb-verdict" style="margin-top:14px">
        <div class="cb-verdict-col">
          <div class="cb-verdict-title cb-verdict-qa">weighted-index가 이기는 곳</div>
          <ul class="cb-verdict-list">
            <li>초고성능 서버간 이벤트 라우팅</li>
            <li>대량 로그 태깅 — 주소 1~2 bytes</li>
            <li>범위 쿼리: "결제 서비스 전체" 같은 와일드카드</li>
            <li>shape 기반 자동 버전 마이그레이션</li>
          </ul>
        </div>
        <div class="cb-verdict-col">
          <div class="cb-verdict-title cb-verdict-casbin">Casbin ABAC가 이기는 곳</div>
          <ul class="cb-verdict-list">
            <li>"본인 주문만 취소 가능" 같은 동적 규칙</li>
            <li>시간대/IP 기반 조건부 접근 제어</li>
            <li>복잡한 역할 계층 + 상속</li>
            <li>비개발자가 정책 CSV를 직접 편집</li>
          </ul>
        </div>
      </div>
      <div class="cb-conclusion">
        <div class="cb-conclusion-title">결론: 대체재가 아닌 보완재</div>
        <div class="cb-conclusion-body">
          <div class="cb-conclusion-item">
            <span class="cb-conclusion-icon cb-verdict-qa">&#x2190;</span>
            <span><strong>내부 통신 계층</strong> (이벤트 버스, 로그, 서비스 메시) → weighted-index</span>
          </div>
          <div class="cb-conclusion-item">
            <span class="cb-conclusion-icon cb-verdict-casbin">&#x2192;</span>
            <span><strong>사용자 대면 계층</strong> (API 게이트웨이, 관리자 콘솔) → Casbin ABAC</span>
          </div>
          <div class="cb-conclusion-item">
            <span class="cb-conclusion-icon" style="color:var(--xl-blue)">&#x2194;</span>
            <span><strong>조합</strong>: Casbin이 접근 판단 → weighted-index가 이벤트/로그에 주소 태깅</span>
          </div>
        </div>
      </div>
    </div>
  `;
  el.appendChild(tradeoffCard);

  return el;
}

// ── Main export ───────────────────────────────────────────────────────────

export function renderCasbinPage(container: HTMLElement, ver = "v2"): void {
  container.innerHTML = "";
  container.classList.add("cb-body");

  let activeStep: StepId = "ours";
  let navEl: HTMLElement | null = null;
  let contentEl: HTMLElement | null = null;
  let grantRows: GrantRow[] = [];
  let featuresData: FeaturesResponse | null = null;

  // 로딩 스켈레톤
  const loading = document.createElement("div");
  loading.innerHTML = `
    <div class="scenario-skeleton">
      <div class="scenario-spinner-wrap">
        <div class="scenario-spinner"></div>
        <span class="scenario-spinner-text">데이터 로딩 중...</span>
      </div>
    </div>
  `;
  container.appendChild(loading);

  function renderContent(): void {
    if (!featuresData) return;

    // 기존 content 제거
    if (contentEl) contentEl.remove();

    switch (activeStep) {
      case "ours":
        contentEl = renderStepOurs(grantRows, featuresData);
        break;
      case "casbin-rbac":
        contentEl = renderStepCasbinRbac(featuresData);
        break;
      case "casbin-abac":
        contentEl = renderStepCasbinAbac();
        break;
    }
    container.appendChild(contentEl);
  }

  function switchStep(id: StepId): void {
    if (id === activeStep && contentEl) return;
    activeStep = id;

    // nav 갱신
    if (navEl) navEl.remove();
    navEl = renderStepNav(activeStep, switchStep);
    container.insertBefore(navEl, container.firstChild);

    renderContent();
  }

  // 데이터 로드
  Promise.all([
    fetchGrantTable(ver),
    fetchFeatures(ver),
  ]).then(([grantData, features]) => {
    grantRows = grantData.rows;
    featuresData = features;
    loading.remove();
    switchStep("ours");
  }).catch((e: unknown) => {
    loading.innerHTML = `<div style="padding:16px;color:#c0392b">오류: ${e instanceof Error ? e.message : "알 수 없는 오류"}</div>`;
  });
}
