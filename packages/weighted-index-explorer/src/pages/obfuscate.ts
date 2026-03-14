// ═══════════════════════════════════════════════════════════════════════════
//  난독화 — 비트 변환 & 복호화 페이지
// ═══════════════════════════════════════════════════════════════════════════

import {
  WeightedIndex,
  calcBitWidth,
  xorObfuscate,
  rotateLeft,
  rotateRight,
  reverseBits,
  toHex,
  toUUID,
  toNanoId,
  toStructuredUUID,
  fromHex,
} from "weighted-index";

// ── 탐색기와 동일한 권한 모델 ──────────────────────────────────────────────

const WI        = new WeightedIndex([8, 4, 5, 4], ["resource", "action", "role", "env"]);
const BIT_WIDTH = calcBitWidth(WI.size); // 10

// ── 변환 로직 ─────────────────────────────────────────────────────────────

type TransformType = "xor" | "rotate" | "reverse" | "compose";

function applyEncode(id: number, type: TransformType, key: number, amount: number, w: number): number {
  switch (type) {
    case "xor":     return xorObfuscate(id, w, key);
    case "rotate":  return rotateLeft(id, w, amount);
    case "reverse": return reverseBits(id, w);
    case "compose": return rotateLeft(xorObfuscate(id, w, key), w, amount);
  }
}

function applyDecode(token: number, type: TransformType, key: number, amount: number, w: number): number {
  switch (type) {
    case "xor":     return xorObfuscate(token, w, key);
    case "rotate":  return rotateRight(token, w, amount);
    case "reverse": return reverseBits(token, w);
    case "compose": return xorObfuscate(rotateRight(token, w, amount), w, key);
  }
}

// ── 비트 시각화 헬퍼 ──────────────────────────────────────────────────────

function toBits(n: number, w: number): string[] {
  return n.toString(2).padStart(w, "0").split("");
}

function renderBitRow(bits: string[], changedIdx: Set<number>): string {
  return bits.map((b, i) =>
    `<span class="obf-bit obf-bit-${b}${changedIdx.has(i) ? " obf-bit-changed" : ""}">${b}</span>`
  ).join("");
}

function changedBits(a: string[], b: string[]): Set<number> {
  const s = new Set<number>();
  a.forEach((bit, i) => { if (bit !== b[i]) s.add(i); });
  return s;
}

// ── Entry point ───────────────────────────────────────────────────────────

export function renderObfuscatePage(container: HTMLElement): void {
  container.innerHTML = `<div class="concept-wrap">
    ${renderIntro()}
    ${renderDemo()}
    ${renderTransformRef()}
    ${renderSerializationRef()}
    ${renderKeyManagement()}
  </div>`;
  setupInteractivity(container);
}

// ── 1. 소개 ──────────────────────────────────────────────────────────────

function renderIntro(): string {
  return `
    <h2 class="concept-section-title">난독화 — 비트 변환과 복호화</h2>
    <p class="concept-desc">
      가중진법 ID는 구조화된 정수입니다. 스키마를 알면 순서를 예측할 수 있다는 것이
      <em>기능</em>이지만, 외부에 ID를 노출할 때는 <strong>내부 구조를 숨기고 싶은 경우</strong>가 있습니다.
      난독화는 ID를 <strong>전단사(bijection) 비트 변환</strong>으로 불투명한 토큰으로 바꾸고,
      필요할 때 다시 원래 ID로 복원하는 방법입니다.
    </p>

    <div class="xl-formula-block" style="gap:24px;flex-wrap:wrap">
      <div>
        <span class="xlf-label">전제 조건</span>
        <span class="xlf-expr">encode(decode(token)) = token &nbsp;·&nbsp; decode(encode(id)) = id</span>
      </div>
      <div style="width:1px;background:var(--border-cell);align-self:stretch"></div>
      <div>
        <span class="xlf-label">이 라이브러리의 bitWidth</span>
        <span class="xlf-expr">size=${WI.size} → bitWidth=${BIT_WIDTH} bits</span>
      </div>
    </div>

    <div class="concept-block">
      <div class="cb-header">난독화 vs 암호화 vs 해시</div>
      <div class="cb-body">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
          ${[
            { title: "난독화 (이 모듈)", color: "#22c55e", items: [
              "양방향 — 복원 가능",
              "전단사 보장",
              "암호학적 보안 없음",
              "구조 예측 방지 목적",
            ]},
            { title: "암호화", color: "#f59e0b", items: [
              "양방향 — 키로 복원",
              "암호학적 안전성",
              "키 없으면 복원 불가",
              "보안이 목적",
            ]},
            { title: "해시 (SHA 등)", color: "#ef4444", items: [
              "단방향 — 복원 불가",
              "충돌 저항성",
              "원본 ID 복원 불필요",
              "무결성 검증 목적",
            ]},
          ].map(({ title, color, items }) => `
            <div class="phi-purpose-box" style="border-top-color:${color}">
              <div class="phi-purpose-title" style="color:${color}">${title}</div>
              <ul class="phi-purpose-list">${items.map(i => `<li>${i}</li>`).join("")}</ul>
            </div>
          `).join("")}
        </div>
        <div class="insight-box" style="margin-top:12px">
          <span class="insight-icon">💡</span>
          <span>
            토큰을 받아 원래 ID로 복원해야 한다면 난독화를,
            복원이 필요 없다면 해시를 사용합니다.
            보안이 요구된다면 HMAC·AES 등 암호화를 선택합니다.
          </span>
        </div>
      </div>
    </div>
  `;
}

