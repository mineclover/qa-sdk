// @def.boundary experience-layer-group
// @def.doc experience-layer-group

/**
 * 용어집 — Registry DSL 핵심 개념 + 구조 설명
 */

interface Section {
  title: string;
  items: { term: string; en: string; desc: string }[];
}

const SECTIONS: Section[] = [
  {
    title: "핵심 원칙",
    items: [
      { term: "Prefix 참조 = Capacity 조회", en: "Prefix Reference",
        desc: "composite가 다른 prefix(leaf든 composite든)를 dims로 참조할 때, <strong>capacity만 사용</strong>한다. 내부를 재귀적으로 펼치지 않는다. 참조 깊이와 무관하게 resolve는 O(prefix 수)." },
      { term: "주소 = 버전에 고정", en: "Version-Pinned Address",
        desc: "같은 정수 주소라도 스키마 버전이 다르면 다른 좌표를 가리킨다. capacity가 stride를 결정하고, stride가 주소의 의미를 결정하므로, <strong>버전 없이 주소는 무의미</strong>하다. 직렬화: <code>schema:version:prefix:address</code>" },
      { term: "축 배치 순서 = Stride 안정성", en: "Axis Ordering",
        desc: "변경 빈도 높은 축을 첫 번째(외부)에 배치하면 capacity 확장 시 stride가 불변 → 마이그레이션 불필요. 내부 축(마지막) 확장 시 모든 외부 축의 stride가 재계산된다." },
    ],
  },
  {
    title: "Layer 0 — EnumAxis",
    items: [
      { term: "EnumAxis (열거형 축)", en: "EnumAxis",
        desc: "DSL의 최소 단위. 문자열 엔트리의 순서 목록. position(1-based)이 곧 좌표. <code>enumAxis('role', ['admin','editor','viewer'], 8)</code>" },
      { term: "Capacity", en: "Capacity",
        desc: "축이 수용할 수 있는 최대 엔트리 수. entries보다 크게 잡아 headroom을 확보하면, 엔트리 추가 시 stride 변경 없이 확장 가능." },
      { term: "Headroom", en: "Headroom",
        desc: "<code>capacity − entries.length</code>. 남은 슬롯 수. headroom이 0이 되면 capacity 확장(=stride 변경=마이그레이션)이 필요." },
    ],
  },
  {
    title: "Layer 1 — Prefix",
    items: [
      { term: "Leaf Prefix", en: "Leaf Prefix",
        desc: "단일 EnumAxis를 주소 공간으로 등록한 것. <code>shape=[capacity], stride=[1]</code>. 모든 주소 공간의 기본 단위." },
      { term: "Composite Prefix", en: "Composite Prefix",
        desc: "여러 prefix를 dims로 조합한 n차원 주소 공간. dims에는 leaf뿐 아니라 <strong>다른 composite도 참조 가능</strong>. 참조 시 capacity만 사용하므로 재귀 없음." },
      { term: "Shape", en: "Shape",
        desc: "composite의 각 dim capacity 배열. <code>[1024, 32768, 1024]</code>. product = 전체 주소 공간 크기." },
      { term: "Stride", en: "Stride",
        desc: "축별 가중치. <code>stride[i] = shape[i+1] × … × shape[n−1]</code>. 마지막 축은 항상 1. 좌표→주소 변환의 핵심." },
    ],
  },
  {
    title: "Layer 2 — Schema / Version",
    items: [
      { term: "Schema", en: "Schema",
        desc: "prefix 집합 + 버전 정보. <code>resolveSchema()</code>로 모든 composite의 shape/stride를 자동 계산." },
      { term: "VersionedAddress", en: "Versioned Address",
        desc: "<code>schema:version:prefix:address</code> 형태. decode 시 반드시 동일 버전의 stride를 사용해야 올바른 좌표가 나온다." },
      { term: "Owner", en: "Owner",
        desc: "prefix를 소유하는 서비스 또는 팀. DAG에서 변경 영향 범위를 소유자별로 추적." },
    ],
  },
  {
    title: "운영",
    items: [
      { term: "Budget 배분", en: "Budget Allocation",
        desc: "Number.MAX_SAFE_INTEGER(2^53)의 비트 예산을 축별 변경 빈도에 비례하여 배분. 자주 바뀌는 축에 더 많은 capacity → headroom 소진을 최대한 늦춤." },
      { term: "Number → BigInt 전환", en: "Number → BigInt",
        desc: "product가 2^53을 초과하면 BigInt 모드로 전환. 기존 Number 주소는 <code>BigInt(addr)</code>로 변환해도 동일 좌표." },
      { term: "DAG", en: "Directed Acyclic Graph",
        desc: "composite가 다른 prefix를 참조하는 방향성 비순환 그래프. release 순서는 위상정렬로 결정 (leaf 먼저, composite 나중)." },
      { term: "Simulate", en: "Simulate",
        desc: "capacity 변경 시 영향받는 composite를 DAG 순회로 식별. stride 변경 여부, overflow 감지, 마이그레이션 필요성 판단." },
    ],
  },
];

export function renderGlossaryPage(container: HTMLElement): void {
  container.innerHTML = `
    <div class="gl-page">
      <h2>Registry DSL 용어집</h2>

      <div class="gl-diagram">
        <div class="gl-diagram-title">Prefix 참조 구조</div>
        <pre class="gl-pre">
leaf env(cap=5)   leaf svc(cap=8)   leaf role(cap=4)
     │                 │                  │
     └────┬────────────┘                  │
          ▼                               │
  composite service                       │
  dims=[env, svc]                         │
  cap = 5 × 8 = 40  ◄── capacity만 참조   │
          │                               │
          └──────────┬────────────────────┘
                     ▼
             composite permission
             dims=[service, role]
             cap = 40 × 4 = 160  ◄── service 내부를 펼치지 않음

  주소 직렬화: "myapp:v1:permission:42"
               schema version prefix  address</pre>
      </div>

      ${SECTIONS.map((s) => `
        <div class="gl-section">
          <h3>${s.title}</h3>
          <div class="gl-list">
            ${s.items.map((t) => `
              <div class="gl-item">
                <div class="gl-term">
                  <span class="gl-term-ko">${t.term}</span>
                  <span class="gl-term-en">${t.en}</span>
                </div>
                <div class="gl-desc">${t.desc}</div>
              </div>
            `).join("")}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}
