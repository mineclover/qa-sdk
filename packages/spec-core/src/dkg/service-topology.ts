/**
 * ServiceTopology — 마이크로서비스 아키텍처의 prefix 소유권, 공유 계약, lifecycle 관리.
 *
 * 단일 서비스 관점(현재)을 멀티서비스 관점으로 확장한다:
 *   - 각 서비스가 prefix를 소유(own)하거나 소비(consume)한다
 *   - 서비스 간 prefix 공유는 계약(SharedContract)으로 관리된다
 *   - 서비스 등록/해제 시 영향받는 prefix/DSL/계약의 cascade를 추적한다
 *   - prefix 변경 시 영향받는 서비스의 승인(approval)이 필요한지 판단한다
 */

import { GraphRegistry } from "./graph-registry.js";
import type { PrefixNode, DecisionNode, ObservationNode, ConsumerNode } from "./dkg.types.js";

// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════

export type OwnershipRole = "owner" | "consumer" | "observer";

export interface ServiceOwnership {
  readonly serviceId: string;
  readonly prefixId: string;
  readonly role: OwnershipRole;
  /** consumer일 때: 사용하는 최소 version */
  readonly minVersion?: string;
  /** consumer일 때: 사용하는 DSL */
  readonly viaDsl?: string;
}

export interface SharedContract {
  readonly id: string;
  readonly prefixId: string;
  readonly provider: string;
  readonly consumers: readonly string[];
  /** 계약 상태 */
  readonly status: "active" | "deprecated" | "broken";
  /** provider가 보장하는 안정 version */
  readonly stableVersion: string;
  /** 계약 위반 조건 */
  readonly breakingConditions: readonly string[];
}

export interface ServiceRegistration {
  readonly serviceId: string;
  readonly name: string;
  readonly team?: string;
  readonly status: "active" | "draining" | "deregistered";
  readonly ownedPrefixes: readonly string[];
  readonly consumedPrefixes: readonly string[];
  readonly dslBindings: readonly string[];
}

export interface TopologyReport {
  readonly services: readonly ServiceRegistration[];
  readonly contracts: readonly SharedContract[];
  readonly orphanPrefixes: readonly string[];
  readonly breakingChanges: readonly BreakingChange[];
  readonly summary: string;
}

export interface BreakingChange {
  readonly prefixId: string;
  readonly changeType: string;
  readonly affectedServices: readonly string[];
  readonly contractIds: readonly string[];
  readonly requiresApproval: boolean;
}

// ═══════════════════════════════════════════════════════════════
//  Topology Builder
// ═══════════════════════════════════════════════════════════════

export class ServiceTopologyRegistry {
  private readonly services = new Map<string, ServiceRegistration>();
  private readonly ownerships: ServiceOwnership[] = [];
  private readonly contracts = new Map<string, SharedContract>();

  registerService(reg: ServiceRegistration): void {
    this.services.set(reg.serviceId, reg);
    for (const p of reg.ownedPrefixes) {
      this.ownerships.push({ serviceId: reg.serviceId, prefixId: p, role: "owner" });
    }
    for (const p of reg.consumedPrefixes) {
      this.ownerships.push({ serviceId: reg.serviceId, prefixId: p, role: "consumer" });
    }
  }

  addContract(contract: SharedContract): void {
    this.contracts.set(contract.id, contract);
  }

  listServices(): ServiceRegistration[] {
    return [...this.services.values()];
  }

  hasContract(prefixId: string): boolean {
    return [...this.contracts.values()].some(c => c.prefixId === prefixId);
  }

  /** prefix의 owner 서비스 */
  getOwner(prefixId: string): string | undefined {
    return this.ownerships.find(o => o.prefixId === prefixId && o.role === "owner")?.serviceId;
  }

  /** prefix를 소비하는 서비스 목록 */
  getConsumers(prefixId: string): string[] {
    return this.ownerships
      .filter(o => o.prefixId === prefixId && o.role === "consumer")
      .map(o => o.serviceId);
  }

  /** 서비스가 소유하는 prefix 목록 */
  getOwnedPrefixes(serviceId: string): string[] {
    return this.ownerships
      .filter(o => o.serviceId === serviceId && o.role === "owner")
      .map(o => o.prefixId);
  }

