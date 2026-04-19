// @def.boundary experience-layer-group
// @def.doc experience-layer-group

import './styles/main.css';
import './styles/tree-view.css';
import './styles/form-builder.css';

import {
  createNode,
  addChild,
  removeChild,
  findNode,
  findParent,
  cloneNode,
  createDefaultTree,
  type DomNode,
} from './form-builder/dom-tree.js';
import { createTreeView } from './form-builder/tree-view.js';
import { createElementEditor } from './form-builder/element-editor.js';
import { renderFormPreview } from './form-builder/form-renderer.js';
import { createQaBridge } from './sdk/qa-bridge.js';
import { createEventEmitter } from './sdk/event-emitter.js';
import { createChildBridge } from './iframe/child-bridge.js';
import { VIZ_WEB_ORIGIN } from './config.js';

// ── State ───────────────────────────────────────────────

let rootNode: DomNode = createDefaultTree();
let selectedNode: DomNode | null = null;

// ── DOM References ──────────────────────────────────────

/* eslint-disable typescript/no-non-null-assertion -- HTML 템플릿에 정의된 요소 */
const treePanel = document.getElementById('tree-panel')!;
const formPreview = document.getElementById('form-preview')!;
const editorPanel = document.getElementById('editor-panel')!;
const statusEl = document.getElementById('connection-status')!;
/* eslint-enable typescript/no-non-null-assertion */

// ── SDK Initialization ──────────────────────────────────

const bridge = createQaBridge({
  onError(err, context) {
    console.error(`[roleplay-web:sdk:${context}]`, err);
    statusEl.textContent = `SDK error (${context}): ${err.message}`;
    statusEl.className = 'toolbar-label status-error';
  },
});
const childBridge = createChildBridge(VIZ_WEB_ORIGIN);
const eventEmitter = createEventEmitter(bridge, childBridge);

// ── Listen for context from parent (viz-web) ────────────

childBridge.onContext((ctx) => {
  bridge.startSession(ctx.scenarioId, ctx.sessionId);
  statusEl.textContent = `session: ${ctx.sessionId.slice(0, 8)}...`;
  statusEl.className = 'toolbar-label status-connected';
});

// ── Form Builder Setup ──────────────────────────────────

const treeView = createTreeView(treePanel, rootNode, onNodeSelect);
const elementEditor = createElementEditor(editorPanel, onNodeChange);
let rerender = renderFormPreview(formPreview, rootNode);

treeView.render();
attachPreviewEvents();

function onNodeSelect(node: DomNode): void {
  selectedNode = node;
  elementEditor.setNode(node);
  highlightPreviewNode(node.id);
}

function onNodeChange(_node: DomNode): void {
  fullUpdate();
}

function fullUpdate(): void {
  treeView.update(rootNode);
  rerender();
  attachPreviewEvents();
  if (selectedNode) {
    highlightPreviewNode(selectedNode.id);
  }
}

function attachPreviewEvents(): void {
  eventEmitter.detach();
  eventEmitter.attach(formPreview);

  // Click-to-select in preview
  formPreview.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-node-id]') as HTMLElement | null;
    if (!target) return;
    const nodeId = target.dataset.nodeId;
    if (!nodeId) return;
    const node = findNode(rootNode, nodeId);
    if (node) {
      selectedNode = node;
      treeView.selectNode(node.id);
      elementEditor.setNode(node);
      highlightPreviewNode(node.id);
    }
  });
}

function highlightPreviewNode(nodeId: string): void {
  formPreview
    .querySelectorAll('.node-selected')
    .forEach((el) => el.classList.remove('node-selected'));
  const el = formPreview.querySelector(`[data-node-id="${nodeId}"]`);
  if (el) {
    el.classList.add('node-selected');
  }
}

// ── Toolbar: Add Element ────────────────────────────────

document.querySelectorAll<HTMLButtonElement>('[data-add-tag]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tag = btn.dataset['addTag'];
    if (!tag) return;
    const newNode = createNode(tag);

    // Set sensible defaults for new elements
    if (tag === 'button') newNode.textContent = 'Button';
    if (tag === 'label') newNode.textContent = 'Label';
    if (tag === 'p') newNode.textContent = 'Paragraph text';
    if (tag === 'h2') newNode.textContent = 'Heading';
    if (tag === 'input') {
      newNode.attributes.type = 'text';
      newNode.attributes.placeholder = 'Enter text...';
    }
    if (tag === 'textarea') {
      newNode.attributes.placeholder = 'Enter text...';
      newNode.attributes.rows = '3';
    }

    const parent = selectedNode ?? rootNode;
    // If selected node is a void element, add to its parent instead
    const voidElements = new Set(['input', 'img', 'br', 'hr']);
    if (voidElements.has(parent.tag)) {
      const grandParent = findParent(rootNode, parent.id);
      if (grandParent) {
        addChild(grandParent, newNode);
      } else {
        addChild(rootNode, newNode);
      }
    } else {
      addChild(parent, newNode);
    }

    fullUpdate();
  });
});

// ── Toolbar: Delete ─────────────────────────────────────

// eslint-disable-next-line typescript/no-non-null-assertion -- HTML 템플릿에 정의된 요소
document.getElementById('btn-delete')!.addEventListener('click', () => {
  if (!selectedNode || selectedNode.id === rootNode.id) return;
  const parent = findParent(rootNode, selectedNode.id);
  if (parent) {
    removeChild(parent, selectedNode.id);
    selectedNode = null;
    elementEditor.clear();
    fullUpdate();
  }
});

// ── Toolbar: Duplicate ──────────────────────────────────

// eslint-disable-next-line typescript/no-non-null-assertion -- HTML 템플릿에 정의된 요소
document.getElementById('btn-duplicate')!.addEventListener('click', () => {
  if (!selectedNode || selectedNode.id === rootNode.id) return;
  const parent = findParent(rootNode, selectedNode.id);
  if (parent) {
    const dup = cloneNode(selectedNode);
    addChild(parent, dup);
    fullUpdate();
  }
});

// ── Toolbar: Clear All ──────────────────────────────────

// eslint-disable-next-line typescript/no-non-null-assertion -- HTML 템플릿에 정의된 요소
document.getElementById('btn-clear')!.addEventListener('click', () => {
  rootNode = createDefaultTree();
  selectedNode = null;
  elementEditor.clear();
  treeView.update(rootNode);
  rerender = renderFormPreview(formPreview, rootNode);
  attachPreviewEvents();
});

// ── Cleanup on unload ───────────────────────────────────

window.addEventListener('beforeunload', () => {
  eventEmitter.detach();
  childBridge.destroy();
  void bridge.shutdown();
});
