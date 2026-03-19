import { renderGlossaryPage } from "./pages/glossary.js";
import { renderPrefixBuilderPage } from "./pages/prefix-builder.js";
import { renderDslBuilderPage } from "./pages/dsl-builder.js";

type TabId = "glossary" | "prefix-builder" | "dsl-builder";

const tabs = document.querySelectorAll<HTMLButtonElement>(".rui-tab");
const pages = document.querySelectorAll<HTMLElement>(".rui-page");

const containers: Record<TabId, HTMLElement> = {
  glossary: document.getElementById("glossary-container")!,
  "prefix-builder": document.getElementById("prefix-builder-container")!,
  "dsl-builder": document.getElementById("dsl-builder-container")!,
};

const rendered = new Set<TabId>();

function switchTab(id: TabId) {
  tabs.forEach((t) => {
    const active = t.dataset.tab === id;
    t.classList.toggle("active", active);
    t.setAttribute("aria-selected", String(active));
  });

  pages.forEach((p) => p.classList.toggle("rui-hidden", p.id !== `page-${id}`));

  if (!rendered.has(id)) {
    rendered.add(id);
    if (id === "glossary") renderGlossaryPage(containers.glossary);
    if (id === "prefix-builder") renderPrefixBuilderPage(containers["prefix-builder"]);
    if (id === "dsl-builder") renderDslBuilderPage(containers["dsl-builder"]);
  }
}

tabs.forEach((t) =>
  t.addEventListener("click", () => switchTab(t.dataset.tab as TabId)),
);

switchTab("prefix-builder");
