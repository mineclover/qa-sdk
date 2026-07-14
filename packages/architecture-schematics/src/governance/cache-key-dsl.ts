export type CacheSegmentEncoding = 'raw' | 'hash' | 'slug';
export type CacheTtlPolicy = 'none' | 'short' | 'medium' | 'long';

export interface CacheKeySegment {
  readonly name: string;
  readonly pii?: boolean;
  readonly encoding?: CacheSegmentEncoding;
}

export interface CacheKeyDefinition {
  readonly id: string;
  readonly domain: string;
  readonly purpose: 'read_model' | 'idempotency' | 'lock' | 'projection' | 'lookup';
  readonly version: string;
  /** Stable one-dimensional namespace derived from the definition id. */
  readonly prefix: string;
  readonly segments: readonly CacheKeySegment[];
  readonly ttl: CacheTtlPolicy;
  readonly openmetadataEntity?: string;
}

export interface BuildCacheKeyInput {
  readonly definition: CacheKeyDefinition;
  readonly values: Readonly<Record<string, string | number>>;
}

export interface CacheKeyValidationIssue {
  readonly definitionId: string;
  readonly message: string;
}

export function buildCacheKey(input: BuildCacheKeyInput): string {
  const values = input.definition.segments.map((segment) => {
    const value = input.values[segment.name];
    if (value === undefined || value === '') {
      throw new Error(`Missing cache key segment "${segment.name}" for "${input.definition.id}".`);
    }
    return encodeSegment(String(value), segment.encoding ?? 'raw');
  });

  return [input.definition.prefix, input.definition.version, ...values].join(':');
}

export function validateCacheKeyDefinitions(
  definitions: readonly CacheKeyDefinition[],
): readonly CacheKeyValidationIssue[] {
  const issues: CacheKeyValidationIssue[] = [];
  const prefixes = new Map<string, string>();

  for (const definition of definitions) {
    const previous = prefixes.get(definition.prefix);
    if (previous) {
      issues.push({
        definitionId: definition.id,
        message: `Duplicate cache key prefix "${definition.prefix}" also used by "${previous}".`,
      });
    }
    prefixes.set(definition.prefix, definition.id);

    if (!/^[a-z][a-z0-9-]*$/.test(definition.id)) {
      issues.push({ definitionId: definition.id, message: 'Cache key id must be kebab-case.' });
    }
    if (!/^[a-z][a-z0-9-]*$/.test(definition.prefix)) {
      issues.push({ definitionId: definition.id, message: 'Cache key prefix must be kebab-case.' });
    }
    if (!/^v[0-9]+$/.test(definition.version)) {
      issues.push({ definitionId: definition.id, message: 'Cache key version must look like v1.' });
    }
    if (definition.ttl === 'none' && definition.purpose !== 'idempotency') {
      issues.push({
        definitionId: definition.id,
        message:
          'Cache key definitions must declare a TTL policy unless they are idempotency keys.',
      });
    }
    if (
      (definition.purpose === 'read_model' || definition.purpose === 'projection') &&
      !definition.openmetadataEntity
    ) {
      issues.push({
        definitionId: definition.id,
        message: 'Read model/projection cache keys must map to an OpenMetadata entity.',
      });
    }

    for (const segment of definition.segments) {
      if (!/^[a-z][a-zA-Z0-9]*$/.test(segment.name)) {
        issues.push({
          definitionId: definition.id,
          message: `Segment "${segment.name}" must be camelCase.`,
        });
      }
      if (segment.pii && segment.encoding !== 'hash') {
        issues.push({
          definitionId: definition.id,
          message: `PII segment "${segment.name}" must use hash encoding.`,
        });
      }
    }
  }

  return issues;
}

function encodeSegment(value: string, encoding: CacheSegmentEncoding): string {
  if (encoding === 'slug')
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  if (encoding === 'hash') return stableHash(value);
  return value;
}

function stableHash(value: string): string {
  let hash = 5381;
  for (const char of value) {
    hash = (hash * 33) ^ char.charCodeAt(0);
  }
  return `h${(hash >>> 0).toString(36)}`;
}
