import type { DomNode } from './dom-tree.js';

export interface ElementEditor {
  setNode(node: DomNode): void;
  clear(): void;
}

const AVAILABLE_TAGS = [
  'div',
  'form',
  'input',
  'button',
  'label',
  'select',
  'textarea',
  'option',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'span',
  'a',
  'img',
  'ul',
  'ol',
  'li',
] as const;

const COMMON_STYLES: {
  label: string;
  property: string;
  type: 'text' | 'select';
  options?: string[];
}[] = [
  {
    label: 'Display',
    property: 'display',
    type: 'select',
    options: ['block', 'flex', 'inline', 'inline-flex', 'grid', 'none'],
  },
  {
    label: 'Flex Direction',
    property: 'flexDirection',
    type: 'select',
    options: ['row', 'column', 'row-reverse', 'column-reverse'],
  },
  {
    label: 'Justify Content',
    property: 'justifyContent',
    type: 'select',
    options: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'],
  },
  {
    label: 'Align Items',
    property: 'alignItems',
    type: 'select',
    options: ['flex-start', 'center', 'flex-end', 'stretch', 'baseline'],
  },
  { label: 'Gap', property: 'gap', type: 'text' },
  { label: 'Padding', property: 'padding', type: 'text' },
  { label: 'Margin', property: 'margin', type: 'text' },
  { label: 'Width', property: 'width', type: 'text' },
  { label: 'Height', property: 'height', type: 'text' },
  { label: 'Background', property: 'background', type: 'text' },
  { label: 'Color', property: 'color', type: 'text' },
  { label: 'Font Size', property: 'fontSize', type: 'text' },
  { label: 'Border', property: 'border', type: 'text' },
  { label: 'Border Radius', property: 'borderRadius', type: 'text' },
];

export function createElementEditor(
  container: HTMLElement,
  onChange: (node: DomNode) => void,
): ElementEditor {
  let currentNode: DomNode | null = null;

  function renderEditor(): void {
    container.innerHTML = '';
    if (!currentNode) {
      container.innerHTML = '<div class="editor-empty">Select an element to edit</div>';
      return;
    }

    const node = currentNode;

    // -- Tag section --
    const tagSection = createSection('Tag');
    const tagSelect = document.createElement('select');
    tagSelect.className = 'editor-input';
    for (const tag of AVAILABLE_TAGS) {
      const opt = document.createElement('option');
      opt.value = tag;
      opt.textContent = `<${tag}>`;
      if (tag === node.tag) opt.selected = true;
      tagSelect.appendChild(opt);
    }
    tagSelect.addEventListener('change', () => {
      node.tag = tagSelect.value;
      onChange(node);
    });
    tagSection.appendChild(tagSelect);
    container.appendChild(tagSection);

    // -- Text Content section --
    const textSection = createSection('Text Content');
    const textInput = document.createElement('input');
    textInput.className = 'editor-input';
    textInput.type = 'text';
    textInput.value = node.textContent ?? '';
    textInput.placeholder = 'Text content...';
    textInput.addEventListener('input', () => {
      node.textContent = textInput.value || undefined;
      onChange(node);
    });
    textSection.appendChild(textInput);
    container.appendChild(textSection);

    // -- Attributes section --
    const attrSection = createSection('Attributes');
    renderAttributes(attrSection, node, onChange);
    container.appendChild(attrSection);

    // -- Styles section --
    const styleSection = createSection('Styles');
    renderStyles(styleSection, node, onChange);
    container.appendChild(styleSection);
  }

  return {
    setNode(node: DomNode): void {
      currentNode = node;
      renderEditor();
    },

    clear(): void {
      currentNode = null;
      renderEditor();
    },
  };
}

function createSection(title: string): HTMLElement {
  const section = document.createElement('div');
  section.className = 'editor-section';

  const header = document.createElement('div');
  header.className = 'editor-section-title';
  header.textContent = title;
  section.appendChild(header);

  return section;
}