  /** prefix 변경 시 영향 분석 */
  analyzeBreakingChange(prefixId: string, changeType: string): BreakingChange {
    const consumers = this.getConsumers(prefixId);
    const contractIds = [...this.contracts.values()]
      .filter(c => c.prefixId === prefixId)
      .map(c => c.id);

    return {
      prefixId,
      changeType,
      affectedServices: consumers,
      contractIds,
      requiresApproval: consumers.length > 0 || contractIds.length > 0,
    };
  }

  /** 서비스 해제 시 cascade 분석 */
  analyzeDeregistration(serviceId: string): {
    orphanPrefixes: string[];
    brokenContracts: string[];
    affectedConsumers: string[];
  } {
    const owned = this.getOwnedPrefixes(serviceId);
    const orphanPrefixes: string[] = [];
    const brokenContracts: string[] = [];
    const affectedConsumers: string[] = [];

    for (const p of owned) {
      const consumers = this.getConsumers(p);
      if (consumers.length > 0) {
        orphanPrefixes.push(p);
        affectedConsumers.push(...consumers);
      }

      for (const [id, contract] of this.contracts) {
        if (contract.provider === serviceId && contract.prefixId === p) {
          brokenContracts.push(id);
        }
      }
    }

    return {
      orphanPrefixes,
      brokenContracts: [...new Set(brokenContracts)],
      affectedConsumers: [...new Set(affectedConsumers)],
    };
  }

  /** 전체 토폴로지 리포트 */
  generateReport(allPrefixIds: readonly string[]): TopologyReport {
    const ownedSet = new Set(this.ownerships.filter(o => o.role === "owner").map(o => o.prefixId));
    const orphanPrefixes = allPrefixIds.filter(p => !ownedSet.has(p));

    const breakingChanges: BreakingChange[] = [];
    for (const contract of this.contracts.values()) {
      if (contract.status === "broken") {
        breakingChanges.push(this.analyzeBreakingChange(contract.prefixId, "contract-broken"));
      }
    }

    const activeServices = [...this.services.values()].filter(s => s.status === "active");
    const drainingServices = [...this.services.values()].filter(s => s.status === "draining");

    return {
      services: [...this.services.values()],
      contracts: [...this.contracts.values()],
      orphanPrefixes,
      breakingChanges,
      summary: [
        `${activeServices.length} active services`,
        `${drainingServices.length} draining`,
        `${this.contracts.size} contracts`,
        `${orphanPrefixes.length} orphan prefixes`,
      ].join(", "),
    };
  }
  // ── 계약 버전 핀 검증 ──────────────────────────────────

  /**
   * consumer가 계약의 stableVersion 이상을 사용하는지 검증.
   * versionUsages: prefix별 실제 사용 version 목록.
   */
  validateContractVersions(
    versionUsages: ReadonlyMap<string, readonly { version: string; sessions: readonly string[] }[]>,
  ): ContractViolation[] {
    const violations: ContractViolation[] = [];

    for (const contract of this.contracts.values()) {
      if (contract.status !== "active") continue;

      const usages = versionUsages.get(contract.prefixId);
      if (!usages) continue;

      for (const u of usages) {
        // stableVersion보다 낮은 version을 사용하는 session 찾기
        if (compareVersions(u.version, contract.stableVersion) < 0) {
          // 이 session이 어떤 consumer 서비스인지 매칭
          for (const sessionId of u.sessions) {
            const consumer = contract.consumers.find(c =>
              sessionId.includes(c) || c.includes(sessionId),
            );
            violations.push({
              contractId: contract.id,
              prefixId: contract.prefixId,
              consumer: consumer ?? sessionId,
              usedVersion: u.version,
              stableVersion: contract.stableVersion,
              severity: compareVersions(u.version, contract.stableVersion) <= -2 ? "critical" : "warning",
            });
          }
        }
      }
    }

    return violations;
  }

  // ── Draining 모드 ────────────────────────────────────

