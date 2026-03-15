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
      label: "출발점",
      title: "고유 주소 체계 설계",
      body: `서비스·역할·이벤트 같은 리소스에 <strong>고유한 숫자 주소</strong>를 부여합니다.
             여러 차원의 좌표를 하나의 정수로 변환하여, 모든 리소스를 단일 주소 공간에서 참조합니다.`,
      detail: `[환경, 리전, 서비스, 네임스페이스] → 단일 정수`,
      accent: "var(--xl-blue)",
      icon: "⊞",
      tabs: ["서비스"],
    },
    {
      num: "02",
      label: "문제 인식",
      title: "스펙 변경 시 주소 붕괴",
      body: `역할이 하나 추가되면 <strong>기존 주소가 전부 밀립니다</strong>.
             차원의 크기가 바뀌면 모든 하위 주소를 다시 계산해야 하는 구조적 취약성이 드러납니다.`,
      detail: `역할 5개 → 6개: 기존 주소 전체가 무효화`,
      accent: "var(--env-dev)",
      icon: "⊙",
      tabs: ["권한", "버전"],
    },
    {
      num: "03",
      label: "해결 접근",
      title: "안정적인 주소 + 중앙 관리",
      body: `주소 체계에 <strong>여유 공간</strong>을 미리 확보하여, 차원이 추가되어도 기존 주소가 유지됩니다.
             중앙 레지스트리가 모든 주소 스키마를 버전별로 관리하고,
             필요할 때 <strong>즉시 버전을 전환</strong>할 수 있습니다.`,
      detail: `여유 공간 → 변경 흡수 · 중앙 관리 → 일관성 · 버전 전환 자동화`,
      accent: "var(--env-prod)",
      icon: "◈",
      tabs: ["시나리오", "부여관리"],
    },
    {
      num: "04",
      label: "부수 효과",
      title: "로깅 압축과 정수 연산 확장",
      body: `문자열 식별자를 정수 주소로 대체하여 <strong>네트워크·저장 비용이 대폭 절감</strong>됩니다.
             범위 쿼리, 비트마스크 필터링 등 <strong>정수 연산</strong>만으로 다양한 확장이 가능합니다.`,
      detail: `JSON ~148 bytes → protobuf ~6 bytes (96% 감소)`,
      accent: "var(--xl-navy)",
      icon: "▶",
      tabs: ["이벤트", "범위탐색"],
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
      title: "Backend SDK",
      layer: "Server / Node.js",
      desc: "주소 생성·해석을 위한 TypeScript SDK. 인코딩, 디코딩, 범위 쿼리, 비트마스크 연산을 제공합니다.",
      pkg: "sdk · core · weighted-index",
    },
    {
      icon: "◇",
      title: "Browser SDK",
      layer: "Frontend / Browser",
      desc: "프론트엔드에서 주소를 참조하는 경량 클라이언트. 권한 확인과 이벤트 발행에 사용됩니다.",
      pkg: "browser-sdk",
    },
    {
      icon: "⊕",
      title: "Registry Server",
      layer: "Server / API",
      desc: "모든 주소 스키마를 중앙에서 관리하는 서버. 클라이언트가 최신 스키마를 동기화합니다.",
      pkg: "registry-server · registry-client",
    },
    {
      icon: "▤",
      title: "Logging & Ingest",
      layer: "Observability",
      desc: "정수 주소 기반의 구조화된 로깅. pino 어댑터와 이벤트 수집 서버를 통해 파이프라인을 구성합니다.",
      pkg: "pino · ingest-server · engine",
    },
    {
      icon: "⊡",
      title: "Store",
      layer: "DB / Persistence",
      desc: "주소 기반의 데이터 저장·조회. 정수 인덱스를 활용한 범위 스캔과 집계 쿼리를 지원합니다.",
      pkg: "store",
    },
    {
      icon: "◎",
      title: "Version Snapshot",
      layer: "Infra / DevOps",
      desc: "특정 시점의 스키마 상태를 스냅샷으로 보존. 스키마 diff 비교와 안전한 롤백을 지원합니다.",
      pkg: "index-meta",
    },
  ];

  const dxSection = document.createElement("div");
  dxSection.className = "ov-dx";
  dxSection.innerHTML = `
    <div class="ov-dx-header">
      <h3 class="ov-dx-title">DX Ecosystem</h3>
      <p class="ov-dx-desc">
        주소 데이터를 백엔드·프론트엔드·인프라 전 계층에서 활용하기 위한 도구들
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
          <span class="ov-usage-card-desc">주소 기반 접근 제어</span>
        </div>
        <pre class="ov-usage-code"><span class="ov-code-kw">const</span> perm = permission.<span class="ov-code-fn">encode</span>({
  svc: <span class="ov-code-str">"payment"</span>,
  role: <span class="ov-code-str">"admin"</span>
});
<span class="ov-code-kw">const</span> ok = grants.<span class="ov-code-fn">has</span>(perm);
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
