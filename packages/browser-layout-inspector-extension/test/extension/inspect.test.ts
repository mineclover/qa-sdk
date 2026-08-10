import { expect, test, chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatInspectionAsCss, formatLayoutExchangeJson } from '../../dist/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const builtExtensionPath = resolve(__dirname, '../../dist');

test('[contract:browser-layout-inspector.geometry.query.v1][contract:browser-layout-inspector.extension.page-tools.v1][contract:browser-layout-inspector.extension.ruler.measurement.v1][contract:browser-layout-inspector.extension.ruler.guides.v1][contract:browser-layout-inspector.extension.capture-viewport.v1][contract:browser-layout-inspector.extension.css-output.query.v1][contract:browser-layout-inspector.extension.json-exchange.query.v1][contract:browser-layout-inspector.extension.side-panel.session.v1] MV3 Side Panel content script returns layout state and reversible page tools', async () => {
  const server = createFixtureServer();
  const port = await listen(server);
  const userDataDir = mkdtempSync(join(tmpdir(), 'browser-layout-inspector-ext-'));
  const extensionPath = createTestExtension();
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });

  try {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const runtimeManifest = await worker.evaluate(() => {
      const chromeApi = (globalThis as { chrome: any }).chrome;
      return {
        manifest: chromeApi.runtime.getManifest(),
        sidePanelApi: typeof chromeApi.sidePanel?.setPanelBehavior,
        captureVisibleTabApi: typeof chromeApi.tabs?.captureVisibleTab,
      };
    });
    expect(runtimeManifest).toMatchObject({
      sidePanelApi: 'function',
      captureVisibleTabApi: 'function',
      manifest: {
        side_panel: { default_path: 'popup.html' },
        permissions: expect.arrayContaining(['activeTab', 'scripting', 'sidePanel']),
      },
    });
    expect(runtimeManifest.manifest.action.default_popup).toBeUndefined();
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/fixture.html`);
    const extensionOrigin = `chrome-extension://${new URL(worker.url()).host}`;
    const panelPage = await context.newPage();
    await panelPage.goto(`${extensionOrigin}/popup.html`);
    await page.bringToFront();
    const captured = await panelPage.evaluate(async () => {
      const chromeApi = (globalThis as { chrome: any }).chrome;
      return Promise.race([
        new Promise<{ readonly ok?: boolean; readonly isPng: boolean; readonly error?: string }>((resolveCapture) => {
          chromeApi.runtime.sendMessage({ type: 'browser-layout-inspector.capture-visible-tab' }, (response: { readonly ok?: boolean; readonly dataUrl?: string; readonly error?: string }) => {
            resolveCapture({ ok: response?.ok, isPng: response?.dataUrl?.startsWith('data:image/png;base64,') === true, error: response?.error });
          });
        }),
        new Promise<{ readonly timeout: true }>((resolveTimeout) => globalThis.setTimeout(() => resolveTimeout({ timeout: true }), 5_000)),
      ]);
    });
    expect(captured).toMatchObject({ ok: true, isPng: true });
    await panelPage.close();
    const inspectedTabId = await worker.evaluate(async () => {
      const chromeApi = (globalThis as { chrome: any }).chrome;
      const tabs = await new Promise<any[]>((resolveTabs) => chromeApi.tabs.query({}, resolveTabs));
      return tabs.find((tab) => typeof tab.id === 'number' && tab.url?.includes('fixture.html'))?.id ?? null;
    });
    expect(inspectedTabId).toEqual(expect.any(Number));

    const response = await worker.evaluate(async (tabId) => {
      const chromeApi = (globalThis as { chrome: any }).chrome;
      await new Promise<void>((resolvePromise, reject) => {
        chromeApi.scripting.executeScript({ target: { tabId }, files: ['content.js'] }, () => {
          if (chromeApi.runtime.lastError) reject(new Error(chromeApi.runtime.lastError.message));
          else resolvePromise();
        });
      });
      return new Promise<any>((resolveResponse) => {
        chromeApi.tabs.sendMessage(
          tabId,
          {
            type: 'browser-layout-inspector.inspect-selector',
            selector: '#target',
            referenceSelector: '#reference',
            computedProperties: ['display', 'gap', 'width', 'grid-template-columns'],
          },
          (message) => resolveResponse({ message, error: chromeApi.runtime.lastError?.message }),
        );
      });
    }, inspectedTabId);

    expect(response.error).toBeUndefined();
    expect(response.message).toMatchObject({
      ok: true,
      inspection: {
        targetSelector: '#target',
        computedStyle: { properties: { display: 'grid', gap: '12px', width: '120px', 'grid-template-columns': 'none' } },
        metrics: { viewportRect: { width: 120, height: 40 } },
        position: { relativeToReference: { deltaCssPx: { x: 30, y: 20 } } },
      },
    });
    expect(response.message.inspection.cssInfluences.matchedSelectors.map((entry: { selector: string }) => entry.selector)).toContain('#reference > .target');
    const cssOutput = formatInspectionAsCss(response.message.inspection);
    expect(cssOutput).toContain('#target {');
    expect(cssOutput).toContain('display: grid;');
    expect(cssOutput).toContain('grid-template-columns:');
    expect(cssOutput).toContain('/* Matched author CSS candidates');
    expect(cssOutput).toContain('#reference > .target {');
    const selecting = await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.start-picker',
      mode: 'select',
    });
    expect(selecting).toMatchObject({ ok: true, state: { pickerMode: 'select' } });
    await page.locator('#target').click();
    const selected = await sendExtensionMessage(worker, inspectedTabId, { type: 'browser-layout-inspector.get-state' });
    expect(selected).toMatchObject({
      ok: true,
      state: { pickerMode: null, selected: { selector: '#target' }, inspection: { metrics: { viewportRect: { width: 120, height: 40 } } } },
    });
    const exchange = JSON.parse(formatLayoutExchangeJson(selected.state));
    expect(exchange).toMatchObject({
      schemaVersion: 'browser-layout-inspector.exchange.v1',
      environment: {
        url: `http://127.0.0.1:${port}/fixture.html`,
        viewportCssPx: { width: expect.any(Number), height: expect.any(Number) },
        scrollCssPx: { x: 0, y: 0 },
        devicePixelRatio: expect.any(Number),
      },
      selected: { selector: '#target' },
      inspection: { targetSelector: '#target' },
      elementMeasurement: null,
      ruler: null,
      rulerSnapEnabled: false,
      guides: { vertical: [], horizontal: [] },
      changedElementCount: 0,
    });
    expect(exchange.exportedAt).toEqual(expect.any(String));

    const styled = await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.apply-style', property: 'background-color', value: 'rgb(255, 0, 0)',
    });
    expect(styled).toMatchObject({ ok: true, state: { changedElementCount: 1 } });
    await expect.poll(() => page.locator('#target').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(255, 0, 0)');

    await sendExtensionMessage(worker, inspectedTabId, { type: 'browser-layout-inspector.hide-selected' });
    await expect.poll(() => page.locator('#target').evaluate((element) => getComputedStyle(element).display)).toBe('none');
    const restored = await sendExtensionMessage(worker, inspectedTabId, { type: 'browser-layout-inspector.restore-selected' });
    expect(restored).toMatchObject({ ok: true, state: { changedElementCount: 0 } });
    await expect.poll(() => page.locator('#target').evaluate((element) => ({ display: getComputedStyle(element).display, inlineColor: (element as HTMLElement).style.backgroundColor }))).toEqual({ display: 'grid', inlineColor: '' });

    await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.apply-style', property: 'opacity', value: '0.5',
    });
    const allRestored = await sendExtensionMessage(worker, inspectedTabId, { type: 'browser-layout-inspector.restore-all' });
    expect(allRestored).toMatchObject({ ok: true, state: { changedElementCount: 0 } });
    await expect.poll(() => page.locator('#target').evaluate((element) => (element as HTMLElement).style.opacity)).toBe('');

    await sendExtensionMessage(worker, inspectedTabId, { type: 'browser-layout-inspector.start-picker', mode: 'measure' });
    await page.locator('#reference').click({ position: { x: 5, y: 5 } });
    await page.locator('#target').click();
    const measured = await sendExtensionMessage(worker, inspectedTabId, { type: 'browser-layout-inspector.get-state' });
    expect(measured).toMatchObject({
      ok: true,
      state: {
        measurement: {
          anchor: { selector: '#reference' }, target: { selector: '#target' },
          relative: { reference: 'element', deltaCssPx: { x: 30, y: 20 }, edgeGapsCssPx: { leftToRight: -270, topToBottom: -140 } },
        },
      },
    });

    await sendExtensionMessage(worker, inspectedTabId, { type: 'browser-layout-inspector.start-picker', mode: 'ruler' });
    await page.mouse.move(40, 50);
    await page.mouse.down();
    await page.mouse.move(140, 100);
    await page.mouse.up();
    const ruled = await sendExtensionMessage(worker, inspectedTabId, { type: 'browser-layout-inspector.get-state' });
    expect(ruled).toMatchObject({
      ok: true,
      state: {
        pickerMode: null,
        ruler: { start: { x: 40, y: 50 }, end: { x: 140, y: 100 }, width: 100, height: 50, distance: 111.8 },
      },
    });

    const snapEnabled = await sendExtensionMessage(worker, inspectedTabId, { type: 'browser-layout-inspector.set-ruler-snap', enabled: true });
    expect(snapEnabled).toMatchObject({ ok: true, state: { rulerSnapEnabled: true } });
    await sendExtensionMessage(worker, inspectedTabId, { type: 'browser-layout-inspector.start-picker', mode: 'ruler' });
    await page.mouse.move(43, 51);
    await page.mouse.down();
    await page.mouse.move(137, 99);
    await page.mouse.up();
    const snapped = await sendExtensionMessage(worker, inspectedTabId, { type: 'browser-layout-inspector.get-state' });
    expect(snapped).toMatchObject({
      ok: true,
      state: {
        rulerSnapEnabled: true,
        ruler: { start: { x: 40, y: 48 }, end: { x: 136, y: 96 }, width: 96, height: 48, distance: 107.33, angle: 26.57 },
      },
    });
    const pinned = await sendExtensionMessage(worker, inspectedTabId, { type: 'browser-layout-inspector.pin-ruler-guides' });
    expect(pinned).toMatchObject({ ok: true, state: { guides: { vertical: [40, 136], horizontal: [48, 96] } } });
    await expect(page.locator('[data-browser-layout-inspector-guide]')).toHaveCount(4);
    const cleared = await sendExtensionMessage(worker, inspectedTabId, { type: 'browser-layout-inspector.clear-ruler-guides' });
    expect(cleared).toMatchObject({ ok: true, state: { guides: { vertical: [], horizontal: [] } } });
    await expect(page.locator('[data-browser-layout-inspector-guide]')).toHaveCount(0);
  } finally {
    await context.close();
    await close(server);
    rmSync(userDataDir, { recursive: true, force: true });
    rmSync(extensionPath, { recursive: true, force: true });
  }
});

