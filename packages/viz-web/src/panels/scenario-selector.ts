// @def.boundary viz-system-root
// @def.doc viz-system-root

import type { ScenarioSpec } from "@qa-sdk/core";
import { listScenarios } from "../api/ingest-client";

export function createScenarioSelector(
  container: HTMLElement,
  onSelect: (spec: ScenarioSpec) => void,
): void {
  const wrapper = document.createElement("div");
  wrapper.className = "scenario-selector";

  const label = document.createElement("label");
  label.textContent = "Scenario";
  label.className = "panel-label";

  const select = document.createElement("select");
  select.className = "scenario-select";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select a scenario...";
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  const details = document.createElement("div");
  details.className = "scenario-details";

  wrapper.appendChild(label);
  wrapper.appendChild(select);
  wrapper.appendChild(details);
  container.appendChild(wrapper);

  let scenarios: ScenarioSpec[] = [];

  async function loadScenarios(): Promise<void> {
    try {
      scenarios = await listScenarios();

      while (select.options.length > 1) {
        select.remove(1);
      }

      for (const spec of scenarios) {
        const option = document.createElement("option");
        option.value = spec.scenario_id;
        option.textContent = `${spec.scenario_id} (v${spec.version})`;
        select.appendChild(option);
      }
    } catch (err) {
      details.textContent = `Failed to load scenarios: ${err instanceof Error ? err.message : String(err)}`;
      details.className = "scenario-details error";
    }
  }

  select.addEventListener("change", () => {
    const scenarioId = select.value;
    const spec = scenarios.find((s) => s.scenario_id === scenarioId);
    if (!spec) return;

    details.innerHTML = "";
    details.className = "scenario-details";

    const dl = document.createElement("dl");

    const dtDomain = document.createElement("dt");
    dtDomain.textContent = "Domain";
    const ddDomain = document.createElement("dd");
    ddDomain.textContent = spec.domain;
    dl.appendChild(dtDomain);
    dl.appendChild(ddDomain);

    const dtVersion = document.createElement("dt");
    dtVersion.textContent = "Version";
    const ddVersion = document.createElement("dd");
    ddVersion.textContent = spec.version;
    dl.appendChild(dtVersion);
    dl.appendChild(ddVersion);

    const dtSteps = document.createElement("dt");
    dtSteps.textContent = "Steps";
    const ddSteps = document.createElement("dd");
    ddSteps.textContent = String(spec.steps.length);
    dl.appendChild(dtSteps);
    dl.appendChild(ddSteps);

    if (spec.description) {
      const dtDesc = document.createElement("dt");
      dtDesc.textContent = "Description";
      const ddDesc = document.createElement("dd");
      ddDesc.textContent = spec.description;
      dl.appendChild(dtDesc);
      dl.appendChild(ddDesc);
    }

    details.appendChild(dl);
    onSelect(spec);
  });

  void loadScenarios();
}
