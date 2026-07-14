// @def.boundary sim-gateway
// @def.doc canary-routing-decision

import { describe, it, expect } from 'vitest';
import { isInternalIp, parseCidrList } from './internal-network.js';

describe('internal-network IPv4 CIDR matcher', () => {
  it('172.16.0.0/12 covers compose default bridge range', () => {
    const cidrs = parseCidrList('172.16.0.0/12');
    expect(isInternalIp('172.17.0.5', cidrs)).toBe(true);
    expect(isInternalIp('172.31.255.255', cidrs)).toBe(true);
    expect(isInternalIp('172.32.0.1', cidrs)).toBe(false);
    expect(isInternalIp('8.8.8.8', cidrs)).toBe(false);
  });

  it('supports comma-separated multi-CIDR', () => {
    const cidrs = parseCidrList('172.16.0.0/12,10.0.0.0/8,127.0.0.0/8');
    expect(isInternalIp('10.5.5.5', cidrs)).toBe(true);
    expect(isInternalIp('127.0.0.1', cidrs)).toBe(true);
    expect(isInternalIp('192.168.1.1', cidrs)).toBe(false);
  });

  it('rejects malformed IP / CIDR', () => {
    const cidrs = parseCidrList('172.16.0.0/12');
    expect(isInternalIp('not-an-ip', cidrs)).toBe(false);
    expect(isInternalIp('999.999.999.999', cidrs)).toBe(false);
    expect(() => parseCidrList('172.16.0.0/33')).toThrow();
    expect(() => parseCidrList('not-a-cidr')).toThrow();
  });

  it('empty CIDR list → no IP is internal', () => {
    expect(parseCidrList('')).toHaveLength(0);
    expect(isInternalIp('172.17.0.5', parseCidrList(''))).toBe(false);
  });
});
