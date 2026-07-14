// @def.boundary sim-gateway
// @def.doc canary-routing-decision
// FNV-1a 32-bit. controller/gateway 모두 동일 알고리즘이어야 sticky 일관성 유지.

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function stickyHashBucket(userId: string): number {
  if (!userId || userId.length === 0) {
    throw new Error('stickyHashBucket: userId is empty');
  }
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0) % 100;
}
