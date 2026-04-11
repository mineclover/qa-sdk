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

interface AuthzMonitorModel {
  graph: AuthzGraph;
  proxyGraph: AuthzGraph;
  appGraph: AuthzGraph;
  decisionGraph: AuthzGraph;
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
    proxyGraph,
    appGraph,
    decisionGraph,
  };
}

function graphForFocus(model: AuthzMonitorModel): AuthzGraph {
  if (state.focus === "proxy") return mergeGraphs(model.proxyGraph, model.decisionGraph);
  if (state.focus === "application") return mergeGraphs(model.appGraph, model.decisionGraph);
  return model.graph;
}

function classifyNode(node: AuthzNode): string {
  const resourceKind = node.coord.taxonomies["resource_kind"];
  if (resourceKind === "proxy_route") return "proxy";
  if (resourceKind === "domain_resource") return "application";
  if (node.kind === "decision") return "decision";
  if (node.kind === "policy") return "policy";
  if (node.kind === "enforcement_point") {
    return node.coord.taxonomies["enforcement_kind"] === "service_middleware" ? "application" : "proxy";
  }
  return "neutral";
}

function classifyRelation(relation: AuthzRelation): string {
  if (relation.kind.startsWith("decision_")) return "decision";
  if (relation.kind === "evaluated_by") return "application";
  if (relation.kind === "protects") return "policy";
  if (relation.kind === "enforced_at" || relation.kind === "matches_resource") return "flow";
  return "neutral";
}

function renderSummary(container: HTMLElement, model: AuthzMonitorModel): void {
  const report = auditGraph(model.graph);
  container.innerHTML = `
    <div class="score">
      <span>Audit</span>
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
  const graph = graphForFocus(model);
  const nodes = graph.nodes;
  const nodeIndex = new Map(nodes.map((node, index) => [node.nodeId, index]));
  const width = 940;
  const height = 390;
  const lanes = ["policy", "proxy", "application", "decision", "neutral"];
  const laneY = new Map(lanes.map((lane, index) => [lane, 58 + index * 76]));
  const laneCounts = new Map<string, number>();
  const positions = new Map<string, { x: number; y: number }>();

  for (const node of nodes) {
    const lane = classifyNode(node);
    const count = laneCounts.get(lane) ?? 0;
    laneCounts.set(lane, count + 1);
    positions.set(node.nodeId, {
      x: Math.min(95 + count * 155 + (lane === "decision" ? 40 : 0), width - 100),
      y: laneY.get(lane) ?? 350,
    });
  }

  const lines = graph.relations
    .map((relation) => {
      const start = positions.get(relation.fromNodeId);
      const end = positions.get(relation.toNodeId);
      if (!start || !end) return "";
      return `<path class="edge ${classifyRelation(relation)}" d="M ${start.x} ${start.y} C ${(start.x + end.x) / 2} ${start.y}, ${(start.x + end.x) / 2} ${end.y}, ${end.x} ${end.y}" />`;
    })
    .join("");

  const nodeMarkup = nodes
    .map((node) => {
      const pos = positions.get(node.nodeId);
      if (!pos) return "";
      const selected = state.selectedNodeId === node.nodeId ? " selected" : "";
      return `
        <button class="node ${classifyNode(node)}${selected}" style="left:${pos.x - 58}px;top:${pos.y - 23}px" data-node-index="${nodeIndex.get(node.nodeId)}">
          <span>${escapeHtml(node.kind)}</span>
          <b>${escapeHtml(node.coord.anchor)}</b>
        </button>
      `;
    })
    .join("");

  container.innerHTML = `
    <div class="lanes">
      <span style="top:40px">policy</span>
      <span style="top:116px">proxy gate</span>
      <span style="top:192px">application gate</span>
      <span style="top:268px">decision</span>
    </div>
    <svg class="graph-svg" viewBox="0 0 ${width} ${height}" aria-hidden="true">${lines}</svg>
    <div class="graph-nodes">${nodeMarkup}</div>
  `;

  container.querySelectorAll<HTMLButtonElement>(".node").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset["nodeIndex"]);
      state.selectedNodeId = nodes[index]?.nodeId ?? null;
      refresh(model);
    });
  });
}

function renderInspector(container: HTMLElement, model: AuthzMonitorModel): void {
  const selected = state.selectedNodeId
    ? model.graph.nodes.find((node) => node.nodeId === state.selectedNodeId)
    : null;
  if (!selected) {
    container.innerHTML = `
      <div class="empty">
        <b>관측 노드를 선택하세요</b>
        <span>route, middleware, policy, decision 좌표와 relation을 확인합니다.</span>
      </div>
    `;
    return;
  }

  const incoming = model.graph.relations.filter((relation) => relation.toNodeId === selected.nodeId);
  const outgoing = model.graph.relations.filter((relation) => relation.fromNodeId === selected.nodeId);
  container.innerHTML = `
    <div class="ins-head">
      <span>${escapeHtml(selected.kind)}</span>
      <b>${escapeHtml(selected.coord.anchor)}</b>
    </div>
    <dl class="ins-meta">
      <dt>realm</dt><dd>${escapeHtml(selected.coord.realm)}</dd>
      <dt>space</dt><dd>${escapeHtml(selected.coord.space)}</dd>
      <dt>taxonomy</dt><dd>${escapeHtml(JSON.stringify(selected.coord.taxonomies))}</dd>
    </dl>
    <div class="rel-list">
      <h4>incoming</h4>
      ${incoming.map((relation) => `<code>${escapeHtml(relation.kind)}</code>`).join("") || "<span>none</span>"}
      <h4>outgoing</h4>
      ${outgoing.map((relation) => `<code>${escapeHtml(relation.kind)}</code>`).join("") || "<span>none</span>"}
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

function renderApp(): void {
  const model = buildModel();
  const app = document.querySelector<HTMLElement>("#app");
  if (!app) return;

  app.innerHTML = `
    <section class="head">
      <div>
        <p class="eyebrow">Authorization Ontology Monitor</p>
        <h1>권한은 두 번 막고, 한 번의 graph로 관측한다.</h1>
        <p>프록시는 입구를 차단하고, 애플리케이션은 도메인 리소스를 확인합니다. 두 계층의 Cerbos policy와 decision을 같은 좌표계에서 비교합니다.</p>
      </div>
      <div id="summary" class="summary"></div>
    </section>
    <section class="controls" aria-label="권한 관측 필터">
      <button data-focus="all" class="active">전체 경로</button>
      <button data-focus="proxy">프록시 부여</button>
      <button data-focus="application">애플리케이션 부여</button>
    </section>
    <section class="workspace">
      <div class="graph" id="graph"></div>
      <aside class="inspector" id="inspector"></aside>
    </section>
    <section class="sequence" id="sequence"></section>
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

renderApp();
