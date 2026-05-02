export interface PlaybookSelectOption {
  value: string;
  label: string;
}

interface PlaybookFieldBase {
  field: string;
  label: string;
  issue?: string;
  idPrefix?: string;
}

interface PlaybookInputField extends PlaybookFieldBase {
  placeholder: string;
  value: string;
}

interface PlaybookTextareaField extends PlaybookFieldBase {
  placeholder: string;
  value: string;
  rows?: number;
}

interface PlaybookSelectField extends PlaybookFieldBase {
  value: string;
  options: PlaybookSelectOption[];
}

interface ActiveFieldSnapshot {
  field: string;
  selectionStart: number | null;
  selectionEnd: number | null;
}

export function renderInputField(options: PlaybookInputField): string {
  return `
    <label class="field">
      <span>${escapeHtml(options.label)}</span>
      <input
        id="${resolveFieldId(options.field, options.idPrefix)}"
        data-field="${options.field}"
        placeholder="${escapeAttribute(options.placeholder)}"
        value="${escapeAttribute(options.value)}"
      />
      ${renderFieldIssue(options.issue)}
    </label>
  `;
}

export function renderTextareaField(options: PlaybookTextareaField): string {
  return `
    <label class="field">
      <span>${escapeHtml(options.label)}</span>
      <textarea
        id="${resolveFieldId(options.field, options.idPrefix)}"
        data-field="${options.field}"
        placeholder="${escapeAttribute(options.placeholder)}"
        rows="${options.rows ?? 4}"
      >${escapeHtml(options.value)}</textarea>
      ${renderFieldIssue(options.issue)}
    </label>
  `;
}

export function renderSelectField(options: PlaybookSelectField): string {
  return `
    <label class="field">
      <span>${escapeHtml(options.label)}</span>
      <select id="${resolveFieldId(options.field, options.idPrefix)}" data-field="${options.field}">
        ${options.options
          .map((option) => renderOption(option.value, option.label, options.value))
          .join('')}
      </select>
      ${renderFieldIssue(options.issue)}
    </label>
  `;
}

export function renderFieldIssue(issue?: string): string {
  return issue ? `<span class="field-issue">${escapeHtml(issue)}</span>` : '';
}

export function captureActiveField(root: HTMLElement): ActiveFieldSnapshot | null {
  const activeElement = root.ownerDocument.activeElement;
  if (
    !(activeElement instanceof HTMLInputElement) &&
    !(activeElement instanceof HTMLTextAreaElement) &&
    !(activeElement instanceof HTMLSelectElement)
  ) {
    return null;
  }

  const field = activeElement.dataset.field;
  if (!field || !root.contains(activeElement)) {
    return null;
  }

  return {
    field,
    selectionStart:
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement
        ? activeElement.selectionStart
        : null,
    selectionEnd:
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement
        ? activeElement.selectionEnd
        : null,
  };
}

export function restoreActiveField(
  root: HTMLElement,
  snapshot: ActiveFieldSnapshot | null,
): void {
  if (!snapshot) {
    return;
  }

  const element = root.querySelector<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >(`[data-field="${snapshot.field}"]`);
  if (!element) {
    return;
  }

  element.focus();

  if (
    snapshot.selectionStart === null ||
    snapshot.selectionEnd === null ||
    (!(element instanceof HTMLInputElement) &&
      !(element instanceof HTMLTextAreaElement))
  ) {
    return;
  }

  element.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function escapeAttribute(value: string): string {
  return escapeHtml(value)
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function resolveFieldId(field: string, idPrefix = 'playbook'): string {
  return `${idPrefix}-${field}`;
}

function renderOption(value: string, label: string, currentValue: string): string {
  return `<option value="${escapeAttribute(value)}" ${
    value === currentValue ? 'selected' : ''
  }>${escapeHtml(label)}</option>`;
}
