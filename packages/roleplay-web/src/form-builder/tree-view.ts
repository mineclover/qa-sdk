import type { DomNode } from "./dom-tree.js";

export interface TreeView {
  render(): void;
  update(root: DomNode): void;
  selectNode(id: string): void;
}

export function createTreeView(
  container: HTMLElement,
  root: DomNode,
  onSelect: (node: DomNode) => void,
): TreeView {
  let currentRoot = root;
  let selectedId: string | null = null;
  const expandedSet = new Set<string>();

  // Expand root and first-level children by default
  expandedSet.add(root.id);
  for (const child of root.children) {
    expandedSet.add(child.id);
  }

  function renderNode(node: DomNode, depth: number): HTMLElement {
    const row = document.createElement("div");
    row.className = "tree-row";
    row.dataset.nodeId = node.id;
    if (node.id === selectedId) {
      row.classList.add("tree-row--selected");
    }

    row.style.paddingLeft = `${depth * 16 + 4}px`;

    const hasChildren = node.children.length > 0;
    const isExpanded = expandedSet.has(node.id);

    // Expand/collapse arrow
    const arrow = document.createElement("span");
    arrow.className = "tree-arrow";
    if (hasChildren) {
      arrow.textContent = isExpanded ? "\u25BE" : "\u25B8";
      arrow.addEventListener("click", (e) => {
        e.stopPropagation();
        if (expandedSet.has(node.id)) {
          expandedSet.delete(node.id);
        } else {
          expandedSet.add(node.id);
        }
        renderTree();
      });
    } else {
      arrow.textContent = " ";
    }

    // Tag label
    const label = document.createElement("span");
    label.className = "tree-tag";
    const attrStr = formatAttrs(node);
    const text = node.textContent
      ? ` "${truncate(node.textContent, 20)}"`
      : "";
    label.innerHTML = `<span class="tree-bracket">&lt;</span><span class="tree-tagname">${node.tag}</span>${attrStr}<span class="tree-bracket">&gt;</span><span class="tree-text">${escapeHtml(text)}</span>`;

    row.appendChild(arrow);
    row.appendChild(label);

    row.addEventListener("click", () => {
      selectedId = node.id;
      onSelect(node);
      renderTree();
    });

    const fragment = document.createElement("div");
    fragment.appendChild(row);

    if (hasChildren && isExpanded) {
      for (const child of node.children) {
        fragment.appendChild(renderNode(child, depth + 1));
      }
      // Closing tag
      const closing = document.createElement("div");
      closing.className = "tree-row tree-closing";
      closing.style.paddingLeft = `${depth * 16 + 4}px`;
      closing.innerHTML = `<span class="tree-arrow"> </span><span class="tree-tag"><span class="tree-bracket">&lt;/</span><span class="tree-tagname">${node.tag}</span><span class="tree-bracket">&gt;</span></span>`;
      fragment.appendChild(closing);
    }

    return fragment;
  }

  function renderTree(): void {
    container.innerHTML = "";
    container.appendChild(renderNode(currentRoot, 0));
  }

  function formatAttrs(node: DomNode): string {
    const entries = Object.entries(node.attributes);
    if (entries.length === 0) return "";
    return entries
      .map(
        ([k, v]) =>
          ` <span class="tree-attrname">${escapeHtml(k)}</span>=<span class="tree-attrval">"${escapeHtml(v)}"</span>`,
      )
      .join("");
  }

  return {
    render(): void {
      renderTree();
    },

    update(root: DomNode): void {
      currentRoot = root;
      renderTree();
    },

    selectNode(id: string): void {
      selectedId = id;
      renderTree();
    },
  };
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + "..." : str;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (ch) => map[ch] ?? ch);
}
