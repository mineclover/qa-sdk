// @def.boundary experience-layer-group
// @def.doc experience-layer-group

import Handlebars from 'handlebars';

export function renderTemplate(template: string, variables: Record<string, unknown>): string {
  try {
    const compiled = Handlebars.compile(template);
    return compiled(variables);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[renderTemplate] Failed to compile template:', message);
    return `<div class="template-error">Template error: ${escapeHtml(message)}</div>`;
  }
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (ch) => map[ch] ?? ch);
}
