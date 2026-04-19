// @def.boundary experience-layer-group
// @def.doc experience-layer-group

export interface DomNode {
  id: string;
  tag: string;
  attributes: Record<string, string>;
  styles: Record<string, string>;
  children: DomNode[];
  textContent?: string;
}

export function createNode(tag: string, attrs?: Record<string, string>): DomNode {
  return {
    id: crypto.randomUUID(),
    tag,
    attributes: { ...attrs },
    styles: {},
    children: [],
  };
}

export function addChild(parent: DomNode, child: DomNode): void {
  parent.children.push(child);
}

export function removeChild(parent: DomNode, childId: string): void {
  const idx = parent.children.findIndex((c) => c.id === childId);
  if (idx !== -1) {
    parent.children.splice(idx, 1);
  }
}

export function findNode(root: DomNode, id: string): DomNode | undefined {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return undefined;
}

export function findParent(root: DomNode, childId: string): DomNode | undefined {
  for (const child of root.children) {
    if (child.id === childId) return root;
    const found = findParent(child, childId);
    if (found) return found;
  }
  return undefined;
}

export function cloneNode(node: DomNode): DomNode {
  return {
    id: crypto.randomUUID(),
    tag: node.tag,
    attributes: { ...node.attributes },
    styles: { ...node.styles },
    children: node.children.map(cloneNode),
    textContent: node.textContent,
  };
}

export function createDefaultTree(): DomNode {
  const root = createNode('div', { class: 'form-container' });
  root.styles = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '24px',
  };

  const form = createNode('form', { id: 'main-form' });
  form.styles = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  };

  const nameLabel = createNode('label');
  nameLabel.textContent = 'Name';

  const nameInput = createNode('input', {
    type: 'text',
    name: 'name',
    placeholder: 'Enter your name',
  });

  const emailLabel = createNode('label');
  emailLabel.textContent = 'Email';

  const emailInput = createNode('input', {
    type: 'email',
    name: 'email',
    placeholder: 'Enter your email',
  });

  const submitBtn = createNode('button', { type: 'submit' });
  submitBtn.textContent = 'Submit';

  addChild(form, nameLabel);
  addChild(form, nameInput);
  addChild(form, emailLabel);
  addChild(form, emailInput);
  addChild(form, submitBtn);
  addChild(root, form);

  return root;
}