// ── 2. 인터랙티브 데모 ────────────────────────────────────────────────────

function renderDemo(): string {
  const initBw    = BIT_WIDTH;          // 10
  const initMaxId = (1 << initBw) - 1; // 1023
  const initKeyMax = initMaxId;
  const initAmtMax = initBw - 1;       // 9

  return `
    <div class="concept-block">
      <div class="cb-header">비트 변환 데모 — 실시간 인코드 / 디코드</div>
      <div class="cb-body">

        <!-- bitWidth 입력 -->
        <div class="obf-input-row">
          <span class="obf-label">bitWidth</span>
          <input type="range"  id="obf-bw-slider" class="buf-slider" min="1" max="30" value="${initBw}" style="flex:1;min-width:120px" />
          <input type="number" id="obf-bw-num"    class="addr-dec-input" min="1" max="30" value="${initBw}" style="width:55px" />
          <span class="obf-range">
            ( 1 ~ 30 ) &nbsp;·&nbsp; size = <span id="obf-bw-size">${1 << initBw}</span>
          </span>
        </div>

        <!-- ID 입력 -->
        <div class="obf-input-row">
          <span class="obf-label">원본 ID</span>
          <input type="range"  id="obf-id-slider" class="buf-slider" min="0" max="${initMaxId}" value="42" style="flex:1;min-width:120px" />
          <input type="number" id="obf-id-num"    class="addr-dec-input" min="0" max="${initMaxId}" value="42" style="width:70px" />
          <span class="obf-range" id="obf-id-range">( 0 ~ ${initMaxId} )</span>
        </div>

        <!-- 변환 선택 -->
        <div class="obf-transform-row">
          <span class="obf-label">변환</span>
          <label class="obf-radio-label"><input type="radio" name="obf-type" value="xor"     checked /> XOR</label>
          <label class="obf-radio-label"><input type="radio" name="obf-type" value="rotate"        /> Rotate</label>
          <label class="obf-radio-label"><input type="radio" name="obf-type" value="reverse"       /> Reverse</label>
          <label class="obf-radio-label"><input type="radio" name="obf-type" value="compose"       /> Compose (XOR→Rotate)</label>
        </div>

        <!-- 파라미터 -->
        <div class="obf-param-row">
          <span class="obf-label">파라미터</span>
          <div id="obf-params">
            <!-- XOR params -->
            <div id="param-xor">
              <label class="obf-param-label" id="obf-key-label">key (0~${initKeyMax})</label>
              <input type="number" id="obf-key" class="addr-dec-input" min="0" max="${initKeyMax}" value="163" style="width:80px" />
              <span class="obf-param-hint" id="obf-key-hint">0x0a3 = 0b${(163).toString(2).padStart(initBw, "0")}</span>
            </div>
            <!-- Rotate params -->
            <div id="param-rotate" style="display:none">
              <label class="obf-param-label" id="obf-amount-label">amount (1~${initAmtMax})</label>
              <input type="number" id="obf-amount" class="addr-dec-input" min="1" max="${initAmtMax}" value="3" style="width:60px" />
            </div>
            <!-- Reverse: no params -->
            <div id="param-reverse" style="display:none">
              <span class="obf-param-hint" style="color:var(--text-muted)">파라미터 없음 — 자기 역원</span>
            </div>
            <!-- Compose params -->
            <div id="param-compose" style="display:none">
              <label class="obf-param-label" id="obf-ckey-label">key (0~${initKeyMax})</label>
              <input type="number" id="obf-ckey" class="addr-dec-input" min="0" max="${initKeyMax}" value="163" style="width:80px" />
              <label class="obf-param-label" id="obf-camount-label" style="margin-left:12px">amount (1~${initAmtMax})</label>
              <input type="number" id="obf-camount" class="addr-dec-input" min="1" max="${initAmtMax}" value="3" style="width:60px" />
            </div>
          </div>
        </div>

        <!-- 비트 시각화 -->
        <div class="obf-viz-block">
          <div class="obf-viz-row">
            <span class="obf-viz-label">원본 ID</span>
            <div class="obf-viz-num" id="viz-orig-num">42</div>
            <div class="obf-bits" id="viz-orig-bits"></div>
          </div>
          <div class="obf-viz-arrow">↓ 변환 적용</div>
          <div class="obf-viz-row">
            <span class="obf-viz-label">변환 후</span>
            <div class="obf-viz-num" id="viz-obf-num">—</div>
            <div class="obf-bits" id="viz-obf-bits"></div>
            <span class="obf-changed-count" id="viz-changed">—</span>
          </div>
        </div>

        <!-- 출력 토큰 -->
        <div class="obf-token-row">
          <div class="obf-token-card">
            <span class="obf-token-label">hex</span>
            <code class="obf-token-val" id="tok-hex">—</code>
            <span class="obf-token-hint" id="tok-hex-hint">${initBw}비트 → ${Math.ceil(initBw / 4)}자리</span>
          </div>
          <div class="obf-token-card">
            <span class="obf-token-label">nanoId</span>
            <code class="obf-token-val" id="tok-nanoid">—</code>
            <span class="obf-token-hint" id="tok-nano-hint">${initBw}비트 → ${Math.ceil(initBw / 6)}자리 (base64url)</span>
          </div>
          <div class="obf-token-card">
            <span class="obf-token-label">구조화 토큰</span>
            <code class="obf-token-val" id="tok-struct" style="font-size:0.78rem">—</code>
            <span class="obf-token-hint" id="tok-struct-hint">v1 + id → compact</span>
          </div>
        </div>

        <!-- 역변환 확인 -->
        <div class="obf-roundtrip" id="obf-roundtrip">
          <span class="obf-rt-label">역변환 확인</span>
          <span id="rt-formula">—</span>
        </div>

      </div>
    </div>
  `;
}

