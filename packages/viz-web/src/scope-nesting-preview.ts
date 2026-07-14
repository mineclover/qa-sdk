// @def.boundary viz-system-root
// @def.doc viz-system-root

/**
 * Scope Nesting 프리뷰 페이지
 * Timeline SVG / Mermaid (3종) / D3 데이터 탭으로 출력 확인
 */

import type { ScopeNesting, PipeFlow } from '@qa-sdk/core';
import {
  validateScopeNesting,
  validateMountFlow,
  validateContractTiming,
  simulate,
} from '@qa-sdk/core';
import type {
  MountFlowBinding,
  ScopePipeBinding,
  TimedMountFlowBinding,
  SimulationResult,
} from '@qa-sdk/core';
import type { PipeGraph, PipeSpec, PipeConnection } from '@qa-sdk/core';
import {
  scopeTimelineToSvg,
  scopeTimelineToD3,
  nestingToMermaid,
  mountSnapshotToMermaid,
  timingToMermaid,
  type ScopeTimelineData,
  type RowType,
} from 'viz-core';

// ── 예제 데이터 ──────────────────────────────────────

const step = (facet: string, eventKey?: string): PipeFlow => ({
  kind: 'step' as const,
  facet,
  ...(eventKey != null ? { eventKey } : {}),
});

function mkPipe(id: string, flow: PipeFlow, extra?: Partial<PipeSpec>): PipeSpec {
  return { pipeId: id, version: '1.0.0', trigger: { eventKey: `${id}.triggered` }, flow, ...extra };
}
function conn(from: string, to: string, kind: PipeConnection['kind'] = 'next'): PipeConnection {
  return { from, to, kind };
}

interface Example {
  name: string;
  desc: string;
  nesting: ScopeNesting;
  graph: PipeGraph;
  /** pipeId → ScopePipeBinding */
  bindings: Record<string, ScopePipeBinding>;
}

const EXAMPLES: Example[] = [
  {
    name: '코드 리뷰',
    desc: '3-scope: app → review → detail',
    nesting: {
      nestingId: 'canonical-review',
      scopes: [
        {
          scopeId: 'app',
          provides: [{ contractId: 'auth-state', type: 'state' }],
          consumes: [],
          facets: ['생산'],
        },
        {
          scopeId: 'review',
          provides: [{ contractId: 'review-list', type: 'state' }],
          consumes: [{ contractId: 'auth-state', type: 'state', required: true }],
          facets: ['소비', '관리'],
        },
        {
          scopeId: 'detail',
          provides: [],
          consumes: [
            { contractId: 'review-list', type: 'state', required: true },
            { contractId: 'auth-state', type: 'state', required: true },
          ],
          facets: ['소비'],
        },
      ],
    },
    graph: {
      graphId: 'review-graph',
      version: '1.0.0',
      pipes: [
        mkPipe('init-auth', step('인증')),
        mkPipe('load-reviews', step('목록조회', 'reviews.loaded')),
        mkPipe('show-detail', step('상세보기')),
      ],
      connections: [
        conn('init-auth', 'load-reviews'),
        conn('load-reviews', 'show-detail', 'event'),
      ],
      entryPipeId: 'init-auth',
    },
    bindings: {
      'init-auth': { scopeId: 'app', scopeContracts: ['auth-state'] },
      'load-reviews': { scopeId: 'review', scopeContracts: ['review-list'] },
      'show-detail': { scopeId: 'detail', scopeContracts: [] },
    },
  },
  {
    name: '인시던트 에스컬레이션',
    desc: '4-scope: platform → monitor → alert → escalate',
    nesting: {
      nestingId: 'incident-escalation',
      scopes: [
        {
          scopeId: 'platform',
          provides: [
            { contractId: 'config', type: 'state' },
            { contractId: 'audit-log', type: 'logging' },
          ],
          consumes: [],
          facets: ['생산', '정의'],
        },
        {
          scopeId: 'monitor',
          provides: [
            { contractId: 'metric-stream', type: 'state', readyAfter: 'metrics.collected' },
          ],
          consumes: [{ contractId: 'config', type: 'state', required: true }],
          facets: ['소비', '생산'],
        },
        {
          scopeId: 'alert',
          provides: [{ contractId: 'alert-state', type: 'state' }],
          consumes: [
            { contractId: 'metric-stream', type: 'state', required: true },
            { contractId: 'audit-log', type: 'logging', required: false },
          ],
          facets: ['소비', '관리'],
        },
        {
          scopeId: 'escalate',
          provides: [],
          consumes: [
            { contractId: 'alert-state', type: 'state', required: true },
            { contractId: 'config', type: 'state', required: true },
          ],
          facets: ['소비'],
        },
      ],
    },
    graph: {
      graphId: 'incident-graph',
      version: '1.0.0',
      pipes: [
        mkPipe('boot-config', step('설정로드')),
        mkPipe('collect-metrics', step('수집', 'metrics.collected')),
        mkPipe('evaluate-rules', step('판정')),
        mkPipe('send-notification', step('알림발송')),
      ],
      connections: [
        conn('boot-config', 'collect-metrics'),
        conn('collect-metrics', 'evaluate-rules', 'event'),
        conn('evaluate-rules', 'send-notification'),
      ],
      entryPipeId: 'boot-config',
    },
    bindings: {
      'boot-config': { scopeId: 'platform', scopeContracts: ['config', 'audit-log'] },
      'collect-metrics': { scopeId: 'monitor', scopeContracts: ['metric-stream'] },
      'evaluate-rules': { scopeId: 'alert', scopeContracts: ['alert-state'] },
      'send-notification': { scopeId: 'escalate', scopeContracts: [] },
    },
  },
];

