// @def.boundary viz-system-root
// @def.doc viz-system-root

/**
 * flow-timeline — 타임라인 링 버퍼 + DOM 렌더링.
 *
 * monitor.html의 인라인 타임라인 로직을 추출한 모듈.
 * CSS 클래스명은 monitor.html에 이미 정의되어 있음:
 *   ft-entry, ft-role-dot, ft-body, ft-prefix, ft-values,
 *   ft-role-tag, ft-time, ft-fading
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface TimelineEntry {
  readonly prefixId: string;
  readonly valuesStr: string;
  readonly role: string;
  readonly ts: string;
}

export interface FlowTimelineOptions {
  maxEntries: number;
  containerId: string;
  roleColors: Record<string, string>;
}

/* ------------------------------------------------------------------ */
/*  FlowTimeline                                                       */
/* ------------------------------------------------------------------ */

export class FlowTimeline {
  private readonly _max: number;
  private readonly _containerId: string;
  private readonly _roleColors: Record<string, string>;
  private readonly _entries: TimelineEntry[] = [];
  private _roleFilter: string | null = null;

  constructor(options: FlowTimelineOptions) {
    this._max = options.maxEntries;
    this._containerId = options.containerId;
    this._roleColors = options.roleColors;
  }

  /* ── public API ── */

  /** 엔트리 추가 + 자동 렌더 */
  add(prefixId: string, valuesStr: string, role: string): void {
    const now = new Date();
    const ts =
      String(now.getHours()).padStart(2, '0') +
      ':' +
      String(now.getMinutes()).padStart(2, '0') +
      ':' +
      String(now.getSeconds()).padStart(2, '0') +
      '.' +
      String(now.getMilliseconds()).padStart(3, '0');
    this._entries.push({ prefixId, valuesStr, role, ts });
    if (this._entries.length > this._max) this._entries.shift();
    this.render();
  }

  /**
   * 컨텍스트 맵을 받아 각 prefix를 decode → 타임라인에 추가.
   * monitor.html의 feedTimeline() 과 동일한 동작.
   */
  feed(
    ctx: Record<string, string>,
    decodeFn: (s: string) => { values: Record<string, string | number> } | null,
    getRoleFn: (p: string) => string,
  ): void {
    for (const [p, s] of Object.entries(ctx)) {
      const role = getRoleFn(p);
      const d = decodeFn(s);
      const vals = d
        ? Object.entries(d.values)
            .map(([k, v]) => `${k}=${v}`)
            .join(' ')
        : s;
      this.add(p, vals, role);
    }
  }

  /** role 필터 설정 (null 이면 전체 표시) */
  setRoleFilter(role: string | null): void {
    this._roleFilter = role;
    this.render();
  }

  get roleFilter(): string | null {
    return this._roleFilter;
  }

  /** DOM 렌더링 — monitor.html의 renderTimeline() 과 동일 HTML 구조 */
  render(): void {
    const container = document.getElementById(this._containerId);
    if (!container) return;

    const html = this._entries
      .map((e) => {
        const col = this._roleColors[e.role] || '#556';
        const dimmed = this._roleFilter && this._roleFilter !== e.role ? 'ft-fading' : '';
        return (
          `<div class="ft-entry ${dimmed}">` +
          `<span class="ft-role-dot" style="background:${col}"></span>` +
          `<div class="ft-body">` +
          `<div class="ft-prefix" style="color:${col}">${e.prefixId}</div>` +
          `<div class="ft-values">${e.valuesStr}</div>` +
          `<div class="ft-role-tag" style="color:${col}">${e.role}</div>` +
          `</div>` +
          `<div class="ft-time">${e.ts}</div>` +
          `</div>`
        );
      })
      .join('');

    container.innerHTML = html;

    // 자동 스크롤 — 외부 래퍼(flow-timeline)가 있으면 최하단으로
    const panel = container.parentElement;
    if (panel) panel.scrollTop = panel.scrollHeight;
  }

  /** 전체 초기화 */
  clear(): void {
    this._entries.length = 0;
    this.render();
  }
}
