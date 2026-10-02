// @def.boundary platform-demo-system
// @def.doc platform-demo-system

/**
 * Deterministic scenario read models for the platform demo.
 *
 * The scenario sheet used to fetch this data from platform-demo-api. Keeping
 * the same response shape here makes the static demo usable when the Worker
 * or D1 grant store is unavailable, while demo-snapshot remains the source of
 * truth for roles, grants, and address calculations.
 */

import {
  DEMO_CATALOG,
  DEMO_KO,
  DEMO_SVCS,
  demoDecodeSvc,
  demoFeatures,
  demoRolesFor,
  encodePrefixByValue,
  type DemoFeatureDef,
  type DemoVer,
} from 'demo-snapshot';
import type { FeaturesResponse, ScenarioResponse } from './registry.js';
import { encodeEventAddress } from './event-address.js';

/** A source-owned identity carried alongside the demo request. */
export interface ScenarioSourceRef {
  namespace: string;
  entityType: string;
  localId: string;
  revision: string;
}

export interface ScenarioAddressContext {
  service: string;
  permission: string;
  event: string | null;
}

export interface ScenarioRequestTrace {
  requestId: string;
  featureId: string;
  featureName: string;
  sourceRef: ScenarioSourceRef;
  service: {
    address: string;
    value: number;
    env: string;
    region: string;
    svcName: string;
    namespace: string;
  };
  permission: {
    address: string;
    value: number;
    role: string;
    roleKo: string;
    status: 'ok' | 'denied';
  };
  event: {
    address: string;
    value: number;
    name: string;
    nameKo: string;
    initiator: string;
    status: 'ok' | 'denied';
  } | null;
  addressContext: ScenarioAddressContext;
}

export type ScenarioResponseWithRequest = ScenarioResponse & {
  request: ScenarioRequestTrace;
};

function featureGranted(feature: DemoFeatureDef, role: string): boolean {
  return feature.grantedRoles.includes(role);
}

function serviceValueFor(feature: DemoFeatureDef): number {
  // `DemoFeatureDef.svcValue` is legacy fixture data. Recompute the address
  // from its semantic coordinates so catalog capacity changes cannot leak a
  // stale service reference into the scenario.
  return encodePrefixByValue(DEMO_CATALOG, 'service', 'v1', {
    env: 'prod',
    region: 'asia',
    svc_name: feature.svcName,
    namespace: 'shop',
  });
}

