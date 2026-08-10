import type { ExtensionRequest, ExtensionResponse } from './protocol.js';
import type { PageToolState } from './page-tools.js';
import { formatInspectionAsCss } from './css-output.js';
import { formatLayoutExchangeJson } from './json-output.js';

const output = requiredElement<HTMLPreElement>('output');
const selection = requiredElement<HTMLElement>('selection');
const pickSelectButton = requiredElement<HTMLButtonElement>('pick-select');
const pickMeasureButton = requiredElement<HTMLButtonElement>('pick-measure');
const rulerButton = requiredElement<HTMLButtonElement>('ruler');
const rulerSnapInput = requiredElement<HTMLInputElement>('ruler-snap');
const pinGuidesButton = requiredElement<HTMLButtonElement>('pin-guides');
const clearGuidesButton = requiredElement<HTMLButtonElement>('clear-guides');
const guideCount = requiredElement<HTMLElement>('guide-count');
const copyCssButton = requiredElement<HTMLButtonElement>('copy-css');
const copyJsonButton = requiredElement<HTMLButtonElement>('copy-json');
const downloadJsonButton = requiredElement<HTMLButtonElement>('download-json');
const exportPngButton = requiredElement<HTMLButtonElement>('export-png');
const refreshButton = requiredElement<HTMLButtonElement>('refresh');
const styleProperty = requiredInput('style-property');
const styleValue = requiredInput('style-value');
const applyStyleButton = requiredElement<HTMLButtonElement>('apply-style');
const hideButton = requiredElement<HTMLButtonElement>('hide-selected');
const restoreSelectedButton = requiredElement<HTMLButtonElement>('restore-selected');
const restoreAllButton = requiredElement<HTMLButtonElement>('restore-all');
const selectorInput = requiredInput('selector');
const referenceInput = requiredInput('reference-selector');
const propertiesInput = requiredInput('properties');
const inspectButton = requiredElement<HTMLButtonElement>('inspect');
let lastState: PageToolState | null = null;

pickSelectButton.addEventListener('click', () => void run({ type: 'browser-layout-inspector.start-picker', mode: 'select' }, '페이지에서 요소를 클릭해 선택하세요. Side Panel은 열린 상태로 유지됩니다.'));
pickMeasureButton.addEventListener('click', () => void run({ type: 'browser-layout-inspector.start-picker', mode: 'measure' }, '기준 A와 대상 B를 차례로 클릭하세요. Side Panel에서 결과가 자동 갱신됩니다.'));
rulerButton.addEventListener('click', () => void run({ type: 'browser-layout-inspector.start-picker', mode: 'ruler' }, '페이지에서 시작점부터 끝점까지 드래그하세요. 요소를 선택하지 않는 자유 Ruler입니다.'));
rulerSnapInput.addEventListener('change', () => void run({ type: 'browser-layout-inspector.set-ruler-snap', enabled: rulerSnapInput.checked }));
pinGuidesButton.addEventListener('click', () => void run({ type: 'browser-layout-inspector.pin-ruler-guides' }));
clearGuidesButton.addEventListener('click', () => void run({ type: 'browser-layout-inspector.clear-ruler-guides' }));
copyCssButton.addEventListener('click', () => void copyCss());
copyJsonButton.addEventListener('click', () => void copyJson());
downloadJsonButton.addEventListener('click', () => downloadJson());
exportPngButton.addEventListener('click', () => void exportViewportPng());
refreshButton.addEventListener('click', () => void run({ type: 'browser-layout-inspector.get-state' }));
applyStyleButton.addEventListener('click', () => void run({
  type: 'browser-layout-inspector.apply-style', property: styleProperty.value, value: styleValue.value,
}));
hideButton.addEventListener('click', () => void run({ type: 'browser-layout-inspector.hide-selected' }));
restoreSelectedButton.addEventListener('click', () => void run({ type: 'browser-layout-inspector.restore-selected' }));
restoreAllButton.addEventListener('click', () => void run({ type: 'browser-layout-inspector.restore-all' }));
inspectButton.addEventListener('click', () => {
  const selector = selectorInput.value.trim();
  if (!selector) return renderError('CSS selector를 입력하세요.');
  void run({
    type: 'browser-layout-inspector.inspect-selector',
    selector,
    ...(referenceInput.value.trim() ? { referenceSelector: referenceInput.value.trim() } : {}),
    ...(propertiesInput.value.trim() ? { computedProperties: propertiesInput.value.split(',').map((property) => property.trim()).filter(Boolean) } : {}),
  });
});

void run({ type: 'browser-layout-inspector.get-state' });

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