// ── 상태 ─────────────────────────────────────────────

let currentExample = 0;
let currentTab = 'timeline';
let activeRows: RowType[] = ['scope', 'contract', 'pipe', 'delegation'];

// ── 시뮬레이션 파이프라인 ────────────────────────────

function buildTimelineData(ex: Example): ScopeTimelineData {
  const validation = validateScopeNesting(ex.nesting);

  const mountBinding: MountFlowBinding = {
    nesting: ex.nesting,
    graph: ex.graph,
    bindings: ex.bindings,
  };
  const mountResult = validateMountFlow(mountBinding);

  const entryPipe = ex.graph.pipes.find((p) => p.pipeId === ex.graph.entryPipeId);
  const initialEvent = {
    eventKey: entryPipe?.trigger.eventKey ?? `${ex.graph.entryPipeId}.triggered`,
  };
  const sim: SimulationResult = simulate({ graph: ex.graph, initialEvent });

  const timedBinding: TimedMountFlowBinding = mountBinding as TimedMountFlowBinding;
  const timing = validateContractTiming(timedBinding, sim);

  return {
    nesting: ex.nesting,
    validation,
    snapshots: mountResult.snapshots,
    timing,
    simulation: sim,
  };
}

// ── 렌더링 ───────────────────────────────────────────

function render() {
  const ex = EXAMPLES[currentExample];
  const data = buildTimelineData(ex);

  // stats
  const statsEl = document.getElementById('stats')!;
  statsEl.innerHTML = [
    stat('Scopes', data.nesting.scopes.length),
    stat('Contracts', data.validation.descentPaths.length),
    stat('Steps', data.simulation?.totalSteps ?? 0),
    stat('Gaps', data.timing?.delegationGaps.length ?? 0),
    stat('Issues', data.validation.issues.length + (data.timing?.issues.length ?? 0)),
  ].join('');

  // Timeline SVG
  const svg = scopeTimelineToSvg(data, { showRows: activeRows });
  document.getElementById('timeline-container')!.innerHTML = svg;

  // Mermaid 3종
  document.getElementById('mermaid-nesting')!.textContent = nestingToMermaid(
    data.nesting,
    data.validation,
  );
  document.getElementById('mermaid-mount')!.textContent = mountSnapshotToMermaid(data.snapshots);
  if (data.timing) {
    document.getElementById('mermaid-timing')!.textContent = timingToMermaid(
      data.timing,
      data.simulation?.totalSteps ?? data.snapshots.length,
    );
  } else {
    document.getElementById('mermaid-timing')!.textContent = '// timing 데이터 없음';
  }

  // D3
  const d3data = scopeTimelineToD3(data, { showRows: activeRows });
  document.getElementById('d3-code')!.textContent = JSON.stringify(d3data, null, 2);
}

function stat(key: string, val: number): string {
  return `<div class="stat"><div class="val">${val}</div><div class="key">${key}</div></div>`;
}

// ── 예제 목록 ────────────────────────────────────────

function buildExampleList() {
  const el = document.getElementById('example-list')!;
  el.innerHTML = EXAMPLES.map(
    (ex, i) => `
    <div class="example-item${i === 0 ? ' active' : ''}" data-index="${i}">
      <div class="name">${ex.name}</div>
      <div class="desc">${ex.desc}</div>
    </div>
  `,
  ).join('');

  el.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest('.example-item') as HTMLElement | null;
    if (!item) return;
    currentExample = parseInt(item.dataset.index!);
    el.querySelectorAll('.example-item').forEach((el) => el.classList.remove('active'));
    item.classList.add('active');
    render();
  });
}

// ── 이벤트 바인딩 ────────────────────────────────────

// 탭 전환
document.querySelectorAll<HTMLElement>('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    currentTab = tab.dataset.tab!;
    document.getElementById(`tab-${currentTab}`)!.classList.add('active');
  });
});

// 행 필터 체크박스
document.querySelectorAll<HTMLInputElement>('.row-filter').forEach((cb) => {
  cb.addEventListener('change', () => {
    activeRows = Array.from(document.querySelectorAll<HTMLInputElement>('.row-filter:checked')).map(
      (el) => el.value as RowType,
    );
    render();
  });
});

// 복사 버튼들
document.querySelectorAll<HTMLElement>('.copy-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target!;
    const code = document.getElementById(targetId)!.textContent ?? '';
    navigator.clipboard.writeText(code).then(() => {
      const orig = btn.textContent;
      btn.textContent = '복사됨!';
      setTimeout(() => {
        btn.textContent = orig;
      }, 1500);
    });
  });
});

// ── 초기화 ───────────────────────────────────────────

buildExampleList();
render();
