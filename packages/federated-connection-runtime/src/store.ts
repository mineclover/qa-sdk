// @def.doc federated-connection-runtime

import { getDatabaseSync, type DatabaseSyncInstance } from 'index-meta';
import {
  ConnectionRegistry,
  mappingKey,
  relationKey,
  sourceIdentityKey,
  sourceRefKey,
  type ConnectionMapping,
  type ConnectionRef,
  type ConnectionSnapshot,
  type SourceRef,
  type TypedRelation,
} from 'federated-connection';
import type {
  ConnectionAuditEvent,
  ConnectionStateStore,
  ImpactPlan,
  PlanExecution,
  PlanStatus,
  SourceIdentityLookup,
  StoredSourceObservation,
} from './runtime-contract.js';

function clone<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function sameSourceIdentity(left: SourceRef, right: SourceIdentityLookup): boolean {
  return (
    left.sourceSystem === right.sourceSystem &&
    left.entityType === right.entityType &&
    left.localId === right.localId
  );
}

export class InMemoryConnectionStateStore implements ConnectionStateStore {
  private readonly registry = new ConnectionRegistry();
  private readonly observations = new Map<string, StoredSourceObservation>();
  private readonly plans = new Map<string, ImpactPlan>();
  private readonly executions = new Map<string, PlanExecution>();
  private readonly auditEvents: ConnectionAuditEvent[] = [];

  registerMapping(mapping: ConnectionMapping): void {
    this.registry.registerMapping(mapping);
  }

  registerRelation(relation: TypedRelation): void {
    this.registry.registerRelation(relation);
  }

  getMapping(source: SourceRef, target: ConnectionRef): ConnectionMapping | undefined {
    return clone(this.registry.getMapping(source, target));
  }

  mappingsForSource(source: SourceRef, status?: ConnectionMapping['status']): ConnectionMapping[] {
    return clone(this.registry.mappingsForSource(source, status));
  }

  resolve(source: SourceRef): ReturnType<ConnectionRegistry['resolve']> {
    return clone(this.registry.resolve(source));
  }

  snapshot(): ConnectionSnapshot {
    return clone(this.registry.snapshot());
  }

  recordObservation(observation: StoredSourceObservation): void {
    this.observations.set(observation.runId, clone(observation));
  }

  latestObservation(source: SourceIdentityLookup): StoredSourceObservation | null {
    const candidates = [...this.observations.values()]
      .filter((observation) => sameSourceIdentity(observation.source, source))
      .sort((left, right) =>
        `${right.observedAt}:${right.recordedAt}`.localeCompare(
          `${left.observedAt}:${left.recordedAt}`,
        ),
      );
    return candidates[0] ? clone(candidates[0]) : null;
  }

  savePlan(plan: ImpactPlan): void {
    this.plans.set(plan.id, clone(plan));
  }

  getPlan(planId: string): ImpactPlan | null {
    const plan = this.plans.get(planId);
    return plan ? clone(plan) : null;
  }

  listPlans(status?: PlanStatus): ImpactPlan[] {
    return [...this.plans.values()]
      .filter((plan) => status === undefined || plan.status === status)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(clone);
  }

  recordExecution(execution: PlanExecution): void {
    this.executions.set(execution.planId, clone(execution));
  }

  getExecution(planId: string): PlanExecution | null {
    const execution = this.executions.get(planId);
    return execution ? clone(execution) : null;
  }

  recordAudit(event: ConnectionAuditEvent): void {
    this.auditEvents.push(clone(event));
  }

  listAudit(planId?: string): ConnectionAuditEvent[] {
    return this.auditEvents
      .filter((event) => planId === undefined || event.planId === planId)
      .map(clone);
  }

  close(): void {
    // In-memory stores have no external resources.
  }
}

