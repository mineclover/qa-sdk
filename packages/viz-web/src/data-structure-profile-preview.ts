// @def.boundary viz-system-root
// @def.doc viz-system-root

import {
  dataStructureLineageToD3,
  dataStructureLineageToMermaid,
  dataStructureLineageToSvg,
  summarizeDataStructureLineage,
} from './data-structure-profile/lineage-view.js';
import { DATA_STRUCTURE_PROFILE_EXAMPLES } from './data-structure-profile/sample-lineage.js';

let currentExample = 0;
let currentTab = 'svg';

function render(): void {
  const example = DATA_STRUCTURE_PROFILE_EXAMPLES[currentExample]!;
  const summary = summarizeDataStructureLineage(
    example.lineage,
    example.validation,
    example.measurement,
  );
  const d3 = dataStructureLineageToD3(example.lineage, example.validation, example.measurement);

  document.getElementById('stats')!.innerHTML = [
    stat('Sources', summary.sources),
    stat('Structures', summary.structures),
    stat('Transforms', summary.transforms),
    stat('Edges', summary.edges),
    stat('Warnings', summary.diagnostics.warnings),
    stat('Errors', summary.diagnostics.errors),
  ].join('');

  document.getElementById('svg-container')!.innerHTML = dataStructureLineageToSvg(
    example.lineage,
    example.validation,
    example.measurement,
  );
  document.getElementById('mermaid-code')!.textContent = dataStructureLineageToMermaid(
    example.lineage,
    example.validation,
  );
  document.getElementById('d3-code')!.textContent = JSON.stringify(d3, null, 2);
  document.getElementById('diagnostic-list')!.innerHTML = example.validation.diagnostics
    .map(
      (diagnostic) => `
      <div class="diagnostic-row ${diagnostic.severity}">
        <div class="diagnostic-code">${escapeHtml(diagnostic.code)}</div>
        <div class="diagnostic-target">${escapeHtml(diagnostic.target)}</div>
        <div class="diagnostic-message">${escapeHtml(diagnostic.message)}</div>
      </div>
    `,
    )
    .join('');
  document.getElementById('measurement')!.innerHTML = [
    metric('Row multiplier', formatNumber(example.measurement.estimates.rowMultiplier)),
    metric('Fact rows/sec', formatNumber(example.measurement.estimates.estimatedFactRowsPerSec)),
    metric(
      'Output bytes/sec',
      formatNumber(example.measurement.estimates.estimatedOutputBytesPerSec),
    ),
    metric('Daily fact rows', formatNumber(example.measurement.estimates.estimatedDailyFactRows)),
  ].join('');
}

function stat(key: string, value: number): string {
  return `<div class="stat"><div class="val">${formatNumber(value)}</div><div class="key">${key}</div></div>`;
}

function metric(key: string, value: string): string {
  return `<div class="metric"><span>${key}</span><strong>${value}</strong></div>`;
}

function buildExampleList(): void {
  const el = document.getElementById('example-list')!;
  el.innerHTML = DATA_STRUCTURE_PROFILE_EXAMPLES.map(
    (example, index) => `
    <div class="example-item${index === 0 ? ' active' : ''}" data-index="${index}">
      <div class="name">${escapeHtml(example.name)}</div>
      <div class="desc">${escapeHtml(example.desc)}</div>
    </div>
  `,
  ).join('');

  el.addEventListener('click', (event) => {
    const item = (event.target as HTMLElement).closest('.example-item') as HTMLElement | null;
    if (!item) return;
    currentExample = Number.parseInt(item.dataset.index!, 10);
    el.querySelectorAll('.example-item').forEach((node) => node.classList.remove('active'));
    item.classList.add('active');
    render();
  });
}

document.querySelectorAll<HTMLElement>('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((node) => node.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach((node) => node.classList.remove('active'));
    tab.classList.add('active');
    currentTab = tab.dataset.tab!;
    document.getElementById(`tab-${currentTab}`)!.classList.add('active');
  });
});

document.querySelectorAll<HTMLElement>('.copy-btn').forEach((button) => {
  button.addEventListener('click', () => {
    const targetId = button.dataset.target!;
    const text = document.getElementById(targetId)!.textContent ?? '';
    navigator.clipboard.writeText(text).then(() => {
      const original = button.textContent;
      button.textContent = 'Copied';
      setTimeout(() => {
        button.textContent = original;
      }, 1200);
    });
  });
});

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

buildExampleList();
render();
