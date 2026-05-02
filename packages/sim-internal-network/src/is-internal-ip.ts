// @def.boundary sim-internal-network
// spec 2026-05-02 §3 — internal IP only auth. 외부는 caller가 404 silent 처리.

interface Cidr4 { base: number; mask: number; }

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
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

function makeCidr(ip: string, prefixLen: number): Cidr4 {
  const baseInt = ipv4ToInt(ip);
  if (baseInt === null) throw new Error(`invalid CIDR base: ${ip}`);
  const mask = prefixLen === 0 ? 0 : (0xffffffff << (32 - prefixLen)) >>> 0;
  return { base: (baseInt & mask) >>> 0, mask };
}

const INTERNAL_V4: Cidr4[] = [
  makeCidr("10.0.0.0", 8), makeCidr("172.16.0.0", 12),
  makeCidr("192.168.0.0", 16), makeCidr("127.0.0.0", 8),
];

function isInternalV4(ip: string): boolean {
  const v = ipv4ToInt(ip);
  if (v === null) return false;
  for (const c of INTERNAL_V4) if (((v & c.mask) >>> 0) === c.base) return true;
  return false;
}

export function isInternalIp(ip: string): boolean {
  if (typeof ip !== "string" || ip.length === 0) return false;
  if (ip === "::1") return true;
  if (ip.startsWith("::ffff:")) return isInternalV4(ip.slice("::ffff:".length));
  return isInternalV4(ip);
}
