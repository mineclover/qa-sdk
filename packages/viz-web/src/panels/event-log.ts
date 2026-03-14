import type { StoredRecord } from "@qa-sdk/core";

export interface EventLog {
  /** spec graph 기반 step 번호 맵 설정 (event_key → 1-based index) */
  setStepMap(map: Map<string, number>): void;
  addEvent(record: StoredRecord): void;
  clear(): void;
}

function formatTimestamp(ts: Date | string): string {
  const date = ts instanceof Date ? ts : new Date(ts);
  return date.toISOString().slice(11, 23);
}

function truncatePayload(payload: unknown, maxLen = 200): string {
  try {
    const str = JSON.stringify(payload);
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen) + "…";
  } catch {
    return String(payload);
  }
}

// Step 번호별 고정 색상 팔레트
const STEP_PALETTE = [
  "#4a9eff", // 1 - blue
  "#4ade80", // 2 - green
  "#fbbf24", // 3 - yellow
  "#fb923c", // 4 - orange
  "#c084fc", // 5 - purple
  "#f472b6", // 6 - pink
  "#22d3ee", // 7 - cyan
  "#a3e635", // 8 - lime
];
const UNMATCHED_COLOR = "#6b7280";

function stepColor(n: number): string {
  if (n === 0) return UNMATCHED_COLOR;
  return STEP_PALETTE[(n - 1) % STEP_PALETTE.length];
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function createEventLog(container: HTMLElement): EventLog {
  let stepMap = new Map<string, number>();

  // ── DOM 구조 ──────────────────────────────────────────────
  const wrapper = document.createElement("div");
  wrapper.className = "event-log";

  const header = document.createElement("div");
  header.className = "panel-header";

  const title = document.createElement("span");
  title.className = "panel-label";
  title.textContent = "Event Log";

  const clearBtn = document.createElement("button");
  clearBtn.className = "btn-clear";
  clearBtn.textContent = "Clear";

  header.appendChild(title);
  header.appendChild(clearBtn);

  // sequence strip: 이벤트 도착 순서를 숫자 칩으로 나열
  const seqStrip = document.createElement("div");
  seqStrip.className = "event-seq-strip";
  const seqEmpty = document.createElement("span");
  seqEmpty.className = "event-seq-empty";
  seqEmpty.textContent = "no events";
  seqStrip.appendChild(seqEmpty);

  const list = document.createElement("div");
  list.className = "event-log-list";

  wrapper.appendChild(header);
  wrapper.appendChild(seqStrip);
  wrapper.appendChild(list);
  container.appendChild(wrapper);

  // ── Tooltip (singleton, body에 붙임) ─────────────────────
  const tooltip = document.createElement("div");
  tooltip.className = "event-seq-tooltip";
  tooltip.hidden = true;
  document.body.appendChild(tooltip);

  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  function showTooltip(anchor: HTMLElement, record: StoredRecord, stepNum: number): void {
    if (hideTimer !== null) { clearTimeout(hideTimer); hideTimer = null; }

    const color = stepColor(stepNum);
    const label = stepNum === 0 ? "?" : String(stepNum);

    tooltip.innerHTML = `
      <div class="tt-header">
        <span class="tt-badge" style="color:${color};background:${hexToRgba(color, 0.18)};border-color:${hexToRgba(color, 0.5)}">${label}</span>
        <span class="tt-key" style="color:${color}">${record.eventKey}</span>
      </div>
      <div class="tt-time">${formatTimestamp(record.timestamp)}</div>
      ${record.eventVersion ? `<div class="tt-version">v${record.eventVersion}</div>` : ""}
      <div class="tt-payload">${truncatePayload(record.payload)}</div>
    `;
    tooltip.hidden = false;

    requestAnimationFrame(() => {
      const ar = anchor.getBoundingClientRect();
      const tr = tooltip.getBoundingClientRect();
      let left = ar.left + ar.width / 2 - tr.width / 2;
      let top = ar.bottom + 8;
      left = Math.max(6, Math.min(left, window.innerWidth - tr.width - 6));
      if (top + tr.height > window.innerHeight - 6) top = ar.top - tr.height - 8;
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    });
  }

  function hideTooltip(): void {
    hideTimer = setTimeout(() => { tooltip.hidden = true; }, 80);
  }

  // ── Clear ─────────────────────────────────────────────────
  function clear(): void {
    list.innerHTML = "";
    seqStrip.innerHTML = "";
    seqStrip.appendChild(seqEmpty);
  }

  clearBtn.addEventListener("click", clear);

  return {
    setStepMap(map: Map<string, number>): void {
      stepMap = map;
    },

    addEvent(record: StoredRecord): void {
      const stepNum = stepMap.get(record.eventKey) ?? 0;
      const color = stepColor(stepNum);
      const label = stepNum === 0 ? "?" : String(stepNum);
      const bgNormal = hexToRgba(color, 0.12);
      const bgHover = hexToRgba(color, 0.26);
      const borderColor = hexToRgba(color, 0.45);

      // empty placeholder 제거
      seqEmpty.remove();

      // ── Sequence chip ──────────────────────────────────────
      const chip = document.createElement("span");
      chip.className = "event-seq-chip";
      chip.textContent = label;
      chip.style.color = color;
      chip.style.background = bgNormal;
      chip.style.borderColor = borderColor;

      chip.addEventListener("mouseenter", () => {
        chip.style.background = bgHover;
        showTooltip(chip, record, stepNum);
      });
      chip.addEventListener("mouseleave", () => {
        chip.style.background = bgNormal;
        hideTooltip();
      });

      seqStrip.appendChild(chip);
      // 오른쪽 끝으로 스크롤
      requestAnimationFrame(() => { seqStrip.scrollLeft = seqStrip.scrollWidth; });

      // ── Log row ────────────────────────────────────────────
      const entry = document.createElement("div");
      entry.className = "event-log-entry";

      const badge = document.createElement("span");
      badge.className = "event-step-badge";
      badge.textContent = label;
      badge.style.color = color;
      badge.style.background = hexToRgba(color, 0.15);
      badge.style.borderColor = hexToRgba(color, 0.35);

      const time = document.createElement("span");
      time.className = "event-time";
      time.textContent = formatTimestamp(record.timestamp);

      const key = document.createElement("span");
      key.className = "event-key";
      key.textContent = record.eventKey;

      const payload = document.createElement("span");
      payload.className = "event-payload";
      payload.textContent = truncatePayload(record.payload, 120);

      entry.appendChild(badge);
      entry.appendChild(time);
      entry.appendChild(key);
      entry.appendChild(payload);
      list.appendChild(entry);
      list.scrollTop = list.scrollHeight;
    },

    clear,
  };
}
