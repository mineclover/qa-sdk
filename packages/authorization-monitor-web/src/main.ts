// @def.boundary experience-layer-group
// @def.doc experience-layer-group

import {
  authorizationGraphToOntologyView,
  layoutOntologyGraph,
  renderOntologyGraphSvg,
  type OntologyGraphViewModel,
  type OntologyLane,
} from "viz-core/ontology-graph";

type FocusMode = "all" | "proxy" | "application";

type NodeKind =
  | "principal"
  | "resource"
  | "action"
  | "policy"
  | "decision"
  | "enforcement_point"
  | "deployment_source";

interface AuthzCoord {
  realm: string;
  space: string;
  anchor: string;
  taxonomies: Record<string, string>;
}

interface AuthzNode {
  nodeId: string;
  kind: NodeKind;
  coord: AuthzCoord;
}

interface AuthzRelation {
  relationId: string;
  kind: string;
  fromNodeId: string;
  toNodeId: string;
}

interface AuthzGraph {
  nodes: AuthzNode[];
  relations: AuthzRelation[];
}

interface AuthzGraphSnapshot {
  graphId?: string;
  snapshotId?: string;
  graph: AuthzGraph;
  auditReport?: {
    ok: boolean;
    summary?: {
      routeCount?: number;
      applicationResourceCount?: number;
      decisionCount?: number;
      warnings?: number;
    };
  };
}

interface AuthzMonitorModel {
  graph: AuthzGraph;
  viewModel: OntologyGraphViewModel;
  source: "sample" | "live";
  snapshotId?: string;
  graphId?: string;
}

interface AuthzMonitorState {
  focus: FocusMode;
  selectedNodeId: string | null;
}

