import type { ExtensionRequest, ExtensionResponse } from './protocol.js';
import type { PageToolState } from './page-tools.js';
import type { PageDomTreeNode, PageStyleSnapshot } from './page-overview.js';
import { formatInspectionAsCss } from './css-output.js';
import { formatLayoutExchangeJson } from './json-output.js';

const output = requiredElement<HTMLPreElement>('output');
const selection = requiredElement<HTMLElement>('selection');
const pickSelectButton = requiredElement<HTMLButtonElement>('pick-select');
const pickAutoSelectButton = requiredElement<HTMLButtonElement>('pick-auto-select');
const pickMeasureButton = requiredElement<HTMLButtonElement>('pick-measure');
const rulerButton = requiredElement<HTMLButtonElement>('ruler');
const rulerSnapInput = requiredElement<HTMLInputElement>('ruler-snap');
const clearGuidesButton = requiredElement<HTMLButtonElement>('clear-guides');
const guideCount = requiredElement<HTMLElement>('guide-count');
const workItems = requiredElement<HTMLElement>('work-items');
const refreshDomTreeButton = requiredElement<HTMLButtonElement>('refresh-dom-tree');
const domTree = requiredElement<HTMLElement>('dom-tree');
const extractPageStylesButton = requiredElement<HTMLButtonElement>('extract-page-styles');
const copyPageStylesButton = requiredElement<HTMLButtonElement>('copy-page-styles');
const downloadPageStylesButton = requiredElement<HTMLButtonElement>('download-page-styles');
const pageStyleOutput = requiredElement<HTMLPreElement>('page-style-output');
const copyCssButton = requiredElement<HTMLButtonElement>('copy-css');
const copyJsonButton = requiredElement<HTMLButtonElement>('copy-json');
const downloadJsonButton = requiredElement<HTMLButtonElement>('download-json');
const exportPngButton = requiredElement<HTMLButtonElement>('export-png');
const refreshButton = requiredElement<HTMLButtonElement>('refresh');
const styleProperty = requiredInput('style-property');
const styleValue = requiredInput('style-value');
const styleImportant = requiredElement<HTMLInputElement>('style-important');
const applyStyleButton = requiredElement<HTMLButtonElement>('apply-style');
const inlineDeclarations = requiredElement<HTMLElement>('inline-declarations');
const authorDeclarations = requiredElement<HTMLElement>('author-declarations');
const computedFilter = requiredInput('computed-filter');
const computedDeclarations = requiredElement<HTMLElement>('computed-declarations');
const hideButton = requiredElement<HTMLButtonElement>('hide-selected');
const restoreSelectedButton = requiredElement<HTMLButtonElement>('restore-selected');
const restoreAllButton = requiredElement<HTMLButtonElement>('restore-all');
const selectorInput = requiredInput('selector');
const referenceInput = requiredInput('reference-selector');
const propertiesInput = requiredInput('properties');
const inspectButton = requiredElement<HTMLButtonElement>('inspect');
let lastState: PageToolState | null = null;
let lastPageStyles: PageStyleSnapshot | null = null;

