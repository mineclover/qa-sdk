// @def.boundary viz-system-root
// @def.doc viz-system-root

import { describe, it, expect } from 'vitest';
import { CellStateManager, BeamPool, ActivationProcessor } from './activation.js';

describe('CellStateManager', () => {
  it('활성화 → glow + hits 증가', () => {
    const mgr = new CellStateManager(4);
    mgr.activate('page_view/home', 0);
    mgr.activate('page_view/home', 0);

    const s = mgr.getOrCreate('page_view/home');
    expect(s.hits).toBe(2);
    expect(s.glow).toBe(2); // 마지막 활성화가 2로 설정
    expect(mgr.isActive('page_view/home')).toBe(true);
    expect(mgr.totalHits).toBe(2);
    expect(mgr.layerHits[0]).toBe(2);
  });

  it('decay → glow 감소', () => {
    const mgr = new CellStateManager(4);
    mgr.activate('endpoint/GET', 1);
    mgr.decay(1.0, 1.2); // 1초 경과

    const s = mgr.getOrCreate('endpoint/GET');
    expect(s.glow).toBeLessThan(2);
    expect(s.glow).toBeGreaterThan(0);
  });

  it('reset → 전체 초기화', () => {
    const mgr = new CellStateManager(4);
    mgr.activate('a', 0);
    mgr.activate('b', 1);
    mgr.reset();

    expect(mgr.totalHits).toBe(0);
    expect(mgr.activeSet.size).toBe(0);
  });
});

describe('BeamPool', () => {
  it('spawn → 빔 생성', () => {
    const pool = new BeamPool(10);
    pool.spawn({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, 0xff0000);

    const active = pool.getActive();
    expect(active.length).toBe(1);
    expect(active[0].color).toBe(0xff0000);
  });

  it('decay → 빔 소멸', () => {
    const pool = new BeamPool(10);
    pool.spawn({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, 0xff0000);
    pool.decay(3.0, 0.5); // 3초 경과

    const active = pool.getActive();
    expect(active.length).toBe(0); // life 소진
  });
});

describe('ActivationProcessor', () => {
  it('fire → 셀 활성화 + 크로스 레이어 빔', () => {
    const cells = new CellStateManager(4);
    const beams = new BeamPool(10);
    const proc = new ActivationProcessor(cells, beams);

    const lookup = (key: string) => {
      if (key === 'page_view/home')
        return {
          key,
          layer: 0,
          category: 'observation',
          worldX: 0,
          worldY: 8,
          worldZ: 0,
          categoryColor: 0x00e5ff,
        };
      if (key === 'endpoint/POST')
        return {
          key,
          layer: 1,
          category: 'observation',
          worldX: 0,
          worldY: 2,
          worldZ: 0,
          categoryColor: 0x00e5ff,
        };
      return undefined;
    };

    proc.fire(['page_view/home', 'endpoint/POST'], lookup);

    expect(cells.isActive('page_view/home')).toBe(true);
    expect(cells.isActive('endpoint/POST')).toBe(true);
    expect(cells.totalHits).toBe(2);

    // 크로스 레이어 빔 생성 (layer 0 ↔ 1)
    expect(beams.getActive().length).toBe(1);
  });
});