// ── 3. 변환 방식 레퍼런스 ─────────────────────────────────────────────────

function renderTransformRef(): string {
  const transforms = [
    {
      name: "XOR",
      fn: "xorObfuscate(id, bitWidth, key)",
      inv: "xorObfuscate(token, bitWidth, key)  ← 동일",
      param: "key: 0 ~ 2^bitWidth−1",
      note: "자기 역원. 같은 함수로 인코드·디코드.",
      example: () => {
        const id = 42, key = 0xA3;
        const t  = xorObfuscate(id, BIT_WIDTH, key);
        return `xorObfuscate(${id}, ${BIT_WIDTH}, 0xA3) → ${t} → xorObfuscate → ${id}`;
      },
    },
    {
      name: "rotateLeft / rotateRight",
      fn: "rotateLeft(id, bitWidth, amount)",
      inv: "rotateRight(token, bitWidth, amount)",
      param: "amount: 정수 (mod bitWidth 정규화, 음수 허용)",
      note: "왼쪽 순환 시프트가 인코드, 오른쪽이 디코드.",
      example: () => {
        const id = 42, amt = 3;
        const t = rotateLeft(id, BIT_WIDTH, amt);
        return `rotateLeft(${id}, ${BIT_WIDTH}, ${amt}) → ${t} → rotateRight → ${id}`;
      },
    },
    {
      name: "reverseBits",
      fn: "reverseBits(id, bitWidth)",
      inv: "reverseBits(token, bitWidth)  ← 동일",
      param: "없음",
      note: "자기 역원. 비트 순서를 뒤집는다.",
      example: () => {
        const id = 42;
        const t  = reverseBits(id, BIT_WIDTH);
        return `reverseBits(${id}, ${BIT_WIDTH}) → ${t} → reverseBits → ${id}`;
      },
    },
    {
      name: "compose",
      fn: "compose(f1, f2, ...)(id, bitWidth)",
      inv: "compose(f2_inv, f1_inv, ...)(token, bitWidth)",
      param: "각 변환의 파라미터",
      note: "체인. 역변환은 역순으로 각 역함수 적용.",
      example: () => {
        const id = 42, key = 0xA3, amt = 3;
        const t = rotateLeft(xorObfuscate(id, BIT_WIDTH, key), BIT_WIDTH, amt);
        const b = xorObfuscate(rotateRight(t, BIT_WIDTH, amt), BIT_WIDTH, key);
        return `XOR(0xA3) → rotate(3): ${id} → ${t} → ${b}`;
      },
    },
  ];

  const rows = transforms.map(({ name, fn, inv, param, note, example }) => `
    <tr>
      <td style="font-weight:700;white-space:nowrap">${name}</td>
      <td><code style="font-size:0.7rem">${fn}</code></td>
      <td><code style="font-size:0.7rem">${inv}</code></td>
      <td style="font-size:0.72rem">${param}</td>
      <td style="font-size:0.7rem;color:var(--text-muted)">${note}</td>
      <td style="font-size:0.68rem;color:var(--xl-green)"><code>${example()}</code></td>
    </tr>
  `).join("");

  return `
    <div class="concept-block">
      <div class="cb-header">변환 방식 레퍼런스</div>
      <div class="cb-body">
        <div class="ev-tbl-wrap">
          <table class="ev-tbl">
            <thead><tr>
              <th>방식</th><th>인코드 함수</th><th>디코드 함수</th>
              <th>베리에이션 파라미터</th><th>특징</th><th>예시 (bitWidth=${BIT_WIDTH})</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="insight-box" style="margin-top:12px">
          <span class="insight-icon">🔑</span>
          <span>
            <strong>파라미터를 잃으면 복원 불가</strong>입니다.
            <code>key</code>와 <code>amount</code>는 인코딩 시 사용한 값과 동일해야 디코딩됩니다.
            <code>bitWidth</code>는 <code>calcBitWidth(wi.size)</code>로 재계산 가능하므로 별도 저장이 불필요합니다.
          </span>
        </div>
      </div>
    </div>
  `;
}

