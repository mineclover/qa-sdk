// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * IR 유저 시나리오 — 실제 비즈니스 흐름으로 cross-IR 정합성 검증.
 *
 * 시나리오: 주문 처리 시스템
 *   OrderService(group) → ValidateOrder(leaf) → ProcessPayment(leaf) → SendNotification(leaf)
 *   데이터: OrderRequest, PaymentResult, NotificationEvent
 *   파이프: tx-validate → tx-payment → tx-notify
 */

import { describe, it, expect } from 'vitest';
import type { ModuleIR, DataIR, PipeIR } from './ir-types.js';
import { computeSchemaHash, deriveCertainty, inferModuleLevel } from './ir-types.js';
import { validateIRGraph, type IRGraph } from './ir-validate.js';
import { pipeGraphToModuleIR, pipeSpecToIR, stepContractToDataIR } from './ir-bridge.js';
import {
  buildSegments,
  totalAddressSpace,
  encodePathAddress,
  decodePathAddress,
  createSpacetimeUID,
  parseSpacetimeUID,
  addressesForBranch,
} from './spacetime-uid.js';
import type { PipeGraph } from '../types/pipe-spec.js';

// ── 시나리오 1: 주문 처리 전체 흐름 ─────────────────

describe('시나리오: 주문 처리 시스템', () => {
  // 모듈 계층
  const orderService: ModuleIR = {
    id: 'order-service',
    source: { filePath: 'src/order/service.ts', line: 1, kind: 'class' },
    interface: {
      inputs: [{ dataId: 'OrderRequest', schemaHash: '' }],
      outputs: [{ dataId: 'NotificationEvent', schemaHash: '' }],
      sideEffects: [],
    },
    relations: {
      parent: null,
      children: [
        { moduleId: 'validate-order' },
        { moduleId: 'process-payment' },
        { moduleId: 'send-notification' },
      ],
      internal: [],
      external: [],
    },
    meta: { level: 'group', layer: 'domain' },
  };

  const validateOrder: ModuleIR = {
    id: 'validate-order',
    source: { filePath: 'src/order/validate.ts', line: 1, kind: 'function' },
    interface: {
      inputs: [{ dataId: 'OrderRequest', schemaHash: '' }],
      outputs: [{ dataId: 'PaymentResult', schemaHash: '' }],
      sideEffects: [],
    },
    relations: { parent: { moduleId: 'order-service' }, children: [], internal: [], external: [] },
    meta: { level: 'leaf', layer: 'domain' },
  };

  const processPayment: ModuleIR = {
    id: 'process-payment',
    source: { filePath: 'src/order/payment.ts', line: 1, kind: 'function' },
    interface: {
      inputs: [{ dataId: 'PaymentResult', schemaHash: '' }],
      outputs: [{ dataId: 'NotificationEvent', schemaHash: '' }],
      sideEffects: [],
    },
    relations: { parent: { moduleId: 'order-service' }, children: [], internal: [], external: [] },
    meta: { level: 'leaf', layer: 'domain' },
  };

  const sendNotification: ModuleIR = {
    id: 'send-notification',
    source: { filePath: 'src/order/notify.ts', line: 1, kind: 'function' },
    interface: {
      inputs: [{ dataId: 'NotificationEvent', schemaHash: '' }],
      outputs: [],
      sideEffects: [],
    },
    relations: { parent: { moduleId: 'order-service' }, children: [], internal: [], external: [] },
    meta: { level: 'leaf', layer: 'mediation' },
  };

  // 데이터
  const orderFields = [
    { name: 'orderId', type: 'string', optional: false, hasDefault: false },
    { name: 'items', type: 'OrderItem[]', optional: false, hasDefault: false },
    { name: 'total', type: 'number', optional: false, hasDefault: false },
  ];

  const paymentFields = [
    { name: 'orderId', type: 'string', optional: false, hasDefault: false },
    { name: 'status', type: 'string', optional: false, hasDefault: false },
    { name: 'transactionRef', type: 'string', optional: true, hasDefault: false },
  ];

  const notifyFields = [
    { name: 'channel', type: 'string', optional: false, hasDefault: false },
    { name: 'message', type: 'string', optional: false, hasDefault: false },
  ];

  const orderReq: DataIR = {
    definition: {
      type: 'OrderRequest',
      schemaHash: computeSchemaHash(orderFields),
      fields: orderFields,
      certainty: deriveCertainty(orderFields),
    },
    management: {
      managedBy: { moduleId: 'order-service' },
      validationRules: [],
      transactionScope: 'distributed',
    },
    lifecycle: { producedBy: [], consumedBy: [{ moduleId: 'validate-order' }], transformedBy: [] },
    storage: {
      uid: 'intent:v1:0:0:1',
      uidScheme: 'intent:v1',
      storageType: 'event-stream',
      retention: 'persistent',
    },
  };

  const paymentResult: DataIR = {
    definition: {
      type: 'PaymentResult',
      schemaHash: computeSchemaHash(paymentFields),
      fields: paymentFields,
      certainty: 'strict',
    },
    management: {
      managedBy: { moduleId: 'process-payment' },
      validationRules: [],
      transactionScope: 'distributed',
    },
    lifecycle: {
      producedBy: [{ moduleId: 'validate-order' }],
      consumedBy: [{ moduleId: 'process-payment' }],
      transformedBy: [],
    },
    storage: {
      uid: 'intent:v1:0:1:1',
      uidScheme: 'intent:v1',
      storageType: 'db',
      retention: 'persistent',
    },
  };

  const notifyEvent: DataIR = {
    definition: {
      type: 'NotificationEvent',
      schemaHash: computeSchemaHash(notifyFields),
      fields: notifyFields,
      certainty: 'strict',
    },
    management: {
      managedBy: { moduleId: 'send-notification' },
      validationRules: [],
      transactionScope: 'local',
    },
    lifecycle: {
      producedBy: [{ moduleId: 'process-payment' }],
      consumedBy: [{ moduleId: 'send-notification' }],
      transformedBy: [],
    },
    storage: {
      uid: 'intent:v1:0:2:1',
      uidScheme: 'intent:v1',
      storageType: 'event-stream',
      retention: 'ephemeral',
    },
  };

  // 파이프
  const txValidate: PipeIR = {
    transactionId: 'tx-validate',
    targetModule: { moduleId: 'validate-order' },
    payload: { dataId: 'OrderRequest', schemaHash: orderReq.definition.schemaHash },
    state: 'committed',
    triggers: [{ pipeId: 'tx-payment', targetModule: { moduleId: 'process-payment' } }],
    source: { filePath: 'src/order/validate.ts', line: 15, kind: 'method-call' },
  };

  const txPayment: PipeIR = {
    transactionId: 'tx-payment',
    targetModule: { moduleId: 'process-payment' },
    payload: { dataId: 'PaymentResult', schemaHash: paymentResult.definition.schemaHash },
    state: 'committed',
    triggers: [{ pipeId: 'tx-notify', targetModule: { moduleId: 'send-notification' } }],
    source: { filePath: 'src/order/payment.ts', line: 30, kind: 'http-request' },
  };

  const txNotify: PipeIR = {
    transactionId: 'tx-notify',
    targetModule: { moduleId: 'send-notification' },
    payload: { dataId: 'NotificationEvent', schemaHash: notifyEvent.definition.schemaHash },
    state: 'committed',
    triggers: [],
    source: { filePath: 'src/order/notify.ts', line: 5, kind: 'event-emit' },
  };

  const graph: IRGraph = {
    modules: [orderService, validateOrder, processPayment, sendNotification],
    data: [orderReq, paymentResult, notifyEvent],
    pipes: [txValidate, txPayment, txNotify],
  };

  it('전체 그래프 검증 → error 없음', () => {
    const issues = validateIRGraph(graph);
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('모듈 계층 — group/leaf 정합성', () => {
    expect(inferModuleLevel(orderService.relations)).toBe('group');
    expect(inferModuleLevel(validateOrder.relations)).toBe('leaf');
    expect(inferModuleLevel(processPayment.relations)).toBe('leaf');
  });

  it('데이터 패싯 — certainty 파생 정확성', () => {
    expect(orderReq.definition.certainty).toBe('strict');
    expect(paymentResult.definition.certainty).toBe('strict');
  });

  it('데이터 패싯 — schemaHash 유일성', () => {
    const hashes = new Set([
      orderReq.definition.schemaHash,
      paymentResult.definition.schemaHash,
      notifyEvent.definition.schemaHash,
    ]);
    expect(hashes.size).toBe(3);
  });

  it('파이프 인과 체인 — 순환 없음, 3단계', () => {
    // tx-validate → tx-payment → tx-notify → 종료
    expect(txValidate.triggers).toHaveLength(1);
    expect(txPayment.triggers).toHaveLength(1);
    expect(txNotify.triggers).toHaveLength(0);
  });

  it('Spacetime UID — 주문 처리 경로 인코딩', () => {
    // 주문 유형(3) × 결제 방법(4) 분기
    const segs = buildSegments([
      {
        pathId: 'order:type→payment',
        branchChain: [
          { id: 'orderType', branchCount: 3 },
          { id: 'paymentMethod', branchCount: 4 },
        ],
      },
    ]);

    // normal(0) + card(1) → encode → UID
    const pathAddr = encodePathAddress(segs[0], [0, 1]);
    const uid = createSpacetimeUID(0, pathAddr, 1);
    expect(uid).toBe('intent:v1:0:1:1');

    // 역추적
    const parsed = parseSpacetimeUID(uid);
    const decoded = decodePathAddress(segs, parsed.pathAddress);
    expect(decoded.coord).toEqual([0, 1]);
  });

  it('Cross-IR 정합성 — Pipe.payload가 Data에 매칭됨', () => {
    const dataTypes = new Set(graph.data.map((d) => d.definition.type));
    for (const pipe of graph.pipes) {
      expect(dataTypes.has(pipe.payload.dataId)).toBe(true);
    }
  });

  it('Cross-IR 정합성 — Pipe.targetModule이 Module에 존재', () => {
    const moduleIds = new Set(graph.modules.map((m) => m.id));
    for (const pipe of graph.pipes) {
      expect(moduleIds.has(pipe.targetModule.moduleId)).toBe(true);
    }
  });

  it('Cross-IR 정합성 — Data.managedBy가 Module에 존재', () => {
    const moduleIds = new Set(graph.modules.map((m) => m.id));
    for (const data of graph.data) {
      expect(moduleIds.has(data.management.managedBy.moduleId)).toBe(true);
    }
  });
});

// ── 시나리오 2: PipeGraph → IR 변환 라운드트립 ────────

describe('시나리오: PipeGraph → IR 변환', () => {
  const pipeGraph: PipeGraph = {
    graphId: 'checkout-flow',
    version: 'v1',
    pipes: [
      {
        pipeId: 'cart-validate',
        version: 'v1',
        trigger: { eventKey: 'cart.submitted' },
        flow: { type: 'step', label: '검증' },
        produces: ['cart.validated'],
      },
      {
        pipeId: 'payment-charge',
        version: 'v1',
        trigger: { eventKey: 'cart.validated' },
        flow: { type: 'step', label: '결제' },
        produces: ['payment.done'],
      },
      {
        pipeId: 'receipt-generate',
        version: 'v1',
        trigger: { eventKey: 'payment.done' },
        flow: { type: 'step', label: '영수증' },
      },
    ],
    connections: [
      { from: 'cart-validate', to: 'payment-charge', kind: 'next' },
      { from: 'payment-charge', to: 'receipt-generate', kind: 'next' },
    ],
    entryPipeId: 'cart-validate',
  };

  it('PipeGraph → ModuleIR 계층 생성', () => {
    const modules = pipeGraphToModuleIR(pipeGraph);
    expect(modules).toHaveLength(4); // root + 3 pipes
    expect(modules[0].meta.level).toBe('group');
    expect(modules.slice(1).every((m) => m.meta.level === 'leaf')).toBe(true);
  });

  it('PipeSpec → PipeIR 변환 + triggers 체인', () => {
    const irs = pipeGraph.pipes.map((spec, i) => pipeSpecToIR(spec, i));
    expect(irs[0].triggers.map((t) => t.pipeId)).toContain('cart.validated');
    expect(irs[1].triggers.map((t) => t.pipeId)).toContain('payment.done');
    expect(irs[2].triggers).toHaveLength(0);
  });

  it('변환된 IR 그래프도 검증 통과', () => {
    const modules = pipeGraphToModuleIR(pipeGraph);
    const data = pipeGraph.pipes.flatMap((spec) => {
      const events = [spec.trigger.eventKey, ...(spec.produces ?? [])];
      return events.map((e) => ({
        definition: {
          type: e,
          schemaHash: computeSchemaHash([]),
          fields: [],
          certainty: 'strict' as const,
        },
        management: {
          managedBy: { moduleId: spec.pipeId },
          validationRules: [],
          transactionScope: 'local' as const,
        },
        lifecycle: { producedBy: [{ moduleId: spec.pipeId }], consumedBy: [], transformedBy: [] },
        storage: {
          uid: '',
          uidScheme: 'intent:v1',
          storageType: 'memory' as const,
          retention: 'ephemeral' as const,
        },
      }));
    });
    // 중복 type 제거
    const uniqueData = [...new Map(data.map((d) => [d.definition.type, d])).values()];
    const pipes = pipeGraph.pipes.map((spec, i) => pipeSpecToIR(spec, i));

    const graph: IRGraph = { modules, data: uniqueData, pipes };
    const errors = validateIRGraph(graph).filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });
});
