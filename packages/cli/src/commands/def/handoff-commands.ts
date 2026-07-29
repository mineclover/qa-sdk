// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildBoundedDefinitionContext,
  createDefinitionTaskHandoff,
  executeDefinitionTaskDecompositionWithDiscovery,
  type DefinitionChildExecutionResult,
} from '../../lib/context-runtime/definition-document-context.js';
import { JsonTaskHandoffStore } from '../../lib/context-runtime/task-handoff-store.js';
import type { DiscoveryTaskDecomposition } from 'context-runtime';
import { parseCsvFlag, getRootDir } from './shared.js';

interface DefinitionDiscoveryResultsInput {
  readonly results: Map<string, DefinitionChildExecutionResult>;
  readonly unresolvedQuestions: readonly string[];
}

export async function cmdHandoff(rest: readonly string[], flags: Record<string, string>): Promise<void> {
  const storePath = rest[0] ?? flags['store'];
  const taskKey = rest[1] ?? flags['task-key'];
  if (!storePath || storePath === 'true' || !taskKey || taskKey === 'true') {
    console.log('Usage: qa-sdk def handoff <store-path> <task-key> [--json]');
    return;
  }

  const handoffs = await new JsonTaskHandoffStore(resolve(getRootDir(), storePath)).findByTaskKey(
    taskKey,
  );
  if (flags['json'] === 'true') {
    console.log(JSON.stringify(handoffs, null, 2));
    return;
  }

  console.log(`# Typed Handoff: ${taskKey}\n`);
  console.log(`records: ${handoffs.length}`);
  for (const handoff of handoffs) {
    console.log(`- result: ${handoff.resultRevision}`);
    console.log(`  source: ${handoff.sourceRevision}`);
    console.log(`  manifest: ${handoff.manifestDigest}`);
  }
}

export async function cmdHandoffAggregate(
  rest: readonly string[],
  flags: Record<string, string>,
): Promise<void> {
  const storePath = rest[0] ?? flags['store'];
  const decompositionPath = rest[1] ?? flags['decomposition'];
  const sourceRevision = flags['source-revision'];
  const resultRevision = flags['result-revision'];
  if (
    !storePath ||
    storePath === 'true' ||
    !decompositionPath ||
    decompositionPath === 'true' ||
    !sourceRevision ||
    sourceRevision === 'true' ||
    !resultRevision ||
    resultRevision === 'true'
  ) {
    console.log(
      'Usage: qa-sdk def handoff-aggregate <store-path> <decomposition.json> --source-revision <REV> --result-revision <REV> [--discovery-results <path>] [--unresolved-questions <csv>] [--json]',
    );
    return;
  }
  if (flags['unresolved-questions'] === 'true') {
    throw new Error('--unresolved-questions에는 csv 값이 필요합니다');
  }

  const nextTaskKey = flags['next-task-key'];
  const nextTaskObjective = flags['next-task-objective'];
  if (nextTaskKey === 'true' || nextTaskObjective === 'true') {
    throw new Error('--next-task-key와 --next-task-objective에는 값이 필요합니다');
  }
  if (Boolean(nextTaskKey) !== Boolean(nextTaskObjective)) {
    throw new Error('--next-task-key와 --next-task-objective는 함께 지정해야 합니다');
  }

  const decomposition = readDiscoveryDecomposition(decompositionPath);
  const store = new JsonTaskHandoffStore(resolve(getRootDir(), storePath));
  const discoveryInput = flags['discovery-results']
    ? readDefinitionDiscoveryResults(flags['discovery-results'])
    : { results: new Map<string, DefinitionChildExecutionResult>(), unresolvedQuestions: [] };
  const discoveryResults = discoveryInput.results;
  const decompositionTaskKeys = new Set(decomposition.children.map((child) => child.taskKey));
  for (const taskKey of discoveryResults.keys()) {
    if (!decompositionTaskKeys.has(taskKey)) {
      throw new Error(
        `discovery result가 decomposition에 없는 child Task를 가리킵니다: ${taskKey}`,
      );
    }
  }

  const execution = await executeDefinitionTaskDecompositionWithDiscovery({
    decomposition,
    executeChild: async (child) => {
      const discovery = discoveryResults.get(child.taskKey);
      if (discovery) return discovery;

      const history = await store.findByTaskKey(child.taskKey);
      if (history.length !== 1) {
        throw new Error(
          `child Task ${child.taskKey}는 정확히 하나의 Handoff가 필요합니다 (현재 ${history.length}건)`,
        );
      }
      return {
        taskKey: child.taskKey,
        kind: 'handoff',
        routeKeys: child.routeKeys,
        unresolvedQuestions: history[0]!.unresolvedQuestions,
        handoff: history[0]!,
      };
    },
    sourceRevision,
    resultRevision,
    unresolvedQuestions: [
      ...parseCsvFlag(flags['unresolved-questions']),
      ...discoveryInput.unresolvedQuestions,
    ],
    ...(nextTaskKey && nextTaskObjective
      ? { nextTask: { taskKey: nextTaskKey, objective: nextTaskObjective } }
      : {}),
  });
  if (!execution.handoff) {
    const failed = execution.execution.children.find((child) => child.status === 'failed');
    throw new Error(
      `parent Handoff를 만들 수 없습니다: ${failed?.error ?? execution.execution.status}`,
    );
  }

  const handoff = execution.handoff;
  await store.save(handoff);

  if (flags['json'] === 'true') {
    const output =
      execution.discoveryRefs.length > 0
        ? {
            handoff,
            discoveryRefs: execution.discoveryRefs,
            unresolvedQuestions: execution.unresolvedQuestions,
          }
        : handoff;
    console.log(JSON.stringify(output, null, 2));
    return;
  }
  console.log(`# Parent Typed Handoff: ${handoff.taskKey}\n`);
  console.log(`children: ${handoff.childTaskKeys?.length ?? 0}`);
  console.log(`discovery refs: ${execution.discoveryRefs.length}`);
  console.log(`result: ${handoff.resultRevision}`);
  console.log(`manifest: ${handoff.manifestDigest}`);
}

