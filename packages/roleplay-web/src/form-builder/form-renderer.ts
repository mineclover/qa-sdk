import type { DomNode } from "./dom-tree.js";

export function renderFormPreview(
  container: HTMLElement,
  root: DomNode,
): () => void {
  function render(): void {
    container.innerHTML = "";
    const el = buildElement(root);
    container.appendChild(el);
  }

  render();

  return render;
}

function buildElement(node: DomNode): HTMLElement {
  const el = document.createElement(node.tag);

  // Apply attributes
  for (const [key, value] of Object.entries(node.attributes)) {
    el.setAttribute(key, value);
  }

  // Apply inline styles
  for (const [prop, value] of Object.entries(node.styles)) {
    el.style.setProperty(camelToKebab(prop), value);
  }

  // Set text content only for leaf nodes (no children)
  if (node.textContent && node.children.length === 0) {
    el.textContent = node.textContent;
  }

  // Recursively build children
  for (const child of node.children) {
    if (node.textContent && child === node.children[0]) {
      // If parent has text content and children, prepend text as text node
      const textNode = document.createTextNode(node.textContent);
      el.appendChild(textNode);
    }
    el.appendChild(buildElement(child));
  }

  // If has text and children but we haven't added text yet
  if (node.textContent && node.children.length > 0) {
    const firstChild = el.firstChild;
    if (!firstChild || firstChild.nodeType !== Node.TEXT_NODE) {
      el.insertBefore(
        document.createTextNode(node.textContent),
        el.firstChild,
      );
    }
  }

  // Data attribute for selection in the builder
  el.dataset.nodeId = node.id;

  return el;
}

function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