pickSelectButton.addEventListener(
  'click',
  () =>
    void run(
      { type: 'browser-layout-inspector.start-picker', mode: 'select' },
      '페이지에서 요소를 클릭해 선택하세요. Side Panel은 열린 상태로 유지됩니다.',
    ),
);
pickAutoSelectButton.addEventListener(
  'click',
  () =>
    void run(
      { type: 'browser-layout-inspector.start-picker', mode: 'auto-select' },
      'hover 대상이 자동 선택됩니다. Delete/Backspace로 숨기고 Escape로 끝냅니다.',
    ),
);
pickMeasureButton.addEventListener(
  'click',
  () =>
    void run(
      { type: 'browser-layout-inspector.start-picker', mode: 'measure' },
      '기준 A와 대상 B를 차례로 클릭하세요. Side Panel에서 결과가 자동 갱신됩니다.',
    ),
);
rulerButton.addEventListener(
  'click',
  () =>
    void run(
      { type: 'browser-layout-inspector.start-picker', mode: 'ruler' },
      '페이지에서 시작점부터 끝점까지 드래그하세요. 요소를 선택하지 않는 자유 Ruler입니다.',
    ),
);
rulerSnapInput.addEventListener(
  'change',
  () =>
    void run({ type: 'browser-layout-inspector.set-ruler-snap', enabled: rulerSnapInput.checked }),
);
clearGuidesButton.addEventListener(
  'click',
  () => void run({ type: 'browser-layout-inspector.clear-ruler-guides' }),
);
refreshDomTreeButton.addEventListener(
  'click',
  () => void run({ type: 'browser-layout-inspector.get-dom-tree' }),
);
extractPageStylesButton.addEventListener(
  'click',
  () => void run({ type: 'browser-layout-inspector.extract-page-styles' }),
);
copyPageStylesButton.addEventListener('click', () => void copyPageStyles());
downloadPageStylesButton.addEventListener('click', () => downloadPageStyles());
copyCssButton.addEventListener('click', () => void copyCss());
copyJsonButton.addEventListener('click', () => void copyJson());
downloadJsonButton.addEventListener('click', () => downloadJson());
exportPngButton.addEventListener('click', () => void exportViewportPng());
refreshButton.addEventListener(
  'click',
  () => void run({ type: 'browser-layout-inspector.get-state' }),
);
applyStyleButton.addEventListener(
  'click',
  () =>
    void run({
      type: 'browser-layout-inspector.apply-style',
      property: styleProperty.value,
      value: styleValue.value,
      ...(styleImportant.checked ? { priority: 'important' } : {}),
    }),
);
computedFilter.addEventListener('input', () => renderCssInspector(lastState));
hideButton.addEventListener(
  'click',
  () => void run({ type: 'browser-layout-inspector.hide-selected' }),
);
restoreSelectedButton.addEventListener(
  'click',
  () => void run({ type: 'browser-layout-inspector.restore-selected' }),
);
restoreAllButton.addEventListener(
  'click',
  () => void run({ type: 'browser-layout-inspector.restore-all' }),
);
inspectButton.addEventListener('click', () => {
  const selector = selectorInput.value.trim();
  if (!selector) return renderError('CSS selector를 입력하세요.');
  void run({
    type: 'browser-layout-inspector.inspect-selector',
    selector,
    ...(referenceInput.value.trim() ? { referenceSelector: referenceInput.value.trim() } : {}),
    ...(propertiesInput.value.trim()
      ? {
          computedProperties: propertiesInput.value
            .split(',')
            .map((property) => property.trim())
            .filter(Boolean),
        }
      : {}),
  });
});

void initializePanel();

chrome.runtime.onMessage.addListener((message) => {
  if (!isStateChangedMessage(message)) return;
  renderState(message.state);
});

async function run(request: ExtensionRequest, notice?: string): Promise<void> {
  setBusy(true);
  try {
    const tabId = await activeTabId();
    const response = await requestInTab(tabId, request);
    render(response, notice);
  } catch (error) {
    renderError(error instanceof Error ? error.message : String(error));
  } finally {
    setBusy(false);
  }
}

async function initializePanel(): Promise<void> {
  await run({ type: 'browser-layout-inspector.get-state' });
  await run({ type: 'browser-layout-inspector.get-dom-tree' });
}

function render(response: ExtensionResponse, notice?: string): void {
  if (!response.ok) return renderError(response.error ?? '요청을 처리하지 못했습니다.');
  if ('domTree' in response) renderDomTree(response.domTree ?? null);
  else if ('pageStyles' in response && response.pageStyles) renderPageStyles(response.pageStyles);
  else if ('state' in response && response.state) renderState(response.state, notice);
  else if ('inspection' in response) {
    selection.textContent = response.inspection?.targetSelector ?? '수동 검사 결과';
    output.textContent = response.inspection
      ? formatInspectionAsCss(response.inspection)
      : '/* 검사 결과가 없습니다. */';
  }
}

function renderDomTree(root: PageDomTreeNode | null): void {
  if (!root) return renderEmpty(domTree, '현재 페이지에서 body 요소를 찾지 못했습니다.');
  domTree.replaceChildren(renderDomTreeNode(root));
}