const DDL = `
CREATE TABLE IF NOT EXISTS federated_connection_mappings (
  mapping_key TEXT PRIMARY KEY,
  mapping_id TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS federated_connection_relations (
  relation_key TEXT PRIMARY KEY,
  relation_id TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS federated_connection_observations (
  run_id TEXT PRIMARY KEY,
  source_system TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  local_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fc_observation_identity
  ON federated_connection_observations(source_system, entity_type, local_id, observed_at);
CREATE TABLE IF NOT EXISTS federated_connection_plans (
  plan_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  source_system TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  local_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fc_plan_status ON federated_connection_plans(status, updated_at);
CREATE TABLE IF NOT EXISTS federated_connection_executions (
  plan_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS federated_connection_audit (
  event_id TEXT PRIMARY KEY,
  plan_id TEXT,
  occurred_at TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fc_audit_plan ON federated_connection_audit(plan_id, occurred_at);
`;

type JsonRow = { payload: string };
type PlanRow = JsonRow & { plan_id: string };

export class SqliteConnectionStateStore implements ConnectionStateStore {
  private readonly rawDb: DatabaseSyncInstance;
  private readonly registry = new ConnectionRegistry();

  constructor(path = ':memory:') {
    const DatabaseSync = getDatabaseSync();
    this.rawDb = new DatabaseSync(path);
    this.rawDb.exec('PRAGMA journal_mode = WAL');
    this.rawDb.exec('PRAGMA busy_timeout = 3000');
    this.rawDb.exec(DDL);
    this.loadRegistry();
  }

  registerMapping(mapping: ConnectionMapping): void {
    this.registry.registerMapping(mapping);
    this.rawDb
      .prepare(
        `INSERT INTO federated_connection_mappings(mapping_key, mapping_id, payload)
         VALUES (?, ?, ?)
         ON CONFLICT(mapping_key) DO UPDATE SET mapping_id = excluded.mapping_id, payload = excluded.payload`,
      )
      .run(mappingKey(mapping), mapping.id, JSON.stringify(mapping));
  }

  registerRelation(relation: TypedRelation): void {
    this.registry.registerRelation(relation);
    this.rawDb
      .prepare(
        `INSERT INTO federated_connection_relations(relation_key, relation_id, payload)
         VALUES (?, ?, ?)
         ON CONFLICT(relation_key) DO UPDATE SET relation_id = excluded.relation_id, payload = excluded.payload`,
      )
      .run(relationKey(relation), relation.id, JSON.stringify(relation));
  }

  getMapping(source: SourceRef, target: ConnectionRef): ConnectionMapping | undefined {
    return this.registry.getMapping(source, target);
  }

  mappingsForSource(source: SourceRef, status?: ConnectionMapping['status']): ConnectionMapping[] {
    return this.registry.mappingsForSource(source, status);
  }

  resolve(source: SourceRef): ReturnType<ConnectionRegistry['resolve']> {
    return this.registry.resolve(source);
  }

  snapshot(): ConnectionSnapshot {
    return this.registry.snapshot();
  }

  recordObservation(observation: StoredSourceObservation): void {
    this.rawDb
      .prepare(
        `INSERT INTO federated_connection_observations
          (run_id, source_system, entity_type, local_id, revision, observed_at, recorded_at, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(run_id) DO UPDATE SET
          source_system = excluded.source_system,
          entity_type = excluded.entity_type,
          local_id = excluded.local_id,
          revision = excluded.revision,
          observed_at = excluded.observed_at,
          recorded_at = excluded.recorded_at,
          payload = excluded.payload`,
      )
      .run(
        observation.runId,
        observation.source.sourceSystem,
        observation.source.entityType,
        observation.source.localId,
        observation.source.revision,
        observation.observedAt,
        observation.recordedAt,
        JSON.stringify(observation),
      );
  }

  latestObservation(source: SourceIdentityLookup): StoredSourceObservation | null {
    const row = this.rawDb
      .prepare(
        `SELECT payload FROM federated_connection_observations
         WHERE source_system = ? AND entity_type = ? AND local_id = ?
         ORDER BY observed_at DESC, recorded_at DESC LIMIT 1`,
      )
      .get(source.sourceSystem, source.entityType, source.localId) as JsonRow | undefined;
    return row ? (JSON.parse(row.payload) as StoredSourceObservation) : null;
  }