function serviceRefFor(feature: DemoFeatureDef): ScenarioRequestTrace['service'] {
  const value = serviceValueFor(feature);
  const [envPos, regionPos, svcPos, namespacePos] = demoDecodeSvc(value);
  const env = DEMO_CATALOG.axes.env.versions.v1.entries[envPos - 1];
  const region = DEMO_CATALOG.axes.region.versions.v1.entries[regionPos - 1];
  const svcName = DEMO_CATALOG.axes.svc_name.versions.v1.entries[svcPos - 1];
  const namespace = DEMO_CATALOG.axes.namespace.versions.v1.entries[namespacePos - 1];
  if (!env || !region || !svcName || !namespace) {
    throw new Error(`Unable to decode scenario service address: ${value}`);
  }
  return {
    address: `service:v1:${value}`,
    value,
    env,
    region,
    svcName,
    namespace,
  };
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

function permissionValueFor(feature: DemoFeatureDef, role: string, ver: DemoVer): number {
  return encodePrefixByValue(DEMO_CATALOG, 'permission', ver, {
    perm_svc: serviceValueFor(feature),
    role,
  });
}

function eventStepFor(
  feature: DemoFeatureDef,
  hasAccess: boolean,
  ver: DemoVer,
  svcValue: number,
): ScenarioResponse['simulation'][number]['event'] {
  // The feature's old eventValue fields are retained for compatibility only.
  // Resolve the semantic event name and encode it against the current catalog.
  const eventName = FEATURE_EVENTS[feature.id]?.[hasAccess ? 'success' : 'fail'];
  if (!eventName) return null;
  const initiator = DEMO_CATALOG.axes.initiator.versions.v1.entries[0];
  if (!initiator) return null;

  try {
    const value = encodeEventAddress(svcValue, eventName, initiator, ver);
    const svcName = DEMO_SVCS[demoDecodeSvc(svcValue)[2] - 1];

    return {
      addr: `event:${ver}:${value}`,
      value,
      status: hasAccess ? 'ok' : 'denied',
      svcName,
      svcNameKo: DEMO_KO.svc[svcName] ?? svcName,
      eventName,
      eventNameKo: DEMO_KO.event[eventName] ?? eventName,
      initiator,
    };
  } catch {
    // A feature can exist in a version before its event vocabulary does.
    return null;
  }
}

/** Return the same feature matrix response as `/api/features`. */
export async function fetchMockFeatures(ver: DemoVer = 'v2'): Promise<FeaturesResponse> {
  const featureDefs = demoFeatures(ver);
  const roles = [...demoRolesFor(ver)].map((id) => ({ id, ko: DEMO_KO.role[id] ?? id }));

  return {
    features: featureDefs.map((feature) => ({
      id: feature.id,
      name: feature.name,
      grantedRoles: [...feature.grantedRoles],
      grantedRolesKo: feature.grantedRoles.map((role) => DEMO_KO.role[role] ?? role),
    })),
    roles,
    matrix: featureDefs.map((feature) => roles.map((role) => featureGranted(feature, role.id))),
  };
}

/** Return the same role-specific scenario response as `/api/scenario`. */
export async function fetchMockScenario(
  role: string,
  ver: DemoVer = 'v2',
): Promise<ScenarioResponseWithRequest> {
  if (!(demoRolesFor(ver) as readonly string[]).includes(role)) {
    throw new Error(`Invalid role: ${role}. Must be one of: ${[...demoRolesFor(ver)].join(', ')}`);
  }

  const featureDefs = demoFeatures(ver);
  const roleKo = DEMO_KO.role[role] ?? role;

  // payment is the primary service in the G-SHOP scenario.
  const mainFeature = featureDefs.find((feature) => feature.svcName === 'payment');
  if (!mainFeature) throw new Error(`Missing payment scenario for ${ver}`);
  const mainPermValue = permissionValueFor(mainFeature, role, ver);

  const features = featureDefs.map((feature) => {
    const permValue = permissionValueFor(feature, role, ver);
    const service = serviceRefFor(feature);
    return {
      id: feature.id,
      name: feature.name,
      svcName: feature.svcName,
      svcAddr: service.address,
      hasAccess: featureGranted(feature, role),
      permAddr: `permission:${ver}:${permValue}`,
      permValue,
      grantedRoles: [...feature.grantedRoles],
      grantedRolesKo: feature.grantedRoles.map((item) => DEMO_KO.role[item] ?? item),
    };
  });

  const simulation = featureDefs.map((feature, index) => {
    const permValue = permissionValueFor(feature, role, ver);
    const service = serviceRefFor(feature);
    const hasAccess = featureGranted(feature, role);
    const permAddr = `permission:${ver}:${permValue}`;
    const grantedAddrs = feature.grantedRoles.map(
      (grantedRole) => `permission:${ver}:${permissionValueFor(feature, grantedRole, ver)}`,
    );
    const deniedReason = hasAccess ? '부여됨' : `미부여 — 허용: [${grantedAddrs.join(', ')}]`;

    const svcNameKo = DEMO_KO.svc[feature.svcName] ?? feature.svcName;

    const perm = {
      addr: permAddr,
      value: permValue,
      status: (hasAccess ? 'ok' : 'denied') as 'ok' | 'denied',
      svcName: feature.svcName,
      svcNameKo,
      roleName: role,
      roleNameKo: roleKo,
      grantedAddrs,
      deniedReason,
    };

    const event = eventStepFor(feature, hasAccess, ver, service.value);

    return {
      featureNum: index + 1,
      featureId: feature.id,
      featureName: feature.name,
      hasAccess,
      perm,
      event,
    };
  });

  const primaryFeature =
    featureDefs.find((feature) => feature.id === 'payment_history') ?? mainFeature;
  const primaryFeatureInfo = features.find((feature) => feature.id === primaryFeature.id);
  const primaryStep = simulation.find((step) => step.featureId === primaryFeature.id);
  if (!primaryFeatureInfo || !primaryStep) {
    throw new Error(`Missing representative request for ${primaryFeature.id}`);
  }
  const primaryService = serviceRefFor(primaryFeature);
  const requestEvent = primaryStep.event
    ? {
        address: primaryStep.event.addr,
        value: primaryStep.event.value,
        name: primaryStep.event.eventName,
        nameKo: primaryStep.event.eventNameKo,
        initiator: primaryStep.event.initiator,
        status: primaryStep.event.status,
      }
    : null;

  const request: ScenarioRequestTrace = {
    requestId: 'req-gshop-1042',
    featureId: primaryFeature.id,
    featureName: primaryFeature.name,
    sourceRef: {
      namespace: 'g-shop',
      entityType: 'payment',
      localId: 'PAY-8821',
      revision: '2026-03-15T10:23:00Z',
    },
    service: primaryService,
    permission: {
      address: primaryStep.perm.addr,
      value: primaryStep.perm.value,
      role,
      roleKo,
      status: primaryStep.perm.status,
    },
    event: requestEvent,
    addressContext: {
      service: primaryService.address,
      permission: primaryStep.perm.addr,
      event: requestEvent?.address ?? null,
    },
  };

  return {
    role,
    roleKo,
    user: {
      name: '홍길동',
      role,
      roleKo,
      mainPermAddr: `permission:${ver}:${mainPermValue}`,
      mainPermValue,
    },
    features,
    simulation,
    request,
  };
}