function renderDomTreeNode(node: PageDomTreeNode): HTMLElement {
  const choose = document.createElement('button');
  choose.type = 'button';
  choose.className = 'dom-tree-node';
  choose.textContent = node.label;
  choose.title = `${node.selector} 선택`;
  choose.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    void run({ type: 'browser-layout-inspector.select-tree-node', selector: node.selector });
  });
  if (node.children.length === 0 && !node.truncated) return choose;

  const details = document.createElement('details');
  details.open = node.selector === 'body';
  const summary = document.createElement('summary');
  summary.append(choose, document.createTextNode(` · ${node.childCount} children`));
  const children = document.createElement('div');
  children.className = 'dom-tree-children';
  children.append(...node.children.map(renderDomTreeNode));
  if (node.truncated) {
    const truncated = document.createElement('div');
    truncated.className = 'dom-tree-truncated';
    truncated.textContent = `… ${Math.max(node.childCount - node.children.length, 0)} child nodes omitted`;
    children.append(truncated);
  }
  details.append(summary, children);
  return details;
}

function renderPageStyles(styles: PageStyleSnapshot): void {
  lastPageStyles = styles;
  pageStyleOutput.textContent = styles.css;
}

function renderState(state: PageToolState, notice?: string): void {
  lastState = state;
  pickSelectButton.textContent = state.pickerMode === 'select' ? '요소 선택 중…' : '요소 선택';
  pickAutoSelectButton.textContent =
    state.pickerMode === 'auto-select' ? '자동 선택 중… (Esc)' : '자동 선택';
  pickMeasureButton.textContent =
    state.pickerMode === 'measure' ? 'A 선택 중…' : '요소 간격 (A → B)';
  rulerButton.textContent = state.pickerMode === 'ruler' ? 'Ruler 드래그 중…' : 'Ruler';
  selection.textContent = state.selected
    ? `${state.selected.selector} (${state.selected.tagName})`
    : '선택된 요소 없음';
  renderWorkItems(state);
  rulerSnapInput.checked = state.rulerSnapEnabled;
  guideCount.textContent = `Ruler 가이드 ${state.guides.vertical.length + state.guides.horizontal.length}개`;
  clearGuidesButton.disabled = state.guides.vertical.length + state.guides.horizontal.length === 0;
  renderCssInspector(state);
  output.textContent = formatStateAsCss(state, notice);
}

function renderWorkItems(state: PageToolState): void {
  if (state.workItems.length === 0) {
    renderEmpty(workItems, '일반 선택, 비교 A/B, Ruler box가 여기에 남습니다.');
    return;
  }
  workItems.replaceChildren(
    ...state.workItems.map((item) => {
      const row = document.createElement('div');
      row.className = 'work-item';
      const focus = document.createElement('button');
      focus.type = 'button';
      focus.className = `work-item-focus${item.active ? ' active' : ''}`;
      focus.title = `${item.label}: ${item.detail}`;
      const label = document.createElement('span');
      label.className = 'work-item-label';
      label.textContent = item.role;
      const detail = document.createElement('span');
      detail.className = 'work-item-detail';
      detail.textContent = item.id === 'ruler' ? item.detail : item.label;
      focus.append(label, detail);
      focus.addEventListener(
        'click',
        () => void run({ type: 'browser-layout-inspector.focus-work-item', id: item.id }),
      );
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'work-item-clear';
      clear.textContent = '선택 해제';
      clear.setAttribute('aria-label', `${item.label} 선택 해제`);
      clear.addEventListener(
        'click',
        () => void run({ type: 'browser-layout-inspector.clear-work-item', id: item.id }),
      );
      row.append(focus, clear);
      if (item.selectorCandidates.length > 0 && item.selectedSelector) {
        const selector = document.createElement('select');
        selector.className = 'work-item-selector';
        selector.title = '이 작업 항목에 표시·복사할 selector 선택';
        for (const candidate of item.selectorCandidates) {
          const option = document.createElement('option');
          option.value = candidate.selector;
          option.selected = candidate.selector === item.selectedSelector;
          option.textContent = `${selectorSourceLabel(candidate.source, candidate.unique)} · ${candidate.selector}`;
          selector.append(option);
        }
        selector.addEventListener(
          'change',
          () =>
            void run({
              type: 'browser-layout-inspector.set-work-item-selector',
              id: item.id as 'selection' | 'anchor' | 'target',
              selector: selector.value,
            }),
        );
        row.append(selector);
      }
      return row;
    }),
  );
}

