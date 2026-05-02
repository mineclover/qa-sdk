import type { InstanceStore } from "./instance-store.js";
import type { Condition, FlowPolicy, FlowInstance, GateSelection } from "./types.js";

export type PatternContextValue = string | number | boolean | null;

export interface PatternGateSelection {
  readonly gateId: string;
  readonly branchId: string;
}

export interface PatternDetectionOptions {
  readonly contextKeys?: readonly string[];
  readonly minFrequency?: number;
}

export interface DetectedPattern {
  readonly schemaId: string;
  readonly contextKey: string;
  readonly contextValue: PatternContextValue;
  readonly gatePath: readonly PatternGateSelection[];
  readonly frequency: number;
  readonly averageConfidence: number;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly histogram: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

export type PolicyCandidateStatus =
  | "candidate"
  | "approved"
  | "rejected"
  | "modified";

export interface PolicyCandidate extends FlowPolicy {
  readonly status: PolicyCandidateStatus;
  readonly reviewReason?: string;
  readonly reviewedAt?: string;
}

export interface PolicyCandidateThreshold {
  readonly minFrequency?: number;
  readonly minAverageConfidence?: number;
  readonly existingPolicies?: readonly FlowPolicy[];
  readonly priority?: number;
}

export interface PolicyCandidateChanges {
  readonly name?: string;
  readonly priority?: number;
  readonly conditions?: readonly Condition[];
  readonly action?: Partial<FlowPolicy["action"]>;
  readonly rationale?: string;
}

export interface PolicyRegistrar {
  registerPolicy(policy: FlowPolicy): void;
}

export interface PolicyCandidateWorkflowOptions {
  readonly engine?: PolicyRegistrar;
  readonly existingPolicies?: readonly FlowPolicy[];
}

interface PatternContextEntry {
  readonly key: string;
  readonly value: PatternContextValue;
}

interface MutablePatternBucket {
  readonly schemaId: string;
  readonly contextKey: string;
  readonly contextValue: PatternContextValue;
  readonly gatePath: readonly PatternGateSelection[];
  frequency: number;
  totalConfidence: number;
  firstSeenAt: string;
  lastSeenAt: string;
  readonly histogram: Map<string, Map<string, number>>;
}

const DEFAULT_MIN_FREQUENCY = 5;
const DEFAULT_MIN_AVERAGE_CONFIDENCE = 0.8;
const DEFAULT_POLICY_PRIORITY = 50;

/**
 * 인간 승인 기반 policy candidate 라이프사이클을 관리한다.
 */
export class PolicyCandidateWorkflow {
  private readonly engine?: PolicyRegistrar;
  private readonly candidates = new Map<string, PolicyCandidate>();
  private readonly rejectedSignatures = new Set<string>();
  private readonly registeredPolicies: FlowPolicy[];

  constructor(options: PolicyCandidateWorkflowOptions = {}) {
    this.engine = options.engine;
    this.registeredPolicies = options.existingPolicies
      ? options.existingPolicies.map((policy) => clonePolicy(policy))
      : [];
  }

  proposeCandidates(
    patterns: readonly DetectedPattern[],
    threshold: number | PolicyCandidateThreshold = {},
  ): PolicyCandidate[] {
    const thresholdOptions = typeof threshold === "number"
      ? { minFrequency: threshold }
      : threshold;
    const candidates = generatePolicyCandidates(patterns, {
      ...thresholdOptions,
      existingPolicies: [
        ...(thresholdOptions.existingPolicies ?? []),
        ...this.registeredPolicies,
      ],
    });
    const proposed: PolicyCandidate[] = [];

    for (const candidate of candidates) {
      const signature = buildPolicySignature(candidate);
      if (this.rejectedSignatures.has(signature)) {
        continue;
      }

      const existing = this.candidates.get(candidate.id);
      if (existing) {
        if (existing.status === "candidate") {
          proposed.push(cloneCandidate(existing));
        }
        continue;
      }

      const cloned = cloneCandidate(candidate);
      this.candidates.set(cloned.id, cloned);
      proposed.push(cloneCandidate(cloned));
    }

    return proposed;
  }

