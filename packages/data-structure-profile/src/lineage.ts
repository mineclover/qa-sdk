import type { CompiledLineage, DataStructureProfile, LineageEdge, LineageNode } from './types.js';

export function compileLineage(profile: DataStructureProfile): CompiledLineage {
  const rootEvent = profile.structures.find(
    (structure) => structure.kind === 'event' && structure.source_path === '$',
  );
  const lineageStructures = profile.structures.filter(
    (structure) =>
      structure.kind === 'event' ||
      structure.kind === 'array' ||
      structure.kind === 'table' ||
      structure.kind === 'relationship',
  );
  const outputStructures = profile.structures.filter(
    (structure) => structure.kind === 'fact' || structure.kind === 'metric',
  );

  const nodes: LineageNode[] = [
    {
      id: profile.source.id,
      kind: 'source',
      label: stripRefScheme(profile.source.ref),
      taxonomyRef: `data-source-kind:${profile.source.kind}`,
    },
  ];

  for (const structure of lineageStructures) {
    nodes.push(
      structureNode(structure.id, structure.kind, labelForStructure(structure, rootEvent?.id)),
    );
  }
  for (const transform of profile.transforms) {
    nodes.push({
      id: transform.id,
      kind: 'transform',
      label: wordsFromId(transform.id),
      taxonomyRef: `transform-kind:${transform.kind}`,
    });
  }
  for (const structure of outputStructures) {
    nodes.push(
      structureNode(structure.id, structure.kind, labelForStructure(structure, rootEvent?.id)),
    );
  }
  const edges: LineageEdge[] = [];
  if (rootEvent) {
    edges.push({ from: profile.source.id, to: rootEvent.id, kind: 'emits' });
  }
  for (const relationship of profile.relationships) {
    if (relationship.kind === 'contains' || relationship.kind === 'joins') {
      edges.push({ from: relationship.from, to: relationship.to, kind: relationship.kind });
    }
  }
  const [firstTransform] = profile.transforms;
  if (firstTransform) {
    edges.push({ from: firstTransform.from, to: firstTransform.id, kind: 'input' });
  }
  for (let index = 0; index < profile.transforms.length - 1; index += 1) {
    edges.push({
      from: profile.transforms[index]!.id,
      to: profile.transforms[index + 1]!.id,
      kind: 'feeds',
    });
  }
  const lastTransform = profile.transforms.at(-1);
  if (lastTransform) {
    edges.push({ from: lastTransform.id, to: lastTransform.to, kind: 'produces' });
  }

  return {
    kind: 'data-structure-profile.compiled.v1',
    profile: profile.profile,
    taxonomyRef: profile.taxonomy_ref ?? 'data-structure-profile@draft',
    lineage: { nodes, edges },
    diagnosticTargets: buildDiagnosticTargets(profile),
  };
}

function structureNode(id: string, kind: string, label: string): LineageNode {
  return {
    id,
    kind,
    label,
    taxonomyRef: `structure-kind:${kind}`,
  };
}

function labelForStructure(
  structure: DataStructureProfile['structures'][number],
  rootEventId: string | undefined,
): string {
  if (structure.id === rootEventId) {
    return labelFromId(structure.id);
  }
  if (structure.kind === 'fact' || structure.kind === 'metric') {
    return stripRefScheme(structure.target_ref ?? structure.id);
  }
  return stripRefScheme(structure.source_path ?? structure.target_ref ?? structure.id);
}

function stripRefScheme(ref: string): string {
  return ref.replace(/^[a-z]+:\/\//i, '');
}

function wordsFromId(id: string): string {
  return id.replaceAll('-', ' ');
}

function labelFromId(id: string): string {
  const words = wordsFromId(id);
  return `${words.slice(0, 1).toUpperCase()}${words.slice(1)}`;
}

function buildDiagnosticTargets(profile: DataStructureProfile): Record<string, string> {
  const targets: Record<string, string> = {};
  const explode = profile.transforms.find((transform) => transform.kind === 'explode');
  for (const gate of profile.quality_gates) {
    switch (gate.risk) {
      case 'dedup':
        targets[gate.id] = 'source.event_id_path';
        break;
      case 'replay':
        targets[gate.id] = 'source.replay_policy';
        break;
      case 'schema-drift':
        targets[gate.id] = 'source.schema_ref';
        break;
      case 'array-explosion':
        targets[gate.id] = explode
          ? `transforms.${explode.id}.semantics.max_array_length`
          : 'transforms';
        break;
      default:
        targets[gate.id] = gate.evidence?.path ?? gate.id;
    }
  }
  targets['dsp-privacy-dpm-ref-missing'] = 'privacy.dpm_policy_ref';
  return targets;
}
