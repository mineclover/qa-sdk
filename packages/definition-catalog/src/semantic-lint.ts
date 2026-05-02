// @def.doc definition-catalog-spec

import type { DefinitionEntry } from "./types.js";
import type { MemoryDefinitionRegistry } from "./registry.js";
import {
  SEMANTIC_LINT_FAMILIES,
  type SemanticLintFamilyRule,
  type SemanticLintTraversalLinkType,
} from "./taxonomy.js";

function neighboringDocIds(
  docId: string,
  registry: MemoryDefinitionRegistry,
  allowedLinkTypes: ReadonlySet<SemanticLintTraversalLinkType>,
): string[] {
  const ids: string[] = [];
  for (const link of registry.getLinks(docId, "both")) {
    if (!allowedLinkTypes.has(link.linkType as SemanticLintTraversalLinkType)) continue;
    ids.push(link.sourceId === docId ? link.targetId : link.sourceId);
  }
  return ids;
}

function resolvesSemanticFamily(
  docId: string,
  registry: MemoryDefinitionRegistry,
  family: SemanticLintFamilyRule,
): boolean {
  const visited = new Set<string>();
  const queue = [docId];
  const seeds = new Set(family.seeds);
  const traversal = new Set(family.traversal);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    if (seeds.has(current)) {
      return true;
    }

    for (const next of neighboringDocIds(current, registry, traversal)) {
      if (!visited.has(next)) queue.push(next);
    }
  }

  return false;
}

export function collectSemanticFamilies(
  docId: string,
  registry: MemoryDefinitionRegistry,
  cache: Map<string, readonly string[]>,
): readonly string[] {
  const cached = cache.get(docId);
  if (cached) return cached;

  const families = SEMANTIC_LINT_FAMILIES
    .filter((family) => resolvesSemanticFamily(docId, registry, family))
    .map((family) => family.id)
    .sort();

  const result = [...families];
  cache.set(docId, result);
  return result;
}

function hasCrossScope(entry: DefinitionEntry | undefined): boolean {
  return entry?.tags?.includes("cross-scope") ?? false;
}

function intersects(left: readonly string[], right: readonly string[]): boolean {
  if (left.length === 0 || right.length === 0) return false;
  const set = new Set(left);
  return right.some((item) => set.has(item));
}

export function allowsSemanticMultiParent(
  childId: string,
  parentIds: readonly string[],
  registry: MemoryDefinitionRegistry,
  cache: Map<string, readonly string[]>,
): boolean {
  const child = registry.get(childId);
  if (!child) return false;
  if (hasCrossScope(child)) return true;

  const parents = parentIds
    .map((id) => registry.get(id))
    .filter((entry): entry is DefinitionEntry => Boolean(entry));

  if (parents.some((parent) => hasCrossScope(parent))) return true;

  const distinctScopes = new Set(parents.map((parent) => parent.scope));
  if (distinctScopes.size <= 1) return false;

  const childFamilies = collectSemanticFamilies(childId, registry, cache);
  if (childFamilies.length > 0 && parents.some((parent) =>
    intersects(childFamilies, collectSemanticFamilies(parent.id, registry, cache)),
  )) {
    return true;
  }

  for (let i = 0; i < parents.length; i++) {
    const leftFamilies = collectSemanticFamilies(parents[i]!.id, registry, cache);
    for (let j = i + 1; j < parents.length; j++) {
      const rightFamilies = collectSemanticFamilies(parents[j]!.id, registry, cache);
      if (intersects(leftFamilies, rightFamilies)) return true;
    }
  }

  return false;
}

export function semanticContainsDepthLimit(
  docId: string,
  registry: MemoryDefinitionRegistry,
  cache: Map<string, readonly string[]>,
): number {
  const familyIds = collectSemanticFamilies(docId, registry, cache);
  if (familyIds.length === 0) return 4;

  const matched = SEMANTIC_LINT_FAMILIES.filter((family) => familyIds.includes(family.id));
  return matched.reduce((max, family) => Math.max(max, family.containsDepthLimit), 4);
}
