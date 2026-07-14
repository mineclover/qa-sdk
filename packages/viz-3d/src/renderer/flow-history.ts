// @def.boundary viz-system-root
// @def.doc viz-system-root

/**
 * FlowHistory — 수집된 data flow 이력 관리 + 탐색.
 *
 * DEMO/LIVE에서 발생한 모든 스텝을 저장하고,
 * 이전/다음 탐색, 특정 인덱스 점프를 지원.
 */

export interface FlowStep {
  readonly tier: string;
  readonly cell: string;
  readonly label: string;
}

export interface FlowEntry {
  readonly name: string;
  readonly desc: string;
  readonly flow: readonly FlowStep[];
  readonly keys: readonly string[];
  readonly ctx: Record<string, string>;
  readonly timestamp: string;
  readonly source: 'demo' | 'live' | 'manual';
}

export class FlowHistory {
  private entries: FlowEntry[] = [];
  private _viewIdx = -1; // -1 = latest (live mode)

  push(entry: FlowEntry): void {
    this.entries.push(entry);
    this._viewIdx = -1; // 새 항목이 오면 최신으로
  }

  get length(): number {
    return this.entries.length;
  }
  get viewIndex(): number {
    return this._viewIdx === -1 ? this.entries.length - 1 : this._viewIdx;
  }
  get isLive(): boolean {
    return this._viewIdx === -1;
  }

  /** 현재 보고 있는 entry */
  current(): FlowEntry | undefined {
    if (this.entries.length === 0) return undefined;
    return this.entries[this.viewIndex];
  }

  /** 이전으로 */
  prev(): FlowEntry | undefined {
    if (this.entries.length === 0) return undefined;
    if (this._viewIdx === -1) this._viewIdx = this.entries.length - 1;
    this._viewIdx = Math.max(0, this._viewIdx - 1);
    return this.entries[this._viewIdx];
  }

  /** 다음으로 */
  next(): FlowEntry | undefined {
    if (this.entries.length === 0) return undefined;
    if (this._viewIdx === -1) return this.entries[this.entries.length - 1];
    this._viewIdx = Math.min(this.entries.length - 1, this._viewIdx + 1);
    if (this._viewIdx === this.entries.length - 1) this._viewIdx = -1; // 최신으로 복귀
    return this.entries[this._viewIdx === -1 ? this.entries.length - 1 : this._viewIdx];
  }

  /** 특정 인덱스로 점프 */
  goTo(idx: number): FlowEntry | undefined {
    if (idx < 0 || idx >= this.entries.length) return undefined;
    this._viewIdx = idx;
    return this.entries[idx];
  }

  /** 최신 모드로 */
  goLive(): void {
    this._viewIdx = -1;
  }

  /** 전체 초기화 */
  clear(): void {
    this.entries = [];
    this._viewIdx = -1;
  }

  /** 전체 이력 */
  all(): readonly FlowEntry[] {
    return this.entries;
  }

  /** 특정 prefix를 포함하는 스텝만 필터 */
  filterByPrefix(prefixId: string): FlowEntry[] {
    return this.entries.filter(
      (e) =>
        e.keys.some((k) => k.startsWith(prefixId + '/')) ||
        e.flow.some((f) => f.cell.startsWith(prefixId + '/')),
    );
  }

  /** 특정 tier만 포함하는 스텝 필터 */
  filterByTier(tier: string): FlowEntry[] {
    return this.entries.filter((e) => e.flow.some((f) => f.tier === tier));
  }

  /** 표시용 텍스트 */
  indexLabel(): string {
    if (this.entries.length === 0) return '-/-';
    const idx = this._viewIdx === -1 ? this.entries.length : this._viewIdx + 1;
    return `${idx}/${this.entries.length}`;
  }
}