  /**
   * 서비스를 draining 상태로 전이하고 이관 계획을 생성한다.
   */
  drainService(serviceId: string): DrainPlan {
    const svc = this.services.get(serviceId);
    if (!svc) throw new Error(`Service not found: ${serviceId}`);

    // 상태 전이
    const updated: ServiceRegistration = { ...svc, status: "draining" };
    this.services.set(serviceId, updated);

    // 이관 대상 분석
    const owned = this.getOwnedPrefixes(serviceId);
    const transferTargets: TransferTarget[] = [];

    for (const prefixId of owned) {
      const consumers = this.getConsumers(prefixId);
      // 계약이 있는 prefix는 이관 필수
      const contracts = [...this.contracts.values()].filter(
        c => c.provider === serviceId && c.prefixId === prefixId,
      );

      transferTargets.push({
        prefixId,
        consumers,
        contracts: contracts.map(c => c.id),
        requiresTransfer: consumers.length > 0 || contracts.length > 0,
        suggestedNewOwner: consumers.length > 0 ? consumers[0] : undefined,
      });
    }

    return {
      serviceId,
      status: "draining",
      ownedPrefixes: owned,
      transferTargets,
      canDeregister: transferTargets.every(t => !t.requiresTransfer),
      summary: transferTargets.filter(t => t.requiresTransfer).length > 0
        ? `${transferTargets.filter(t => t.requiresTransfer).length}개 prefix 이관 필요`
        : "즉시 해제 가능",
    };
  }

  /**
   * 서비스를 deregistered 상태로 전이한다. draining에서만 가능.
   */
  deregisterService(serviceId: string): boolean {
    const svc = this.services.get(serviceId);
    if (!svc || svc.status !== "draining") return false;
    this.services.set(serviceId, { ...svc, status: "deregistered" });
    return true;
  }

  // ── Approval Gate ─────────────────────────────────────

  /**
   * prefix 변경에 대한 approval 요청을 생성한다.
   */
  createApprovalRequest(
    prefixId: string,
    changeType: string,
    requestedBy: string,
  ): ApprovalRequest {
    const impact = this.analyzeBreakingChange(prefixId, changeType);
    const owner = this.getOwner(prefixId);

    // 영향받는 서비스의 팀 추출
    const affectedTeams = new Set<string>();
    for (const svcId of impact.affectedServices) {
      const svc = this.services.get(svcId);
      if (svc?.team) affectedTeams.add(svc.team);
    }

    return {
      prefixId,
      changeType,
      requestedBy,
      owner: owner ?? "unknown",
      affectedServices: impact.affectedServices,
      affectedTeams: [...affectedTeams],
      contracts: impact.contractIds,
      approvals: [...affectedTeams].map(team => ({
        team,
        status: "pending" as const,
      })),
      canProceed: affectedTeams.size === 0,
    };
  }
}

// ═══════════════════════════════════════════════════════════════
//  Supporting Types
// ═══════════════════════════════════════════════════════════════

export interface ContractViolation {
  readonly contractId: string;
  readonly prefixId: string;
  readonly consumer: string;
  readonly usedVersion: string;
  readonly stableVersion: string;
  readonly severity: "warning" | "critical";
}

export interface TransferTarget {
  readonly prefixId: string;
  readonly consumers: readonly string[];
  readonly contracts: readonly string[];
  readonly requiresTransfer: boolean;
  readonly suggestedNewOwner?: string;
}

export interface DrainPlan {
  readonly serviceId: string;
  readonly status: string;
  readonly ownedPrefixes: readonly string[];
  readonly transferTargets: readonly TransferTarget[];
  readonly canDeregister: boolean;
  readonly summary: string;
}

export interface ApprovalRequest {
  readonly prefixId: string;
  readonly changeType: string;
  readonly requestedBy: string;
  readonly owner: string;
  readonly affectedServices: readonly string[];
  readonly affectedTeams: readonly string[];
  readonly contracts: readonly string[];
  readonly approvals: readonly { team: string; status: "pending" | "approved" | "rejected" }[];
  readonly canProceed: boolean;
}

// ═══════════════════════════════════════════════════════════════
//  서비스 의존 그래프
// ═══════════════════════════════════════════════════════════════