  savePlan(plan: ImpactPlan): void {
    this.rawDb
      .prepare(
        `INSERT INTO federated_connection_plans
          (plan_id, status, source_system, entity_type, local_id, revision, updated_at, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(plan_id) DO UPDATE SET
          status = excluded.status,
          source_system = excluded.source_system,
          entity_type = excluded.entity_type,
          local_id = excluded.local_id,
          revision = excluded.revision,
          updated_at = excluded.updated_at,
          payload = excluded.payload`,
      )
      .run(
        plan.id,
        plan.status,
        plan.source.sourceSystem,
        plan.source.entityType,
        plan.source.localId,
        plan.source.revision,
        plan.updatedAt,
        JSON.stringify(plan),
      );
  }

  getPlan(planId: string): ImpactPlan | null {
    const row = this.rawDb
      .prepare('SELECT payload FROM federated_connection_plans WHERE plan_id = ?')
      .get(planId) as JsonRow | undefined;
    return row ? (JSON.parse(row.payload) as ImpactPlan) : null;
  }

  listPlans(status?: PlanStatus): ImpactPlan[] {
    const rows = status
      ? (this.rawDb
          .prepare(
            'SELECT plan_id, payload FROM federated_connection_plans WHERE status = ? ORDER BY updated_at DESC',
          )
          .all(status) as PlanRow[])
      : (this.rawDb
          .prepare(
            'SELECT plan_id, payload FROM federated_connection_plans ORDER BY updated_at DESC',
          )
          .all() as PlanRow[]);
    return rows.map((row) => JSON.parse(row.payload) as ImpactPlan);
  }

  recordExecution(execution: PlanExecution): void {
    this.rawDb
      .prepare(
        `INSERT INTO federated_connection_executions(plan_id, status, completed_at, payload)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(plan_id) DO UPDATE SET
          status = excluded.status,
          completed_at = excluded.completed_at,
          payload = excluded.payload`,
      )
      .run(execution.planId, execution.status, execution.completedAt, JSON.stringify(execution));
  }

  getExecution(planId: string): PlanExecution | null {
    const row = this.rawDb
      .prepare('SELECT payload FROM federated_connection_executions WHERE plan_id = ?')
      .get(planId) as JsonRow | undefined;
    return row ? (JSON.parse(row.payload) as PlanExecution) : null;
  }

  recordAudit(event: ConnectionAuditEvent): void {
    this.rawDb
      .prepare(
        `INSERT INTO federated_connection_audit(event_id, plan_id, occurred_at, kind, payload)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(event_id) DO UPDATE SET
          plan_id = excluded.plan_id,
          occurred_at = excluded.occurred_at,
          kind = excluded.kind,
          payload = excluded.payload`,
      )
      .run(event.id, event.planId ?? null, event.occurredAt, event.kind, JSON.stringify(event));
  }

  listAudit(planId?: string): ConnectionAuditEvent[] {
    const rows = planId
      ? (this.rawDb
          .prepare(
            'SELECT payload FROM federated_connection_audit WHERE plan_id = ? ORDER BY occurred_at',
          )
          .all(planId) as JsonRow[])
      : (this.rawDb
          .prepare('SELECT payload FROM federated_connection_audit ORDER BY occurred_at')
          .all() as JsonRow[]);
    return rows.map((row) => JSON.parse(row.payload) as ConnectionAuditEvent);
  }

  close(): void {
    this.rawDb.close();
  }

  private loadRegistry(): void {
    const mappingRows = this.rawDb
      .prepare('SELECT payload FROM federated_connection_mappings ORDER BY mapping_key')
      .all() as JsonRow[];
    for (const row of mappingRows) {
      this.registry.registerMapping(JSON.parse(row.payload) as ConnectionMapping);
    }

    const relationRows = this.rawDb
      .prepare('SELECT payload FROM federated_connection_relations ORDER BY relation_key')
      .all() as JsonRow[];
    for (const row of relationRows) {
      this.registry.registerRelation(JSON.parse(row.payload) as TypedRelation);
    }
  }
}

export function sourceIdentityForObservation(observation: StoredSourceObservation): string {
  return sourceIdentityKey(observation.source);
}

export function sourceRevisionForObservation(observation: StoredSourceObservation): string {
  return sourceRefKey(observation.source);
}