  listCandidates(status?: PolicyCandidateStatus): PolicyCandidate[] {
    return [...this.candidates.values()]
      .filter((candidate) => status === undefined || candidate.status === status)
      .toSorted((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
      .map((candidate) => cloneCandidate(candidate));
  }

  getCandidate(id: string): PolicyCandidate | undefined {
    const candidate = this.candidates.get(id);
    return candidate ? cloneCandidate(candidate) : undefined;
  }

  approveCandidate(id: string): FlowPolicy {
    const candidate = this.requireCandidate(id, ["candidate"]);
    const approvedCandidate: PolicyCandidate = {
      ...candidate,
      status: "approved",
      reviewedAt: new Date().toISOString(),
      reviewReason: undefined,
    };
    this.candidates.set(id, approvedCandidate);

    const policy = toFlowPolicy(approvedCandidate);
    this.registerPolicy(policy);
    return clonePolicy(policy);
  }

  rejectCandidate(id: string, reason: string): PolicyCandidate {
    const candidate = this.requireCandidate(id, ["candidate"]);
    const rejectedCandidate: PolicyCandidate = {
      ...candidate,
      status: "rejected",
      reviewReason: reason,
      reviewedAt: new Date().toISOString(),
    };

    this.candidates.set(id, rejectedCandidate);
    this.rejectedSignatures.add(buildPolicySignature(rejectedCandidate));
    return cloneCandidate(rejectedCandidate);
  }

  modifyCandidate(
    id: string,
    changes: PolicyCandidateChanges,
  ): FlowPolicy {
    const candidate = this.requireCandidate(id, ["candidate"]);
    const modifiedCandidate: PolicyCandidate = {
      ...applyCandidateChanges(candidate, changes),
      status: "modified",
      reviewedAt: new Date().toISOString(),
      reviewReason: undefined,
    };

    this.candidates.set(id, modifiedCandidate);

    const policy = toFlowPolicy(modifiedCandidate);
    this.registerPolicy(policy);
    return clonePolicy(policy);
  }

  private requireCandidate(
    id: string,
    allowedStatuses: readonly PolicyCandidateStatus[],
  ): PolicyCandidate {
    const candidate = this.candidates.get(id);
    if (!candidate) {
      throw new Error(`정책 후보를 찾을 수 없다: "${id}"`);
    }
    if (!allowedStatuses.includes(candidate.status)) {
      throw new Error(`정책 후보 상태가 유효하지 않다: "${candidate.status}"`);
    }
    return candidate;
  }

  private registerPolicy(policy: FlowPolicy): void {
    this.registeredPolicies.push(clonePolicy(policy));
    this.engine?.registerPolicy(policy);
  }
}

/**
 * 저장된 인스턴스 이력에서 반복 결정 패턴을 감지한다.
 *
 * 동일한 context key/value 조합이 동일한 gate 선택 경로로
 * 최소 N회 이상 반복될 때 하나의 패턴으로 간주한다.
 */
export function detectPatterns(
  store: InstanceStore,
  schemaId: string,
  options: PatternDetectionOptions = {},
): DetectedPattern[] {
  const minFrequency = normalizeMinFrequency(options.minFrequency);
  const instances = store.findBySchema(schemaId)
    .filter((instance) => instance.status === "completed");
  const buckets = new Map<string, MutablePatternBucket>();

  for (const instance of instances) {
    if (instance.selections.length === 0) {
      continue;
    }

    const gatePath = buildGatePath(instance.selections);
    const pathKey = buildPathKey(gatePath);
    const occurrenceConfidence = calcAverageConfidence(instance.selections);
    const occurredAt = resolveOccurrenceTimestamp(instance);
    const contextEntries = collectPatternContextEntries(instance.context, options.contextKeys);

    for (const entry of contextEntries) {
      const bucketKey = `${entry.key}\u0000${serializeContextValue(entry.value)}\u0000${pathKey}`;
      const bucket = buckets.get(bucketKey) ?? createPatternBucket(
        schemaId,
        entry,
        gatePath,
        occurredAt,
      );

      bucket.frequency += 1;
      bucket.totalConfidence += occurrenceConfidence;
      if (compareTimestamps(occurredAt, bucket.firstSeenAt) < 0) {
        bucket.firstSeenAt = occurredAt;
      }
      if (compareTimestamps(occurredAt, bucket.lastSeenAt) > 0) {
        bucket.lastSeenAt = occurredAt;
      }
      accumulateHistogram(bucket.histogram, instance.selections);

      buckets.set(bucketKey, bucket);
    }
  }

  return [...buckets.values()]
    .filter((bucket) => bucket.frequency >= minFrequency)
    .map((bucket) => ({
      schemaId: bucket.schemaId,
      contextKey: bucket.contextKey,
      contextValue: bucket.contextValue,
      gatePath: bucket.gatePath.map((selection) => ({ ...selection })),
      frequency: bucket.frequency,
      averageConfidence: bucket.totalConfidence / bucket.frequency,
      firstSeenAt: bucket.firstSeenAt,
      lastSeenAt: bucket.lastSeenAt,
      histogram: histogramToRecord(bucket.histogram),
    }))
    .toSorted((a, b) =>
      b.frequency - a.frequency
      || compareTimestamps(b.lastSeenAt, a.lastSeenAt)
      || a.contextKey.localeCompare(b.contextKey)
      || String(a.contextValue).localeCompare(String(b.contextValue)),
    );
}

/**
 * 감지된 패턴에서 자동 적용 가능한 FlowPolicy 후보를 생성한다.
 *
 * 패턴의 마지막 gate 선택은 action으로 변환하고,
 * 그 이전 gate 선택과 컨텍스트 key/value는 조건으로 승격한다.
 * 이미 동일 조건/액션을 가진 정책이 등록되어 있으면 후보 생성에서 제외한다.
 */
export function generatePolicyCandidates(
  patterns: readonly DetectedPattern[],
  threshold: number | PolicyCandidateThreshold = {},
): PolicyCandidate[] {
  const normalized = normalizeCandidateThreshold(threshold);

  return patterns
    .filter((pattern) =>
      pattern.frequency >= normalized.minFrequency
      && pattern.averageConfidence >= normalized.minAverageConfidence
      && pattern.gatePath.length > 0,
    )
    .map((pattern) => createPolicyCandidate(pattern, normalized.priority))
    .filter((candidate) => !isDuplicatePolicy(candidate, normalized.existingPolicies))
    .toSorted((a, b) =>
      b.priority - a.priority
      || a.flowId.localeCompare(b.flowId)
      || a.id.localeCompare(b.id),
    );
}

function normalizeMinFrequency(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_MIN_FREQUENCY;
  }
  if (!Number.isFinite(value)) {
    return DEFAULT_MIN_FREQUENCY;
  }
  return Math.max(1, Math.floor(value));
}

function normalizeCandidateThreshold(
  threshold: number | PolicyCandidateThreshold,
): Required<PolicyCandidateThreshold> {
  if (typeof threshold === "number") {
    return {
      minFrequency: normalizeMinFrequency(threshold),
      minAverageConfidence: DEFAULT_MIN_AVERAGE_CONFIDENCE,
      existingPolicies: [],
      priority: DEFAULT_POLICY_PRIORITY,
    };
  }

  return {
    minFrequency: normalizeMinFrequency(threshold.minFrequency),
    minAverageConfidence: normalizeAverageConfidence(threshold.minAverageConfidence),
    existingPolicies: threshold.existingPolicies ? [...threshold.existingPolicies] : [],
    priority: normalizePriority(threshold.priority),
  };
}

function normalizeAverageConfidence(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_MIN_AVERAGE_CONFIDENCE;
  }

