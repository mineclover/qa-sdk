// ═══════════════════════════════════════════════════════════════════════════
//  개요 페이지 — 프로젝트 목표, 핵심 개념, DX 생태계
// ═══════════════════════════════════════════════════════════════════════════

export function renderOverviewPage(container: HTMLElement): void {
  container.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "ov-wrap";

  // ── Header ──────────────────────────────────────────────────────────────
  const header = document.createElement("header");
  header.className = "ov-header";
  header.innerHTML = `
    <h1 class="ov-title">n차원 참조 주소 체계</h1>
    <p class="ov-subtitle">
      모든 리소스에 <strong>고유한 정수 주소</strong>를 부여하고,<br/>
      스펙이 변해도 기존 주소가 깨지지 않는 중앙 인덱스 시스템
    </p>
  `;
  wrap.appendChild(header);

  // ── Core Concept ──────────────────────────────────────────────────────
  const concept = document.createElement("div");
  concept.className = "ov-concept";
  concept.innerHTML = `
    <div class="ov-concept-inner">
      <div class="ov-concept-icon">fx</div>
      <div class="ov-concept-text">
        <p>
          서비스, 권한, 이벤트 등 모든 리소스를 <strong>다차원 좌표</strong>로 표현하고,
          이를 <strong>하나의 정수</strong>로 변환합니다.
          문자열 대신 숫자로 식별하여 전송·저장·연산이 효율적이며,
          중앙 레지스트리가 모든 버전의 주소 스키마를 관리합니다.
        </p>
      </div>
    </div>
  `;
  wrap.appendChild(concept);

  // ── Flow: 4 stages ──────────────────────────────────────────────────────
  const stages = [
    {
      num: "01",
      label: "문제 인식",
      title: "하드코딩된 식별자와 권한",
      body: `코드 곳곳에 <strong>문자열 상수와 매직 넘버</strong>가 산재합니다.
             권한 문자열이 하드코딩되어 오타를 감지할 수 없고,
             식별자가 변경되면 어디까지 영향이 퍼지는지 <strong>추적이 불가능</strong>합니다.`,
      detail: `if (role === "amdin") — 오타가 런타임까지 살아남음`,
      accent: "var(--env-dev)",
      icon: "⊙",
      tabs: ["권한"],
    },
    {
      num: "02",
      label: "상수 추출",
      title: "SDK로 식별자 체계화",
      body: `흩어진 문자열·숫자 식별자를 <strong>인덱스와 버전 단위</strong>로 선언합니다.
             SDK가 차원별 상수를 자동 생성하여 <strong>IDE 자동완성과 타입 안전성</strong>을 확보하고,
             변경 지점을 스키마 한곳으로 단일화합니다.`,
      detail: `client("perm", "v1").constants("role") → { admin, editor, viewer }`,
      accent: "var(--xl-blue)",
      icon: "⊞",
      tabs: ["서비스"],
    },
    {
      num: "03",
      label: "체계화",
      title: "다차원 좌표를 정수로 압축",
      body: `추출된 상수를 <strong>다차원 좌표 체계</strong>로 구조화합니다.
             여러 축의 조합을 하나의 정수 주소로 변환하여,
             전송·저장·범위 쿼리 등 <strong>정수 연산</strong>으로 확장합니다.`,
      detail: `[역할, 행위, 리소스] → 단일 정수 주소`,
      accent: "var(--env-prod)",
      icon: "◈",
      tabs: ["시나리오", "범위탐색"],
    },
    {
      num: "04",
      label: "타입 주입",
      title: "스키마 기반 버전 관리",
      body: `스키마가 <strong>유효한 조합만 허용</strong>하고, 잘못된 입력은 컴파일 타임에 차단합니다.
             버전별 스냅샷으로 스펙 변경을 흡수하며,
             기존 주소가 깨지지 않도록 <strong>안정적인 마이그레이션</strong>을 제공합니다.`,
      detail: `encode({ role: "없는값" }) → 컴파일 에러 · v1 → v2 자동 전환`,
      accent: "var(--xl-navy)",
      icon: "▶",
      tabs: ["버전", "권한 부여 관리"],
    },
  ];

  const flow = document.createElement("div");
  flow.className = "ov-flow";

  for (let i = 0; i < stages.length; i++) {
    const s = stages[i];

    const card = document.createElement("div");
    card.className = "ov-card";
    card.style.setProperty("--card-accent", s.accent);

    card.innerHTML = `
      <div class="ov-card-num">${s.num}</div>
      <div class="ov-card-head">
        <span class="ov-card-label">${s.label}</span>
        <h2 class="ov-card-title">${s.title}</h2>
      </div>
      <div class="ov-card-body">${s.body}</div>
      <div class="ov-card-detail">
        <span class="ov-card-icon">${s.icon}</span>
        <code>${s.detail}</code>
      </div>
      <div class="ov-card-tabs">
        ${s.tabs.map((t) => `<span class="ov-card-tab">${t}</span>`).join("")}
      </div>
    `;

    flow.appendChild(card);

    // Arrow between cards
    if (i < stages.length - 1) {
      const arrow = document.createElement("div");
      arrow.className = "ov-arrow";
      arrow.textContent = "→";
      flow.appendChild(arrow);
    }
  }

  wrap.appendChild(flow);

  // ── DX Ecosystem ──────────────────────────────────────────────────────
  const dxTools = [
    {
      icon: "⊞",
      title: "Core Codec",
      layer: "Library",
      desc: "다차원 좌표 ↔ 정수 전단사 변환 엔진. 범위 연산, 비트마스크, 주소 직렬화, 용량 계획을 제공합니다.",
      pkg: "weighted-index",
    },
    {
      icon: "◈",
      title: "Schema Registry",
      layer: "Library + DB",
      desc: "차원·인덱스 선언과 버전 관리 프레임워크. DB 저장소, 분산 라우팅, 게이트 제어를 포함합니다.",
      pkg: "index-meta",
    },
    {
      icon: "◇",
      title: "Client SDK",
      layer: "Browser / Edge",
      desc: "Node.js 의존성 없는 경량 번들. 프론트엔드·Edge에서 동일한 스키마로 encode/decode합니다.",
      pkg: "index-meta/client",
    },
    {
      icon: "▤",
      title: "Explorer",
      layer: "Dev Tool",
      desc: "인코딩·디코딩 결과를 시각적으로 확인하는 탐색 도구. 주소 공간 구조를 직관적으로 파악합니다.",
      pkg: "weighted-index-explorer",
    },
  ];

  const dxSection = document.createElement("div");
  dxSection.className = "ov-dx";
  dxSection.innerHTML = `
    <div class="ov-dx-header">
      <h3 class="ov-dx-title">DX Ecosystem</h3>
      <p class="ov-dx-desc">
        n차원 참조 주소 체계를 구성하고 운영하기 위한 도구 모음
      </p>
    </div>
    <div class="ov-dx-grid">
      ${dxTools.map((t) => `
        <div class="ov-dx-card">
          <div class="ov-dx-card-head">
            <span class="ov-dx-card-icon">${t.icon}</span>
            <div>
              <div class="ov-dx-card-title">${t.title}</div>
              <div class="ov-dx-card-layer">${t.layer}</div>
            </div>
          </div>
          <div class="ov-dx-card-body">${t.desc}</div>
          <div class="ov-dx-card-pkg"><code>${t.pkg}</code></div>
        </div>
      `).join("")}
    </div>
  `;
  wrap.appendChild(dxSection);

  // ── SDK Usage Examples ──────────────────────────────────────────────────
  const usage = document.createElement("div");
  usage.className = "ov-usage";
  usage.innerHTML = `
    <h3 class="ov-usage-title">라이브러리 사용 예시</h3>
    <div class="ov-usage-grid">
      <div class="ov-usage-card">
        <div class="ov-usage-card-head">
          <span class="ov-usage-card-label">주소 생성</span>
          <span class="ov-usage-card-desc">좌표를 넘기면 정수 주소를 반환</span>
        </div>
        <pre class="ov-usage-code"><span class="ov-code-kw">const</span> addr = index.<span class="ov-code-fn">encode</span>({
  env: <span class="ov-code-str">"prod"</span>,
  region: <span class="ov-code-str">"kr"</span>,
  svc: <span class="ov-code-str">"payment"</span>,
  ns: <span class="ov-code-str">"default"</span>
});
<span class="ov-code-cmt">// => 46</span></pre>
      </div>
      <div class="ov-usage-card">
        <div class="ov-usage-card-head">
          <span class="ov-usage-card-label">주소 해석</span>
          <span class="ov-usage-card-desc">정수 주소를 좌표로 복원</span>
        </div>
        <pre class="ov-usage-code"><span class="ov-code-kw">const</span> coords = index.<span class="ov-code-fn">decode</span>(<span class="ov-code-num">46</span>);
<span class="ov-code-cmt">// => { env: "prod", region: "kr",</span>
<span class="ov-code-cmt">//      svc: "payment", ns: "default" }</span></pre>
      </div>
      <div class="ov-usage-card">
        <div class="ov-usage-card-head">
          <span class="ov-usage-card-label">범위 쿼리</span>
          <span class="ov-usage-card-desc">와일드카드 차원으로 매칭 주소 탐색</span>
        </div>
        <pre class="ov-usage-code"><span class="ov-code-kw">const</span> matches = index.<span class="ov-code-fn">range</span>({
  env: <span class="ov-code-str">"prod"</span>,
  svc: <span class="ov-code-str">"*"</span>  <span class="ov-code-cmt">// 와일드카드</span>
});
<span class="ov-code-cmt">// => [40, 41, 42, ..., 49]</span></pre>
      </div>
      <div class="ov-usage-card">
        <div class="ov-usage-card-head">
          <span class="ov-usage-card-label">버전 스냅샷</span>
          <span class="ov-usage-card-desc">스키마 상태 저장 및 버전 전환</span>
        </div>
        <pre class="ov-usage-code"><span class="ov-code-kw">const</span> snap = registry.<span class="ov-code-fn">snapshot</span>(<span class="ov-code-str">"v1"</span>);
<span class="ov-code-cmt">// 스키마 diff 비교</span>
<span class="ov-code-kw">const</span> diff = registry.<span class="ov-code-fn">diff</span>(<span class="ov-code-str">"v1"</span>, <span class="ov-code-str">"v2"</span>);
<span class="ov-code-cmt">// 버전 전환</span>
registry.<span class="ov-code-fn">migrate</span>(<span class="ov-code-str">"v1"</span>, <span class="ov-code-str">"v2"</span>);</pre>
      </div>
      <div class="ov-usage-card">
        <div class="ov-usage-card-head">
          <span class="ov-usage-card-label">권한 확인</span>
          <span class="ov-usage-card-desc">비트마스크 기반 접근 제어</span>
        </div>
        <pre class="ov-usage-code"><span class="ov-code-cmt">// 서버: role별 grant → flat bitmask 생성</span>
<span class="ov-code-kw">const</span> mask = codec.<span class="ov-code-fn">createMask</span>();
codec.<span class="ov-code-fn">grantRaw</span>(mask,
  <span class="ov-code-str">"payment"</span>, <span class="ov-code-str">"api"</span>, <span class="ov-code-str">"orders"</span>, <span class="ov-code-str">"GET"</span>);

<span class="ov-code-cmt">// 클라이언트: mask에서 O(1) 비트 체크</span>
codec.<span class="ov-code-fn">checkRaw</span>(mask,
  <span class="ov-code-str">"payment"</span>, <span class="ov-code-str">"api"</span>, <span class="ov-code-str">"orders"</span>, <span class="ov-code-str">"GET"</span>);
<span class="ov-code-cmt">// => true</span></pre>
      </div>
      <div class="ov-usage-card">
        <div class="ov-usage-card-head">
          <span class="ov-usage-card-label">로깅 통합</span>
          <span class="ov-usage-card-desc">정수 주소로 경량 로그 전송</span>
        </div>
        <pre class="ov-usage-code">logger.<span class="ov-code-fn">info</span>({
  svc:  <span class="ov-code-num">46</span>,   <span class="ov-code-cmt">// "payment/prod/kr"</span>
  perm: <span class="ov-code-num">42</span>,   <span class="ov-code-cmt">// "payment:admin"</span>
  evt:  <span class="ov-code-num">132</span>   <span class="ov-code-cmt">// "order.paid:web"</span>
});
<span class="ov-code-cmt">// ~6 bytes (문자열 대비 96% 감소)</span></pre>
      </div>
    </div>
    <div class="ov-usage-footer">
      각 탭에서 셀을 클릭하면 실제 인코딩/디코딩 결과를 확인할 수 있습니다.
    </div>
  `;
  wrap.appendChild(usage);

  container.appendChild(wrap);
}
