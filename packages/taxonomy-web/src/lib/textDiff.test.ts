import { describe, it, expect } from 'vitest';
import { lineDiff, diffStats } from './textDiff';

describe('lineDiff', () => {
  it('동일 텍스트 → 모두 same', () => {
    const d = lineDiff('a\nb\nc', 'a\nb\nc');
    expect(d.every((x) => x.kind === 'same')).toBe(true);
    expect(d.length).toBe(3);
  });

  it('줄 추가', () => {
    const d = lineDiff('a\nb', 'a\nb\nc');
    expect(d.length).toBe(3);
    expect(d[2]).toEqual({ kind: 'add', text: 'c', lineNoB: 3 });
  });

  it('줄 제거', () => {
    const d = lineDiff('a\nb\nc', 'a\nc');
    const kinds = d.map((x) => x.kind);
    expect(kinds).toContain('remove');
    const removed = d.find((x) => x.kind === 'remove');
    expect(removed?.text).toBe('b');
  });

  it('순서 변경 — LCS는 b를 보존하고 c를 add/remove', () => {
    const d = lineDiff('a\nb\nc', 'a\nc\nb');
    const stats = diffStats(d);
    expect(stats.same).toBeGreaterThanOrEqual(2);
    expect(stats.added + stats.removed).toBeGreaterThan(0);
  });

  it('빈 string과 비교 → 모든 라인 add', () => {
    const d = lineDiff('', 'a\nb');
    // "" split → [""] 한 줄. b의 라인은 add
    expect(d.filter((x) => x.kind === 'add').length).toBe(2);
  });
});

describe('diffStats', () => {
  it('add/remove/same 카운트', () => {
    const stats = diffStats([
      { kind: 'same', text: 'a', lineNoA: 1, lineNoB: 1 },
      { kind: 'add', text: 'b', lineNoB: 2 },
      { kind: 'add', text: 'c', lineNoB: 3 },
      { kind: 'remove', text: 'd', lineNoA: 2 },
    ]);
    expect(stats).toEqual({ added: 2, removed: 1, same: 1 });
  });
});
