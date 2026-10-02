// @def.boundary platform-demo-system
// @def.doc platform-demo-system

/** Bundled permission read model for the static platform demo. */
import {
  DEMO_ENVS,
  DEMO_KO,
  DEMO_NSS,
  DEMO_PERM_SVC_VALUES,
  DEMO_REGIONS,
  DEMO_SVCS,
  demoCalcPermAddr,
  demoDecodeSvc,
  demoRoleStride,
  demoRolesFor,
  type DemoVer,
} from 'demo-snapshot';
import type { PermCellsResponse } from './registry.js';

export async function fetchMockPermCells(ver: DemoVer = 'v2'): Promise<PermCellsResponse> {
  const roles = demoRolesFor(ver);
  const roleStride = demoRoleStride(ver);
  const svcLabels = DEMO_PERM_SVC_VALUES.map((svcValue, index) => {
    const [envPos, regionPos, svcPos, namespacePos] = demoDecodeSvc(svcValue);
    const env = DEMO_ENVS[envPos - 1];
    const region = DEMO_REGIONS[regionPos - 1];
    const svcName = DEMO_SVCS[svcPos - 1];
    const namespace = DEMO_NSS[namespacePos - 1];
    return {
      pos: index + 1,
      svcValue,
      svcName: DEMO_KO.svc[svcName] ?? svcName,
      env,
      region,
      namespace,
    };
  });
  const roleLabels = roles.map((id, index) => ({
    pos: index + 1,
    id,
    ko: DEMO_KO.role[id] ?? id,
  }));
  const cells = DEMO_PERM_SVC_VALUES.flatMap((_svcValue, svcIndex) =>
    roles.map((_role, roleIndex) => ({
      svcPos: svcIndex + 1,
      rolePos: roleIndex + 1,
      value: demoCalcPermAddr(svcIndex + 1, roleIndex + 1, ver),
    })),
  );
  return {
    ver,
    roleStride,
    prefix: `permission:${ver}`,
    maxValue: DEMO_PERM_SVC_VALUES.length * roleStride - 1,
    svcLabels,
    roleLabels,
    cells,
  };
}
