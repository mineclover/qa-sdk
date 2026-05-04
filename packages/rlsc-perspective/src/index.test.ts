// @vitest-environment happy-dom
import type { RLSCDocument, RLSCNode } from '@qa-sdk/rlsc-analysis';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPerspectiveViewer } from './index';

class TestResizeObserver {
  observe(): void {}
  disconnect(): void {}
}

function node(id: string, rect: RLSCNode['rect'], children: readonly RLSCNode[] = []): RLSCNode {
  return {
    id,
    tag: id === 'root' ? 'main' : 'section',
    classes: [],
    rect,
    zIndex: 0,
    depth: id === 'root' ? 0 : 1,
    display: 'block',
    position: 'static',
    overflow: 'visible',
    visible: true,
    identifier: {
      kind: 'nodeId',
      value: id,
      nodeId: id,
    },
    attributes: {},
    children,
  };
}

function fixture(): RLSCDocument {
  const childA = node('child-a', { x: 20, y: 24, width: 180, height: 90 });
  const childB = node('child-b', { x: 240, y: 40, width: 160, height: 110 });
  return {
    version: '1.0',
    viewport: { width: 640, height: 360 },
    url: 'https://example.test',
    timestamp: '2026-05-05T00:00:00.000Z',
    root: node('root', { x: 0, y: 0, width: 640, height: 360 }, [childA, childB]),
    grid: {
      cellSize: 80,
      cols: 8,
      rows: 5,
      cells: [],
    },
    layers: [],
    relations: [],
  };
}

function mount(): HTMLElement {
  const container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { configurable: true, value: 800 });
  Object.defineProperty(container, 'clientHeight', { configurable: true, value: 520 });
  document.body.appendChild(container);
  return container;
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.stubGlobal('ResizeObserver', TestResizeObserver);
});

describe('createPerspectiveViewer', () => {
  it('renders CSS 3D layers with orthographic projection by default', () => {
    const container = mount();
    const viewer = createPerspectiveViewer(container, fixture());

    const viewport = container.querySelector<HTMLElement>('.rlsc-css3d-viewport');
    const nodes = container.querySelectorAll<HTMLElement>('.rlsc-css3d-node');

    expect(viewport?.style.perspective).toBe('none');
    expect(nodes).toHaveLength(3);
    expect(container.querySelector('canvas')).toBeNull();

    viewer.setProjectionMode('perspective');
    expect(viewport?.style.perspective).toBe('980px');

    viewer.setProjectionMode('orthographic');
    expect(viewport?.style.perspective).toBe('none');
  });

  it('keeps projection disabled when switching to top view', () => {
    const container = mount();
    const viewer = createPerspectiveViewer(container, fixture(), {
      projectionMode: 'orthographic',
    });
    const viewport = container.querySelector<HTMLElement>('.rlsc-css3d-viewport');
    const scene = container.querySelector<HTMLElement>('.rlsc-css3d-scene');

    viewer.setView('top');

    expect(viewport?.style.perspective).toBe('none');
    expect(scene?.style.transform).toContain('matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)');
  });

  it('preserves existing callbacks when update receives partial options', () => {
    const onHover = vi.fn();
    const container = mount();
    const viewer = createPerspectiveViewer(container, fixture(), { onHover });

    viewer.update(fixture(), { projectionMode: 'perspective' });
    container
      .querySelector<HTMLElement>('[data-node-id="child-a"]')
      ?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));

    expect(onHover).toHaveBeenCalledWith(expect.objectContaining({ nodeId: 'child-a' }));
  });

  it('clears stale hover border when hover moves to another node', () => {
    const container = mount();
    createPerspectiveViewer(container, fixture());
    const first = container.querySelector<HTMLElement>('[data-node-id="child-a"]');
    const second = container.querySelector<HTMLElement>('[data-node-id="child-b"]');

    first?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    expect(first?.style.borderColor).toMatch(/^rgba\(111, 76, 0, (?:0)?\.96\)$/);

    second?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));

    expect(first?.style.borderColor).toMatch(/^rgba\(30, 41, 59, (?:0)?\.52\)$/);
    expect(second?.style.borderColor).toMatch(/^rgba\(111, 76, 0, (?:0)?\.96\)$/);
  });
});
