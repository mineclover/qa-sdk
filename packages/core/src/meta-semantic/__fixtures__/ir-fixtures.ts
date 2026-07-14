// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * IR 테스트 공용 fixture — 모듈/데이터/파이프 팩토리
 */

import type { ModuleIR, DataIR, PipeIR } from '../ir-types.js';
import { computeSchemaHash } from '../ir-types.js';

export function makeModule(id: string, overrides: Partial<ModuleIR> = {}): ModuleIR {
  return {
    id,
    source: { filePath: `src/${id}.ts`, line: 1, kind: 'class' },
    interface: { inputs: [], outputs: [], sideEffects: [] },
    relations: { parent: null, children: [], internal: [], external: [] },
    meta: { level: 'leaf' },
    ...overrides,
  };
}

export function makeData(type: string, managedBy: string): DataIR {
  return {
    definition: {
      type,
      schemaHash: computeSchemaHash([
        { name: 'id', type: 'string', optional: false, hasDefault: false },
      ]),
      fields: [{ name: 'id', type: 'string', optional: false, hasDefault: false }],
      certainty: 'strict',
    },
    management: {
      managedBy: { moduleId: managedBy },
      validationRules: [],
      transactionScope: 'local',
    },
    lifecycle: {
      producedBy: [{ moduleId: managedBy }],
      consumedBy: [],
      transformedBy: [],
    },
    storage: {
      uid: 'intent:v1:0:0:0',
      uidScheme: 'intent:v1',
      storageType: 'db',
      retention: 'persistent',
    },
  };
}

export function makePipe(txId: string, targetModule: string, payloadType: string): PipeIR {
  return {
    transactionId: txId,
    targetModule: { moduleId: targetModule },
    payload: { dataId: payloadType, schemaHash: '00000000' },
    state: 'pending',
    triggers: [],
    source: { filePath: 'src/handler.ts', line: 10, kind: 'method-call' },
  };
}