function selectorSourceLabel(
  source: 'matched-css' | 'unique' | 'fallback',
  unique: boolean,
): string {
  if (source === 'matched-css') return unique ? '매칭 CSS · 고유' : '매칭 CSS';
  if (source === 'unique') return '고유 식별자';
  return unique ? '구조 · 고유' : '구조';
}

function renderCssInspector(state: PageToolState | null): void {
  if (!state?.cssInspector) {
    renderEmpty(inlineDeclarations, '요소를 선택하면 inline declaration을 편집할 수 있습니다.');
    renderEmpty(authorDeclarations, '선택된 요소의 CSS source 후보가 표시됩니다.');
    renderEmpty(computedDeclarations, '선택된 요소의 최종 computed 값이 표시됩니다.');
    return;
  }
  const inline = state.cssInspector.sourceDeclarations.filter(
    (declaration) => declaration.source === 'inline',
  );
  renderInlineDeclarations(inline);
  renderAuthorDeclarations(
    state.cssInspector.sourceDeclarations.filter((declaration) => declaration.source === 'author'),
  );
  const query = computedFilter.value.trim().toLowerCase();
  renderComputedDeclarations(
    state.cssInspector.computedDeclarations.filter(
      (declaration) =>
        !query ||
        declaration.property.includes(query) ||
        declaration.value.toLowerCase().includes(query),
    ),
  );
}

function renderInlineDeclarations(
  declarations: readonly {
    readonly property: string;
    readonly value: string;
    readonly priority: string;
  }[],
): void {
  if (declarations.length === 0)
    return renderEmpty(
      inlineDeclarations,
      '현재 inline declaration이 없습니다. 위에서 추가할 수 있습니다.',
    );
  inlineDeclarations.replaceChildren(
    ...declarations.map((declaration) => {
      const row = document.createElement('div');
      row.className = 'declaration-row';
      const property = input(declaration.property, 'CSS 속성');
      const value = input(declaration.value, '값');
      const save = document.createElement('button');
      save.type = 'button';
      save.textContent = '적용';
      save.addEventListener(
        'click',
        () =>
          void run({
            type: 'browser-layout-inspector.apply-style',
            property: property.value,
            value: value.value,
            ...(declaration.priority ? { priority: declaration.priority } : {}),
          }),
      );
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove';
      remove.textContent = '삭제';
      remove.addEventListener(
        'click',
        () =>
          void run({
            type: 'browser-layout-inspector.remove-style',
            property: declaration.property,
          }),
      );
      row.append(property, value, save, remove);
      return row;
    }),
  );
}

function renderAuthorDeclarations(
  declarations: readonly {
    readonly property: string;
    readonly value: string;
    readonly priority: string;
    readonly selector: string | null;
    readonly stylesheetLabel: string;
    readonly conditions: readonly string[];
  }[],
): void {
  if (declarations.length === 0)
    return renderEmpty(authorDeclarations, '접근 가능한 author declaration 후보가 없습니다.');
  authorDeclarations.replaceChildren(
    ...declarations.map((declaration) => {
      const row = document.createElement('div');
      row.className = 'declaration-row';
      const property = document.createElement('span');
      property.textContent = declaration.property;
      const value = document.createElement('span');
      value.textContent = `${declaration.value}${declaration.priority ? ' !important' : ''}`;
      const source = document.createElement('span');
      source.className = 'declaration-meta';
      source.textContent = `${declaration.stylesheetLabel} · ${declaration.selector ?? '(inline)'}${declaration.conditions.length ? ` · ${declaration.conditions.join(', ')}` : ''}`;
      row.append(property, value, source);
      return row;
    }),
  );
}

