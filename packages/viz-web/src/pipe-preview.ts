// @def.boundary viz-system-root
// @def.doc viz-system-root

/**
 * PipeGraph 프리뷰 페이지
 * SVG / Mermaid / D3 데이터 세 가지 탭으로 출력 확인
 */

import type { PipeGraph, PipeSpec, PipeConnection, PipeFlow, FoldLevel } from '@qa-sdk/core';
import { computeZoomView, computeLayout } from '@qa-sdk/core';
import { pipeGraphToSvg, pipeGraphToD3, pipeGraphToMermaid } from 'viz-core';

// ── 예제 그래프 정의 ──────────────────────────────────

function pipe(id: string, overrides?: Partial<PipeSpec>): PipeSpec {
  return {
    pipeId: id,
    version: '1.0.0',
    trigger: { eventKey: `${id}.triggered` },
    flow: { kind: 'step', facet: id },
    ...overrides,
  };
}
function c(
  from: string,
  to: string,
  kind: PipeConnection['kind'] = 'next',
  cond?: string,
): PipeConnection {
  return { from, to, kind, ...(cond ? { condition: cond } : {}) };
}

interface Example {
  name: string;
  desc: string;
  graph: PipeGraph;
}

const EXAMPLES: Example[] = [
  {
    name: '선형 체인',
    desc: 'A → B → C 단순 순차 흐름',
    graph: {
      graphId: 'linear',
      version: '1.0.0',
      pipes: [pipe('receive'), pipe('validate'), pipe('process'), pipe('notify')],
      connections: [c('receive', 'validate'), c('validate', 'process'), c('process', 'notify')],
      entryPipeId: 'receive',
    },
  },
  {
    name: '조건 분기',
    desc: 'checkout → 카드/계좌 분기 후 합류',
    graph: {
      graphId: 'branch',
      version: '1.0.0',
      pipes: [
        pipe('checkout'),
        pipe('pay-card', { scope: 'payment', aspect: 'card' }),
        pipe('pay-bank', { scope: 'payment', aspect: 'bank' }),
        pipe('confirm'),
      ],
      connections: [
        c('checkout', 'pay-card', 'conditional', 'method=card'),
        c('checkout', 'pay-bank', 'conditional', 'method=bank'),
        c('pay-card', 'confirm'),
        c('pay-bank', 'confirm'),
      ],
      entryPipeId: 'checkout',
    },
  },
  {
    name: '이벤트 체인',
    desc: 'order → event → shipment 이벤트 연결',
    graph: {
      graphId: 'events',
      version: '1.0.0',
      pipes: [pipe('place-order'), pipe('reserve-stock'), pipe('ship'), pipe('deliver')],
      connections: [
        c('place-order', 'reserve-stock', 'next'),
        c('reserve-stock', 'ship', 'event'),
        c('ship', 'deliver', 'event'),
      ],
      entryPipeId: 'place-order',
    },
  },
  {
    name: 'Fan-out 병렬',
    desc: '알림을 이메일·SMS·푸시로 동시 발송',
    graph: {
      graphId: 'fanout',
      version: '1.0.0',
      pipes: [
        pipe('trigger-notify'),
        pipe('send-email'),
        pipe('send-sms'),
        pipe('send-push'),
        pipe('log-result'),
      ],
      connections: [
        c('trigger-notify', 'send-email', 'fan-out'),
        c('trigger-notify', 'send-sms', 'fan-out'),
        c('trigger-notify', 'send-push', 'fan-out'),
        c('send-email', 'log-result'),
        c('send-sms', 'log-result'),
        c('send-push', 'log-result'),
      ],
      entryPipeId: 'trigger-notify',
    },
  },
  {
    name: '에러 처리',
    desc: '결제 실패 시 보상 트랜잭션',
    graph: {
      graphId: 'error-flow',
      version: '1.0.0',
      pipes: [pipe('start'), pipe('charge'), pipe('error-handler'), pipe('refund'), pipe('done')],
      connections: [
        c('start', 'charge'),
        c('charge', 'error-handler', 'error'),
        c('error-handler', 'refund', 'compensate'),
        c('charge', 'done'),
        c('refund', 'done'),
      ],
      entryPipeId: 'start',
    },
  },
  {
    name: '은행 송금 (transition-scope)',
    desc: '출금→입금 원자 전이 + 보상 + 데이터 계보',
    graph: {
      graphId: 'transfer',
      version: '1.0.0',
      pipes: [
        pipe('접수', {
          flow: {
            kind: 'step',
            facet: '접수',
            dataContract: {
              consumes: {
                amount: { type: 'number', required: true },
                fromAccount: { type: 'string', required: true },
                toAccount: { type: 'string', required: true },
              },
              produces: { transferRequest: { type: 'object', required: true } },
              lineageHints: {
                transferRequest: {
                  sources: ['amount', 'fromAccount', 'toAccount'],
                  transform: 'compute',
                },
              },
            },
          } satisfies PipeFlow,
        }),
        pipe('송금실행', {
          flow: {
            kind: 'transition-scope',
            transitionId: 'transfer.execute',
            events: ['account.debit', 'account.credit'],
            body: {
              kind: 'sequence',
              steps: [
                {
                  kind: 'step',
                  facet: '출금',
                  eventKey: 'account.debit',
                  dataContract: {
                    consumes: { transferRequest: { type: 'object', required: true } },
                    produces: { debitResult: { type: 'object', required: true } },
                    lineageHints: {
                      debitResult: { sources: ['transferRequest'], transform: 'compute' },
                    },
                  },
                },
                {
                  kind: 'step',
                  facet: '입금',
                  eventKey: 'account.credit',
                  dataContract: {
                    consumes: { debitResult: { type: 'object', required: true } },
                    produces: { creditResult: { type: 'object', required: true } },
                    lineageHints: {
                      creditResult: { sources: ['debitResult'], transform: 'compute' },
                    },
                  },
                },
              ],
            },
            compensate: { kind: 'step', facet: '환불' },
          } satisfies PipeFlow,
        }),
        pipe('완료알림', {
          flow: { kind: 'step', facet: '알림' },
        }),
      ],
      connections: [c('접수', '송금실행'), c('송금실행', '완료알림')],
      entryPipeId: '접수',
    },
  },
  {
    name: '복잡 그래프',
    desc: '여러 패턴 혼합 (8 파이프)',
    graph: {
      graphId: 'complex',
      version: '1.0.0',
      pipes: [
        pipe('entry'),
        pipe('auth'),
        pipe('fetch-data'),
        pipe('transform'),
        pipe('validate-out'),
        pipe('cache-store'),
        pipe('error-fallback'),
        pipe('response'),
      ],
      connections: [
        c('entry', 'auth'),
        c('auth', 'fetch-data', 'conditional', 'role=user'),
        c('auth', 'error-fallback', 'error'),
        c('fetch-data', 'transform'),
        c('transform', 'validate-out'),
        c('validate-out', 'cache-store', 'fan-out'),
        c('validate-out', 'response', 'fan-out'),
        c('cache-store', 'response'),
        c('error-fallback', 'response'),
      ],
      entryPipeId: 'entry',
    },
  },
];

