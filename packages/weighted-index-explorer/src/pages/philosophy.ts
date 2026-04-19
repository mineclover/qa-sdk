// @def.boundary weighted-index-system
// @def.doc weighted-index-system

// ═══════════════════════════════════════════════════════════════════════════
//  설계 철학 & 유스케이스 페이지
// ═══════════════════════════════════════════════════════════════════════════

export function renderPhilosophy(container: HTMLElement): void {
  container.innerHTML = `<div class="concept-wrap">
    ${renderCore()}
    ${renderMath()}
    ${renderProperties()}
    ${renderUseCases()}
    ${renderWhenNotTo()}
  </div>`;
}

// ── 1. 핵심 아이디어 ─────────────────────────────────────────────────────

function renderCore(): string {
  return `
    <h2 class="concept-section-title">설계 철학 — 가중진법의 핵심 아이디어</h2>
    <p class="concept-desc">
      가중진법은 <strong>N차원 공간의 모든 좌표를 고유한 1차원 정수 하나로 표현</strong>하는 방법입니다.
      각 차원이 갖는 <em>값의 개수(N)</em>로부터 가중치를 계산하면,
      그 가중치의 조합이 곧 고유한 식별자가 됩니다.
    </p>

    <div class="xl-formula-block" style="flex-direction:column;align-items:flex-start;gap:8px">
      <span class="xlf-label">핵심 명제</span>
      <div style="font-size:0.82rem;line-height:1.9;color:var(--text-formula)">
        <div>
          <strong>의미는 좌표에 있고, 식별자는 계산된다.</strong>
          <span style="color:var(--text-muted);font-size:0.74rem;margin-left:8px">
            ID는 도출된 값 — 의미 자체가 아님
          </span>
        </div>
        <div>
          <strong>스키마(N 목록)만 있으면 언제든 역산 가능하다.</strong>
          <span style="color:var(--text-muted);font-size:0.74rem;margin-left:8px">
            ID를 저장하지 않아도, 규칙만 알면 ID를 복원할 수 있음
          </span>
        </div>
        <div>
          <strong>N이 바뀌어도 구버전 ID는 그 버전의 스키마로 계속 유효하다.</strong>
          <span style="color:var(--text-muted);font-size:0.74rem;margin-left:8px">
            버전 업 = 스키마 등록, 데이터 재작성 아님
          </span>
        </div>
      </div>
    </div>

    <div class="concept-block">
      <div class="cb-header">식별자 vs 주소 — 무엇이 다른가</div>
      <div class="cb-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            <div style="font-size:0.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">
              UUID / 랜덤 ID
            </div>
            <ul class="phi-list">
              <li>의미 없음 — 단순 식별 목적</li>
              <li>역산 불가 — ID에서 맥락 추출 불가능</li>
              <li>항상 고유 — 충돌 걱정 없음</li>
              <li>스키마 변경과 무관</li>
            </ul>
          </div>
          <div>
            <div style="font-size:0.7rem;font-weight:700;color:var(--xl-green);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">
              가중진법 주소
            </div>
            <ul class="phi-list phi-list-green">
              <li>구조화된 의미 — 좌표가 ID에 내포</li>
              <li>역산 가능 — ID만으로 좌표 복원</li>
              <li>스키마 기반 고유 보장</li>
              <li>버전으로 스키마 변화 추적 가능</li>
            </ul>
          </div>
        </div>
        <div class="insight-box" style="margin-top:12px">
          <span class="insight-icon">💡</span>
          <span>
            UUID가 <em>"이 레코드를 어디서 찾나"</em>를 답한다면,
            가중진법 주소는 <em>"이 레코드가 어떤 좌표에 있는가"</em>를 답합니다.
            두 가지를 모두 쓸 수 있고, 목적에 따라 선택합니다.
          </span>
        </div>
      </div>
    </div>
  `;
}

// ── 2. 수학적 근거 ────────────────────────────────────────────────────────