const state: AuthzMonitorState = {
  focus: "all",
  selectedNodeId: null,
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function makeNode(
  kind: NodeKind,
  realm: string,
  space: string,
  anchor: string,
  taxonomies: Record<string, string>,
): AuthzNode {
  const query = Object.entries(taxonomies)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return {
    nodeId: `node:${realm}/${space}/${anchor}?${query}`,
    kind,
    coord: { realm, space, anchor, taxonomies },
  };
}

function makeRelation(kind: string, fromNodeId: string, toNodeId: string): AuthzRelation {
  return {
    relationId: `authz:${kind}:${fromNodeId}->${toNodeId}`,
    kind,
    fromNodeId,
    toNodeId,
  };
}

function mergeGraphs(...graphs: AuthzGraph[]): AuthzGraph {
  return {
    nodes: [...new Map(graphs.flatMap((graph) => graph.nodes).map((node) => [node.nodeId, node])).values()],
    relations: [
      ...new Map(
        graphs.flatMap((graph) => graph.relations).map((relation) => [relation.relationId, relation]),
      ).values(),
    ],
  };
}

function emptyGraph(): AuthzGraph {
  return { nodes: [], relations: [] };
}

function isAuthzGraph(value: unknown): value is AuthzGraph {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<AuthzGraph>;
  return Array.isArray(record.nodes) && Array.isArray(record.relations);
}

function graphFromSnapshotPayload(payload: unknown): AuthzGraphSnapshot {
  if (isAuthzGraph(payload)) {
    return { graph: payload };
  }
  if (payload && typeof payload === "object" && isAuthzGraph((payload as { graph?: unknown }).graph)) {
    return payload as AuthzGraphSnapshot;
  }
  throw new Error("Invalid authorization graph payload");
}

async function fetchLiveSnapshot(): Promise<AuthzGraphSnapshot | null> {
  const url = new URL(window.location.href);
  const graphUrl = url.searchParams.get("graph") ?? "/authorization-graph-snapshot.json";
  try {
    const response = await fetch(graphUrl, { headers: { accept: "application/json" } });
    if (!response.ok) return null;
    return graphFromSnapshotPayload(await response.json());
  } catch (error) {
    console.warn("authorization graph live fetch failed; falling back to sample", error);
    return null;
  }
}

function auditGraph(graph: AuthzGraph): {
  ok: boolean;
  summary: {
    routeCount: number;
    applicationResourceCount: number;
    decisionCount: number;
    warnings: number;
  };
} {
  const routes = graph.nodes.filter((node) => node.coord.taxonomies["resource_kind"] === "proxy_route");
  const appResources = graph.nodes.filter((node) => node.coord.taxonomies["resource_kind"] === "domain_resource");
  const decisions = graph.nodes.filter((node) => node.kind === "decision");
  const warnings =
    routes.filter((route) => !graph.relations.some((relation) => relation.kind === "protects" && relation.toNodeId === route.nodeId)).length +
    appResources.filter((resource) => !graph.relations.some((relation) => relation.kind === "protects" && relation.toNodeId === resource.nodeId)).length +
    decisions.filter((decision) => !graph.relations.some((relation) => relation.kind === "decision_policy" && relation.fromNodeId === decision.nodeId)).length;

  return {
    ok: warnings === 0,
    summary: {
      routeCount: routes.length,
      applicationResourceCount: appResources.length,
      decisionCount: decisions.length,
      warnings,
    },
  };
}

function buildModel(): AuthzMonitorModel {
  const policy = makeNode("policy", "policy:cerbos:prod", "policy", "cerbos:resource:crm.customer_profile", {
    node_kind: "policy",
    policy_kind: "cerbos_resource_policy",
    version: "v1",
  });
  const service = makeNode("resource", "application:service:crm:prod", "resource", "crm.customer_profile", {
    node_kind: "resource",
    resource_kind: "service",
  });
  const readAction = makeNode("action", "policy:cerbos:prod", "action", "read", {
    node_kind: "action",
    action_kind: "read",
  });
  const exportAction = makeNode("action", "policy:cerbos:prod", "action", "export", {
    node_kind: "action",
    action_kind: "export",
  });
  const proxyRoute = makeNode("resource", "enforcement:nginx:prod", "resource", "crm.example.com/customers", {
    node_kind: "resource",
    resource_kind: "proxy_route",
    method: "GET",
  });
  const proxy = makeNode("enforcement_point", "enforcement:nginx:prod", "enforcement", "edge-nginx:crm", {
    node_kind: "enforcement_point",
    enforcement_kind: "nginx_proxy",
  });
  const domainResource = makeNode("resource", "application:service:crm:prod", "resource", "crm.customer_profile:customer-123", {
    node_kind: "resource",
    resource_kind: "domain_resource",
    sensitivity: "pii",
  });
  const serviceMiddleware = makeNode("enforcement_point", "enforcement:service:crm:prod", "enforcement", "crm-api:cerbos-middleware", {
    node_kind: "enforcement_point",
    enforcement_kind: "service_middleware",
  });
  const principal = makeNode("principal", "identity:zitadel:prod", "principal", "user:lee", {
    node_kind: "principal",
    principal_kind: "human_user",
  });
  const proxyDecision = makeNode("decision", "enforcement:nginx:prod", "decision", "req-proxy-0101:read", {
    node_kind: "decision",
    effect: "allow",
  });
  const appDecision = makeNode("decision", "enforcement:service:crm:prod", "decision", "req-app-0101:export", {
    node_kind: "decision",
    effect: "allow",
  });
  const deployment = makeNode("deployment_source", "infra:argocd:prod", "deployment-source", "argocd:crm", {
    node_kind: "deployment_source",
    deployment_kind: "argocd",
    revision: "rev-prod",
  });

  const policyGraph: AuthzGraph = {
    nodes: [policy, service, readAction, exportAction],
    relations: [
      makeRelation("protects", policy.nodeId, service.nodeId),
      makeRelation("allows_action", policy.nodeId, readAction.nodeId),
      makeRelation("allows_action", policy.nodeId, exportAction.nodeId),
    ],
  };
  const proxyGraph: AuthzGraph = {
    nodes: [proxyRoute, proxy, service, policy, deployment],
    relations: [
      makeRelation("enforced_at", proxyRoute.nodeId, proxy.nodeId),
      makeRelation("matches_resource", proxyRoute.nodeId, service.nodeId),
      makeRelation("protects", policy.nodeId, proxyRoute.nodeId),
      makeRelation("deployed_by", proxyRoute.nodeId, deployment.nodeId),
    ],
  };
  const appGraph: AuthzGraph = {
    nodes: [service, domainResource, serviceMiddleware, policy, readAction, exportAction, deployment],
    relations: [
      makeRelation("matches_resource", service.nodeId, domainResource.nodeId),
      makeRelation("enforced_at", domainResource.nodeId, serviceMiddleware.nodeId),
      makeRelation("protects", policy.nodeId, domainResource.nodeId),
      makeRelation("evaluated_by", readAction.nodeId, serviceMiddleware.nodeId),
      makeRelation("evaluated_by", exportAction.nodeId, serviceMiddleware.nodeId),
      makeRelation("deployed_by", domainResource.nodeId, deployment.nodeId),
    ],
  };
  const decisionGraph: AuthzGraph = {
    nodes: [proxyDecision, appDecision, principal, service, domainResource, readAction, exportAction, policy, proxy, serviceMiddleware],
    relations: [
      makeRelation("decision_principal", proxyDecision.nodeId, principal.nodeId),
      makeRelation("decision_resource", proxyDecision.nodeId, service.nodeId),
      makeRelation("decision_action", proxyDecision.nodeId, readAction.nodeId),
      makeRelation("decision_policy", proxyDecision.nodeId, policy.nodeId),
      makeRelation("decision_enforcement", proxyDecision.nodeId, proxy.nodeId),
      makeRelation("decision_principal", appDecision.nodeId, principal.nodeId),
      makeRelation("decision_resource", appDecision.nodeId, domainResource.nodeId),
      makeRelation("decision_action", appDecision.nodeId, exportAction.nodeId),
      makeRelation("decision_policy", appDecision.nodeId, policy.nodeId),
      makeRelation("decision_enforcement", appDecision.nodeId, serviceMiddleware.nodeId),
    ],
  };

  return {
    graph: mergeGraphs(policyGraph, proxyGraph, appGraph, decisionGraph),
    viewModel: authorizationGraphToOntologyView(mergeGraphs(policyGraph, proxyGraph, appGraph, decisionGraph)),
    source: "sample",
  };
}

async function loadModel(): Promise<AuthzMonitorModel> {
  const live = await fetchLiveSnapshot();
  if (!live) return buildModel();
  return {
    graph: live.graph,
    viewModel: authorizationGraphToOntologyView(live.graph),
    source: "live",
    snapshotId: live.snapshotId,
    graphId: live.graphId,
  };
}

function viewModelForFocus(model: AuthzMonitorModel): OntologyGraphViewModel {
  if (state.focus === "all") return model.viewModel;

  const focusLanes: OntologyLane[] =
    state.focus === "proxy"
      ? ["policy", "proxy", "decision"]
      : ["policy", "application", "decision"];
  const seedIds = new Set(
    model.viewModel.nodes
      .filter((node) => focusLanes.includes(node.lane))
      .map((node) => node.id),
  );
  for (const edge of model.viewModel.edges) {
    if (seedIds.has(edge.from) || seedIds.has(edge.to)) {
      seedIds.add(edge.from);
      seedIds.add(edge.to);
    }
  }
  return {
    ...model.viewModel,
    nodes: model.viewModel.nodes.filter((node) => seedIds.has(node.id)),
    edges: model.viewModel.edges.filter((edge) => seedIds.has(edge.from) && seedIds.has(edge.to)),
  };
}

function renderSummary(container: HTMLElement, model: AuthzMonitorModel): void {
  const report = auditGraph(model.graph);
  container.innerHTML = `
    <div class="score">
      <span>Audit · ${model.source}${model.snapshotId ? ` · ${escapeHtml(model.snapshotId)}` : ""}</span>
      <b class="${report.ok ? "ok" : "bad"}">${report.ok ? "OK" : "Drift"}</b>
    </div>
    <div class="kpis">
      <div><b>${report.summary.routeCount}</b><span>proxy routes</span></div>
      <div><b>${report.summary.applicationResourceCount}</b><span>domain resources</span></div>
      <div><b>${report.summary.decisionCount}</b><span>decisions</span></div>
      <div><b>${report.summary.warnings}</b><span>warnings</span></div>
    </div>
  `;
}

function renderTopology(container: HTMLElement, model: AuthzMonitorModel): void {
  const viewModel = viewModelForFocus(model);
  const positioned = layoutOntologyGraph(viewModel, {
    laneOrder: ["policy", "proxy", "application", "decision", "neutral"],
    laneGap: 190,
    rowGap: 92,
    nodeWidth: 150,
    nodeHeight: 66,
    paddingX: 110,
    paddingY: 70,
  });
  const laneLabels = [
    { label: "policy", x: 110 },
    { label: "proxy gate", x: 300 },
    { label: "application gate", x: 490 },
    { label: "decision", x: 680 },
    { label: "other", x: 870 },
  ]
    .map(
      (lane) =>
        `<span style="left:${lane.x - 75}px;top:24px;width:150px">${lane.label}</span>`,
    )
    .join("");

  container.innerHTML = `
    <div class="graph-surface" style="width:${positioned.width}px;height:${positioned.height}px" data-qa-address="authz-monitor:surface:graph-canvas">
      <div class="lanes" data-qa-address="authz-monitor:surface:lanes">
        ${laneLabels}
      </div>
      <div class="topology" data-qa-address="authz-monitor:surface:ontology-graph">${renderOntologyGraphSvg(positioned)}</div>
    </div>
  `;

  container.querySelectorAll<SVGElement>("[data-node-id]").forEach((nodeElement) => {
    const nodeId = nodeElement.dataset["nodeId"] ?? "";
    const node = viewModel.nodes.find((candidate) => candidate.id === nodeId);
    nodeElement.setAttribute(
      "data-qa-address",
      `authz-monitor:node:${node?.lane ?? "neutral"}:${node?.label ?? nodeId}`,
    );
    if (state.selectedNodeId === nodeId) nodeElement.classList.add("selected");
    nodeElement.addEventListener("click", () => {
      state.selectedNodeId = nodeId;
      refresh(model);
    });
  });
  container.querySelectorAll<SVGPathElement>(".ontology-edge").forEach((edgeElement, index) => {
    const edge = viewModel.edges[index];
    edgeElement.setAttribute(
      "data-qa-address",
      `authz-monitor:edge:${index}:${edge?.label ?? edge?.kind ?? "edge"}`,
    );
  });
}

function renderInspector(container: HTMLElement, model: AuthzMonitorModel): void {
  const selected = state.selectedNodeId
    ? model.viewModel.nodes.find((node) => node.id === state.selectedNodeId)
    : null;
  if (!selected) {
    container.innerHTML = `
      <div class="empty" data-qa-address="authz-monitor:surface:inspector-empty">
        <b>관측 노드를 선택하세요</b>
        <span>route, middleware, policy, decision 좌표와 relation을 확인합니다.</span>
      </div>
    `;
    return;
  }

  const incoming = model.viewModel.edges.filter((edge) => edge.to === selected.id);
  const outgoing = model.viewModel.edges.filter((edge) => edge.from === selected.id);
  container.innerHTML = `
    <div class="ins-head" data-qa-address="authz-monitor:surface:inspector-head">
      <span>${escapeHtml(selected.lane)} / ${escapeHtml(selected.kind)}</span>
      <b>${escapeHtml(selected.label)}</b>
    </div>
    <dl class="ins-meta">
      <dt>id</dt><dd>${escapeHtml(selected.id)}</dd>
      <dt>status</dt><dd>${escapeHtml(selected.status ?? "unknown")}</dd>
      <dt>summary</dt><dd>${escapeHtml(selected.summary ?? "")}</dd>
      <dt>raw</dt><dd>${escapeHtml(JSON.stringify(selected.raw ?? {}, null, 2))}</dd>
    </dl>
    <div class="rel-list">
      <h4>incoming</h4>
      ${incoming.map((edge) => `<code>${escapeHtml(edge.label ?? edge.kind ?? "edge")}</code>`).join("") || "<span>none</span>"}
      <h4>outgoing</h4>
      ${outgoing.map((edge) => `<code>${escapeHtml(edge.label ?? edge.kind ?? "edge")}</code>`).join("") || "<span>none</span>"}
    </div>
  `;
}

function renderSequence(container: HTMLElement): void {
  container.innerHTML = `
    <div class="step proxy"><span>1</span><b>Proxy gate</b><p>host/path/method 기준으로 route를 차단하고 upstream service로 보냅니다.</p><code>proxy_route -> enforced_at -> nginx_proxy</code></div>
    <div class="step policy"><span>2</span><b>Cerbos policy</b><p>동일한 policy id가 route와 domain resource를 보호합니다.</p><code>policy -> protects -> resource</code></div>
    <div class="step app"><span>3</span><b>Application gate</b><p>서비스 내부에서 객체/컬럼/action 단위의 fine-grained check를 수행합니다.</p><code>domain_resource -> enforced_at -> service_middleware</code></div>
    <div class="step decision"><span>4</span><b>Decision observation</b><p>principal, resource, action, policy, enforcement point를 decision node로 남깁니다.</p><code>decision -> decision_policy -> policy</code></div>
  `;
}

function refresh(model: AuthzMonitorModel): void {
  const summary = document.querySelector<HTMLElement>("#summary");
  const graph = document.querySelector<HTMLElement>("#graph");
  const inspector = document.querySelector<HTMLElement>("#inspector");
  if (summary) renderSummary(summary, model);
  if (graph) renderTopology(graph, model);
  if (inspector) renderInspector(inspector, model);
  document.querySelectorAll<HTMLButtonElement>("[data-focus]").forEach((button) => {
    button.classList.toggle("active", button.dataset["focus"] === state.focus);
  });
}

async function renderApp(): Promise<void> {
  const model = await loadModel();
  const app = document.querySelector<HTMLElement>("#app");
  if (!app) return;

  app.innerHTML = `
    <section class="head">
      <div>
        <p class="eyebrow">Authorization Ontology Monitor</p>
        <h1>권한은 두 번 막고, 한 번의 graph로 관측한다.</h1>
        <p>프록시는 입구를 차단하고, 애플리케이션은 도메인 리소스를 확인합니다. 두 계층의 Cerbos policy와 decision을 같은 좌표계에서 비교합니다.</p>
        <p class="source-line">source: ${model.source}${model.graphId ? ` / ${escapeHtml(model.graphId)}` : ""}</p>
      </div>
      <div id="summary" class="summary" data-qa-address="authz-monitor:surface:audit-summary"></div>
    </section>
    <section class="controls" aria-label="권한 관측 필터" data-qa-address="authz-monitor:surface:focus-controls">
      <button data-focus="all" class="active">전체 경로</button>
      <button data-focus="proxy">프록시 부여</button>
      <button data-focus="application">애플리케이션 부여</button>
    </section>
    <section class="workspace" data-qa-address="authz-monitor:surface:workspace">
      <div class="graph" id="graph" data-qa-address="authz-monitor:surface:graph"></div>
      <aside class="inspector" id="inspector" data-qa-address="authz-monitor:surface:inspector"></aside>
    </section>
    <section class="sequence" id="sequence" data-qa-address="authz-monitor:surface:sequence"></section>
  `;

  document.querySelectorAll<HTMLButtonElement>("[data-focus]").forEach((button) => {
    button.addEventListener("click", () => {
      state.focus = (button.dataset["focus"] as FocusMode) ?? "all";
      state.selectedNodeId = null;
      refresh(model);
    });
  });

  renderSequence(document.querySelector<HTMLElement>("#sequence")!);
  refresh(model);
}

renderApp().catch((error) => {
  const app = document.querySelector<HTMLElement>("#app");
  if (app) {
    app.innerHTML = `<pre class="fatal">${escapeHtml(error instanceof Error ? error.message : String(error))}</pre>`;
  }
});
