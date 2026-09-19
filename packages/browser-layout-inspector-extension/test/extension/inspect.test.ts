import { expect, test, chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatInspectionAsCss, formatLayoutExchangeJson } from '../../dist/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const builtExtensionPath = resolve(__dirname, '../../dist');

test('[contract:browser-layout-inspector.geometry.query.v1][contract:browser-layout-inspector.extension.page-tools.v1][contract:browser-layout-inspector.extension.comparison-dimensions.render.v1][contract:browser-layout-inspector.extension.comparison-gap-and-copy.write.v1][contract:browser-layout-inspector.extension.comparison-label-drag.write.v1][contract:browser-layout-inspector.extension.comparison-zero-and-drag-highlight.render.v1][contract:browser-layout-inspector.extension.work-item-selector.write.v1][contract:browser-layout-inspector.extension.ruler.measurement.v1][contract:browser-layout-inspector.extension.ruler.guides.v1][contract:browser-layout-inspector.extension.work-items.write.v1][contract:browser-layout-inspector.extension.auto-select-hide.write.v1][contract:browser-layout-inspector.extension.capture-viewport.v1][contract:browser-layout-inspector.extension.css-output.query.v1][contract:browser-layout-inspector.extension.json-exchange.query.v1][contract:browser-layout-inspector.css-inspector.query.v1][contract:browser-layout-inspector.extension.inline-declaration.write.v1][contract:browser-layout-inspector.extension.inline-declaration.invalid-property.v1][contract:browser-layout-inspector.extension.side-panel.workspace-panels.query.v1][contract:browser-layout-inspector.extension.side-panel.session.v1] MV3 Side Panel content script returns layout state and reversible page tools', async () => {
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
        permissions: expect.arrayContaining([
          'activeTab',
          'clipboardWrite',
          'scripting',
          'sidePanel',
        ]),
        host_permissions: ['<all_urls>'],
      },
    });
    expect(runtimeManifest.manifest.action.default_popup).toBeUndefined();
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/fixture.html`);
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: `http://127.0.0.1:${port}`,
    });
    const extensionOrigin = `chrome-extension://${new URL(worker.url()).host}`;
    const panelPage = await context.newPage();
    await panelPage.goto(`${extensionOrigin}/popup.html`);
    await expect(panelPage.locator('[data-browser-layout-inspector-panel]')).toHaveCount(4);
    await expect(
      panelPage.locator('[data-browser-layout-inspector-panel="measurement"]'),
    ).toContainText('측정과 선택');
    await expect(
      panelPage.locator('[data-browser-layout-inspector-panel="css-inspector"]'),
    ).toContainText('CSS Inspector');
    await expect(
      panelPage.locator('[data-browser-layout-inspector-panel="dom-tree"]'),
    ).toContainText('화면 계층 구조');
    await expect(panelPage.locator('[data-browser-layout-inspector-panel="export"]')).toContainText(
      '페이지 스타일과 내보내기',
    );
    await page.bringToFront();
    const captured = await panelPage.evaluate(async () => {
      const chromeApi = (globalThis as { chrome: any }).chrome;
      return Promise.race([
        new Promise<{ readonly ok?: boolean; readonly isPng: boolean; readonly error?: string }>(
          (resolveCapture) => {
            chromeApi.runtime.sendMessage(
              { type: 'browser-layout-inspector.capture-visible-tab' },
              (response: {
                readonly ok?: boolean;
                readonly dataUrl?: string;
                readonly error?: string;
              }) => {
                resolveCapture({
                  ok: response?.ok,
                  isPng: response?.dataUrl?.startsWith('data:image/png;base64,') === true,
                  error: response?.error,
                });
              },
            );
          },
        ),
        new Promise<{ readonly timeout: true }>((resolveTimeout) =>
          globalThis.setTimeout(() => resolveTimeout({ timeout: true }), 5_000),
        ),
      ]);
    });
    expect(captured).toMatchObject({ ok: true, isPng: true });
    await panelPage.close();
    const inspectedTabId = await worker.evaluate(async () => {
      const chromeApi = (globalThis as { chrome: any }).chrome;
      const tabs = await new Promise<any[]>((resolveTabs) => chromeApi.tabs.query({}, resolveTabs));
      return (
        tabs.find((tab) => typeof tab.id === 'number' && tab.url?.includes('fixture.html'))?.id ??
        null
      );
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
        computedStyle: {
          properties: {
            display: 'grid',
            gap: '12px',
            width: '120px',
            'grid-template-columns': 'none',
          },
        },
        metrics: { viewportRect: { width: 120, height: 40 } },
        position: { relativeToReference: { deltaCssPx: { x: 30, y: 20 } } },
      },
    });
    expect(
      response.message.inspection.cssInfluences.matchedSelectors.map(
        (entry: { selector: string }) => entry.selector,
      ),
    ).toContain('#reference > .target');
    const domTree = await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.get-dom-tree',
    });
    expect(domTree).toMatchObject({
      ok: true,
      domTree: expect.objectContaining({
        selector: 'body',
        children: expect.arrayContaining([expect.objectContaining({ selector: '#reference' })]),
      }),
    });
    const selectedTreeNode = await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.select-tree-node',
      selector: '#reference',
    });
    expect(selectedTreeNode).toMatchObject({
      ok: true,
      state: {
        selected: { selector: '#reference' },
        workItems: expect.arrayContaining([
          expect.objectContaining({ id: 'selection', active: true }),
        ]),
      },
    });
    const pageStyles = await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.extract-page-styles',
    });
    expect(pageStyles).toMatchObject({ ok: true, pageStyles: { accessibleStylesheetCount: 1 } });
    expect(pageStyles.pageStyles.css).toContain('#reference');
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
    expect(await page.locator('html').evaluate((element) => getComputedStyle(element).cursor)).toBe(
      'crosshair',
    );
    await page.locator('#target').click();
    expect(
      await page.locator('html').evaluate((element) => (element as HTMLElement).style.cursor),
    ).toBe('');
    const selected = await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.get-state',
    });
    expect(selected).toMatchObject({
      ok: true,
      state: {
        pickerMode: null,
        selected: { selector: '#target' },
        workItems: [
          {
            id: 'selection',
            role: '일반 선택',
            label: '#reference > .target',
            detail: '매칭 CSS · 고유',
            active: true,
          },
        ],
        inspection: { metrics: { viewportRect: { width: 120, height: 40 } } },
      },
    });
    expect(selected.state.cssInspector).toMatchObject({
      sourceDeclarations: expect.arrayContaining([
        expect.objectContaining({
          source: 'author',
          selector: '#reference > .target',
          property: 'display',
          value: 'grid',
        }),
      ]),
      computedDeclarations: expect.arrayContaining([
        expect.objectContaining({ property: 'display', value: 'grid' }),
      ]),
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
      workItems: [expect.objectContaining({ id: 'selection', label: '#reference > .target' })],
      inspection: { targetSelector: '#target' },
      elementMeasurement: null,
      ruler: null,
      rulerSnapEnabled: false,
      guides: { vertical: [], horizontal: [] },
      changedElementCount: 0,
    });
    expect(exchange.exportedAt).toEqual(expect.any(String));

    const inlineColor = await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.apply-style',
      property: 'color',
      value: 'rgb(255, 0, 0)',
    });
    expect(inlineColor).toMatchObject({
      ok: true,
      state: {
        cssInspector: {
          sourceDeclarations: expect.arrayContaining([
            expect.objectContaining({
              source: 'inline',
              property: 'color',
              value: 'rgb(255, 0, 0)',
            }),
          ]),
        },
      },
    });
    await expect
      .poll(() => page.locator('#target').evaluate((element) => getComputedStyle(element).color))
      .toBe('rgb(255, 0, 0)');
    const removedColor = await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.remove-style',
      property: 'color',
    });
    expect(removedColor).toMatchObject({ ok: true });
    expect(
      removedColor.state.cssInspector.sourceDeclarations.some(
        (declaration: { source: string; property: string }) =>
          declaration.source === 'inline' && declaration.property === 'color',
      ),
    ).toBe(false);
    await expect
      .poll(() => page.locator('#target').evaluate((element) => getComputedStyle(element).color))
      .toBe('rgb(1, 2, 3)');
    const invalidDeclaration = await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.apply-style',
      property: 'not a property',
      value: 'value',
    });
    expect(invalidDeclaration).toMatchObject({
      ok: false,
      error: '유효한 CSS 속성명을 입력하세요.',
    });
    await expect
      .poll(() => page.locator('#target').evaluate((element) => getComputedStyle(element).color))
      .toBe('rgb(1, 2, 3)');

    const styled = await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.apply-style',
      property: 'background-color',
      value: 'rgb(255, 0, 0)',
    });
    expect(styled).toMatchObject({ ok: true, state: { changedElementCount: 1 } });
    await expect
      .poll(() =>
        page.locator('#target').evaluate((element) => getComputedStyle(element).backgroundColor),
      )
      .toBe('rgb(255, 0, 0)');

    await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.hide-selected',
    });
    await expect
      .poll(() => page.locator('#target').evaluate((element) => getComputedStyle(element).display))
      .toBe('none');
    const restored = await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.restore-selected',
    });
    expect(restored).toMatchObject({ ok: true, state: { changedElementCount: 0 } });
    await expect
      .poll(() =>
        page.locator('#target').evaluate((element) => ({
          display: getComputedStyle(element).display,
          inlineColor: (element as HTMLElement).style.backgroundColor,
        })),
      )
      .toEqual({ display: 'grid', inlineColor: '' });

    await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.apply-style',
      property: 'opacity',
      value: '0.5',
    });
    const allRestored = await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.restore-all',
    });
    expect(allRestored).toMatchObject({ ok: true, state: { changedElementCount: 0 } });
    await expect
      .poll(() =>
        page.locator('#target').evaluate((element) => (element as HTMLElement).style.opacity),
      )
      .toBe('');

    await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.start-picker',
      mode: 'measure',
    });
    await page.locator('#reference').click({ position: { x: 5, y: 5 } });
    await page.locator('#target').click();
    const measured = await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.get-state',
    });
    expect(measured).toMatchObject({
      ok: true,
      state: {
        measurement: {
          anchor: { selector: '#reference' },
          target: { selector: '#target' },
          relative: {
            reference: 'element',
            deltaCssPx: { x: 30, y: 20 },
            edgeGapsCssPx: { leftToRight: -270, topToBottom: -140 },
          },
        },
      },
    });
    expect(measured.state.workItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'selection', label: '#reference > .target' }),
        expect.objectContaining({ id: 'anchor', role: '비교 A', label: '#reference' }),
        expect.objectContaining({
          id: 'target',
          role: '비교 B',
          label: '#reference > .target',
          active: true,
          selectorCandidates: expect.arrayContaining([
            expect.objectContaining({ selector: '#target', source: 'unique', unique: true }),
          ]),
        }),
      ]),
    );
    const selectedCandidate = await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.set-work-item-selector',
      id: 'target',
      selector: '#target',
    });
    expect(selectedCandidate).toMatchObject({
      ok: true,
      state: {
        workItems: expect.arrayContaining([
          expect.objectContaining({ id: 'target', label: '#target', selectedSelector: '#target' }),
        ]),
      },
    });
    await expect(page.locator('[data-browser-layout-inspector-measurement-summary]')).toContainText(
      '#reference → #target',
    );
    await expect(page.locator('[data-browser-layout-inspector-dimension]')).toHaveCount(4);
    await expect(page.locator('[data-browser-layout-inspector-dimension="left"]')).toHaveText(
      'A.left → B.left +30px',
    );
    await expect(page.locator('[data-browser-layout-inspector-dimension="right"]')).toHaveText(
      'A.right → B.right -150px',
    );
    await expect(page.locator('[data-browser-layout-inspector-dimension="top"]')).toHaveText(
      'A.top → B.top +20px',
    );
    await expect(page.locator('[data-browser-layout-inspector-dimension="bottom"]')).toHaveText(
      'A.bottom → B.bottom -100px',
    );
    await expect(page.locator('[data-browser-layout-inspector-dimension="left"]')).toHaveCSS(
      'pointer-events',
      'none',
    );
    const rightLabel = page.locator('[data-browser-layout-inspector-dimension="right"] span');
    await rightLabel.hover();
    await expect(rightLabel).toHaveCSS('background-color', 'rgb(17, 94, 89)');
    const labelBox = await rightLabel.boundingBox();
    if (!labelBox) throw new Error('dimension label not visible');
    await page.mouse.move(labelBox.x + labelBox.width / 2, labelBox.y + labelBox.height / 2);
    await page.mouse.down();
    const rightDimension = page.locator('[data-browser-layout-inspector-dimension="right"]');
    await expect(rightDimension).toHaveAttribute(
      'data-browser-layout-inspector-dimension-active',
      '',
    );
    await expect(rightDimension).toHaveCSS('border-color', 'rgb(94, 234, 212)');
    await page.mouse.move(
      labelBox.x + labelBox.width / 2 + 44,
      labelBox.y + labelBox.height / 2 + 28,
    );
    await page.mouse.up();
    await expect(rightLabel).toHaveCSS('cursor', 'grab');
    await expect(rightLabel).toHaveAttribute('style', /translate\(44px, 28px\)/);
    await expect(rightDimension).not.toHaveAttribute(
      'data-browser-layout-inspector-dimension-active',
    );
    await rightLabel.click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe('A.right → B.right -150px');

    await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.start-picker',
      mode: 'ruler',
    });
    await page.mouse.move(500, 300);
    await page.mouse.down();
    await page.mouse.move(600, 350);
    await page.mouse.up();
    const ruled = await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.get-state',
    });
    expect(ruled).toMatchObject({
      ok: true,
      state: {
        pickerMode: null,
        ruler: {
          start: { x: 500, y: 300 },
          end: { x: 600, y: 350 },
          width: 100,
          height: 50,
          distance: 111.8,
        },
      },
    });

    const snapEnabled = await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.set-ruler-snap',
      enabled: true,
    });
    expect(snapEnabled).toMatchObject({ ok: true, state: { rulerSnapEnabled: true } });
    await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.start-picker',
      mode: 'ruler',
    });
    await page.mouse.move(503, 301);
    await page.mouse.down();
    await page.mouse.move(597, 349);
    await page.mouse.up();
    const snapped = await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.get-state',
    });
    expect(snapped).toMatchObject({
      ok: true,
      state: {
        rulerSnapEnabled: true,
        ruler: {
          start: { x: 504, y: 304 },
          end: { x: 600, y: 352 },
          width: 96,
          height: 48,
          distance: 107.33,
          angle: 26.57,
        },
      },
    });
    expect(snapped).toMatchObject({
      ok: true,
      state: { guides: { vertical: [504, 600], horizontal: [304, 352] } },
    });
    await expect(page.locator('[data-browser-layout-inspector-guide]')).toHaveCount(4);
    const cleared = await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.clear-ruler-guides',
    });
    expect(cleared).toMatchObject({
      ok: true,
      state: { guides: { vertical: [], horizontal: [] } },
    });
    await expect(page.locator('[data-browser-layout-inspector-guide]')).toHaveCount(0);

    await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.start-picker',
      mode: 'ruler',
    });
    await page.mouse.move(405, 207);
    await page.mouse.down();
    await page.mouse.move(451, 255);
    await page.mouse.up();
    const replacedGuides = await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.get-state',
    });
    expect(replacedGuides).toMatchObject({
      ok: true,
      state: { guides: { vertical: [408, 448], horizontal: [208, 256] } },
    });
    await expect(page.locator('[data-browser-layout-inspector-guide]')).toHaveCount(4);

    expect(snapped.state.workItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'selection' }),
        expect.objectContaining({ id: 'anchor' }),
        expect.objectContaining({ id: 'target' }),
        expect.objectContaining({ id: 'ruler', detail: '96 × 48px · 107.33px' }),
      ]),
    );
    const focusedAnchor = await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.focus-work-item',
      id: 'anchor',
    });
    expect(focusedAnchor).toMatchObject({
      ok: true,
      state: { selected: { selector: '#reference' } },
    });
    expect(focusedAnchor.state.workItems).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'anchor', active: true })]),
    );
    const clearedRuler = await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.clear-work-item',
      id: 'ruler',
    });
    expect(clearedRuler).toMatchObject({
      ok: true,
      state: {
        ruler: null,
        measurement: { anchor: { selector: '#reference' }, target: { selector: '#target' } },
      },
    });
    expect(clearedRuler.state.workItems.some((item: { id: string }) => item.id === 'ruler')).toBe(
      false,
    );
    const clearedTarget = await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.clear-work-item',
      id: 'target',
    });
    expect(clearedTarget).toMatchObject({
      ok: true,
      state: { measurement: null, selected: { selector: '#reference' } },
    });
    expect(clearedTarget.state.workItems.some((item: { id: string }) => item.id === 'target')).toBe(
      false,
    );
    await expect(page.locator('[data-browser-layout-inspector-dimension]')).toHaveCount(0);

    const autoSelecting = await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.start-picker',
      mode: 'auto-select',
    });
    expect(autoSelecting).toMatchObject({ ok: true, state: { pickerMode: 'auto-select' } });
    await page.locator('#target').hover();
    const autoSelected = await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.get-state',
    });
    expect(autoSelected).toMatchObject({
      ok: true,
      state: {
        pickerMode: 'auto-select',
        selected: { selector: '#target' },
        workItems: expect.arrayContaining([
          expect.objectContaining({ id: 'selection', active: true }),
        ]),
      },
    });
    await page.keyboard.press('Backspace');
    await expect
      .poll(() => page.locator('#target').evaluate((element) => getComputedStyle(element).display))
      .toBe('none');
    const autoHidden = await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.get-state',
    });
    expect(autoHidden).toMatchObject({
      ok: true,
      state: { pickerMode: 'auto-select', changedElementCount: 1 },
    });
    await page.locator('#editable').hover();
    await page.locator('#editable').focus();
    await page
      .locator('#editable')
      .evaluate((input) => (input as HTMLInputElement).setSelectionRange(3, 3));
    await page.keyboard.press('Backspace');
    await expect(page.locator('#editable')).toHaveValue('12');
    await page.keyboard.press('Escape');
    const autoFinished = await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.get-state',
    });
    expect(autoFinished).toMatchObject({ ok: true, state: { pickerMode: null } });

    await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.start-picker',
      mode: 'measure',
    });
    await page.locator('#reference').click({ position: { x: 5, y: 5 } });
    await page.locator('#gap-target').click();
    await expect(page.locator('[data-browser-layout-inspector-gap="horizontal"]')).toHaveCount(1);
    const gapLabel = page.locator('[data-browser-layout-inspector-gap="horizontal"] span');
    await expect(gapLabel).toHaveText('A.right → B.left gap 60px');
    await gapLabel.click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe('A.right → B.left gap 60px');

    await page.locator('#same-edge-target').evaluate((element) => {
      (element as HTMLElement).style.display = 'block';
    });
    await sendExtensionMessage(worker, inspectedTabId, {
      type: 'browser-layout-inspector.start-picker',
      mode: 'measure',
    });
    await page.locator('#reference').click({ position: { x: 5, y: 5 } });
    await page.locator('#same-edge-target').click();
    await expect(page.locator('[data-browser-layout-inspector-dimension]')).toHaveCount(2);
    await expect(page.locator('[data-browser-layout-inspector-dimension="top"]')).toHaveCount(0);
    await expect(page.locator('[data-browser-layout-inspector-dimension="bottom"]')).toHaveCount(0);
  } finally {
    await context.close();
    await close(server);
    rmSync(userDataDir, { recursive: true, force: true });
    rmSync(extensionPath, { recursive: true, force: true });
  }
});

