import type { VerdictReport, Verdict, StepMatch } from "@qa-sdk/core";

export interface VerdictPanel {
  showVerdict(report: VerdictReport): void;
  clear(): void;
}

function verdictColorClass(v: Verdict): string {
  switch (v) {
    case "pass":
      return "verdict-pass";
    case "fail":
      return "verdict-fail";
    case "warn":
      return "verdict-warn";
    case "degraded":
      return "verdict-degraded";
    case "unknown":
      return "verdict-unknown";
  }
}

function createStepMatchRow(match: StepMatch): HTMLElement {
  const row = document.createElement("div");
  row.className = `step-match ${verdictColorClass(match.verdict)}`;

  const header = document.createElement("div");
  header.className = "step-match-header";

  const idSpan = document.createElement("span");
  idSpan.className = "step-id";
  idSpan.textContent = match.step_id;

  const verdictBadge = document.createElement("span");
  verdictBadge.className = `verdict-badge ${verdictColorClass(match.verdict)}`;
  verdictBadge.textContent = match.verdict.toUpperCase();

  header.appendChild(idSpan);
  header.appendChild(verdictBadge);
  row.appendChild(header);

  if (match.matched_node_id) {
    const nodeInfo = document.createElement("div");
    nodeInfo.className = "step-match-node";
    nodeInfo.textContent = `Matched: ${match.matched_node_id}`;
    row.appendChild(nodeInfo);
  }

  if (match.constraint_results.length > 0) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = `Constraints (${match.constraint_results.length})`;
    details.appendChild(summary);

    const constraintList = document.createElement("ul");
    constraintList.className = "constraint-list";

    for (const cr of match.constraint_results) {
      const li = document.createElement("li");
      li.className = cr.passed ? "constraint-pass" : "constraint-fail";
      li.textContent = `${cr.constraint.field} ${cr.constraint.op} ${cr.constraint.value !== undefined ? JSON.stringify(cr.constraint.value) : ""} - ${cr.passed ? "PASS" : "FAIL"}`;
      if (cr.actual !== undefined) {
        li.textContent += ` (actual: ${JSON.stringify(cr.actual)})`;
      }
      constraintList.appendChild(li);
    }

    details.appendChild(constraintList);
    row.appendChild(details);
  }

  return row;
}

export function createVerdictPanel(container: HTMLElement): VerdictPanel {
  const wrapper = document.createElement("div");
  wrapper.className = "verdict-panel";

  const header = document.createElement("div");
  header.className = "panel-label";
  header.textContent = "Verdict";

  const content = document.createElement("div");
  content.className = "verdict-content";

  wrapper.appendChild(header);
  wrapper.appendChild(content);
  container.appendChild(wrapper);

  return {
    showVerdict(report: VerdictReport) {
      content.innerHTML = "";

      const overallSection = document.createElement("div");
      overallSection.className = "verdict-overall";

      const overallBadge = document.createElement("div");
      overallBadge.className = `verdict-badge-large ${verdictColorClass(report.overall_verdict)}`;
      overallBadge.textContent = report.overall_verdict.toUpperCase();

      const summaryText = document.createElement("p");
      summaryText.className = "verdict-summary";
      summaryText.textContent = report.summary;

      const metaInfo = document.createElement("div");
      metaInfo.className = "verdict-meta";
      metaInfo.textContent = `Scenario: ${report.scenario_id} | Trace: ${report.trace_id} | Computed: ${report.computed_at}`;

      overallSection.appendChild(overallBadge);
      overallSection.appendChild(summaryText);
      overallSection.appendChild(metaInfo);
      content.appendChild(overallSection);

      if (report.step_matches.length > 0) {
        const matchesSection = document.createElement("div");
        matchesSection.className = "verdict-matches";

        const matchesTitle = document.createElement("h4");
        matchesTitle.textContent = "Step Matches";
        matchesSection.appendChild(matchesTitle);

        for (const match of report.step_matches) {
          matchesSection.appendChild(createStepMatchRow(match));
        }
        content.appendChild(matchesSection);
      }

      if (report.missing_steps.length > 0) {
        const missingSection = document.createElement("div");
        missingSection.className = "verdict-missing";

        const missingTitle = document.createElement("h4");
        missingTitle.textContent = "Missing Steps";
        missingSection.appendChild(missingTitle);

        const missingList = document.createElement("ul");
        for (const stepId of report.missing_steps) {
          const li = document.createElement("li");
          li.textContent = stepId;
          missingList.appendChild(li);
        }
        missingSection.appendChild(missingList);
        content.appendChild(missingSection);
      }

      if (report.unexpected_nodes.length > 0) {
        const unexpectedSection = document.createElement("div");
        unexpectedSection.className = "verdict-unexpected";

        const unexpectedTitle = document.createElement("h4");
        unexpectedTitle.textContent = "Unexpected Nodes";
        unexpectedSection.appendChild(unexpectedTitle);

        const unexpectedList = document.createElement("ul");
        for (const nodeId of report.unexpected_nodes) {
          const li = document.createElement("li");
          li.textContent = nodeId;
          unexpectedList.appendChild(li);
        }
        unexpectedSection.appendChild(unexpectedList);
        content.appendChild(unexpectedSection);
      }

      if (report.latency_violations.length > 0) {
        const latencySection = document.createElement("div");
        latencySection.className = "verdict-latency";

        const latencyTitle = document.createElement("h4");
        latencyTitle.textContent = "Latency Violations";
        latencySection.appendChild(latencyTitle);

        const latencyList = document.createElement("ul");
        for (const v of report.latency_violations) {
          const li = document.createElement("li");
          li.textContent = `${v.step_id}: expected ${v.expected_ms}ms, actual ${v.actual_ms}ms`;
          latencyList.appendChild(li);
        }
        latencySection.appendChild(latencyList);
        content.appendChild(latencySection);
      }
    },

    clear() {
      content.innerHTML = "";
    },
  };
}
