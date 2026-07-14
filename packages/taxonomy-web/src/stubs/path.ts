// Browser stub for Node's path module.
// validateLifecycle만 사용하며 브라우저에서는 호출되지 않으므로 no-op으로 충분.
export function isAbsolute(_p: string): boolean {
  return false;
}

export function resolve(...segments: string[]): string {
  return segments.join('/');
}

export function dirname(p: string): string {
  const idx = p.lastIndexOf('/');
  return idx < 0 ? '' : p.slice(0, idx);
}
