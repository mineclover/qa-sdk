// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * 데이터 원천에서 IRModule을 생성하는 빌더.
 *
 * DEMO_CATALOG + PrefixSpec → IRModule.
 * 언어 generator는 이 IRModule만 소비하면 된다.
 */

import type { IRModule, IREnum, IREnumValue, IRStruct, IRField } from './ir.js';
import type { PrefixSpec } from '../spec/prefix-spec.types.js';
import type { AxisInput } from './ts-generator.js';

export interface BuildIROptions {
  /** 모듈 이름 */
  name?: string;
  /** axis 데이터 */
  axes: readonly AxisInput[];
  /** prefix specs */
  prefixSpecs: readonly PrefixSpec[];
  /** axis별 ko 번역 (axisId → entry → ko) */
  ko?: Record<string, Record<string, string>>;
  /** prefix별 버전 목록 (prefixId → versions) */
  prefixVersions?: Record<string, readonly string[]>;
}

/**
 * 데이터 원천에서 IRModule을 생성한다.
 */
export function buildIR(options: BuildIROptions): IRModule {
  const enums: IREnum[] = [];
  const structs: IRStruct[] = [];

  // axis → enum
  for (const axis of options.axes) {
    const koMap = options.ko?.[axis.id];
    const values: IREnumValue[] = axis.entries.map((entry, i) => ({
      name: entry,
      index: i,
      label: koMap?.[entry],
    }));

    enums.push({
      id: axis.id,
      capacity: axis.capacity,
      values,
    });
  }

  // prefix export surface → struct
  for (const spec of options.prefixSpecs) {
    const fields: IRField[] = spec.export.dims.map((dim) => {
      const dimRef = spec.dims[dim];
      return {
        name: dim,
        enumRef: dimRef?.kind === 'axis' ? dimRef.axisId : null,
        dimKind: dimRef?.kind ?? 'axis',
      };
    });

    structs.push({
      id: spec.id,
      description: `export: ${spec.export.pattern}`,
      fields,
      versions: options.prefixVersions?.[spec.id],
    });
  }

  return { name: options.name, enums, structs };
}
