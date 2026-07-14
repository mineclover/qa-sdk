// @def.boundary dkg-system-root
// @def.doc dkg-system-root

/**
 * DEMO_CATALOG의 refEntries 의미 정의 (SSOT).
 *
 * 이 파일이 "어떤 service 조합을 참조하는가"의 원본이다.
 * 정수 주소는 deriveRefEntries()로 파생한다.
 */

import type { SemanticRefEntries } from './semantic-ref.js';

// ═══════════════════════════════════════════════════════════════
//  permission prefix — prod/asia의 전 서비스 × 전 namespace
// ═══════════════════════════════════════════════════════════════

function permissionSvcRefs(version: string): SemanticRefEntries {
  return {
    prefixId: 'permission',
    version,
    dimLabel: 'perm_svc',
    refPrefix: 'service',
    refVersion: 'v1',
    entries: [
      {
        values: { env: 'dev', region: 'asia', svc_name: 'shopping-web', namespace: 'shop' },
        label: 'dev/shopping-web/shop',
      },
      {
        values: { env: 'dev', region: 'asia', svc_name: 'shopping-backend', namespace: 'shop' },
        label: 'dev/shopping-backend/shop',
      },
      {
        values: { env: 'dev', region: 'asia', svc_name: 'auth', namespace: 'shop' },
        label: 'dev/auth/shop',
      },
      {
        values: { env: 'dev', region: 'asia', svc_name: 'payment', namespace: 'shop' },
        label: 'dev/payment/shop',
      },
      {
        values: { env: 'dev', region: 'asia', svc_name: 'gateway', namespace: 'shop' },
        label: 'dev/gateway/shop',
      },
      {
        values: { env: 'prod', region: 'asia', svc_name: 'shopping-web', namespace: 'shop' },
        label: 'prod/shopping-web/shop',
      },
      {
        values: { env: 'prod', region: 'asia', svc_name: 'shopping-web', namespace: 'cms' },
        label: 'prod/shopping-web/cms',
      },
      {
        values: { env: 'prod', region: 'asia', svc_name: 'shopping-backend', namespace: 'shop' },
        label: 'prod/shopping-backend/shop',
      },
      {
        values: { env: 'prod', region: 'asia', svc_name: 'shopping-backend', namespace: 'cms' },
        label: 'prod/shopping-backend/cms',
      },
      {
        values: { env: 'prod', region: 'asia', svc_name: 'auth', namespace: 'shop' },
        label: 'prod/auth/shop',
      },
      {
        values: { env: 'prod', region: 'asia', svc_name: 'auth', namespace: 'cms' },
        label: 'prod/auth/cms',
      },
      {
        values: { env: 'prod', region: 'asia', svc_name: 'payment', namespace: 'shop' },
        label: 'prod/payment/shop',
      },
      {
        values: { env: 'prod', region: 'asia', svc_name: 'payment', namespace: 'cms' },
        label: 'prod/payment/cms',
      },
      {
        values: { env: 'prod', region: 'asia', svc_name: 'gateway', namespace: 'shop' },
        label: 'prod/gateway/shop',
      },
      {
        values: { env: 'prod', region: 'asia', svc_name: 'gateway', namespace: 'cms' },
        label: 'prod/gateway/cms',
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
//  event prefix — dev + prod의 5개 서비스 (namespace=shop)
// ═══════════════════════════════════════════════════════════════

function eventSvcRefs(version: string): SemanticRefEntries {
  return {
    prefixId: 'event',
    version,
    dimLabel: 'evt_svc',
    refPrefix: 'service',
    refVersion: 'v1',
    entries: [
      {
        values: { env: 'dev', region: 'asia', svc_name: 'shopping-web', namespace: 'shop' },
        label: 'dev/shopping-web',
      },
      {
        values: { env: 'dev', region: 'asia', svc_name: 'shopping-backend', namespace: 'shop' },
        label: 'dev/shopping-backend',
      },
      {
        values: { env: 'dev', region: 'asia', svc_name: 'auth', namespace: 'shop' },
        label: 'dev/auth',
      },
      {
        values: { env: 'dev', region: 'asia', svc_name: 'payment', namespace: 'shop' },
        label: 'dev/payment',
      },
      {
        values: { env: 'dev', region: 'asia', svc_name: 'gateway', namespace: 'shop' },
        label: 'dev/gateway',
      },
      {
        values: { env: 'prod', region: 'asia', svc_name: 'shopping-web', namespace: 'shop' },
        label: 'prod/shopping-web',
      },
      {
        values: { env: 'prod', region: 'asia', svc_name: 'shopping-backend', namespace: 'shop' },
        label: 'prod/shopping-backend',
      },
      {
        values: { env: 'prod', region: 'asia', svc_name: 'auth', namespace: 'shop' },
        label: 'prod/auth',
      },
      {
        values: { env: 'prod', region: 'asia', svc_name: 'payment', namespace: 'shop' },
        label: 'prod/payment',
      },
      {
        values: { env: 'prod', region: 'asia', svc_name: 'gateway', namespace: 'shop' },
        label: 'prod/gateway',
      },
      {
        values: { env: 'prod', region: 'asia', svc_name: 'shopping-web', namespace: 'cms' },
        label: 'prod/shopping-web/cms',
      },
      {
        values: { env: 'prod', region: 'asia', svc_name: 'shopping-backend', namespace: 'cms' },
        label: 'prod/shopping-backend/cms',
      },
      {
        values: { env: 'prod', region: 'asia', svc_name: 'auth', namespace: 'cms' },
        label: 'prod/auth/cms',
      },
      {
        values: { env: 'prod', region: 'asia', svc_name: 'payment', namespace: 'cms' },
        label: 'prod/payment/cms',
      },
      {
        values: { env: 'prod', region: 'asia', svc_name: 'gateway', namespace: 'cms' },
        label: 'prod/gateway/cms',
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
//  order_event prefix — prod 5개 서비스 (namespace=shop)
// ═══════════════════════════════════════════════════════════════

const ORDER_EVENT_SVC_REFS: SemanticRefEntries = {
  prefixId: 'order_event',
  version: 'v1',
  dimLabel: 'service_ctx',
  refPrefix: 'service',
  refVersion: 'v1',
  entries: [
    {
      values: { env: 'prod', region: 'asia', svc_name: 'shopping-web', namespace: 'shop' },
      label: 'prod/shopping-web',
    },
    {
      values: { env: 'prod', region: 'asia', svc_name: 'shopping-backend', namespace: 'shop' },
      label: 'prod/shopping-backend',
    },
    {
      values: { env: 'prod', region: 'asia', svc_name: 'auth', namespace: 'shop' },
      label: 'prod/auth',
    },
    {
      values: { env: 'prod', region: 'asia', svc_name: 'payment', namespace: 'shop' },
      label: 'prod/payment',
    },
    {
      values: { env: 'prod', region: 'asia', svc_name: 'gateway', namespace: 'shop' },
      label: 'prod/gateway',
    },
  ],
};

/**
 * DEMO_CATALOG 전체 semantic refEntries 정의.
 * 이것이 SSOT. 정수 주소는 여기서 파생한다.
 */
export function getAllSemanticRefs(): SemanticRefEntries[] {
  return [
    permissionSvcRefs('v1'),
    permissionSvcRefs('v2'),
    permissionSvcRefs('v3'),
    permissionSvcRefs('v4'),
    eventSvcRefs('v1'),
    eventSvcRefs('v2'),
    eventSvcRefs('v3'),
    eventSvcRefs('v4'),
    ORDER_EVENT_SVC_REFS,
  ];
}
