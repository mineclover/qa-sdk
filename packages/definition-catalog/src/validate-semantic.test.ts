// @def.doc definition-catalog-spec

import { describe, expect, it } from 'vitest';

import { MemoryDefinitionRegistry } from './registry.js';
import { validateGraph } from './validate.js';
import type { DefinitionEntryInput } from './types.js';

const NOW = '2026-04-05T00:00:00Z';

function doc(
  input: Partial<DefinitionEntryInput> &
    Pick<DefinitionEntryInput, 'id' | 'title' | 'scope' | 'aspect' | 'depth'>,
): DefinitionEntryInput {
  return {
    lifecycle: 'approved',
    createdAt: NOW,
    updatedAt: NOW,
    ...input,
  };
}

describe('validateGraph semantic overrides', () => {
  it('semantic boundary 신호가 있으면 cross-scope multi-parent를 허용한다', () => {
    const reg = new MemoryDefinitionRegistry();

    reg.register(
      doc({
        id: 'concept-root',
        title: 'Concept Root',
        level: 'group',
        scope: 'data',
        aspect: 'domain_data',
        depth: 'overview',
      }),
    );
    reg.register(
      doc({
        id: 'meta-semantic-concepts',
        title: 'Meta Semantic Concepts',
        level: 'module',
        scope: 'data',
        aspect: 'domain_data',
        depth: 'overview',
      }),
    );
    reg.register(
      doc({
        id: 'ms-concept-boundary',
        title: 'Boundary Concept',
        level: 'leaf',
        scope: 'data',
        aspect: 'domain_data',
        depth: 'specification',
      }),
    );
    reg.register(
      doc({
        id: 'provider-root',
        title: 'Provider Root',
        level: 'group',
        scope: 'feature',
        aspect: 'func_def',
        depth: 'overview',
      }),
    );
    reg.register(
      doc({
        id: 'lifecycle-root',
        title: 'Lifecycle Root',
        level: 'group',
        scope: 'flow',
        aspect: 'process_flow',
        depth: 'overview',
      }),
    );
    reg.register(
      doc({
        id: 'shared-child',
        title: 'Shared Child',
        level: 'leaf',
        scope: 'feature',
        aspect: 'func_def',
        depth: 'specification',
      }),
    );

    reg.link('concept-root', 'meta-semantic-concepts', 'contains');
    reg.link('meta-semantic-concepts', 'ms-concept-boundary', 'contains');
    reg.link('concept-root', 'provider-root', 'contains');
    reg.link('provider-root', 'lifecycle-root', 'contains');
    reg.link('provider-root', 'ms-concept-boundary', 'implements');
    reg.link('provider-root', 'shared-child', 'contains');
    reg.link('lifecycle-root', 'shared-child', 'contains');

    const result = validateGraph(reg);
    expect(result.issues.filter((issue) => issue.type === 'multi-parent')).toHaveLength(0);
  });

  it('일반 문서는 multi-parent를 계속 경고한다', () => {
    const reg = new MemoryDefinitionRegistry();

    reg.register(
      doc({
        id: 'parent-a',
        title: 'Parent A',
        level: 'group',
        scope: 'flow',
        aspect: 'process_flow',
        depth: 'overview',
      }),
    );
    reg.register(
      doc({
        id: 'parent-b',
        title: 'Parent B',
        level: 'group',
        scope: 'data',
        aspect: 'domain_data',
        depth: 'overview',
      }),
    );
    reg.register(
      doc({
        id: 'child-a',
        title: 'Child A',
        level: 'leaf',
        scope: 'feature',
        aspect: 'func_def',
        depth: 'specification',
      }),
    );

    reg.link('parent-a', 'child-a', 'contains');
    reg.link('parent-b', 'child-a', 'contains');

    const result = validateGraph(reg);
    expect(result.issues.filter((issue) => issue.type === 'multi-parent')).toHaveLength(1);
  });

  it('semantic boundary overview는 contains depth 5를 허용한다', () => {
    const reg = new MemoryDefinitionRegistry();

    reg.register(
      doc({
        id: 'concept-root',
        title: 'Concept Root',
        level: 'group',
        scope: 'data',
        aspect: 'domain_data',
        depth: 'overview',
      }),
    );
    reg.register(
      doc({
        id: 'meta-semantic-concepts',
        title: 'Meta Semantic Concepts',
        level: 'module',
        scope: 'data',
        aspect: 'domain_data',
        depth: 'overview',
      }),
    );
    reg.register(
      doc({
        id: 'ms-concept-boundary',
        title: 'Boundary Concept',
        level: 'leaf',
        scope: 'data',
        aspect: 'domain_data',
        depth: 'specification',
      }),
    );
    reg.register(
      doc({
        id: 'g2',
        title: 'G2',
        level: 'group',
        scope: 'feature',
        aspect: 'func_def',
        depth: 'overview',
      }),
    );
    reg.register(
      doc({
        id: 'g3',
        title: 'G3',
        level: 'module',
        scope: 'feature',
        aspect: 'func_def',
        depth: 'overview',
      }),
    );
    reg.register(
      doc({
        id: 'g4',
        title: 'G4',
        level: 'module',
        scope: 'feature',
        aspect: 'func_def',
        depth: 'overview',
      }),
    );
    reg.register(
      doc({
        id: 'leaf',
        title: 'Leaf',
        level: 'leaf',
        scope: 'feature',
        aspect: 'func_def',
        depth: 'specification',
      }),
    );

    reg.link('concept-root', 'meta-semantic-concepts', 'contains');
    reg.link('meta-semantic-concepts', 'ms-concept-boundary', 'contains');
    reg.link('concept-root', 'g2', 'contains');
    reg.link('g2', 'g3', 'contains');
    reg.link('g3', 'g4', 'contains');
    reg.link('g4', 'leaf', 'contains');
    reg.link('g3', 'ms-concept-boundary', 'implements');

    const result = validateGraph(reg);
    expect(result.issues.filter((issue) => issue.type === 'contains-depth-violation')).toHaveLength(
      0,
    );
  });

  it('meta-semantic 같은 이름이라도 concept link가 없으면 override하지 않는다', () => {
    const reg = new MemoryDefinitionRegistry();

    reg.register(
      doc({
        id: 'meta-semanticish-parent-a',
        title: 'Meta Semanticish Parent A',
        level: 'group',
        scope: 'feature',
        aspect: 'func_def',
        depth: 'overview',
      }),
    );
    reg.register(
      doc({
        id: 'meta-semanticish-parent-b',
        title: 'Meta Semanticish Parent B',
        level: 'group',
        scope: 'data',
        aspect: 'domain_data',
        depth: 'overview',
      }),
    );
    reg.register(
      doc({
        id: 'child',
        title: 'Child',
        level: 'leaf',
        scope: 'feature',
        aspect: 'func_def',
        depth: 'specification',
      }),
    );

    reg.link('meta-semanticish-parent-a', 'child', 'contains');
    reg.link('meta-semanticish-parent-b', 'child', 'contains');

    const result = validateGraph(reg);
    expect(result.issues.filter((issue) => issue.type === 'multi-parent')).toHaveLength(1);
  });

  it('일반 overview는 contains depth 5에서 계속 경고한다', () => {
    const reg = new MemoryDefinitionRegistry();

    reg.register(
      doc({
        id: 'root',
        title: 'Root',
        level: 'group',
        scope: 'flow',
        aspect: 'process_flow',
        depth: 'overview',
      }),
    );
    reg.register(
      doc({
        id: 'g2',
        title: 'G2',
        level: 'group',
        scope: 'flow',
        aspect: 'process_flow',
        depth: 'overview',
      }),
    );
    reg.register(
      doc({
        id: 'g3',
        title: 'G3',
        level: 'module',
        scope: 'feature',
        aspect: 'func_def',
        depth: 'overview',
      }),
    );
    reg.register(
      doc({
        id: 'g4',
        title: 'G4',
        level: 'module',
        scope: 'feature',
        aspect: 'func_def',
        depth: 'overview',
      }),
    );
    reg.register(
      doc({
        id: 'leaf',
        title: 'Leaf',
        level: 'leaf',
        scope: 'feature',
        aspect: 'func_def',
        depth: 'specification',
      }),
    );

    reg.link('root', 'g2', 'contains');
    reg.link('g2', 'g3', 'contains');
    reg.link('g3', 'g4', 'contains');
    reg.link('g4', 'leaf', 'contains');

    const result = validateGraph(reg);
    expect(result.issues.filter((issue) => issue.type === 'contains-depth-violation')).toHaveLength(
      1,
    );
  });

  it('coordinate-cluster 태그가 그룹 전원에 있으면 duplicate-coordinate을 허용한다', () => {
    const reg = new MemoryDefinitionRegistry();

    reg.register(
      doc({
        id: 'metadata-root',
        title: 'Metadata Root',
        tier: 'layout',
        scope: 'data',
        aspect: 'system_data',
        depth: 'overview',
        layer: 'operation',
      }),
    );
    reg.register(
      doc({
        id: 'metadata-option-a',
        title: 'Metadata Option A',
        tier: 'system',
        scope: 'data',
        aspect: 'system_data',
        depth: 'specification',
        layer: 'operation',
        tags: ['coordinate-cluster'],
      }),
    );
    reg.register(
      doc({
        id: 'metadata-option-b',
        title: 'Metadata Option B',
        tier: 'system',
        scope: 'data',
        aspect: 'system_data',
        depth: 'specification',
        layer: 'operation',
        tags: ['coordinate-cluster'],
      }),
    );
    reg.link('metadata-option-a', 'metadata-root', 'refines');
    reg.link('metadata-option-b', 'metadata-root', 'refines');

    const result = validateGraph(reg);
    expect(result.issues.filter((issue) => issue.type === 'duplicate-coordinate')).toHaveLength(0);
  });

  it('coordinate-cluster 태그가 일부 문서에만 있으면 duplicate-coordinate을 계속 경고한다', () => {
    const reg = new MemoryDefinitionRegistry();

    reg.register(
      doc({
        id: 'metadata-root',
        title: 'Metadata Root',
        tier: 'layout',
        scope: 'data',
        aspect: 'system_data',
        depth: 'overview',
        layer: 'operation',
      }),
    );
    reg.register(
      doc({
        id: 'metadata-option-a',
        title: 'Metadata Option A',
        tier: 'system',
        scope: 'data',
        aspect: 'system_data',
        depth: 'specification',
        layer: 'operation',
        tags: ['coordinate-cluster'],
      }),
    );
    reg.register(
      doc({
        id: 'metadata-option-b',
        title: 'Metadata Option B',
        tier: 'system',
        scope: 'data',
        aspect: 'system_data',
        depth: 'specification',
        layer: 'operation',
      }),
    );
    reg.link('metadata-option-a', 'metadata-root', 'refines');
    reg.link('metadata-option-b', 'metadata-root', 'refines');

    const result = validateGraph(reg);
    expect(result.issues.filter((issue) => issue.type === 'duplicate-coordinate')).toHaveLength(1);
  });
});