async function sendExtensionMessage(worker: any, tabId: number, message: unknown): Promise<any> {
  const result = await worker.evaluate(
    ({ tabId: targetTabId, message: request }: { tabId: number; message: unknown }) => {
      const chromeApi = (globalThis as { chrome: any }).chrome;
      return new Promise<any>((resolveResponse) => {
        chromeApi.tabs.sendMessage(targetTabId, request, (response: unknown) => {
          resolveResponse({ message: response, error: chromeApi.runtime.lastError?.message });
        });
      });
    },
    { tabId, message },
  );
  if (result.error) throw new Error(result.error);
  return result.message;
}

function createFixtureServer() {
  return createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(`<!doctype html><style>
      #reference { position: relative; left: 20px; top: 10px; width: 300px; height: 160px; }
      #reference > .target { position: relative; left: 30px; top: 20px; display: grid; gap: 12px; width: 120px; height: 40px; color: rgb(1, 2, 3); }
      #gap-target { position: absolute; left: 360px; top: 20px; width: 120px; height: 40px; }
      #same-edge-target { position: absolute; left: 60px; top: 0; display: none; width: 120px; height: 160px; }
    </style><section id="reference"><article id="target" class="target"></article><article id="gap-target"></article><article id="same-edge-target"></article></section><input id="editable" value="123" />`);
  });
}

/** The production manifest grants <all_urls>; the test copy keeps that explicit shape while loading unpacked. */
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
      if (!address || typeof address === 'string')
        throw new Error('failed to start fixture server');
      resolvePromise(address.port);
    });
  });
}

function close(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolvePromise, reject) =>
    server.close((error) => (error ? reject(error) : resolvePromise())),
  );
}
