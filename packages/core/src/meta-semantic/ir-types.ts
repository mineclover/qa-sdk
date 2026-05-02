// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * Meta-Semantic IR 3종 타입 정의.
 *
 * 3개 IR이 소프트웨어 정의를 직교 축으로 분해한다:
 *   ModuleIR — 의도의 컨테이너 (정적 구조)
 *   DataIR   — 상태의 실체 (스키마 + 패싯)
 *   PipeIR   — 실행 트랜잭션 (동적 시간 축)
 *
 * 참조 관계: Module ↔ Data ↔ Pipe (순환 허용은 external/lifecycle만)
 * 스펙: docs/specs/meta-semantic/meta-semantic-ir/
 */

import type { FoldLevel } from "../pipe/pipe-fold.js";
import type {
  ProjectionPlane,
  IntentHierarchy,
  LineageFacet,
  LineageKind,
} from "definition-catalog";

// ── 참조 타입 ─────────────────────────────────────────

/** 모듈 참조 */
export interface ModuleRef {
  readonly moduleId: string;
  readonly address?: number;
}

/** 데이터 참조 — schemaHash가 구조적 정체성 */
export interface DataRef {
  readonly dataId: string;
  readonly schemaHash: string;
}

/** 파이프 참조 */
export interface PipeRef {
  readonly pipeId: string;
  readonly targetModule: ModuleRef;
}

/** 검증 규칙 참조 */
export interface RuleRef {
  readonly ruleId: string;
}

// ── ModuleIR ──────────────────────────────────────────

/** 소스 코드 위치 */
export interface SourceLocation {
  readonly filePath: string;
  readonly line: number;
  readonly kind: "class" | "function" | "module" | "namespace";
}

/** 모듈 외부 계약 — 이 바운더리가 소비/생산하는 것 */
export interface ModuleInterface {
  readonly inputs: readonly DataRef[];
  readonly outputs: readonly DataRef[];
  readonly sideEffects: readonly PipeRef[];
}

/** 모듈 계층 관계 — 계약 전달 경로 */
export interface ModuleRelations {
  readonly parent: ModuleRef | null;
  readonly children: readonly ModuleRef[];
  readonly internal: readonly ModuleRef[];
  readonly external: readonly ModuleRef[];
}

/** definition-catalog 대응 메타데이터 */
export interface ModuleMeta {
  readonly level: FoldLevel;
  readonly layer?: "domain" | "operation" | "mediation" | "experience";
  readonly defDocRef?: string;
  readonly projectionPlane?: ProjectionPlane;
  readonly intentHierarchy?: IntentHierarchy;
}

/**
 * ModuleIR — 의도의 컨테이너.
 *
 * 코드의 구조적 바운더리를 표현한다.
 * interface가 데이터 계약, relations가 계층 구조.
 */
export interface ModuleIR {
  readonly id: string;
  readonly source: SourceLocation;
  readonly interface: ModuleInterface;
  readonly relations: ModuleRelations;
  readonly meta: ModuleMeta;
}

// ── DataIR ────────────────────────────────────────────

/** 필드 기술자 */
export interface FieldDescriptor {
  readonly name: string;
  readonly type: string;
  readonly optional: boolean;
  readonly hasDefault: boolean;
}

/** 데이터 정의 — 스키마 구조 */
export interface DataDefinition {
  readonly type: string;
  readonly schemaHash: string;
  readonly fields: readonly FieldDescriptor[];
  readonly certainty: "strict" | "flexible";
}

/** 데이터 관리 — 정합성 보장 주체 */
export interface DataManagement {
  readonly managedBy: ModuleRef;
  readonly validationRules: readonly RuleRef[];
  readonly transactionScope: "local" | "distributed";
}

/** 데이터 생산/소비 수명 */
export interface DataLifecycle {
  readonly producedBy: readonly ModuleRef[];
  readonly consumedBy: readonly ModuleRef[];
  readonly transformedBy: readonly ModuleRef[];
  readonly lineageFacet?: LineageFacet;
  readonly lineageKind?: LineageKind;
}

/** 데이터 저장 — UID 할당 체계 */
export interface DataStorage {
  readonly uid: string;
  readonly uidScheme: string;
  readonly axisType?: "finite" | "structural";
  readonly stableAnchor?: string; // UID or Axis ID
  readonly storageType: "memory" | "db" | "event-stream";
  readonly retention: "ephemeral" | "session" | "persistent";
}

/**
 * DataIR — 상태의 실체.
 *
 * 4개 패싯으로 데이터를 분해:
 *   definition — 무엇인가 (스키마)
 *   management — 누가 관리하는가 (계약)
 *   lifecycle  — 누가 생산/소비하는가
 *   storage    — 어디에 어떻게 저장하는가 (좌표)
 */
export interface DataIR {
  readonly definition: DataDefinition;
  readonly management: DataManagement;
  readonly lifecycle: DataLifecycle;
  readonly storage: DataStorage;
}

// ── PipeIR ────────────────────────────────────────────

/** 파이프 소스 위치 */
export interface PipeSourceLocation {
  readonly filePath: string;
  readonly line: number;
  readonly kind: "method-call" | "event-emit" | "http-request" | "db-query";
}

/**
 * PipeIR — 실행 트랜잭션.
 *
 * 시간 축 좌표의 원천. transactionId가 단조 증가하며
 * triggers로 인과 체인을 형성한다.
 */
export interface PipeIR {
  readonly transactionId: string;
  readonly targetModule: ModuleRef;
  readonly payload: DataRef;
  readonly state: "pending" | "committed" | "rolledBack";
  readonly triggers: readonly PipeRef[];
  readonly source: PipeSourceLocation;
}

// ── 유틸리티 ──────────────────────────────────────────

/**
 * ModuleIR.relations에서 level을 자동 추론.
 *
 * parent === null && children > 0 → group
 * parent !== null && children > 0 → module
 * children === 0                  → leaf
 */
export function inferModuleLevel(relations: ModuleRelations): FoldLevel {
  if (relations.children.length === 0) return "leaf";
  if (relations.parent === null) return "group";
  return "module";
}

/**
 * DataIR.definition.fields에서 결정론적 schemaHash 계산.
 *
 * 정렬된 필드 시그니처를 연결한 문자열의 해시.
 */
export function computeSchemaHash(fields: readonly FieldDescriptor[]): string {
  const sorted = [...fields].sort((a, b) => a.name.localeCompare(b.name));
  const sig = sorted.map(f => `${f.name}:${f.type}:${f.optional}`).join("|");
  // 간단한 결정론적 해시 (FNV-1a 32bit)
  let hash = 0x811c9dc5;
  for (let i = 0; i < sig.length; i++) {
    hash ^= sig.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * DataIR.definition.certainty 판정.
 *
 * any, unknown, Record<string, any> 등이 포함되면 flexible.
 */
export function deriveCertainty(fields: readonly FieldDescriptor[]): "strict" | "flexible" {
  const flexiblePatterns = ["any", "unknown", "Record<string, any>", "Record<string, unknown>"];
  for (const f of fields) {
    if (flexiblePatterns.some(p => f.type.includes(p))) return "flexible";
  }
  return "strict";
}
