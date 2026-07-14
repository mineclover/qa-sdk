import { afterEach, describe, it, expect, vi } from 'vitest';
import { DEMO_CATALOG } from 'demo-snapshot';
import { createQaContext, createQaContextAsync } from '@qa-sdk/context';
import type { TypedQaContext } from 'demo-types';

describe('QaContext', () => {
  // TypedQaContext — encode("permission", ...) 등 prefix 자동완성
  const qa: TypedQaContext = createQaContext({
    env: 'prod',
    region: 'asia',
    service: 'shopping-web',
    namespace: 'shop',
    catalog: DEMO_CATALOG,
  });

  it('encode/decode 라운드트립', () => {
    const serialized = qa.encode('endpoint', {
      resource_type: 'api',
      http_method: 'POST',
      api_version: 'v1',
    });
    expect(serialized).toMatch(/^endpoint:v1:\d+$/);

    const decoded = qa.decode(serialized);
    expect(decoded.resource_type).toBe('api');
    expect(decoded.http_method).toBe('POST');
  });

  it('track — address_context 생성 + service 자동 포함', () => {
    const result = qa.track({
      endpoint: { resource_type: 'api', http_method: 'GET', api_version: 'v1' },
    });

    expect(result.address_context.endpoint).toMatch(/^endpoint:v1:\d+$/);
    expect(result.address_context.service).toMatch(/^service:v1:\d+$/);
  });

  it('infraContext — 서비스 주소를 infra_context로 반환', () => {
    const infra = qa.infraContext();
    expect(infra.service).toMatch(/^service:v\d+:\d+$/);
  });

  it('executionMode 기본값 live', () => {
    expect(qa.executionMode).toBe('live');
  });

  it('executionMode test 설정', () => {
    const testQa = createQaContext({
      env: 'test',
      region: 'asia',
      service: 'shopping-web',
      namespace: 'shop',
      catalog: DEMO_CATALOG,
      executionMode: 'test',
      executionId: 'e2e-checkout-v1',
    });
    expect(testQa.executionMode).toBe('test');
    expect(testQa.executionId).toBe('e2e-checkout-v1');
  });
});

describe('QaContext async fallback', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registry fetch 실패 시 로컬 catalog로 fallback한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('registry down');
      }),
    );

    const qa = await createQaContextAsync({
      registry: 'http://registry.invalid',
      env: 'prod',
      region: 'asia',
      service: 'shopping-web',
      namespace: 'shop',
    });

    const serialized = qa.encode('endpoint', {
      resource_type: 'api',
      http_method: 'POST',
      api_version: 'v1',
    });

    expect(serialized).toMatch(/^endpoint:v1:\d+$/);
  });
});

describe('QaContext DSL 모드', () => {
  const qa = createQaContext({
    env: 'prod',
    region: 'asia',
    service: 'shopping-web',
    namespace: 'shop',
    catalog: DEMO_CATALOG,
  });

  const checkoutMembers = ['page_view', 'endpoint', 'flow_point', 'order_event', 'permission'];
  const session = qa.useDsl('dsl-checkout', checkoutMembers);

  it('DSL 세션 생성', () => {
    expect(session.dslId).toBe('dsl-checkout');
    expect(session.memberPrefixes).toEqual(checkoutMembers);
  });

  it('멤버 prefix track — 정상', () => {
    const result = session.track({
      endpoint: { resource_type: 'api', http_method: 'POST', api_version: 'v1' },
      flow_point: { flow_name: 'checkout', flow_step: 'success', flow_variant: 'default' },
    });

    expect(result.address_context.endpoint).toBeDefined();
    expect(result.address_context.flow_point).toBeDefined();
    expect(result.address_context.service).toBeDefined();

    // 누락 멤버 경고
    expect(result.warnings.some((w) => w.includes('page_view'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('order_event'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('permission'))).toBe(true);
  });

  it('비멤버 prefix track — 경고 + 필터', () => {
    const result = session.track({
      endpoint: { resource_type: 'api', http_method: 'GET', api_version: 'v1' },
      deploy_event: { deploy_action: 'deploy' }, // 비멤버
    });

    // deploy_event는 필터됨
    expect(result.address_context.deploy_event).toBeUndefined();
    // 경고 발생
    expect(
      result.warnings.some((w) => w.includes('deploy_event') && w.includes('멤버가 아닙니다')),
    ).toBe(true);
  });

  it('전체 멤버 track — 경고 없음 (service 제외)', () => {
    const result = session.track({
      page_view: { page: 'checkout', locale: 'ko', userType: 'member' },
      endpoint: { resource_type: 'api', http_method: 'POST', api_version: 'v1' },
      flow_point: { flow_name: 'checkout', flow_step: 'success', flow_variant: 'default' },
      order_event: { action: 'create' },
      permission: { role: 'admin' },
    });

    // 누락 경고 없음
    const memberWarnings = result.warnings.filter((w) => w.includes('track되지 않았습니다'));
    expect(memberWarnings.length).toBe(0);
  });
});
