// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * PrefixSpec → Registry 등록 (publish).
 *
 * spec-core의 PrefixSpec을 registry에 draft로 등록한다.
 * DimRef를 분류하여 refs/capacity를 자동 산출한다.
 */

import type { PrefixSpec } from '../spec/prefix-spec.types.js';
import type { RegistryPort } from './registry-port.js';

export interface PublishInput {
  readonly spec: PrefixSpec;
  readonly owner: string;
  readonly mode: 'new' | 'version';
  readonly baseVersion?: string;
}

export interface PublishResult {
  readonly prefix: string;
  readonly versionId: string;
  readonly status: 'draft';
  readonly capacity: number;
  readonly refs: Array<{ prefix: string; versionId: string }>;
}

/**
 * PrefixSpec을 registry에 draft로 등록한다.
 *
 * mode="new": 새 prefix 등록 + 첫 draft
 * mode="version": 기존 prefix에 새 version draft
 */
export async function publishSpec(
  registry: RegistryPort,
  input: PublishInput,
): Promise<PublishResult> {
  const { spec, owner, mode, baseVersion } = input;

  // prefix_ref를 가지고 있으면 composite
  const hasRefs = Object.values(spec.dims).some((d) => d.kind === 'prefix_ref');
  const kind = hasRefs ? ('composite' as const) : ('leaf' as const);

  // 1. mode=new이면 prefix 등록
  if (mode === 'new') {
    const exists = await registry.hasPrefix(spec.id);
    if (!exists) {
      await registry.registerPrefix({
        prefix: spec.id,
        owner,
        kind,
        numberType: 'number',
      });
    }
  }

  // 2. refs 구성 (prefix_ref 차원)
  const refs: Array<{ prefix: string; versionId: string }> = [];
  for (const [, dimRef] of Object.entries(spec.dims)) {
    if (dimRef.kind === 'prefix_ref') {
      const activeVersion = await registry.getActiveVersion(dimRef.prefixId);
      if (activeVersion) {
        refs.push({ prefix: dimRef.prefixId, versionId: activeVersion });
      }
    }
  }

  // 3. capacity 산출 (axis dims의 export 기반 추정)
  //    실제 capacity는 registry-service가 refs에서 계산하거나 명시적으로 제공
  //    여기서는 spec에서 추론 가능한 기본값 사용
  const capacity = estimateCapacity(spec);

  // 4. draft 생성
  await registry.createDraft({
    prefix: spec.id,
    versionId: spec.version,
    baseVersionId: baseVersion ?? null,
    capacity,
    refs: refs.length > 0 ? refs : undefined,
  });

  return {
    prefix: spec.id,
    versionId: spec.version,
    status: 'draft',
    capacity,
    refs,
  };
}

/**
 * PrefixSpec에서 capacity를 추정한다.
 * axis dims의 수로 기본 capacity를 산출. 실제값은 registry에서 결정.
 */
function estimateCapacity(spec: PrefixSpec): number {
  let capacity = 1;
  for (const [, dimRef] of Object.entries(spec.dims)) {
    if (dimRef.kind === 'axis') {
      // axis의 실제 capacity는 카탈로그에서 오지만,
      // publishSpec 단계에서는 export dims 수 기반 기본값 사용
      capacity *= 16; // 기본 headroom
    }
  }
  return capacity;
}