function renderAttributes(
  container: HTMLElement,
  node: DomNode,
  onChange: (node: DomNode) => void,
): void {
  const entries = Object.entries(node.attributes);

  for (const [key, value] of entries) {
    const row = createKeyValueRow(
      key,
      value,
      (newKey, newValue) => {
        if (newKey !== key) {
          delete node.attributes[key];
        }
        if (newKey) {
          node.attributes[newKey] = newValue;
        }
        onChange(node);
      },
      () => {
        delete node.attributes[key];
        onChange(node);
        renderAttributes(clearContent(container), node, onChange);
      },
    );
    container.appendChild(row);
  }

  const addBtn = document.createElement('button');
  addBtn.className = 'editor-btn editor-btn--add';
  addBtn.textContent = '+ Add Attribute';
  addBtn.addEventListener('click', () => {
    const newKey = `attr${Object.keys(node.attributes).length}`;
    node.attributes[newKey] = '';
    onChange(node);
    renderAttributes(clearContent(container), node, onChange);
  });
  container.appendChild(addBtn);
}

function renderStyles(
  container: HTMLElement,
  node: DomNode,
  onChange: (node: DomNode) => void,
): void {
  for (const styleDef of COMMON_STYLES) {
    const row = document.createElement('div');
    row.className = 'editor-row';

    const label = document.createElement('label');
    label.className = 'editor-label';
    label.textContent = styleDef.label;
    row.appendChild(label);

    if (styleDef.type === 'select' && styleDef.options) {
      const select = document.createElement('select');
      select.className = 'editor-input';

      const emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.textContent = '--';
      select.appendChild(emptyOpt);

      for (const opt of styleDef.options) {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        if (node.styles[styleDef.property] === opt) option.selected = true;
        select.appendChild(option);
      }

      select.addEventListener('change', () => {
        if (select.value) {
          node.styles[styleDef.property] = select.value;
        } else {
          delete node.styles[styleDef.property];
        }
        onChange(node);
      });
      row.appendChild(select);
    } else {
      const input = document.createElement('input');
      input.className = 'editor-input';
      input.type = 'text';
      input.value = node.styles[styleDef.property] ?? '';
      input.placeholder = styleDef.property;
      input.addEventListener('change', () => {
        if (input.value) {
          node.styles[styleDef.property] = input.value;
        } else {
          delete node.styles[styleDef.property];
        }
        onChange(node);
      });
      row.appendChild(input);
    }

    container.appendChild(row);
  }

  // Custom style entries not in COMMON_STYLES
  const commonProps = new Set(COMMON_STYLES.map((s) => s.property));
  const customEntries = Object.entries(node.styles).filter(([k]) => !commonProps.has(k));

  for (const [key, value] of customEntries) {
    const row = createKeyValueRow(
      key,
      value,
      (newKey, newValue) => {
        if (newKey !== key) delete node.styles[key];
        if (newKey) node.styles[newKey] = newValue;
        onChange(node);
      },
      () => {
        delete node.styles[key];
        onChange(node);
      },
    );
    container.appendChild(row);
  }
}

function createKeyValueRow(
  key: string,
  value: string,
  onUpdate: (newKey: string, newValue: string) => void,
  onRemove: () => void,
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'editor-row editor-row--kv';

  const keyInput = document.createElement('input');
  keyInput.className = 'editor-input editor-input--key';
  keyInput.type = 'text';
  keyInput.value = key;

  const valInput = document.createElement('input');
  valInput.className = 'editor-input editor-input--val';
  valInput.type = 'text';
  valInput.value = value;

  const removeBtn = document.createElement('button');
  removeBtn.className = 'editor-btn editor-btn--remove';
  removeBtn.textContent = '\u00D7';
  removeBtn.addEventListener('click', onRemove);

  keyInput.addEventListener('change', () => {
    onUpdate(keyInput.value, valInput.value);
  });
  valInput.addEventListener('change', () => {
    onUpdate(keyInput.value, valInput.value);
  });

  row.appendChild(keyInput);
  row.appendChild(valInput);
  row.appendChild(removeBtn);
  return row;
}

function clearContent(section: HTMLElement): HTMLElement {
  // Keep the section title, remove everything else
  const title = section.querySelector('.editor-section-title');
  section.innerHTML = '';
  if (title) section.appendChild(title);
  return section;
}
