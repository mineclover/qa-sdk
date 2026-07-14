import { parse as parseTaxonomy } from 'taxonomy-engine';
import type { TaxonomyVocabulary } from './types.js';

export function parseProfileTaxonomy(yamlText: string): TaxonomyVocabulary {
  const result = parseTaxonomy(yamlText);
  if ('error' in result) {
    throw new Error(`Failed to parse profile taxonomy: ${result.error.message}`);
  }

  const axes = new Map<string, ReadonlySet<string>>();
  for (const [axisName, axis] of result.ir.axes) {
    axes.set(axisName, new Set(axis.entries.map((entry) => entry.id)));
  }

  return {
    taxonomy: result.ir.taxonomy,
    version: result.ir.version,
    axes,
  };
}

export function hasTaxonomyEntry(
  taxonomy: TaxonomyVocabulary | undefined,
  axisName: string,
  entryId: string,
): boolean {
  if (!taxonomy) return true;
  return taxonomy.axes.get(axisName)?.has(entryId) ?? false;
}
