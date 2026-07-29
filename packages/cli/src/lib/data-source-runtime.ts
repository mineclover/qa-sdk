// @def.boundary docs-control-plane
// @def.doc docs-control-plane

export function closeDataSource(source: unknown): void {
  if (!source || (typeof source !== 'object' && typeof source !== 'function')) return;
  const close = (source as { close?: unknown }).close;
  if (typeof close === 'function') close.call(source);
}