export interface DependencyEdge {
  readonly from: string;
  readonly to: string;
  readonly via: readonly string[];
  readonly strength: "strong" | "weak";
}

export interface DependencyGraph {
  readonly edges: readonly DependencyEdge[];
  readonly roots: readonly string[];
  readonly leaves: readonly string[];
  readonly cycles: readonly string[][];
  readonly maxDepth: number;
}

/**
 * 서비스 간 의존 그래프를 추출한다.
 * prefix 소유/소비 관계에서 의존 체인을 구축한다.
 */
export function buildDependencyGraph(topo: ServiceTopologyRegistry): DependencyGraph {
  const allServices = topo.listServices();
  const edges: DependencyEdge[] = [];
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();

  for (const svc of allServices) {
    inDegree.set(svc.serviceId, 0);
    outDegree.set(svc.serviceId, 0);
  }

  // consumer → owner 의존 관계
  for (const svc of allServices) {
    for (const prefixId of svc.consumedPrefixes) {
      const owner = topo.getOwner(prefixId);
      if (owner && owner !== svc.serviceId) {
        const existing = edges.find(e => e.from === svc.serviceId && e.to === owner);
        if (existing) {
          (existing.via as string[]).push(prefixId);
        } else {
          edges.push({
            from: svc.serviceId,
            to: owner,
            via: [prefixId],
            strength: topo.hasContract(prefixId) ? "strong" : "weak",
          });
        }
        inDegree.set(owner, (inDegree.get(owner) ?? 0) + 1);
        outDegree.set(svc.serviceId, (outDegree.get(svc.serviceId) ?? 0) + 1);
      }
    }
  }

  const roots = allServices.filter(s => (inDegree.get(s.serviceId) ?? 0) === 0).map(s => s.serviceId);
  const leaves = allServices.filter(s => (outDegree.get(s.serviceId) ?? 0) === 0).map(s => s.serviceId);

  // 순환 감지 (DFS)
  const cycles = detectCycles(allServices.map(s => s.serviceId), edges);

  // 최대 깊이 (BFS from roots)
  let maxDepth = 0;
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = roots.map(r => ({ id: r, depth: 0 }));
  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    maxDepth = Math.max(maxDepth, depth);
    for (const e of edges.filter(e => e.to === id)) {
      queue.push({ id: e.from, depth: depth + 1 });
    }
  }

  return { edges, roots, leaves, cycles, maxDepth };
}

function detectCycles(nodes: string[], edges: DependencyEdge[]): string[][] {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n, []);
  for (const e of edges) adj.get(e.from)?.push(e.to);

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(node: string, path: string[]): void {
    if (stack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart >= 0) cycles.push(path.slice(cycleStart));
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    stack.add(node);
    for (const next of adj.get(node) ?? []) {
      dfs(next, [...path, node]);
    }
    stack.delete(node);
  }

  for (const n of nodes) dfs(n, []);
  return cycles;
}

// ═══════════════════════════════════════════════════════════════
//  변경 이력 타임라인
// ═══════════════════════════════════════════════════════════════

export interface TimelineEvent {
  readonly date: string;
  readonly type: "decision" | "observation" | "version-event" | "transition";
  readonly id: string;
  readonly title: string;
  readonly subjects: readonly string[];
}

/**
 * DKG 그래프에서 시간순 변경 이력을 추출한다.
 */