function renderMath(): string {
  return `
    <div class="concept-block">
      <div class="cb-header">수학적 근거 — 혼합 진법(Mixed-Radix)</div>
      <div class="cb-body">
        <p class="concept-desc">
          가중진법은 수학의 <strong>혼합 진법(Mixed-Radix Numeral System)</strong>과 동일한 원리입니다.
          각 차원이 서로 다른 밑(base)을 갖는 위치 기수법으로,
          일상의 시간 표기(<code>DD:HH:MM:SS</code>)와 정확히 같은 구조입니다.
        </p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
          <div class="phi-analogy-box">
            <div class="phi-analogy-title">시간 표기 (혼합 진법)</div>
            <div class="phi-analogy-body">
              <code>DD:HH:MM:SS</code><br/>
              <span class="phi-small">N = [31, 24, 60, 60]</span><br/>
              <span class="phi-small">W = [86400, 3600, 60, 1]</span><br/>
              <code style="color:var(--xl-green)">2:03:15:40 = 183,340초</code>
            </div>
          </div>
          <div class="phi-analogy-box">
            <div class="phi-analogy-title">가중진법 주소 (같은 구조)</div>
            <div class="phi-analogy-body">
              <code>tenant:schema:table:shard</code><br/>
              <span class="phi-small">N = [50, 10, 30, 8]</span><br/>
              <span class="phi-small">W = [2400, 240, 8, 1]</span><br/>
              <code style="color:var(--xl-green)">5:3:12:4 → ID 12,564</code>
            </div>
          </div>
        </div>

        <table class="nd-table">
          <thead>
            <tr>
              <th>성질</th>
              <th>설명</th>
              <th>의미</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>전단사(Bijection)</strong></td>
              <td>모든 좌표 ↔ 고유한 ID 일대일 대응</td>
              <td>충돌 없음, 역산 항상 가능</td>
            </tr>
            <tr>
              <td><strong>결정론적</strong></td>
              <td>같은 좌표 + 같은 스키마 → 항상 같은 ID</td>
              <td>별도 저장 없이 재계산 가능</td>
            </tr>
            <tr>
              <td><strong>연속성</strong></td>
              <td>ID는 0 ~ (size-1) 정수 공간을 빈틈없이 채움</td>
              <td>배열·비트맵 인덱스로 직접 사용 가능</td>
            </tr>
            <tr>
              <td><strong>분해 가능</strong></td>
              <td>ID → 좌표 변환이 O(d) 산술 연산</td>
              <td>스키마만 있으면 런타임에 즉시 역산</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ── 3. 설계 원칙 ──────────────────────────────────────────────────────────

function renderProperties(): string {
  return `
    <div class="concept-block">
      <div class="cb-header">설계 원칙 — 무엇을 위한 시스템인가</div>
      <div class="cb-body">
        <p class="concept-desc">
          가중진법은 <strong>암호화나 보안</strong>을 목적으로 설계되지 않았습니다.
          스키마를 알면 순서를 예측할 수 있으며, 그것이 의도된 설계입니다.
          이 시스템의 목적은 <em>다차원 구조를 규칙성 있게 단일 정수로 압축</em>하는 것입니다.
        </p>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">
          ${[
            {
              icon: "✓",
              color: "#22c55e",
              title: "목적",
              items: [
                "다차원 좌표의 1D 표현",
                "스키마 기반 규칙적 ID",
                "버전 관리 가능한 식별자",
                "압축된 메타데이터 주소",
              ],
            },
            {
              icon: "≈",
              color: "#f59e0b",
              title: "부수 효과",
              items: [
                "스키마 없으면 예측 어려움",
                "연속 정수 → 비트맵 최적화",
                "슬롯 사전 계산 가능",
                "범위 질의 가능 (차원 정렬 시)",
              ],
            },
            {
              icon: "✗",
              color: "#ef4444",
              title: "목적 아닌 것",
              items: [
                "암호화 / 난독화",
                "충돌 없는 전역 UUID",
                "분산 시스템 고유성 보장",
                "해시 기반 조회 최적화",
              ],
            },
          ].map(({ icon, color, title, items }) => `
            <div class="phi-purpose-box" style="border-top-color:${color}">
              <div class="phi-purpose-icon" style="color:${color}">${icon}</div>
              <div class="phi-purpose-title">${title}</div>
              <ul class="phi-purpose-list">
                ${items.map((i) => `<li>${i}</li>`).join("")}
              </ul>
            </div>
          `).join("")}
        </div>

        <div class="insight-box">
          <span class="insight-icon">🔑</span>
          <span>
            <strong>예측 가능성은 버그가 아니라 기능입니다.</strong>
            스키마를 공개하면 누구나 좌표에서 ID를 계산할 수 있고,
            ID에서 좌표를 복원할 수 있습니다.
            이 투명성이 디버깅, 로깅, 모니터링을 단순하게 만듭니다.
            보안이 필요하면 ID 자체가 아닌 <em>접근 제어 계층</em>에서 처리합니다.
          </span>
        </div>
      </div>
    </div>
  `;
}

// ── 4. 유스케이스 ─────────────────────────────────────────────────────────

function renderUseCases(): string {
  const cases = [
    {
      title: "다차원 권한 모델",
      tag: "권한",
      tagColor: "#1f497d",
      tagBg: "#dce6f1",
      desc: "resource × action × role × env 조합을 단일 정수로. 비트마스크 없이 다차원 권한을 직관적으로 표현.",
      dims: "resource(8) × action(4) × role(5) × env(4) = 640",
      example: "perm:v2:42 → [document, read, editor, staging]",
    },
    {
      title: "데이터 스토리지 주소",
      tag: "스토리지",
      tagColor: "#375623",
      tagBg: "#e2efda",
      desc: "tenant × schema × table × shard 좌표를 단일 주소로 압축. UUID 없이 구조화된 스토리지 주소 체계 구현.",
      dims: "tenant(50) × schema(10) × table(30) × shard(8) = 120,000",
      example: "addr:v1:12564 → [tenant#5, schema#3, table#12, shard#4]",
    },
    {
      title: "이벤트 분류 인덱스",
      tag: "이벤트",
      tagColor: "#7f6000",
      tagBg: "#fff2cc",
      desc: "category × subcategory × trigger × auto_manual 조합을 이벤트 타입 ID로. 이벤트 테이블 없이 ID만으로 분류 추론.",
      dims: "category(8) × subcategory(10) × trigger(5) × mode(2) = 800",
      example: "evt:v1:123 → [interaction, click, user, manual]",
    },
    {
      title: "네트워크 엔드포인트",
      tag: "네트워크",
      tagColor: "#0e5f75",
      tagBg: "#ddf4f9",
      desc: "datacenter × cluster × service × instance 주소를 정수 하나로. IP/포트 없이 논리적 위치를 표현.",
      dims: "datacenter(5) × cluster(20) × service(50) × instance(10) = 50,000",
      example: "ep:v1:7234 → [dc-ap1, cluster-03, auth-svc, instance-4]",
    },
    {
      title: "A/B 테스트 슬롯",
      tag: "실험",
      tagColor: "#843c0c",
      tagBg: "#fce4d6",
      desc: "experiment × variant × cohort × feature 조합을 단일 슬롯 ID로. 실험 설계를 테이블 없이 ID만으로 역산.",
      dims: "experiment(100) × variant(4) × cohort(10) × feature(5) = 20,000",
      example: "exp:v1:4523 → [exp#23, variant-B, cohort-5, feature-3]",
    },
    {
      title: "물리 공간 주소",
      tag: "공간",
      tagColor: "#493073",
      tagBg: "#e8e0f0",
      desc: "building × floor × zone × unit 좌표를 공간 주소로. 도시 규모 자산 관리 시스템의 위치 식별자.",
      dims: "building(200) × floor(50) × zone(10) × unit(20) = 2,000,000",
      example: "loc:v1:184522 → [building#8, floor#9, zone-A, unit#12]",
    },
  ];

  const cards = cases.map(({ title, tag, tagColor, tagBg, desc, dims, example }) => `
    <div class="phi-usecase-card">
      <div class="phi-uc-header">
        <span class="phi-uc-title">${title}</span>
        <span class="phi-uc-tag" style="background:${tagBg};color:${tagColor}">${tag}</span>
      </div>
      <p class="phi-uc-desc">${desc}</p>
      <div class="phi-uc-dims">${dims}</div>
      <div class="phi-uc-example"><code>${example}</code></div>
    </div>
  `).join("");

  return `
    <div class="concept-block">
      <div class="cb-header">유스케이스 — 어디에 쓸 수 있는가</div>
      <div class="cb-body">
        <p class="concept-desc" style="margin-bottom:14px">
          N차원 구조가 있는 곳이라면 어디든 가중진법 주소를 적용할 수 있습니다.
          핵심은 <strong>"좌표계"가 미리 정의된 도메인</strong>입니다.
        </p>
        <div class="phi-usecase-grid">${cards}</div>
      </div>
    </div>
  `;
}

// ── 5. 언제 쓰지 말아야 하는가 ────────────────────────────────────────────

function renderWhenNotTo(): string {
  return `
    <div class="concept-block">
      <div class="cb-header">언제 쓰지 말아야 하는가</div>
      <div class="cb-body">
        <table class="nd-table">
          <thead><tr><th>상황</th><th>이유</th><th>대안</th></tr></thead>
          <tbody>
            <tr>
              <td>차원 크기가 무한하거나 사전 알 수 없을 때</td>
              <td>N을 모르면 가중치 계산 불가</td>
              <td>UUID, ULID</td>
            </tr>
            <tr>
              <td>식별자 자체가 비공개여야 할 때</td>
              <td>스키마가 있으면 역산 가능</td>
              <td>암호화된 토큰, HMAC ID</td>
            </tr>
            <tr>
              <td>분산 환경에서 조율 없이 생성해야 할 때</td>
              <td>스키마 동기화 필요</td>
              <td>Snowflake ID, ULID</td>
            </tr>
            <tr>
              <td>임의의 엔티티 수를 ID로 구분할 때</td>
              <td>차원 없이 단순 식별 목적</td>
              <td>Auto-increment, UUID</td>
            </tr>
          </tbody>
        </table>
        <div class="insight-box" style="margin-top:12px">
          <span class="insight-icon">⚖️</span>
          <span>
            가중진법은 <strong>구조화된 도메인의 주소 체계</strong>로 최적입니다.
            도메인에 자연스러운 "차원"이 존재하고,
            그 차원의 크기가 설계 시점에 결정되거나 예측 가능할 때 가장 큰 가치를 발휘합니다.
          </span>
        </div>
      </div>
    </div>
  `;
}