// ── 4. 직렬화 형식 ────────────────────────────────────────────────────────

function renderSerializationRef(): string {
  const exId     = 42;
  const exKey    = 0xA3;
  const exObf    = xorObfuscate(exId, BIT_WIDTH, exKey);
  const exHex    = toHex(exObf, BIT_WIDTH);
  const exNano   = toNanoId(exObf, BIT_WIDTH);
  const exUuid   = toUUID(exObf, BIT_WIDTH);
  const hexLen   = Math.ceil(BIT_WIDTH / 4);
  const nanoLen  = Math.ceil(BIT_WIDTH / 6);

  return `
    <div class="concept-block">
      <div class="cb-header">직렬화 형식 — hex · nanoId · UUID</div>
      <div class="cb-body">
        <p class="concept-desc" style="margin-bottom:14px">
          변환된 정수는 <strong>숫자 그대로 쓰는 것이 가장 빠릅니다.</strong>
          외부에 노출하거나 문자열 형식이 필요할 때만 직렬화를 추가합니다.
        </p>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px">
          <div class="phi-analogy-box">
            <div class="phi-analogy-title">toHex / fromHex</div>
            <div class="phi-analogy-body">
              <span class="phi-small">길이: ceil(${BIT_WIDTH} / 4) = <strong>${hexLen}자</strong> · base16</span><br/>
              <code style="color:var(--xl-green)">toHex(${exObf}, ${BIT_WIDTH})<br/>"${exHex}"</code><br/>
              <span class="phi-small" style="margin-top:6px;display:block">URL 파라미터, 헤더 토큰</span>
            </div>
          </div>
          <div class="phi-analogy-box">
            <div class="phi-analogy-title">toNanoId / fromNanoId</div>
            <div class="phi-analogy-body">
              <span class="phi-small">길이: ceil(${BIT_WIDTH} / 6) = <strong>${nanoLen}자</strong> · base64url</span><br/>
              <code style="color:var(--xl-green)">toNanoId(${exObf}, ${BIT_WIDTH})<br/>"${exNano}"</code><br/>
              <span class="phi-small" style="margin-top:6px;display:block">가장 짧은 URL-safe 토큰</span>
            </div>
          </div>
          <div class="phi-analogy-box">
            <div class="phi-analogy-title">toUUID / fromUUID</div>
            <div class="phi-analogy-body">
              <span class="phi-small">출력: 128비트 고정 · prefix 배치 (8-4-4-4-12)</span><br/>
              <code style="color:var(--xl-green);font-size:0.68rem">toUUID(${exObf}, ${BIT_WIDTH})<br/>"${exUuid}"</code><br/>
              <span class="phi-small" style="margin-top:6px;display:block">UUID를 요구하는 외부 시스템</span>
            </div>
          </div>
        </div>
        <table class="nd-table">
          <thead><tr><th>형식</th><th>길이 (bitWidth=${BIT_WIDTH})</th><th>알파벳</th><th>역변환</th><th>용도</th></tr></thead>
          <tbody>
            <tr>
              <td><strong>정수 (기본)</strong></td>
              <td>—</td>
              <td>—</td>
              <td>직접 변환 함수 사용</td>
              <td>내부 처리, DB 저장, 최고 성능</td>
            </tr>
            <tr>
              <td><strong>hex</strong></td>
              <td>${hexLen}자</td>
              <td>0-9 a-f (4 bits/char)</td>
              <td>fromHex(token, bitWidth)</td>
              <td>URL, 헤더, 짧은 토큰</td>
            </tr>
            <tr>
              <td><strong>nanoId</strong></td>
              <td><strong>${nanoLen}자</strong> ← 최단</td>
              <td>A-Z a-z 0-9 - _ (6 bits/char)</td>
              <td>fromNanoId(token, bitWidth)</td>
              <td>URL-safe 최소 토큰</td>
            </tr>
            <tr>
              <td><strong>UUID</strong></td>
              <td>36자 (128비트 고정)</td>
              <td>hex + dashes · prefix 배치</td>
              <td>fromUUID(token, bitWidth)</td>
              <td>UUID를 요구하는 외부 API</td>
            </tr>
            <tr>
              <td><strong>구조화 토큰</strong></td>
              <td>ceil(totalBits/4)자 · compact</td>
              <td>hex + dashes (4자마다)</td>
              <td>fromStructuredUUID(token, bitWidths)</td>
              <td>다중 필드 bit-pack · 버전·네임스페이스 내장</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    ${renderStructuredUUIDRef(exObf)}
  `;
}