function renderComputedDeclarations(
  declarations: readonly { readonly property: string; readonly value: string }[],
): void {
  if (declarations.length === 0)
    return renderEmpty(computedDeclarations, '필터와 일치하는 computed declaration이 없습니다.');
  computedDeclarations.replaceChildren(
    ...declarations.map((declaration) => {
      const row = document.createElement('div');
      row.className = 'computed-row';
      const property = document.createElement('span');
      property.textContent = declaration.property;
      const value = document.createElement('span');
      value.textContent = declaration.value;
      row.append(property, value);
      return row;
    }),
  );
}

function renderEmpty(container: HTMLElement, message: string): void {
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  empty.textContent = message;
  container.replaceChildren(empty);
}

function input(value: string, placeholder: string): HTMLInputElement {
  const element = document.createElement('input');
  element.value = value;
  element.placeholder = placeholder;
  return element;
}

function renderError(error: string): void {
  output.textContent = `/* 오류: ${safeComment(error)} */`;
}

function formatStateAsCss(state: PageToolState, notice?: string): string {
  const notes = [
    notice ? `상태: ${notice}` : null,
    state.pickerMode ? `도구: ${state.pickerMode} 활성` : null,
    state.measurement
      ? `A → B DOM edge gap — Δx ${state.measurement.relative.deltaCssPx?.x ?? 'n/a'}px, Δy ${state.measurement.relative.deltaCssPx?.y ?? 'n/a'}px; A.right → B.left ${state.measurement.relative.edgeGapsCssPx?.leftToRight ?? 'n/a'}px; A.bottom → B.top ${state.measurement.relative.edgeGapsCssPx?.topToBottom ?? 'n/a'}px.`
      : null,
    state.ruler
      ? `Ruler viewport — start (${state.ruler.start.x}, ${state.ruler.start.y}), end (${state.ruler.end.x}, ${state.ruler.end.y}); width ${state.ruler.width}px; height ${state.ruler.height}px; diagonal ${state.ruler.distance}px.`
      : null,
    state.ruler
      ? `Ruler angle: ${state.ruler.angle}°; 8px snap ${state.rulerSnapEnabled ? 'on' : 'off'}; current Ruler guides ${state.guides.vertical.length + state.guides.horizontal.length}.`
      : null,
    state.changedElementCount > 0
      ? `임시 inline 변경 요소: ${state.changedElementCount}개 (원복 가능)`
      : null,
  ].filter((note): note is string => note !== null);
  const inspection = state.inspection
    ? formatInspectionAsCss(state.inspection)
    : '/* 페이지에서 요소를 선택하면 copyable computed CSS가 표시됩니다. */';
  return `${notes.length > 0 ? `/*\n${notes.map((note) => ` * ${safeComment(note)}`).join('\n')}\n */\n\n` : ''}${inspection}`;
}