export function buildTimeline(graph: GraphRegistry): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const node of graph.getAllNodes()) {
    if (node.kind === "decision") {
      events.push({
        date: (node as any).date,
        type: "decision",
        id: node.id,
        title: (node as any).title,
        subjects: graph.neighbors(node.id, "governs").concat(graph.neighbors(node.id, "justifies")),
      });
    }
    if (node.kind === "observation") {
      events.push({
        date: (node as any).date,
        type: "observation",
        id: node.id,
        title: (node as any).finding?.slice(0, 60) ?? "",
        subjects: (node as any).subjects ?? [],
      });
    }
    if (node.kind === "version-event") {
      events.push({
        date: (node as any).date,
        type: "version-event",
        id: node.id,
        title: `${(node as any).subjectId}: ${(node as any).fromVersion} → ${(node as any).toVersion}`,
        subjects: [(node as any).subjectId],
      });
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

function compareVersions(a: string, b: string): number {
  const na = parseInt(a.replace(/\D/g, ""), 10) || 0;
  const nb = parseInt(b.replace(/\D/g, ""), 10) || 0;
  return na - nb;
}

// ═══════════════════════════════════════════════════════════════
//  Default Topology (DEMO)
// ═══════════════════════════════════════════════════════════════

/** 데모 토폴로지 — 5개 서비스, prefix 소유권, 공유 계약 */
export function createDemoTopology(): ServiceTopologyRegistry {
  const topo = new ServiceTopologyRegistry();

  // ── 서비스 등록 ──
  topo.registerService({
    serviceId: "shopping-web", name: "쇼핑 웹", team: "frontend",
    status: "active",
    ownedPrefixes: ["page_view", "tracking"],
    consumedPrefixes: ["permission", "endpoint", "flow_point", "service"],
    dslBindings: ["dsl-checkout", "dsl-observation"],
  });

  topo.registerService({
    serviceId: "shopping-backend", name: "쇼핑 백엔드", team: "backend",
    status: "active",
    ownedPrefixes: ["cart_event", "order_event", "permission", "event"],
    consumedPrefixes: ["service", "endpoint"],
    dslBindings: ["dsl-checkout", "dsl-commerce", "dsl-auth"],
  });

  topo.registerService({
    serviceId: "auth", name: "인증 서비스", team: "platform",
    status: "active",
    ownedPrefixes: ["auth_event", "rbac"],
    consumedPrefixes: ["permission", "service", "endpoint"],
    dslBindings: ["dsl-auth", "dsl-access-control"],
  });

  topo.registerService({
    serviceId: "payment", name: "결제 서비스", team: "backend",
    status: "active",
    ownedPrefixes: [],
    consumedPrefixes: ["permission", "order_event", "endpoint", "service"],
    dslBindings: ["dsl-checkout"],
  });

  topo.registerService({
    serviceId: "infra-controller", name: "인프라 컨트롤러", team: "devops",
    status: "active",
    ownedPrefixes: ["deploy_event", "health_event", "pipeline_point", "data_policy", "engine_event", "schema_event", "service", "endpoint", "pattern_match", "pattern_anomaly"],
    consumedPrefixes: [],
    dslBindings: ["dsl-infra", "dsl-pipeline", "dsl-observation"],
  });

  topo.registerService({
    serviceId: "content-service", name: "콘텐츠 서비스", team: "frontend",
    status: "active",
    ownedPrefixes: ["content", "relational"],
    consumedPrefixes: ["service", "endpoint"],
    dslBindings: ["dsl-content", "dsl-access-control"],
  });

  topo.registerService({
    serviceId: "gateway", name: "API 게이트웨이", team: "platform",
    status: "active",
    ownedPrefixes: ["flow_point"],
    consumedPrefixes: ["service", "endpoint", "permission"],
    dslBindings: ["dsl-observation", "dsl-checkout"],
  });

  // ── 공유 계약 ──
  topo.addContract({
    id: "SC-permission",
    prefixId: "permission",
    provider: "shopping-backend",
    consumers: ["shopping-web", "auth", "payment"],
    status: "active",
    stableVersion: "v4",
    breakingConditions: ["capacity 변경", "role entry 제거"],
  });

  topo.addContract({
    id: "SC-endpoint",
    prefixId: "endpoint",
    provider: "infra-controller",
    consumers: ["shopping-web", "shopping-backend", "auth", "payment"],
    status: "active",
    stableVersion: "v1",
    breakingConditions: ["resource_type entry 변경", "svc_ref 구조 변경"],
  });

  topo.addContract({
    id: "SC-service",
    prefixId: "service",
    provider: "infra-controller",
    consumers: ["shopping-web", "shopping-backend", "auth", "payment"],
    status: "active",
    stableVersion: "v1",
    breakingConditions: ["env/region/svc_name/namespace capacity 변경"],
  });

  return topo;
}