// ── 4b. 구조화 토큰 ──────────────────────────────────────────────────────

function renderStructuredUUIDRef(exObfId: number): string {
  const ver      = 1;
  const schemaId = 3;
  const totalBitsA = 4 + 8 + BIT_WIDTH; // 22
  const tokenA   = toStructuredUUID([
    { value: ver,      bitWidth: 4  },
    { value: schemaId, bitWidth: 8  },
    { value: exObfId,  bitWidth: BIT_WIDTH },
  ]);

  const tokenB = toStructuredUUID([{ value: exObfId, bitWidth: BIT_WIDTH }]);

  const totalBitsC = 2 + 6 + BIT_WIDTH; // 18
  const tokenC = toStructuredUUID([
    { value: 0b10, bitWidth: 2  },
    { value: 0x1F, bitWidth: 6  },
    { value: exObfId, bitWidth: BIT_WIDTH },
  ]);

  return `
    <div class="concept-block">
      <div class="cb-header">구조화 토큰 — 다중 필드 bit-pack</div>
      <div class="cb-body">
        <p class="concept-desc" style="margin-bottom:14px">
          여러 필드(버전·네임스페이스·난독화 ID 등)를 <strong>비트 단위로 tight-pack</strong>해서
          필요한 만큼만 hex로 출력합니다.
          128비트 고정 UUID와 달리 <strong>출력 길이 = ceil(totalBits / 4)</strong>이므로
          필드가 적으면 토큰도 짧아집니다.
        </p>

        <div class="addr-code-block" style="margin-bottom:14px">
          <div class="addr-code-label">3개 필드 — version(4) + schemaId(8) + id(${BIT_WIDTH}) = ${totalBitsA}비트 → ${Math.ceil(totalBitsA / 4)}자</div>
          <pre class="buf-code">toStructuredUUID([
  { value: ${ver},   bitWidth: 4  },   // version
  { value: ${schemaId},   bitWidth: 8  },   // schemaId
  { value: ${exObfId}, bitWidth: ${BIT_WIDTH} },  // obf id
])
// → "${tokenA}"

fromStructuredUUID("${tokenA}", [4, 8, ${BIT_WIDTH}])
// → [${ver}, ${schemaId}, ${exObfId}]</pre>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
          <div class="phi-analogy-box">
            <div class="phi-analogy-title">단일 필드 (${BIT_WIDTH}비트) → ${Math.ceil(BIT_WIDTH / 4)}자</div>
            <div class="phi-analogy-body">
              <code style="font-size:0.68rem;color:var(--xl-green)">
                toStructuredUUID([&#123; value: ${exObfId}, bitWidth: ${BIT_WIDTH} &#125;])<br/>
                "${tokenB}"
              </code>
            </div>
          </div>
          <div class="phi-analogy-box">
            <div class="phi-analogy-title">flag(2) + ns(6) + id(${BIT_WIDTH}) = ${totalBitsC}비트 → ${Math.ceil(totalBitsC / 4)}자</div>
            <div class="phi-analogy-body">
              <code style="font-size:0.68rem;color:var(--xl-green)">
                [0b10, 0x1f, ${exObfId}]<br/>
                "${tokenC}"
              </code>
            </div>
          </div>
        </div>

        <table class="nd-table">
          <thead><tr><th>규칙</th><th>설명</th></tr></thead>
          <tbody>
            <tr>
              <td>bit-level pack</td>
              <td>필드 간 nibble 정렬 낭비 없음. 1-bit 플래그도 1비트만 차지</td>
            </tr>
            <tr>
              <td>compact 출력</td>
              <td>hex 길이 = <code>ceil(totalBits / 4)</code>. 22비트 → 6자, 14비트 → 4자</td>
            </tr>
            <tr>
              <td>스키마 공유</td>
              <td><code>bitWidths</code> 배열이 인코더·디코더 양쪽에서 동일해야 합니다</td>
            </tr>
            <tr>
              <td>full UUID 필요 시</td>
              <td><code>toUUID</code>를 사용 — 128비트 고정, 8-4-4-4-12 포맷</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ── 5. 복호화 방법 관리 ───────────────────────────────────────────────────

function renderKeyManagement(): string {
  return `
    <div class="concept-block">
      <div class="cb-header">복호화 방법 관리 — 무엇을 보존해야 하는가</div>
      <div class="cb-body">
        <table class="nd-table">
          <thead><tr><th>요소</th><th>재계산 가능 여부</th><th>관리 방법</th></tr></thead>
          <tbody>
            <tr>
              <td><code>bitWidth</code></td>
              <td style="color:var(--xl-green)">✅ 항상 재계산 가능</td>
              <td><code>calcBitWidth(wi.size)</code> — shape에서 유도, 별도 저장 불필요</td>
            </tr>
            <tr>
              <td><code>key</code> (XOR)</td>
              <td style="color:var(--status-fail)">❌ 별도 보관 필수</td>
              <td>환경 변수, 시크릿 관리 도구 등 — 잃으면 복원 불가</td>
            </tr>
            <tr>
              <td><code>amount</code> (Rotate)</td>
              <td style="color:var(--status-fail)">❌ 별도 보관 필수</td>
              <td>key와 함께 보관. 고정값이면 코드 상수로도 가능</td>
            </tr>
            <tr>
              <td>shape 버전</td>
              <td style="color:var(--xl-blue)">⚠️ 주의 필요</td>
              <td>shape이 바뀌면 size가 달라져 bitWidth도 변경됨. 이전 토큰과 호환 불가 → 버전 전환 시 토큰 재발급 필요</td>
            </tr>
          </tbody>
        </table>

        <div class="addr-code-block" style="margin-top:14px">
          <div class="addr-code-label">권장 패턴 — 변환 설정을 한 곳에서 관리</div>
          <pre class="buf-code">import { WeightedIndex, calcBitWidth, xorObfuscate, rotateLeft, rotateRight, toHex, fromHex } from "weighted-index";

const wi       = new WeightedIndex([8, 4, 5, 4]);
const bitWidth = calcBitWidth(wi.size);  // 재계산 가능 — 저장 불필요

// key·amount는 환경 변수 등으로 외부 주입
const KEY    = 0xA3;  // 별도 보관 필요
const AMOUNT = 3;     // 별도 보관 필요

// encode: ID → hex 토큰
export function encodeToken(id: number): string {
  const obf = rotateLeft(xorObfuscate(id, bitWidth, KEY), bitWidth, AMOUNT);
  return toHex(obf, bitWidth);
}

// decode: hex 토큰 → ID
export function decodeToken(hex: string): number {
  const obf = fromHex(hex, bitWidth);
  return xorObfuscate(rotateRight(obf, bitWidth, AMOUNT), bitWidth, KEY);
}</pre>
        </div>

        <div class="insight-box" style="margin-top:12px">
          <span class="insight-icon">⚠️</span>
          <span>
            <strong>숫자가 더 빠릅니다.</strong>
            내부 처리에서는 변환된 정수를 그대로 쓰는 것이 성능상 최선입니다.
            hex·UUID 직렬화는 외부에 노출할 때만 추가하세요.
          </span>
        </div>
      </div>
    </div>
  `;
}

// ── 인터랙티브 로직 ───────────────────────────────────────────────────────

function setupInteractivity(container: HTMLElement): void {
  const bwSlider  = container.querySelector<HTMLInputElement>("#obf-bw-slider")!;
  const bwNum     = container.querySelector<HTMLInputElement>("#obf-bw-num")!;
  const slider    = container.querySelector<HTMLInputElement>("#obf-id-slider")!;
  const numInput  = container.querySelector<HTMLInputElement>("#obf-id-num")!;
  const radios    = container.querySelectorAll<HTMLInputElement>("input[name='obf-type']");
  const keyInput  = container.querySelector<HTMLInputElement>("#obf-key")!;
  const amtInput  = container.querySelector<HTMLInputElement>("#obf-amount")!;
  const ckeyInput = container.querySelector<HTMLInputElement>("#obf-ckey")!;
  const camtInput = container.querySelector<HTMLInputElement>("#obf-camount")!;
  const paramDivs = {
    xor:     container.querySelector<HTMLElement>("#param-xor")!,
    rotate:  container.querySelector<HTMLElement>("#param-rotate")!,
    reverse: container.querySelector<HTMLElement>("#param-reverse")!,
    compose: container.querySelector<HTMLElement>("#param-compose")!,
  };

  function getBitWidth(): number {
    return Math.max(1, Math.min(30, Number(bwNum.value) || 10));
  }

  function getType(): TransformType {
    return (container.querySelector<HTMLInputElement>("input[name='obf-type']:checked")?.value ?? "xor") as TransformType;
  }

  function getParams(): { key: number; amount: number } {
    const type = getType();
    return {
      key:    type === "compose" ? Number(ckeyInput.value)  : Number(keyInput.value),
      amount: type === "compose" ? Number(camtInput.value)  : Number(amtInput.value),
    };
  }

  function update(): void {
    const bw     = getBitWidth();
    const maxId  = (1 << bw) - 1;
    const id     = Math.max(0, Math.min(maxId, Number(numInput.value) || 0));
    const type   = getType();
    const { key, amount } = getParams();

    // Sync ID slider range + value
    slider.max     = String(maxId);
    numInput.max   = String(maxId);
    slider.value   = String(id);
    numInput.value = String(id);

    // Update param ranges + hints
    const keyMax = maxId;
    const amtMax = Math.max(1, bw - 1);
    keyInput.max   = String(keyMax);
    ckeyInput.max  = String(keyMax);
    amtInput.max   = String(amtMax);
    camtInput.max  = String(amtMax);

    const keyLabelEl  = container.querySelector<HTMLElement>("#obf-key-label");
    const amtLabelEl  = container.querySelector<HTMLElement>("#obf-amount-label");
    const ckeyLabelEl = container.querySelector<HTMLElement>("#obf-ckey-label");
    const camtLabelEl = container.querySelector<HTMLElement>("#obf-camount-label");
    if (keyLabelEl)  keyLabelEl.textContent  = `key (0~${keyMax})`;
    if (amtLabelEl)  amtLabelEl.textContent  = `amount (1~${amtMax})`;
    if (ckeyLabelEl) ckeyLabelEl.textContent = `key (0~${keyMax})`;
    if (camtLabelEl) camtLabelEl.textContent = `amount (1~${amtMax})`;

    if (type === "xor") {
      const hint = container.querySelector<HTMLElement>("#obf-key-hint");
      if (hint) hint.textContent =
        `0x${key.toString(16).padStart(Math.ceil(bw / 4), "0")} = 0b${key.toString(2).padStart(bw, "0")}`;
    }

    const token   = applyEncode(id, type, key, amount, bw);
    const decoded = applyDecode(token, type, key, amount, bw);

    // Bit visualization
    const origBits = toBits(id, bw);
    const obfBits  = toBits(token, bw);
    const changed  = changedBits(origBits, obfBits);

    container.querySelector<HTMLElement>("#viz-orig-bits")!.innerHTML = renderBitRow(origBits, new Set());
    container.querySelector<HTMLElement>("#viz-obf-bits")!.innerHTML  = renderBitRow(obfBits, changed);
    container.querySelector<HTMLElement>("#viz-orig-num")!.textContent = String(id);
    container.querySelector<HTMLElement>("#viz-obf-num")!.textContent  = String(token);
    const changedEl = container.querySelector<HTMLElement>("#viz-changed")!;
    changedEl.textContent = `${changed.size}비트 변경`;
    changedEl.style.color = changed.size === 0 ? "var(--text-muted)" : "var(--status-warn, #f59e0b)";

    // Tokens
    container.querySelector<HTMLElement>("#tok-hex")!.textContent    = toHex(token, bw);
    container.querySelector<HTMLElement>("#tok-nanoid")!.textContent = toNanoId(token, bw);

    // Structured token: version=1 (4-bit) + obfuscated id
    const structToken = toStructuredUUID([
      { value: 1,     bitWidth: 4  },
      { value: token, bitWidth: bw },
    ]);
    const structTotalBits = 4 + bw;
    container.querySelector<HTMLElement>("#tok-struct")!.textContent = structToken;

    // Token hints
    const hexHint    = container.querySelector<HTMLElement>("#tok-hex-hint");
    const nanoHint   = container.querySelector<HTMLElement>("#tok-nano-hint");
    const structHint = container.querySelector<HTMLElement>("#tok-struct-hint");
    if (hexHint)    hexHint.textContent    = `${bw}비트 → ${Math.ceil(bw / 4)}자리`;
    if (nanoHint)   nanoHint.textContent   = `${bw}비트 → ${Math.ceil(bw / 6)}자리 (base64url)`;
    if (structHint) structHint.textContent = `v1(4) + id(${bw}) = ${structTotalBits}비트 → ${Math.ceil(structTotalBits / 4)}자리`;

    // bw-size display + range label
    const bwSizeEl  = container.querySelector<HTMLElement>("#obf-bw-size");
    const rangeEl   = container.querySelector<HTMLElement>("#obf-id-range");
    if (bwSizeEl) bwSizeEl.textContent = String(1 << bw);
    if (rangeEl)  rangeEl.textContent  = `( 0 ~ ${maxId} )`;

    // Round-trip verification
    const ok = decoded === id;
    container.querySelector<HTMLElement>("#rt-formula")!.innerHTML =
      `decode(${token}) = <strong>${decoded}</strong> ${ok ? '<span style="color:var(--xl-green)">✓</span>' : '<span style="color:var(--status-fail)">✗</span>'}`;
  }

  function onBwChange(): void {
    const bw = getBitWidth();
    bwSlider.value = String(bw);
    bwNum.value    = String(bw);
    update();
  }

  function onTypeChange(): void {
    const type = getType();
    Object.entries(paramDivs).forEach(([k, el]) => {
      el.style.display = k === type ? "" : "none";
    });
    update();
  }

  bwSlider.addEventListener("input", () => { bwNum.value = bwSlider.value; onBwChange(); });
  bwNum.addEventListener("input",    () => { bwSlider.value = bwNum.value; onBwChange(); });
  slider.addEventListener("input",   () => { numInput.value = slider.value; update(); });
  numInput.addEventListener("input", () => { slider.value = numInput.value; update(); });
  radios.forEach(r => r.addEventListener("change", onTypeChange));
  keyInput.addEventListener("input", update);
  amtInput.addEventListener("input", update);
  ckeyInput.addEventListener("input", update);
  camtInput.addEventListener("input", update);

  update();
}