  return Math.min(1, Math.max(0, value));
}

function normalizePriority(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_POLICY_PRIORITY;
  }

  return Math.max(0, Math.floor(value));
}

function collectPatternContextEntries(
  context: Record<string, unknown>,
  contextKeys: readonly string[] | undefined,
): PatternContextEntry[] {
  if (contextKeys && contextKeys.length > 0) {
    const seen = new Set<string>();
    const entries: PatternContextEntry[] = [];

    for (const key of contextKeys) {
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      const value = resolveContextValue(context, key);
      if (isPatternContextValue(value)) {
        entries.push({ key, value });
      }
    }

    return entries;
  }

  return flattenContextEntries(context);
}

function flattenContextEntries(
  value: unknown,
  prefix = "",
): PatternContextEntry[] {
  if (isPatternContextValue(value)) {
    return prefix ? [{ key: prefix, value }] : [];
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    return flattenContextEntries(entry, nextPrefix);
  });
}

function resolveContextValue(
  context: Record<string, unknown>,
  key: string,
): unknown {
  return key.split(".").reduce<unknown>((current, segment) => {
    if (current === null || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, context);
}

function buildGatePath(
  selections: readonly GateSelection[],
): readonly PatternGateSelection[] {
  return selections.map((selection) => ({
    gateId: selection.gateId,
    branchId: selection.branchId,
  }));
}

function buildPathKey(
  gatePath: readonly PatternGateSelection[],
): string {
  return gatePath
    .map((selection) => `${selection.gateId}=${selection.branchId}`)
    .join("|");
}

function createPatternBucket(
  schemaId: string,
  entry: PatternContextEntry,
  gatePath: readonly PatternGateSelection[],
  occurredAt: string,
): MutablePatternBucket {
  return {
    schemaId,
    contextKey: entry.key,
    contextValue: entry.value,
    gatePath,
    frequency: 0,
    totalConfidence: 0,
    firstSeenAt: occurredAt,
    lastSeenAt: occurredAt,
    histogram: new Map(),
  };
}

function createPolicyCandidate(
  pattern: DetectedPattern,
  priority: number,
): PolicyCandidate {
  const actionSelection = pattern.gatePath[pattern.gatePath.length - 1];
  const conditions = buildPolicyConditions(pattern);
  const candidateKey = [
    pattern.schemaId,
    pattern.contextKey,
    serializeContextValue(pattern.contextValue),
    buildPathKey(pattern.gatePath),
  ].join("|");

  return {
    id: `candidate-${toIdentifierPart(candidateKey)}`,
    name: `${pattern.schemaId} 자동 정책 후보`,
    flowId: pattern.schemaId,
    priority,
    conditions,
    action: {
      gateId: actionSelection.gateId,
      branchId: actionSelection.branchId,
      confidence: pattern.averageConfidence,
    },
    rationale: `${pattern.frequency}회 반복, 평균 confidence ${pattern.averageConfidence.toFixed(2)}`,
    status: "candidate",
  };
}

function applyCandidateChanges(
  candidate: PolicyCandidate,
  changes: PolicyCandidateChanges,
): PolicyCandidate {
  return {
    ...candidate,
    name: changes.name ?? candidate.name,
    priority: changes.priority ?? candidate.priority,
    conditions: changes.conditions ? [...changes.conditions] : [...candidate.conditions],
    action: {
      ...candidate.action,
      ...changes.action,
    },
    rationale: changes.rationale ?? candidate.rationale,
  };
}

function buildPolicyConditions(
  pattern: DetectedPattern,
): readonly Condition[] {
  const contextCondition: Condition = {
    field: `context.${pattern.contextKey}`,
    op: "eq",
    value: pattern.contextValue,
  };
  const gateConditions = pattern.gatePath.slice(0, -1).map<Condition>((selection) => ({
    field: `gate.${selection.gateId}.branch`,
    op: "eq",
    value: selection.branchId,
  }));

  return [contextCondition, ...gateConditions];
}

function isDuplicatePolicy(
  candidate: PolicyCandidate,
  existingPolicies: readonly FlowPolicy[],
): boolean {
  const candidateSignature = buildPolicySignature(candidate);
  return existingPolicies.some((policy) => buildPolicySignature(policy) === candidateSignature);
}

function buildPolicySignature(policy: FlowPolicy): string {
  const serializedConditions = [...policy.conditions]
    .map((condition) => serializeCondition(condition))
    .toSorted()
    .join("|");

  return [
    policy.flowId,
    policy.action.gateId,
    policy.action.branchId,
    serializedConditions,
  ].join("\u0000");
}

function toFlowPolicy(candidate: PolicyCandidate): FlowPolicy {
  return {
    id: candidate.id,
    name: candidate.name,
    flowId: candidate.flowId,
    priority: candidate.priority,
    conditions: [...candidate.conditions],
    action: { ...candidate.action },
    rationale: candidate.rationale,
  };
}

function cloneCandidate(candidate: PolicyCandidate): PolicyCandidate {
  return {
    ...candidate,
    conditions: [...candidate.conditions],
    action: { ...candidate.action },
  };
}

function clonePolicy(policy: FlowPolicy): FlowPolicy {
  return {
    ...policy,
    conditions: [...policy.conditions],
    action: { ...policy.action },
  };
}

function serializeCondition(condition: Condition): string {
  return [
    condition.field,
    condition.op,
    serializeUnknown(condition.value),
  ].join("\u0000");
}

function serializeUnknown(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  if (typeof value === "string") {
    return `string:${value}`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return `${typeof value}:${String(value)}`;
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => serializeUnknown(entry)).join(",")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .toSorted(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${key}:${serializeUnknown(entry)}`)
      .join(",")}}`;
  }

  return String(value);
}

function calcAverageConfidence(
  selections: readonly GateSelection[],
): number {
  if (selections.length === 0) {
    return 0;
  }

  const total = selections.reduce((sum, selection) => sum + selection.confidence, 0);
  return total / selections.length;
}

function resolveOccurrenceTimestamp(instance: FlowInstance): string {
  if (instance.completedAt) {
    return instance.completedAt;
  }
  const lastSelection = instance.selections[instance.selections.length - 1];
  return lastSelection?.timestamp ?? instance.startedAt;
}

function accumulateHistogram(
  histogram: Map<string, Map<string, number>>,
  selections: readonly GateSelection[],
): void {
  for (const selection of selections) {
    const gateHistogram = histogram.get(selection.gateId) ?? new Map<string, number>();
    gateHistogram.set(
      selection.branchId,
      (gateHistogram.get(selection.branchId) ?? 0) + 1,
    );
    histogram.set(selection.gateId, gateHistogram);
  }
}

function histogramToRecord(
  histogram: Map<string, Map<string, number>>,
): Readonly<Record<string, Readonly<Record<string, number>>>> {
  return Object.fromEntries(
    [...histogram.entries()].map(([gateId, branches]) => [
      gateId,
      Object.fromEntries([...branches.entries()].toSorted(([a], [b]) => a.localeCompare(b))),
    ]),
  );
}

function serializeContextValue(value: PatternContextValue): string {
  if (value === null) {
    return "null";
  }
  return `${typeof value}:${String(value)}`;
}

function toIdentifierPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function isPatternContextValue(value: unknown): value is PatternContextValue {
  return value === null
    || typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean";
}

function compareTimestamps(a: string, b: string): number {
  return new Date(a).getTime() - new Date(b).getTime();
}

// ─── 패턴 분류 (Pattern Classification) ──────────────────

/**
 * 결정 경로 패턴의 분류.
 *
 * routine:      고빈도 + 고confidence. 자동화 후보. "항상 이렇게 결정한다"
 * exploratory:  저빈도 + 다양한 경로. 탐색 중. "아직 최적 경로를 찾는 중"
 * escalation:   confidence가 낮거나 하락 중. 주의 필요. "확신 없이 결정하고 있다"
 * anomaly:      기존 패턴에서 벗어남. 새 경로 또는 비정상. "이전과 다르게 결정했다"
 */
export type PatternClass = "routine" | "exploratory" | "escalation" | "anomaly";

/** 분류된 패턴 */
export interface ClassifiedPattern {
  readonly pattern: DetectedPattern;
  readonly classification: PatternClass;
  readonly reason: string;
  /** 자동 정책 후보 적합도 (0-1). routine이 가장 높음 */
  readonly policyFitness: number;
}

/**
 * 감지된 패턴을 자동 분류한다.
 *
 * 분류 기준:
 * - routine:      frequency ≥ 5 AND confidence ≥ 0.7
 * - escalation:   confidence < 0.5
 * - anomaly:      frequency = 1 (한 번만 발생)
 * - exploratory:  그 외 (빈도 낮거나 confidence 중간)
 */
export function classifyPattern(pattern: DetectedPattern): ClassifiedPattern {
  const { frequency, averageConfidence } = pattern;

  if (frequency === 1) {
    return {
      pattern,
      classification: "anomaly",
      reason: `1회만 발생 — 기존 패턴에서 벗어난 새 경로`,
      policyFitness: 0,
    };
  }

  if (averageConfidence < 0.5) {
    return {
      pattern,
      classification: "escalation",
      reason: `평균 confidence ${averageConfidence.toFixed(2)} — 확신 없이 결정하고 있다`,
      policyFitness: 0.1,
    };
  }

  if (frequency >= 5 && averageConfidence >= 0.7) {
    return {
      pattern,
      classification: "routine",
      reason: `${frequency}회 반복, confidence ${averageConfidence.toFixed(2)} — 자동 정책 후보`,
      policyFitness: Math.min(1, (frequency / 10) * averageConfidence),
    };
  }

  return {
    pattern,
    classification: "exploratory",
    reason: `${frequency}회, confidence ${averageConfidence.toFixed(2)} — 아직 패턴 확립 중`,
    policyFitness: 0.3,
  };
}

/**
 * 여러 패턴을 한 번에 분류한다.
 */
export function classifyPatterns(patterns: readonly DetectedPattern[]): readonly ClassifiedPattern[] {
  return patterns.map(classifyPattern);
}
