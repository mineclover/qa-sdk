// Browser stub for Node's fs module.
// taxonomy-engine의 validateLifecycle은 decisionLink path 존재 확인에 existsSync를 쓰지만
// 브라우저에서는 validate를 호출하지 않으므로 안전한 no-op으로 충분.
export function existsSync(_path: string): boolean {
  return false;
}