function readDiscoveryDecomposition(pathValue: string): DiscoveryTaskDecomposition {
  const path = resolve(getRootDir(), pathValue);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch (error) {
    throw new Error(`decomposition JSON을 읽을 수 없습니다: ${path}`, { cause: error });
  }

  const candidate =
    isRecord(parsed) && isRecord(parsed.discovery) ? parsed.discovery.decomposition : parsed;
  if (!isRecord(candidate) || !Array.isArray(candidate.children)) {
    throw new Error('decomposition JSON은 children 배열을 포함해야 합니다');
  }
  return candidate as unknown as DiscoveryTaskDecomposition;
}

function readDefinitionDiscoveryResults(pathValue: string): DefinitionDiscoveryResultsInput {
  if (pathValue === 'true') {
    throw new Error('--discovery-results에는 discovery result JSON 파일 경로가 필요합니다');
  }

  const path = resolve(getRootDir(), pathValue);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch (error) {
    throw new Error(`discovery result JSON을 읽을 수 없습니다: ${path}`, { cause: error });
  }

  const wrapperUnresolvedQuestions =
    isRecord(parsed) && parsed.unresolvedQuestions !== undefined ? parsed.unresolvedQuestions : [];
  if (!isStringArray(wrapperUnresolvedQuestions)) {
    throw new Error('discovery result JSON의 unresolvedQuestions는 문자열 배열이어야 합니다');
  }
  if (wrapperUnresolvedQuestions.some((question) => !question.trim())) {
    throw new Error('discovery result JSON의 unresolvedQuestions에는 빈 값이 있을 수 없습니다');
  }

  const values =
    isRecord(parsed) && Array.isArray(parsed.discoveryRefs) ? parsed.discoveryRefs : parsed;
  if (!Array.isArray(values)) {
    throw new Error('discovery result JSON은 배열 또는 discoveryRefs 배열을 포함해야 합니다');
  }

  const results = new Map<string, DefinitionChildExecutionResult>();
  for (const [index, value] of values.entries()) {
    if (!isRecord(value)) throw new Error(`discovery result[${index}]가 객체가 아닙니다`);
    const taskKey = value.taskKey;
    const routeKeys = value.routeKeys;
    const sourceRefs = value.sourceRefs ?? [];
    const unresolvedQuestions = value.unresolvedQuestions ?? [];
    if (typeof taskKey !== 'string' || taskKey.trim().length === 0) {
      throw new Error(`discovery result[${index}].taskKey가 필요합니다`);
    }
    if (!isStringArray(routeKeys)) {
      throw new Error(`discovery result[${index}].routeKeys는 문자열 배열이어야 합니다`);
    }
    if (!isStringArray(sourceRefs)) {
      throw new Error(`discovery result[${index}].sourceRefs는 문자열 배열이어야 합니다`);
    }
    if (!isStringArray(unresolvedQuestions)) {
      throw new Error(`discovery result[${index}].unresolvedQuestions는 문자열 배열이어야 합니다`);
    }
    if (results.has(taskKey)) {
      throw new Error(`discovery result에 중복된 taskKey가 있습니다: ${taskKey}`);
    }
    results.set(taskKey, {
      taskKey,
      kind: 'discovery',
      routeKeys,
      sourceRefs,
      unresolvedQuestions,
    });
  }
  return { results, unresolvedQuestions: [...new Set(wrapperUnresolvedQuestions)].sort() };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function persistDefinitionTaskHandoff(
  bounded: Awaited<ReturnType<typeof buildBoundedDefinitionContext>>,
  flags: Record<string, string>,
): Promise<{ handoff: ReturnType<typeof createDefinitionTaskHandoff>; path: string }> {
  const outputPath = flags['handoff-out'];
  if (!outputPath || outputPath === 'true') {
    throw new Error('--handoff-out에는 저장할 JSON 파일 경로가 필요합니다');
  }
  const resultRevision = flags['result-revision'];
  if (!resultRevision || resultRevision === 'true') {
    throw new Error('--handoff-out 사용 시 --result-revision이 필요합니다');
  }

  const sourceRevision = flags['source-revision'];
  if (sourceRevision === 'true') {
    throw new Error('--source-revision에는 revision 값이 필요합니다');
  }
  if (flags['unresolved-questions'] === 'true') {
    throw new Error('--unresolved-questions에는 csv 값이 필요합니다');
  }
  const nextTaskKey = flags['next-task-key'];
  const nextTaskObjective = flags['next-task-objective'];
  if (nextTaskKey === 'true' || nextTaskObjective === 'true') {
    throw new Error('--next-task-key와 --next-task-objective에는 값이 필요합니다');
  }
  if (Boolean(nextTaskKey) !== Boolean(nextTaskObjective)) {
    throw new Error('--next-task-key와 --next-task-objective는 함께 지정해야 합니다');
  }

  const handoff = createDefinitionTaskHandoff({
    boundedContext: bounded,
    resultRevision,
    ...(sourceRevision ? { sourceRevision } : {}),
    unresolvedQuestions: parseCsvFlag(flags['unresolved-questions']),
    ...(nextTaskKey && nextTaskObjective
      ? { nextTask: { taskKey: nextTaskKey, objective: nextTaskObjective } }
      : {}),
  });
  const path = resolve(getRootDir(), outputPath);
  await new JsonTaskHandoffStore(path).save(handoff);
  return { handoff, path };
}
