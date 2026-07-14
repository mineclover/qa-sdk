// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// commands/audit.ts — 레지스트리 감사
import type { DiscoveryClient, ServiceInfo } from '../discovery/client.js';

export interface AuditResult {
  warnings: AuditIssue[];
  errors: AuditIssue[];
}

export interface AuditIssue {
  serviceId: string;
  type: string;
  message: string;
}

export async function auditRegistry(discovery: DiscoveryClient): Promise<AuditResult> {
  const services = await discovery.listServices();
  const warnings: AuditIssue[] = [];
  const errors: AuditIssue[] = [];

  const urlMap = new Map<string, string[]>(); // url -> serviceIds
  const allOwnedPrefixes = new Set<string>();

  for (const svc of services) {
    // URL 미등록 확인
    if (!svc.url) {
      warnings.push({ serviceId: svc.serviceId, type: 'no-url', message: '기본 URL 미등록' });
    }

    // env별 URL 확인
    const envs = ['dev', 'staging', 'prod'];
    for (const env of envs) {
      if (!svc.urls?.[env]) {
        warnings.push({
          serviceId: svc.serviceId,
          type: 'no-env-url',
          message: `${env} URL 미등록`,
        });
      }
    }

    // ownedPrefixes 확인 (infra/backend tier)
    if (svc.ownedPrefixes.length === 0 && (svc.tier === 'infra' || svc.tier === 'backend')) {
      warnings.push({
        serviceId: svc.serviceId,
        type: 'no-owned-prefixes',
        message: `tier=${svc.tier}이지만 ownedPrefixes 없음`,
      });
    }

    // prefix 소유 추적
    for (const p of svc.ownedPrefixes) allOwnedPrefixes.add(p);

    // URL 중복 추적
    if (svc.url) {
      const list = urlMap.get(svc.url) ?? [];
      list.push(svc.serviceId);
      urlMap.set(svc.url, list);
    }
  }

  // consumed prefix인데 소유자 없음
  for (const svc of services) {
    for (const p of svc.consumedPrefixes ?? []) {
      if (!allOwnedPrefixes.has(p)) {
        warnings.push({
          serviceId: svc.serviceId,
          type: 'orphan-consumed',
          message: `consumed prefix "${p}"의 소유 서비스 없음`,
        });
      }
    }
  }

  // URL 중복
  for (const [url, ids] of urlMap.entries()) {
    if (ids.length > 1) {
      for (const id of ids) {
        warnings.push({
          serviceId: id,
          type: 'duplicate-url',
          message: `URL "${url}"을 ${ids.join(', ')}이(가) 공유`,
        });
      }
    }
  }

  return { warnings, errors };
}
