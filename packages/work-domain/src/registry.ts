// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import {
  type WorkDomainDef,
  type WorkDomainId,
  WORK_DOMAINS,
  ALL_DOMAIN_IDS,
  getSubDomain as getSubDomainBase,
} from 'test-types';

export type { WorkDomainDef, WorkDomainId };
export { WORK_DOMAINS, ALL_DOMAIN_IDS };

// ─── 조회 유틸 ──────────────────────────────────────────

/** ID로 도메인 정의 조회 */
export function getDomainDef(id: WorkDomainId): WorkDomainDef {
  const found = WORK_DOMAINS.find((d) => d.id === id);
  if (!found) throw new Error(`알 수 없는 Work Domain: ${id}`);
  return found;
}

/** ID로 서브도메인 조회 */
export function getSubDomain(domainId: WorkDomainId, subDomainId: string) {
  return getSubDomainBase(domainId, subDomainId);
}
