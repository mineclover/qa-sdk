// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, it, expect } from 'vitest';
import { pipeSpecToIR, pipeGraphToModuleIR, stepContractToDataIR } from './ir-bridge.js';
import type { PipeSpec, PipeGraph } from '../types/pipe-spec.js';
import type { StepDataContract } from '../types/pipe-spec.js';

// ── fixtures ──────────────────────────────────────────

const orderPipe: PipeSpec = {
  pipeId: 'process-order',
  version: '1.0',
  trigger: { eventKey: 'order.created' },
  flow: { type: 'step', label: '주문 처리' },
  produces: ['order.processed', 'notification.send'],
};

const paymentPipe: PipeSpec = {
  pipeId: 'process-payment',
  version: '1.0',
  trigger: { eventKey: 'order.processed' },
  flow: { type: 'step', label: '결제 처리' },
  produces: ['payment.completed'],
};

const graph: PipeGraph = {
  graphId: 'order-flow',
  version: '1.0',
  pipes: [orderPipe, paymentPipe],
  connections: [{ from: 'process-order', to: 'process-payment', kind: 'next' }],
  entryPipeId: 'process-order',
};

// ── pipeSpecToIR ──────────────────────────────────────

describe('pipeSpecToIR', () => {
  it('PipeSpec → PipeIR 변환', () => {
    const ir = pipeSpecToIR(orderPipe);
    expect(ir.transactionId).toContain('process-order');
    expect(ir.targetModule.moduleId).toBe('process-order');
    expect(ir.payload.dataId).toBe('order.created');
    expect(ir.state).toBe('pending');
    expect(ir.triggers).toHaveLength(2);
    expect(ir.triggers[0].pipeId).toBe('order.processed');
  });

  it('produces 없으면 triggers 빈 배열', () => {
    const spec: PipeSpec = {
      pipeId: 'leaf',
      version: '1.0',
      trigger: { eventKey: 'end' },
      flow: { type: 'step', label: 'end' },
    };
    const ir = pipeSpecToIR(spec);
    expect(ir.triggers).toHaveLength(0);
  });
});

// ── pipeGraphToModuleIR ───────────────────────────────

describe('pipeGraphToModuleIR', () => {
  it('그래프 → 루트(group) + 자식(leaf) 모듈', () => {
    const modules = pipeGraphToModuleIR(graph);
    expect(modules).toHaveLength(3); // root + 2 pipes

    const root = modules[0];
    expect(root.id).toBe('order-flow');
    expect(root.meta.level).toBe('group');
    expect(root.relations.children).toHaveLength(2);
    expect(root.relations.parent).toBeNull();

    const child = modules[1];
    expect(child.id).toBe('process-order');
    expect(child.meta.level).toBe('leaf');
    expect(child.relations.parent?.moduleId).toBe('order-flow');

    // 추적 정보 검증
    expect(root.meta.projectionPlane).toBe('execution');
    expect(root.meta.intentHierarchy).toBe('core');
    expect(child.meta.projectionPlane).toBe('execution');
  });

  it('그래프 입력 = 엔트리 파이프의 trigger eventKey', () => {
    const modules = pipeGraphToModuleIR(graph);
    const root = modules[0];
    expect(root.interface.inputs).toHaveLength(1);
    expect(root.interface.inputs[0].dataId).toBe('order.created');
  });

  it('그래프 출력 = 다른 파이프 trigger에 매칭 안 되는 produces', () => {
    const modules = pipeGraphToModuleIR(graph);
    const root = modules[0];
    // "order.processed"는 payment의 trigger → 그래프 내부
    // "notification.send", "payment.completed" → 그래프 출력
    expect(root.interface.outputs.map((o) => o.dataId)).toContain('notification.send');
    expect(root.interface.outputs.map((o) => o.dataId)).toContain('payment.completed');
  });
});

// ── stepContractToDataIR ──────────────────────────────

describe('stepContractToDataIR', () => {
  it('StepDataContract → DataIR 변환', () => {
    const contract: StepDataContract = {
      consumes: {
        orderId: { type: 'string', required: true },
        amount: { type: 'number', required: true },
      },
      produces: {
        valid: { type: 'boolean', required: true },
      },
    };

    const dataIR = stepContractToDataIR(contract, { moduleId: 'order-service' });

    expect(dataIR.definition.type).toBe('step');
    expect(dataIR.definition.fields).toHaveLength(3);
    expect(dataIR.definition.certainty).toBe('strict');
    expect(dataIR.management.managedBy.moduleId).toBe('order-service');
    expect(dataIR.lifecycle.producedBy[0].moduleId).toBe('order-service');

    // 추적 정보 검증
    expect(dataIR.lifecycle.lineageFacet).toBe('transform');
    expect(dataIR.lifecycle.lineageKind).toBe('mapping');
    expect(dataIR.storage.axisType).toBe('finite');
  });

  it('any 필드 포함 → certainty flexible', () => {
    const contract: StepDataContract = {
      consumes: {
        data: { type: 'any', required: false },
      },
    };

    const dataIR = stepContractToDataIR(contract, { moduleId: 'svc' });
    expect(dataIR.definition.certainty).toBe('flexible');
  });
});