async function sendExtensionMessage(worker: any, tabId: number, message: unknown): Promise<any> {
  const result = await worker.evaluate(({ tabId: targetTabId, message: request }: { tabId: number; message: unknown }) => {
    const chromeApi = (globalThis as { chrome: any }).chrome;
    return new Promise<any>((resolveResponse) => {
      chromeApi.tabs.sendMessage(targetTabId, request, (response: unknown) => {
        resolveResponse({ message: response, error: chromeApi.runtime.lastError?.message });
      });
    });
  }, { tabId, message });
  if (result.error) throw new Error(result.error);
  return result.message;
}

function createFixtureServer() {
  return createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(`<!doctype html><style>
      #reference { position: relative; left: 20px; top: 10px; width: 300px; height: 160px; }
      #reference > .target { position: relative; left: 30px; top: 20px; display: grid; gap: 12px; width: 120px; height: 40px; }
    </style><section id="reference"><article id="target" class="target"></article></section>`);
  });
}

/** activeTab is granted by a real browser-action click. Playwright has no action-click primitive,
 * so the isolated test copy receives <all_urls> host access for injection and capture; production stays activeTab-only. */
function createTestExtension(): string {
  const extensionPath = mkdtempSync(join(tmpdir(), 'browser-layout-inspector-build-'));
  cpSync(builtExtensionPath, extensionPath, { recursive: true });
  const manifestPath = join(extensionPath, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
  manifest.host_permissions = ['<all_urls>'];
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return extensionPath;
}

function listen(server: ReturnType<typeof createServer>): Promise<number> {
  return new Promise((resolvePromise) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('failed to start fixture server');
      resolvePromise(address.port);
    });
  });
}

function close(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolvePromise, reject) => server.close((error) => (error ? reject(error) : resolvePromise())));
}