async function copyCss(): Promise<void> {
  try {
    await navigator.clipboard.writeText(output.textContent ?? '');
    flashButton(copyCssButton, '복사됨', 'CSS 복사');
  } catch (error) {
    renderError(`클립보드 복사 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function copyPageStyles(): Promise<void> {
  try {
    await navigator.clipboard.writeText(requirePageStyles().css);
    flashButton(copyPageStylesButton, '페이지 CSS 복사됨', '페이지 CSS 복사');
  } catch (error) {
    renderError(`페이지 CSS 복사 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function downloadPageStyles(): void {
  try {
    const styles = requirePageStyles();
    downloadText(
      styles.css,
      `browser-page-styles-${new Date().toISOString().replaceAll(':', '-')}.css`,
      'text/css',
    );
    flashButton(downloadPageStylesButton, '페이지 CSS 저장됨', '페이지 CSS 저장');
  } catch (error) {
    renderError(`페이지 CSS 저장 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function copyJson(): Promise<void> {
  try {
    await navigator.clipboard.writeText(requireExchangeJson());
    flashButton(copyJsonButton, 'JSON 복사됨', 'JSON 복사');
  } catch (error) {
    renderError(
      `JSON 클립보드 복사 실패: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function downloadJson(): void {
  try {
    downloadText(
      requireExchangeJson(),
      `browser-layout-exchange-${new Date().toISOString().replaceAll(':', '-')}.json`,
      'application/json',
    );
    flashButton(downloadJsonButton, 'JSON 저장됨', 'JSON 저장');
  } catch (error) {
    renderError(`JSON 내보내기 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function requireExchangeJson(): string {
  if (!lastState) throw new Error('먼저 페이지 상태를 불러오세요.');
  return formatLayoutExchangeJson(lastState);
}

function requirePageStyles(): PageStyleSnapshot {
  if (!lastPageStyles) throw new Error('먼저 페이지 스타일을 추출하세요.');
  return lastPageStyles;
}

function downloadText(contents: string, filename: string, type: string): void {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function flashButton(button: HTMLButtonElement, confirmation: string, original: string): void {
  button.textContent = confirmation;
  globalThis.setTimeout(() => {
    button.textContent = original;
  }, 1_500);
}

async function exportViewportPng(): Promise<void> {
  exportPngButton.disabled = true;
  try {
    const result = await new Promise<{
      readonly ok?: boolean;
      readonly dataUrl?: string;
      readonly error?: string;
    }>((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'browser-layout-inspector.capture-visible-tab' },
        (response) => {
          resolve(
            (response as
              | { readonly ok?: boolean; readonly dataUrl?: string; readonly error?: string }
              | undefined) ?? {},
          );
        },
      );
    });
    if (!result.ok || !result.dataUrl)
      throw new Error(result.error ?? '현재 viewport를 캡처하지 못했습니다.');
    const anchor = document.createElement('a');
    anchor.href = result.dataUrl;
    anchor.download = `browser-layout-${new Date().toISOString().replaceAll(':', '-')}.png`;
    anchor.click();
    flashButton(exportPngButton, 'PNG 저장됨', 'Viewport PNG');
  } catch (error) {
    renderError(`PNG 내보내기 실패: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    exportPngButton.disabled = false;
  }
}

function safeComment(value: string): string {
  return value.replaceAll('*/', '* /').replaceAll('\n', ' ');
}

function isStateChangedMessage(message: unknown): message is {
  readonly type: 'browser-layout-inspector.state-changed';
  readonly state: PageToolState;
} {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { readonly type?: unknown }).type === 'browser-layout-inspector.state-changed' &&
    typeof (message as { readonly state?: unknown }).state === 'object'
  );
}

function setBusy(busy: boolean): void {
  for (const button of document.querySelectorAll('button')) button.disabled = busy;
  if (!busy)
    clearGuidesButton.disabled =
      !lastState || lastState.guides.vertical.length + lastState.guides.horizontal.length === 0;
}

function requiredElement<T extends Element>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`popup element missing: ${id}`);
  return element as unknown as T;
}

function requiredInput(id: string): HTMLInputElement {
  return requiredElement<HTMLInputElement>(id);
}

function activeTabId(): Promise<number> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (typeof tabId !== 'number') reject(new Error('활성 탭을 찾지 못했습니다.'));
      else resolve(tabId);
    });
  });
}

function sendToTab(tabId: number, request: ExtensionRequest): Promise<ExtensionResponse | null> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, request, (response) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve((response as ExtensionResponse | undefined) ?? null);
    });
  });
}

function ensureContentScript(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'browser-layout-inspector.ensure-content-script', tabId },
      (response) => {
        const result = response as { readonly ok?: boolean; readonly error?: string } | undefined;
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else if (!result?.ok)
          reject(new Error(result?.error ?? 'content script 주입에 실패했습니다.'));
        else resolve();
      },
    );
  });
}

async function requestInTab(tabId: number, request: ExtensionRequest): Promise<ExtensionResponse> {
  const initial = await sendToTab(tabId, request);
  if (initial) return initial;
  await ensureContentScript(tabId);
  const response = await sendToTab(tabId, request);
  if (!response) throw new Error('content script 응답을 받지 못했습니다.');
  return response;
}
