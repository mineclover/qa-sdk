import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DEMO_CATALOG, DEMO_DKG_CONFIG } from "demo-snapshot";
import {
  bootstrapDkg,
  GraphRegistry,
  recordDecision,
  type DecisionNode,
  type DecisionType,
  type ObservationNode,
} from "dkg";
import { DkgSqliteStore } from "dkg/store";
import type { FeedbackRequest } from "review-ledger";
import { getQaSdkDir } from "./qa-dir.js";

const STATE_DIR = getQaSdkDir();
const STATE_DB = join(STATE_DIR, "state.sqlite");

export interface ReviewFeedbackDecisionInput {
  type: DecisionType;
  title: string;
  rationale: string;
}

export interface ReviewFeedbackBridgeOptions {
  targetId: string;
  decisionId?: string;
  decision?: ReviewFeedbackDecisionInput;
  catalogId?: string;
  context?: {
    graph: GraphRegistry;
    store: DkgSqliteStore;
  };
}

export interface ReviewFeedbackBridgeResult {
  observationId: string;
  decisionId?: string;
  targetId: string;
  linkedExistingDecision: boolean;
  createdDecision: boolean;
}

export function bridgeFeedbackRequestToDkg(
  request: FeedbackRequest,
  options: ReviewFeedbackBridgeOptions,
): ReviewFeedbackBridgeResult {
  if (options.decisionId && options.decision) {
    throw new Error("decisionId와 decision 입력을 동시에 사용할 수 없습니다");
  }

  const ownedContext = options.context ?? createPersistentContext(options.catalogId ?? "demo");
  const { graph, store } = ownedContext;

  try {
    if (!graph.hasNode(options.targetId)) {
      throw new Error(`DKG target을 찾을 수 없습니다: ${options.targetId}`);
    }

    const observation = buildFeedbackObservation(request, options.targetId);
    const edges: Array<{ type: "observes" | "prompts" | "governs"; from: string; to: string }> = [];
    const nodes: Array<ObservationNode | DecisionNode> = [observation];

    graph.addNode(observation);
    graph.addEdge("observes", observation.id, options.targetId, {
      feedbackRequestId: request.id,
    });
    edges.push({ type: "observes", from: observation.id, to: options.targetId });

    let decisionId: string | undefined;
    let linkedExistingDecision = false;
    let createdDecision = false;

    if (options.decisionId) {
      const decisionNode = graph.getNode(options.decisionId);
      if (!decisionNode || decisionNode.kind !== "decision") {
        throw new Error(`Decision을 찾을 수 없습니다: ${options.decisionId}`);
      }
      graph.addEdge("prompts", observation.id, options.decisionId, {
        feedbackRequestId: request.id,
      });
      edges.push({ type: "prompts", from: observation.id, to: options.decisionId });
      decisionId = options.decisionId;
      linkedExistingDecision = true;
    } else if (options.decision) {
      const decisionResult = recordDecision(graph, {
        targetId: options.targetId,
        type: options.decision.type,
        title: options.decision.title,
        rationale: `${options.decision.rationale}\n\nFeedbackRequest: ${request.id}`,
      });
      if (decisionResult.verdict !== "ok" || !decisionResult.decision) {
        throw new Error(decisionResult.reason ?? "Decision 생성 실패");
      }

      const decision: DecisionNode = {
        ...decisionResult.decision,
        metadata: {
          ...decisionResult.decision.metadata,
          feedbackRequestId: request.id,
          targetModel: request.targetModel,
          serviceScope: request.serviceScope,
        },
      };
      graph.addNode(decision);
      nodes.push(decision);

      for (const edge of decisionResult.edges) {
        graph.addEdge(edge.type, edge.from, edge.to, {
          feedbackRequestId: request.id,
        });
        edges.push(edge);
      }

      graph.addEdge("prompts", observation.id, decision.id, {
        feedbackRequestId: request.id,
      });
      edges.push({ type: "prompts", from: observation.id, to: decision.id });
      decisionId = decision.id;
      createdDecision = true;
    }

    store.saveNodes(nodes, edges, "manual");

    return {
      observationId: observation.id,
      ...(decisionId ? { decisionId } : {}),
      targetId: options.targetId,
      linkedExistingDecision,
      createdDecision,
    };
  } finally {
    if (!options.context) {
      ownedContext.store.close();
    }
  }
}

export function buildFeedbackObservation(
  request: FeedbackRequest,
  targetId: string,
): ObservationNode {
  return {
    kind: "observation",
    id: `OBS-REVIEW-${request.id}`,
    date: request.createdAt.slice(0, 10),
    source: "review",
    subjects: [
      targetId,
      ...(request.serviceScope ? [request.serviceScope] : []),
      ...request.evidenceBundle.items.slice(0, 5).map((item) => item.filePath),
    ],
    finding:
      `${request.purpose} — reviewed ${request.evidenceBundle.reviewed}, ` +
      `stale ${request.evidenceBundle.stale}, unreviewed ${request.evidenceBundle.unreviewed}`,
    intent:
      request.evidenceBundle.stale > 0 || request.evidenceBundle.unreviewed > 0
        ? "action-needed"
        : "monitoring",
    metadata: {
      feedbackRequestId: request.id,
      targetModel: request.targetModel,
      serviceScope: request.serviceScope,
      totalFiles: request.evidenceBundle.total,
      reviewedFiles: request.evidenceBundle.reviewed,
      staleFiles: request.evidenceBundle.stale,
      unreviewedFiles: request.evidenceBundle.unreviewed,
      filePaths: request.evidenceBundle.items.map((item) => item.filePath),
    },
  };
}

function createPersistentContext(catalogId: string): {
  graph: GraphRegistry;
  store: DkgSqliteStore;
} {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }

  const store = new DkgSqliteStore(STATE_DB, catalogId);
  const stats = store.stats();
  const graph = stats.nodes > 0
    ? store.loadGraph()
    : bootstrapAndPersist(store);

  return { graph, store };
}

function bootstrapAndPersist(store: DkgSqliteStore): GraphRegistry {
  const graph = bootstrapDkg({
    catalog: DEMO_CATALOG,
    config: DEMO_DKG_CONFIG,
  });
  store.saveGraph(graph);
  return graph;
}
