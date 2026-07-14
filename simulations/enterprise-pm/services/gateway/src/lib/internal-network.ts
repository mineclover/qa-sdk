// @def.boundary sim-gateway
// @def.doc canary-routing-decision
// spec 02 §3.4 — internal IP only escape hatch.
// 값 출처는 docker compose network 정의이며, INTERNAL_CIDRS env는 단순 전달 채널.

export interface Cidr {
  base: number;
  mask: number;
  prefixLen: number;
}

function ipToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let v = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n < 0 || n > 255) return null;
    v = (v * 256 + n) >>> 0;
  }
  return v >>> 0;
}

export function parseCidrList(input: string): Cidr[] {
  const trimmed = input.trim();
  if (trimmed.length === 0) return [];
  const out: Cidr[] = [];
  for (const item of trimmed.split(',')) {
    const cidr = item.trim();
    const m = cidr.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/);
    if (!m) throw new Error(`invalid CIDR: ${cidr}`);
    const baseInt = ipToInt(m[1]!);
    if (baseInt === null) throw new Error(`invalid CIDR base: ${cidr}`);
    const prefixLen = Number(m[2]);
    if (prefixLen < 0 || prefixLen > 32) throw new Error(`invalid CIDR prefix: ${cidr}`);
    const mask = prefixLen === 0 ? 0 : (0xffffffff << (32 - prefixLen)) >>> 0;
    out.push({ base: (baseInt & mask) >>> 0, mask, prefixLen });
  }
  return out;
}

export function isInternalIp(ip: string, cidrs: Cidr[]): boolean {
  const v = ipToInt(ip);
  if (v === null) return false;
  for (const c of cidrs) {
    if ((v & c.mask) >>> 0 === c.base) return true;
  }
  return false;
}
