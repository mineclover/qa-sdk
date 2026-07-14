// @def.boundary docs-control-plane
// @def.doc docs-control-plane

export type WorkTopicDiagnosticSeverity = 'error' | 'warning';

export interface WorkTopicBoundary {
  readonly read: readonly string[];
  readonly write: readonly string[];
  readonly forbidden: readonly string[];
}

export interface WorkTopic {
  readonly id: string;
  readonly ownerSystem: string;
  readonly goal: string;
  readonly topicKind?: string;
  readonly contracts: readonly string[];
  readonly sourceTargets: readonly string[];
  readonly proofSurface: readonly string[];
  readonly assimilationTarget: readonly string[];
  readonly boundaries: WorkTopicBoundary;
}

export interface WorkTopicDiagnostic {
  readonly code: string;
  readonly severity: WorkTopicDiagnosticSeverity;
  readonly message: string;
  readonly sourcePath: string;
  readonly pointer: string;
  readonly topicId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface WorkTopicDocumentMetadata {
  readonly topics: readonly WorkTopic[];
  readonly diagnostics: readonly WorkTopicDiagnostic[];
}

const WORK_TOPIC_BLOCK_RE = /```(?:yaml|yml)\s+work(?:[_-])topic[^\n]*\n([\s\S]*?)```/g;

export function extractWorkTopicDocumentMetadata(
  sourcePath: string,
  markdown: string,
): WorkTopicDocumentMetadata {
  const topics: WorkTopic[] = [];
  const diagnostics: WorkTopicDiagnostic[] = [];

  let blockIndex = 0;
  for (const match of markdown.matchAll(WORK_TOPIC_BLOCK_RE)) {
    blockIndex += 1;
    const pointer = `work-topic-block:${blockIndex}`;
    const rawYaml = match[1] ?? '';

    let parsedYaml: unknown;
    try {
      parsedYaml = parseWorkTopicYaml(rawYaml);
    } catch (error) {
      diagnostics.push(
        diagnostic({
          sourcePath,
          pointer,
          code: 'work-topic-yaml-parse-error',
          severity: 'error',
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      continue;
    }

    const normalized = normalizeTopicBlock(sourcePath, pointer, parsedYaml);
    topics.push(...normalized.topics);
    diagnostics.push(...normalized.diagnostics);
  }

  diagnostics.push(
    ...validateSingleWorkTopicDocument({
      sourcePath,
      topics,
    }),
  );

  return {
    topics,
    diagnostics,
  };
}

export function hasWorkTopicMetadata(metadata: WorkTopicDocumentMetadata): boolean {
  return metadata.topics.length > 0 || metadata.diagnostics.length > 0;
}

function normalizeTopicBlock(
  sourcePath: string,
  pointer: string,
  value: unknown,
): { readonly topics: readonly WorkTopic[]; readonly diagnostics: readonly WorkTopicDiagnostic[] } {
  if (!isRecord(value)) {
    return {
      topics: [],
      diagnostics: [
        diagnostic({
          sourcePath,
          pointer,
          code: 'work-topic-schema-error',
          severity: 'error',
          message: 'work-topic block must parse to an object root.',
        }),
      ],
    };
  }

  const rawTopics =
    value.work_topic !== undefined
      ? [value.work_topic]
      : Array.isArray(value.work_topics)
        ? value.work_topics
        : undefined;

  if (!rawTopics) {
    return {
      topics: [],
      diagnostics: [
        diagnostic({
          sourcePath,
          pointer,
          code: 'work-topic-missing-root',
          severity: 'error',
          message: 'work-topic block must define `work_topic:` or `work_topics:`.',
        }),
      ],
    };
  }

  const topics: WorkTopic[] = [];
  const diagnostics: WorkTopicDiagnostic[] = [];

  for (let index = 0; index < rawTopics.length; index += 1) {
    const rawTopic = rawTopics[index];
    const topicPointer = `${pointer}.topic:${index + 1}`;
    if (!isRecord(rawTopic)) {
      diagnostics.push(
        diagnostic({
          sourcePath,
          pointer: topicPointer,
          code: 'work-topic-schema-error',
          severity: 'error',
          message: 'work_topic entry must be an object.',
        }),
      );
      continue;
    }

    const id = stringField(rawTopic.id);
    const ownerSystem = stringField(rawTopic.owner_system);
    const goal = stringField(rawTopic.goal);
    const topicKind = stringField(rawTopic.topic_kind);
    const contracts = stringArrayField(rawTopic.contracts);
    const sourceTargets = stringArrayField(rawTopic.source_targets);
    const proofSurface = stringArrayField(rawTopic.proof_surface);
    const assimilationTarget = stringArrayField(rawTopic.assimilation_target);
    const boundaries = boundaryField(rawTopic.boundaries);

    if (!id) {
      diagnostics.push(
        diagnostic({
          sourcePath,
          pointer: topicPointer,
          code: 'work-topic-schema-error',
          severity: 'error',
          message: 'work_topic.id is required.',
        }),
      );
      continue;
    }
    if (!ownerSystem) {
      diagnostics.push(
        diagnostic({
          sourcePath,
          pointer: topicPointer,
          code: 'work-topic-schema-error',
          severity: 'error',
          message: `work_topic ${id} is missing owner_system.`,
          topicId: id,
        }),
      );
      continue;
    }
    if (!goal) {
      diagnostics.push(
        diagnostic({
          sourcePath,
          pointer: topicPointer,
          code: 'work-topic-schema-error',
          severity: 'error',
          message: `work_topic ${id} is missing goal.`,
          topicId: id,
        }),
      );
      continue;
    }

    topics.push({
      id,
      ownerSystem,
      goal,
      ...(topicKind ? { topicKind } : {}),
      contracts,
      sourceTargets,
      proofSurface,
      assimilationTarget,
      boundaries,
    });
  }

  return { topics, diagnostics };
}

function validateSingleWorkTopicDocument(input: {
  readonly sourcePath: string;
  readonly topics: readonly WorkTopic[];
}): readonly WorkTopicDiagnostic[] {
  const diagnostics: WorkTopicDiagnostic[] = [];
  const seen = new Set<string>();
  for (const topic of input.topics) {
    if (seen.has(topic.id)) {
      diagnostics.push(
        diagnostic({
          sourcePath: input.sourcePath,
          pointer: `work_topic:${topic.id}`,
          code: 'work-topic-duplicate-id',
          severity: 'error',
          message: `Duplicate work_topic id: ${topic.id}`,
          topicId: topic.id,
        }),
      );
      continue;
    }
    seen.add(topic.id);
  }
  return diagnostics;
}

function parseWorkTopicYaml(yaml: string): Record<string, unknown> {
  const lines = yaml
    .split(/\r?\n/)
    .map((line) => line.replace(/\r$/, ''))
    .filter((line) => line.trim().length > 0 && !line.trim().startsWith('#'))
    .map((line) => ({
      indent: line.length - line.trimStart().length,
      text: line.trim(),
    }));
  let index = 0;

  function parseObject(indent: number): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    while (index < lines.length) {
      const line = lines[index]!;
      if (line.indent < indent) break;
      if (line.indent > indent) break;
      if (line.text.startsWith('- ')) break;

      const parsed = parseKeyValue(line.text);
      if (!parsed) {
        index += 1;
        continue;
      }
      index += 1;
      if (parsed.value === '') {
        result[parsed.key] = parseNested(line.indent);
      } else {
        result[parsed.key] = parseScalarOrInlineArray(parsed.value);
      }
    }
    return result;
  }

  function parseNested(parentIndent: number): unknown {
    const next = lines[index];
    if (!next || next.indent <= parentIndent) return {};
    if (next.text.startsWith('- ')) return parseArray(next.indent);
    return parseObject(next.indent);
  }

  function parseArray(indent: number): unknown[] {
    const result: unknown[] = [];
    while (index < lines.length) {
      const line = lines[index]!;
      if (line.indent < indent) break;
      if (line.indent !== indent || !line.text.startsWith('- ')) break;

      const rest = line.text.slice(2).trim();
      index += 1;
      const parsed = looksLikePathReference(rest) ? null : parseKeyValue(rest);
      if (!parsed) {
        result.push(parseScalarOrInlineArray(rest));
        continue;
      }

      const item: Record<string, unknown> = {};
      item[parsed.key] =
        parsed.value === '' ? parseNested(line.indent) : parseScalarOrInlineArray(parsed.value);

      while (index < lines.length) {
        const next = lines[index]!;
        if (next.indent <= line.indent) break;
        if (next.indent !== line.indent + 2 || next.text.startsWith('- ')) break;

        const continuation = parseKeyValue(next.text);
        if (!continuation) {
          index += 1;
          continue;
        }
        index += 1;
        item[continuation.key] =
          continuation.value === ''
            ? parseNested(next.indent)
            : parseScalarOrInlineArray(continuation.value);
      }
      result.push(item);
    }
    return result;
  }

  return parseObject(0);
}

function parseKeyValue(text: string): { key: string; value: string } | null {
  const match = text.match(/^([^:]+):\s*(.*)$/);
  if (!match?.[1]) return null;
  return {
    key: match[1].trim(),
    value: match[2]?.trim() ?? '',
  };
}

function looksLikePathReference(value: string): boolean {
  return /^.+\.(?:c|cc|cpp|css|go|html|java|js|json|jsx|kt|md|py|rb|rs|ts|tsx|txt|yaml|yml)(?::|#).+/.test(
    value,
  );
}

function parseScalarOrInlineArray(value: string): unknown {
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((item) => parseScalar(item.trim()));
  }
  return parseScalar(value);
}

function parseScalar(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  const numberValue = Number(value);
  if (!Number.isNaN(numberValue) && value.trim() !== '') return numberValue;
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function stringArrayField(value: unknown): readonly string[] {
  if (typeof value === 'string' && value.trim().length > 0) return [value.trim()];
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
}

function boundaryField(value: unknown): WorkTopicBoundary {
  if (!isRecord(value)) {
    return {
      read: [],
      write: [],
      forbidden: [],
    };
  }
  return {
    read: stringArrayField(value.read),
    write: stringArrayField(value.write),
    forbidden: stringArrayField(value.forbidden),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function diagnostic(input: {
  readonly sourcePath: string;
  readonly pointer: string;
  readonly code: string;
  readonly severity: WorkTopicDiagnosticSeverity;
  readonly message: string;
  readonly topicId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}): WorkTopicDiagnostic {
  return {
    code: input.code,
    severity: input.severity,
    message: input.message,
    sourcePath: input.sourcePath,
    pointer: input.pointer,
    ...(input.topicId ? { topicId: input.topicId } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}
