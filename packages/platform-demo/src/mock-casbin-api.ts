// @def.boundary platform-demo-system
// @def.doc platform-demo-system

/**
 * Static authorization read models for the Casbin explainer.
 *
 * The page only needs a deterministic grant matrix and a few address mapping
 * examples. Deriving those values from demo-snapshot removes the D1/API
 * dependency without changing the teaching content or response contracts.
 */

import {
  DEMO_CATALOG,
  DEMO_ENVS,
  DEMO_KO,
  DEMO_NSS,
  DEMO_PERM_SVC_VALUES,
  DEMO_REGIONS,
  DEMO_SVCS,
  demoCalcPermAddr,
  demoEncodeSvc,
  demoDecodeSvc,
  demoFeatures,
  demoRolePos,
  demoRolesFor,
  encodePrefixByValue,
  type DemoVer,
} from 'demo-snapshot';
import type { FeaturesResponse, GrantRow, GrantTableResponse } from './registry.js';

function isGranted(ver: DemoVer, featureId: string, role: string): boolean {
  const feature = demoFeatures(ver).find((item) => item.id === featureId);
  return feature?.grantedRoles.includes(role) ?? false;
}

/**
 * Feature definitions predate the current service capacity.  Their old
 * `svcValue`/`permSvcPos` fields are useful compatibility metadata, but are
 * not safe to use as current addresses.  The Casbin explainer derives the
 * canonical service reference from the semantic service name instead.
 */
function currentServiceValue(svcName: string): number {
  const envPos = DEMO_ENVS.indexOf('prod') + 1;
  const regionPos = DEMO_REGIONS.indexOf('asia') + 1;
  const svcPos = (DEMO_SVCS as readonly string[]).indexOf(svcName) + 1;
  const namespacePos = DEMO_NSS.indexOf('shop') + 1;

  if (envPos === 0 || regionPos === 0 || svcPos === 0 || namespacePos === 0) {
    throw new Error(`Casbin demo service coordinates are incomplete: ${svcName}`);
  }

  const value = demoEncodeSvc([envPos, regionPos, svcPos, namespacePos]);
  if (!DEMO_PERM_SVC_VALUES.includes(value)) {
    throw new Error(`Service is not present in the permission reference list: ${svcName}`);
  }
  return value;
}

/** Semantic event names used by the authorization walkthrough. */
const FEATURE_EVENTS: Record<string, { success?: string; fail?: string }> = {
  product_list: { success: 'user.login' },
  order_list: { success: 'order.created' },
  payment_history: { success: 'order.paid', fail: 'payment.failed' },
  payment_cancel: { fail: 'payment.failed' },
  user_mgmt: { success: 'config.changed', fail: 'session.expired' },
  config_change: { success: 'config.changed', fail: 'session.expired' },
  payment_cancel_req: { success: 'payment.cancel_requested', fail: 'payment.failed' },
  payment_cancel_approve: { success: 'payment.cancel_approved', fail: 'payment.failed' },
};

function currentEventValue(
  ver: DemoVer,
  featureId: string,
  granted: boolean,
  svcValue: number,
): { value: number; name: string } | null {
  const eventName = FEATURE_EVENTS[featureId]?.[granted ? 'success' : 'fail'];
  if (!eventName) return null;

  try {
    return {
      value: encodePrefixByValue(DEMO_CATALOG, 'event', ver, {
        evt_svc: svcValue,
        event_name: eventName,
        initiator: 'web',
      }),
      name: eventName,
    };
  } catch {
    // A feature may be present in a version before its event vocabulary is.
    return null;
  }
}

export async function fetchMockFeatures(ver: DemoVer = 'v2'): Promise<FeaturesResponse> {
  const defs = demoFeatures(ver);
  const roles = [...demoRolesFor(ver)].map((id) => ({ id, ko: DEMO_KO.role[id] ?? id }));
  return {
    features: defs.map((feature) => ({
      id: feature.id,
      name: feature.name,
      grantedRoles: [...feature.grantedRoles],
      grantedRolesKo: feature.grantedRoles.map((role) => DEMO_KO.role[role] ?? role),
    })),
    roles,
    matrix: defs.map((feature) => roles.map((role) => isGranted(ver, feature.id, role.id))),
  };
}

export async function fetchMockGrantTable(ver: DemoVer = 'v2'): Promise<GrantTableResponse> {
  const defs = demoFeatures(ver);
  const roles = demoRolesFor(ver);
  const rolePositions = demoRolePos(ver);

  const rows = defs.flatMap((feature) =>
    roles.map((role) => {
      const granted = isGranted(ver, feature.id, role);
      const svcValue = currentServiceValue(feature.svcName);
      const permSvcPos = DEMO_PERM_SVC_VALUES.indexOf(svcValue) + 1;
      const rolePos = rolePositions[role];
      if (permSvcPos === 0 || rolePos === undefined) {
        throw new Error(`Invalid Casbin demo reference for ${feature.id}/${role}`);
      }
      const permValue = demoCalcPermAddr(permSvcPos, rolePos, ver);
      const [envPos, regionPos, svcPos, namespacePos] = demoDecodeSvc(svcValue);
      const env = DEMO_ENVS[envPos - 1];
      const region = DEMO_REGIONS[regionPos - 1];
      const svcName = DEMO_SVCS[svcPos - 1];
      const namespace = DEMO_NSS[namespacePos - 1];
      const event = currentEventValue(ver, feature.id, granted, svcValue);
      const eventType: GrantRow['eventType'] = event ? (granted ? 'success' : 'fail') : 'none';

      return {
        featureId: feature.id,
        featureName: feature.name,
        permAddr: `permission:${ver}:${permValue}`,
        permValue,
        svcValue,
        svcNameKo: DEMO_KO.svc[svcName] ?? svcName,
        env,
        envKo: DEMO_KO.env[env] ?? env,
        region,
        regionKo: DEMO_KO.region[region] ?? region,
        namespace,
        namespaceKo: DEMO_KO.ns[namespace] ?? namespace,
        role,
        roleKo: DEMO_KO.role[role] ?? role,
        granted,
        grantedRoles: [...feature.grantedRoles],
        grantedRolesKo: feature.grantedRoles.map((item) => DEMO_KO.role[item] ?? item),
        eventAddr: event ? `event:${ver}:${event.value}` : null,
        eventValue: event?.value ?? null,
        eventNameKo: event ? (DEMO_KO.event[event.name] ?? event.name) : null,
        eventType,
      };
    }),
  );

  return { rows };
}