// ── 상태 ──────────────────────────────────────────────

let currentExample = 0;
let currentLevel: FoldLevel = 'leaf';
let currentTab = 'svg';

// ── 렌더링 ────────────────────────────────────────────

function render() {
  const example = EXAMPLES[currentExample];
  const graph = example.graph;

  // stats
  const view = computeLayout(computeZoomView(graph, currentLevel));
  const statsEl = document.getElementById('stats')!;
  statsEl.innerHTML = [
    stat('노드', view.nodes.length),
    stat('엣지', view.edges.length),
    stat('접힌 노드', view.summary.foldedNodeCount),
    stat('전체 파이프', view.summary.originalPipeCount),
    stat('경로 수', view.summary.totalPaths),
  ].join('');

  // SVG
  const svg = pipeGraphToSvg(graph, currentLevel, { padding: 48 });
  document.getElementById('svg-container')!.innerHTML = svg;

  // Mermaid
  const mermaid = pipeGraphToMermaid(graph, currentLevel);
  document.getElementById('mermaid-code')!.textContent = mermaid;

  // D3 (lineageSummaries 포함)
  const d3data = pipeGraphToD3(graph, currentLevel);
  document.getElementById('d3-code')!.textContent = JSON.stringify(d3data, null, 2);
}

function stat(key: string, val: number): string {
  return `<div class="stat"><div class="val">${val}</div><div class="key">${key}</div></div>`;
}

// ── 예제 목록 ─────────────────────────────────────────

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

// ── 이벤트 바인딩 ─────────────────────────────────────

document.querySelectorAll<HTMLButtonElement>('.zoom-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.zoom-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentLevel = btn.dataset.level as FoldLevel;
    render();
  });
});

document.querySelectorAll<HTMLElement>('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    currentTab = tab.dataset.tab!;
    document.getElementById(`tab-${currentTab}`)!.classList.add('active');
  });
});

document.getElementById('copy-mermaid')!.addEventListener('click', () => {
  const code = document.getElementById('mermaid-code')!.textContent ?? '';
  navigator.clipboard.writeText(code).then(() => {
    const btn = document.getElementById('copy-mermaid')!;
    btn.textContent = '복사됨!';
    setTimeout(() => {
      btn.textContent = '복사';
    }, 1500);
  });
});

// ── 초기화 ────────────────────────────────────────────

buildExampleList();
render();