function render(response: ExtensionResponse, notice?: string): void {
  if (!response.ok) return renderError(response.error ?? '요청을 처리하지 못했습니다.');
  if ('state' in response && response.state) renderState(response.state, notice);
  else if ('inspection' in response) {
    selection.textContent = response.inspection?.targetSelector ?? '수동 검사 결과';
    output.textContent = response.inspection ? formatInspectionAsCss(response.inspection) : '/* 검사 결과가 없습니다. */';
  }
}

function renderState(state: PageToolState, notice?: string): void {
  lastState = state;
  selection.textContent = state.selected ? `${state.selected.selector} (${state.selected.tagName})` : '선택된 요소 없음';
  rulerSnapInput.checked = state.rulerSnapEnabled;
  guideCount.textContent = `가이드 ${state.guides.vertical.length + state.guides.horizontal.length}개`;
  output.textContent = formatStateAsCss(state, notice);
}

function renderError(error: string): void {
  output.textContent = `/* 오류: ${safeComment(error)} */`;
}

function formatStateAsCss(state: PageToolState, notice?: string): string {
  const notes = [
    notice ? `상태: ${notice}` : null,
    state.pickerMode ? `도구: ${state.pickerMode} 활성` : null,
    state.measurement ? `A → B DOM edge gap — Δx ${state.measurement.relative.deltaCssPx?.x ?? 'n/a'}px, Δy ${state.measurement.relative.deltaCssPx?.y ?? 'n/a'}px; A.right → B.left ${state.measurement.relative.edgeGapsCssPx?.leftToRight ?? 'n/a'}px; A.bottom → B.top ${state.measurement.relative.edgeGapsCssPx?.topToBottom ?? 'n/a'}px.` : null,
    state.ruler ? `Ruler viewport — start (${state.ruler.start.x}, ${state.ruler.start.y}), end (${state.ruler.end.x}, ${state.ruler.end.y}); width ${state.ruler.width}px; height ${state.ruler.height}px; diagonal ${state.ruler.distance}px.` : null,
    state.ruler ? `Ruler angle: ${state.ruler.angle}°; 8px snap ${state.rulerSnapEnabled ? 'on' : 'off'}; persistent guides ${state.guides.vertical.length + state.guides.horizontal.length}.` : null,
    state.changedElementCount > 0 ? `임시 inline 변경 요소: ${state.changedElementCount}개 (원복 가능)` : null,
  ].filter((note): note is string => note !== null);
  const inspection = state.inspection ? formatInspectionAsCss(state.inspection) : '/* 페이지에서 요소를 선택하면 copyable computed CSS가 표시됩니다. */';
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

async function copyJson(): Promise<void> {
  try {
    await navigator.clipboard.writeText(requireExchangeJson());
    flashButton(copyJsonButton, 'JSON 복사됨', 'JSON 복사');
  } catch (error) {
    renderError(`JSON 클립보드 복사 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function downloadJson(): void {
  try {
    const blob = new Blob([requireExchangeJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `browser-layout-exchange-${new Date().toISOString().replaceAll(':', '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    flashButton(downloadJsonButton, 'JSON 저장됨', 'JSON 저장');
  } catch (error) {
    renderError(`JSON 내보내기 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function requireExchangeJson(): string {
  if (!lastState) throw new Error('먼저 페이지 상태를 불러오세요.');
  return formatLayoutExchangeJson(lastState);
}

function flashButton(button: HTMLButtonElement, confirmation: string, original: string): void {
  button.textContent = confirmation;
  globalThis.setTimeout(() => { button.textContent = original; }, 1_500);
}

async function exportViewportPng(): Promise<void> {
  exportPngButton.disabled = true;
  try {
    const result = await new Promise<{ readonly ok?: boolean; readonly dataUrl?: string; readonly error?: string }>((resolve) => {
      chrome.runtime.sendMessage({ type: 'browser-layout-inspector.capture-visible-tab' }, (response) => {
        resolve((response as { readonly ok?: boolean; readonly dataUrl?: string; readonly error?: string } | undefined) ?? {});
      });
    });
    if (!result.ok || !result.dataUrl) throw new Error(result.error ?? '현재 viewport를 캡처하지 못했습니다.');
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

function isStateChangedMessage(message: unknown): message is { readonly type: 'browser-layout-inspector.state-changed'; readonly state: PageToolState } {
  return typeof message === 'object' && message !== null &&
    (message as { readonly type?: unknown }).type === 'browser-layout-inspector.state-changed' &&
    typeof (message as { readonly state?: unknown }).state === 'object';
}

function setBusy(busy: boolean): void {
  for (const button of document.querySelectorAll('button')) button.disabled = busy;
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
    chrome.runtime.sendMessage({ type: 'browser-layout-inspector.ensure-content-script', tabId }, (response) => {
      const result = response as { readonly ok?: boolean; readonly error?: string } | undefined;
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else if (!result?.ok) reject(new Error(result?.error ?? 'content script 주입에 실패했습니다.'));
      else resolve();
    });
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
