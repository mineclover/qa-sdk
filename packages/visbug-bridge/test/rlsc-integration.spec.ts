import { describe, expect, it } from 'vitest';
import { createDomRefSymbolResolver } from '../src/coordinate-symbols.js';
import type { DomRefCatalog, EditLogEntry } from '../src/types.js';
import { collectLayout, scanScreen } from 'rlsc-analysis/browser';

describe('visbug-bridge DomRef ↔ rlsc smoke', () => {
  it('joins an EditLogEntry target catalog to an rlsc node by qa address', () => {
    document.body.innerHTML = `
      <main id="app" data-qa-address="demo:app">
        <button id="save" data-qa-address="demo:save">Save</button>
      </main>
    `;
    setRect('#app', { x: 0, y: 0, width: 320, height: 160 });
    setRect('#save', { x: 16, y: 24, width: 80, height: 32 });

    const root = requireElement('#app');
    const button = requireElement('#save');
    const doc = collectLayout(root);
    const resolver = createDomRefSymbolResolver({
      rlsc: {
        locateElement: (element) => ({
          address: element.getAttribute('data-qa-address') ?? undefined,
        }),
      },
    });
    const catalog: DomRefCatalog = {
      canonical: { kind: 'xpath', value: '/html[1]/body[1]/main[1]/button[1]' },
      symbols: [
        ...resolver(button),
        {
          kind: 'xpath',
          value: '/main[1]/button[1]',
          matchCount: 1,
          stability: 80,
          provenance: 'rlsc.identifier',
        },
      ],
      primary: null,
      fingerprint: { tagName: 'button', textSnippet: 'Save' },
      capturedAt: 1,
    };
    const entry = fakeEntry(catalog);

    const joined = joinEntryToRlscNode(entry, scanScreen(root));

    expect(doc.root.children[0]?.address).toBe('demo:save');
    expect(joined?.id).toBe('button#save');
    expect(joined?.identifier.qaAddress).toBe('demo:save');
  });

  it('falls back to DomRef XPath when an rlsc symbol is not present', () => {
    document.body.innerHTML = `
      <main id="app">
        <section>
          <button id="save">Save</button>
        </section>
      </main>
    `;
    setRect('#app', { x: 0, y: 0, width: 320, height: 160 });
    setRect('section', { x: 8, y: 8, width: 200, height: 80 });
    setRect('#save', { x: 16, y: 24, width: 80, height: 32 });

    const root = requireElement('#app');
    const catalog: DomRefCatalog = {
      canonical: { kind: 'xpath', value: '/html[1]/body[1]/main[1]/section[1]/button[1]' },
      symbols: [
        {
          kind: 'xpath',
          value: '/main[1]/section[1]/button[1]',
          matchCount: 1,
          stability: 80,
          provenance: 'dom-ref.fullXPath',
        },
      ],
      primary: null,
      fingerprint: { tagName: 'button', textSnippet: 'Save' },
      capturedAt: 1,
    };

    const joined = joinEntryToRlscNode(fakeEntry(catalog), scanScreen(root));

    expect(joined?.id).toBe('button#save');
    expect(joined?.identifier.xpath).toBe('/main[1]/section[1]/button[1]');
  });
});

type RlscScanResult = ReturnType<typeof scanScreen>;
type RlscNode = NonNullable<ReturnType<RlscScanResult['byId']>>;

function joinEntryToRlscNode(
  entry: Pick<EditLogEntry, 'target'>,
  scan: RlscScanResult,
): RlscNode | null {
  const catalog = entry.target.catalog;
  if (!catalog) return null;
  const rlscSymbol = catalog.symbols.find((symbol) => symbol.kind === 'rlsc');
  if (rlscSymbol) {
    const matches = scan.byQaAddress(rlscSymbol.value);
    if (matches.length === 1) return matches[0] ?? null;
  }
  for (const symbol of [catalog.primary, ...catalog.symbols, catalog.canonical]) {
    if (symbol?.kind !== 'xpath') continue;
    const node = scan.byXPath(stripHtmlBodyPrefix(symbol.value));
    if (node) return node;
  }
  return null;
}

function stripHtmlBodyPrefix(xpath: string): string {
  return xpath.replace(/^\/html\[1\]\/body\[1\]/, '');
}

function fakeEntry(catalog: DomRefCatalog): EditLogEntry {
  return {
    id: 'entry-1',
    ts: 1,
    feature: 'padding',
    args: [],
    target: {
      selector: '#save',
      nodePath: 'button',
      catalog,
      primary: catalog.primary ?? undefined,
      weakRef: null,
    },
    beforeCSS: { padding: '0px' },
    afterCSS: { padding: '8px' },
    source: 'feature',
    correlationId: catalog.canonical.value,
  };
}

function requireElement(selector: string): HTMLElement {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLElement)) throw new Error(`missing fixture element: ${selector}`);
  return element;
}

function setRect(selector: string, rect: DOMRectInit): void {
  const element = requireElement(selector);
  element.getBoundingClientRect = () =>
    ({
      x: rect.x ?? 0,
      y: rect.y ?? 0,
      left: rect.x ?? 0,
      top: rect.y ?? 0,
      width: rect.width ?? 0,
      height: rect.height ?? 0,
      right: (rect.x ?? 0) + (rect.width ?? 0),
      bottom: (rect.y ?? 0) + (rect.height ?? 0),
      toJSON: () => ({}),
    }) as DOMRect;
}
