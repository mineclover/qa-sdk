// @def.boundary registry-system
// @def.doc registry-system

import type { ConfigStore } from '../stores/config-store.js';
import type { SeedLogger } from './types.js';

/** 기본 no-op 로거 */
const noopLogger: SeedLogger = {
  info() {},
  warn() {},
  debug() {},
};

const EVENT_ADOPTION_CONFIG_TYPE = 'event-adoption';

/** DkgConfig + PatternRules + 서비스 목록 seed */
export async function seedConfigs(configStore: ConfigStore, logger: SeedLogger = noopLogger) {
  try {
    const { DEMO_DKG_CONFIG } = await import('demo-dkg-config');
    await configStore.set('demo', 'dkg-config', JSON.stringify(DEMO_DKG_CONFIG));
    logger.info('seeded DEMO_DKG_CONFIG to config store');
  } catch (error) {
    logger.warn({ err: error }, 'Failed to seed DEMO_DKG_CONFIG');
  }

  try {
    const convergence = await import('@qa-sdk/convergence');
    await configStore.set('demo', 'pattern-rules', JSON.stringify(convergence.DEMO_PATTERN_RULES));
    logger.info('seeded DEMO_PATTERN_RULES to config store');
  } catch (error) {
    logger.warn({ err: error }, 'Failed to seed DEMO_PATTERN_RULES');
  }

  // 서비스 목록 seed
  // prefix는 비즈니스 도메인의 좌표 공간이며 특정 서비스의 배타적 소유가 아님.
  // svc_ref 차원이 발생 서비스를 인코딩하므로 여러 서비스가 같은 prefix에 이벤트를 쓸 수 있다.
  // ownedPrefixes = 이 서비스가 주로 produce하는 prefix (Projection 배치 기준)
  // consumedPrefixes = 이 서비스가 조회/소비하는 prefix
  const demoServices = [
    // ── 프론트엔드 ──
    {
      serviceId: 'shopping-web',
      name: '쇼핑 웹',
      tier: 'frontend',
      team: 'frontend',
      url: 'http://localhost:5220',
      urls: { dev: 'http://localhost:5220', prod: 'https://shop-web-7dq.pages.dev' },
      // shop-pack(owner=shopping-web) 매핑이 endpoint/flow_point/order_event/pipeline_point도 emit하므로 ownership 등록.
      // 같은 prefix를 shopping-backend/payment/gateway/ingest-server가 함께 소유 — 좌표 공간은 비배타적.
      ownedPrefixes: [
        'page_view',
        'tracking',
        'cart_event',
        'auth_event',
        'endpoint',
        'flow_point',
        'order_event',
        'pipeline_point',
      ],
      consumedPrefixes: ['service', 'permission'],
    },
    {
      serviceId: 'platform-demo',
      name: '플랫폼 데모',
      tier: 'frontend',
      team: 'frontend',
      url: 'http://localhost:5176',
      ownedPrefixes: [],
      consumedPrefixes: [
        'service',
        'page_view',
        'tracking',
        'endpoint',
        'flow_point',
        'order_event',
      ],
    },
    {
      serviceId: 'platform-demo-api',
      name: '플랫폼 데모 API',
      tier: 'backend',
      team: 'frontend',
      url: 'http://localhost:8787',
      urls: {
        dev: 'http://localhost:8787',
        prod: 'https://platform-demo-api.astralclover.workers.dev',
      },
      ownedPrefixes: ['execution_context'],
      consumedPrefixes: ['service', 'permission', 'endpoint'],
    },
    {
      serviceId: 'content-service',
      name: '콘텐츠 서비스',
      tier: 'frontend',
      team: 'frontend',
      ownedPrefixes: ['content', 'relational'],
    },
    // ── 비즈니스 백엔드 ──
    {
      serviceId: 'shopping-backend',
      name: '쇼핑 백엔드',
      tier: 'backend',
      team: 'backend',
      deployedWith: 'platform-demo-api',
      ownedPrefixes: ['order_event', 'endpoint', 'event'],
      consumedPrefixes: ['service', 'permission', 'cart_event'],
    },
    {
      serviceId: 'auth',
      name: '인증 서비스',
      tier: 'backend',
      team: 'platform',
      deployedWith: 'platform-demo-api',
      ownedPrefixes: ['rbac', 'auth_event'],
      consumedPrefixes: ['service'],
    },
    {
      serviceId: 'payment',
      name: '결제 서비스',
      tier: 'backend',
      team: 'backend',
      deployedWith: 'platform-demo-api',
      ownedPrefixes: ['flow_point', 'permission'],
      consumedPrefixes: ['service', 'order_event'],
    },
    {
      serviceId: 'gateway',
      name: 'API 게이트웨이',
      tier: 'system',
      team: 'platform',
      url: 'http://localhost:8787',
      urls: {
        dev: 'http://localhost:8787',
        staging: 'https://gateway.staging.qa-sdk.io',
        prod: 'https://api.qa-sdk.io',
      },
      // rpc-pack(owner=gateway) 매핑이 rpc_event를 emit하므로 ownership 등록.
      ownedPrefixes: ['endpoint', 'schema_validation', 'rpc_event'],
      consumedPrefixes: ['service', 'rbac'],
    },
    // ── 인프라 ──
    {
      serviceId: 'infra-controller',
      name: '인프라 컨트롤러',
      tier: 'infra',
      team: 'devops',
      url: 'http://localhost:3300',
      // infra-observe-pack(owner=infra-controller) 매핑이 metric/pattern/schema/ingest_record 등을 emit.
      // dkg-engine·ingest-server·gateway와 prefix를 공유 (좌표 공간은 비배타적).
      ownedPrefixes: [
        'deploy_event',
        'health_event',
        'service',
        'data_policy',
        'engine_event',
        'schema_event',
        'resource_lifecycle',
        'gate_point',
        'version_point',
        'version_state',
        'tag_lifecycle',
        'metric_point',
        'metric_aggregate',
        'pattern_match',
        'pattern_anomaly',
        'event_classification',
        'schema_validation',
        'ingest_record',
      ],
    },
    {
      serviceId: 'ingest-server',
      name: '이벤트 수집',
      tier: 'infra',
      team: 'platform',
      url: 'http://localhost:3200',
      urls: {
        dev: 'http://localhost:3200',
        staging: 'https://ingest.staging.qa-sdk.io',
        prod: 'https://ingest.qa-sdk.io',
      },
      gatewayPath: '/v1/',
      // 파이프라인 자체 이벤트 + 수집 메트릭 생산
      ownedPrefixes: ['pipeline_point', 'ingest_record', 'metric_point', 'metric_aggregate'],
      consumedPrefixes: ['service'],
    },
    {
      serviceId: 'gate-service',
      name: '게이트 서비스',
      tier: 'infra',
      team: 'platform',
      url: 'http://localhost:3400',
      urls: {
        dev: 'http://localhost:3400',
        prod: 'https://qa-gate-service.astralclover.workers.dev',
      },
      gatewayPath: '/gate/',
      stripPrefix: true,
      // gate-pack(owner=gate-service) 매핑이 gate_execution/bundle_observation을 emit하므로 ownership 등록.
      // gate_point는 GateEngine 라이브러리가 계산 (read-only cache).
      ownedPrefixes: ['gate_execution', 'bundle_observation'],
      consumedPrefixes: ['service', 'version_point'],
    },
    {
      serviceId: 'query-service',
      name: '질의 서비스',
      tier: 'infra',
      team: 'platform',
      url: 'http://localhost:3500',
      urls: {
        dev: 'http://localhost:3500',
        prod: 'https://qa-query-service.astralclover.workers.dev',
      },
      gatewayPath: '/query/',
      stripPrefix: true,
      ownedPrefixes: [],
      consumedPrefixes: ['service', 'gate_point'],
    },
    {
      serviceId: 'decode-service',
      name: '디코드 서비스',
      tier: 'infra',
      team: 'platform',
      url: 'http://localhost:3600',
      urls: {
        dev: 'http://localhost:3600',
        prod: 'https://qa-decode-service.astralclover.workers.dev',
      },
      gatewayPath: '/decode/',
      stripPrefix: true,
      ownedPrefixes: [],
      consumedPrefixes: ['service'],
    },
    // ── 시스템 (CLI / CI / DKG 엔진) ──
    {
      serviceId: 'qa-sdk-cli',
      name: 'QA SDK CLI',
      tier: 'system',
      team: 'platform',
      // cli-observe-pack(owner=qa-sdk-cli) 매핑이 test_coverage도 emit하므로 ownership 등록.
      ownedPrefixes: ['cli_event', 'skill_execution', 'cli_tracking', 'test_coverage'],
      consumedPrefixes: ['service', 'dkg_event'],
    },
    {
      serviceId: 'ci-runner',
      name: 'CI Runner',
      tier: 'system',
      team: 'platform',
      ownedPrefixes: ['build_event', 'test_event', 'contract_check', 'test_coverage'],
    },
    {
      serviceId: 'dkg-engine',
      name: 'DKG 엔진',
      tier: 'system',
      team: 'platform',
      ownedPrefixes: [
        'dkg_event',
        'dkg_decision_event',
        'dkg_observation_event',
        'observation_event',
        'spec_event',
        'edge_activity',
        'decision_event',
        'decision_path',
        'escalation_event',
        'forcing_response',
        'model_apply',
        'pattern_match',
        'pattern_anomaly',
        'event_classification',
      ],
      consumedPrefixes: ['service', 'build_event', 'test_event'],
    },
    {
      serviceId: 'registry-service',
      name: '레지스트리 서비스',
      tier: 'infra',
      team: 'platform',
      url: 'http://localhost:3300',
      urls: {
        dev: 'http://localhost:3300',
        staging: 'https://registry.staging.qa-sdk.io',
        prod: 'https://registry.qa-sdk.io',
      },
      gatewayPath: '/api/',
      // 메타데이터 관리 전용 — 이벤트 생산 없음
      ownedPrefixes: [],
      consumedPrefixes: ['service'],
    },
    {
      serviceId: 'definition-service',
      name: '정의 관리 서비스',
      tier: 'infra',
      team: 'platform',
      url: 'http://localhost:3700',
      urls: { dev: 'http://localhost:3700' },
      gatewayPath: '/def/',
      stripPrefix: true,
      // graph-pack/harness-pack (owner=definition-service) 매핑이 graph_event/harness_*을 emit하므로 ownership 등록.
      ownedPrefixes: ['graph_event', 'harness_transition', 'harness_process_step', 'harness_guard'],
      consumedPrefixes: ['service'],
    },
    {
      serviceId: 'motion-workspace-service',
      name: '워크스페이스 서비스',
      tier: 'backend',
      team: 'frontend',
      url: 'http://localhost:3900',
      urls: { dev: 'http://localhost:3900' },
      ownedPrefixes: [],
      consumedPrefixes: ['service'],
    },
    // ── 프론트엔드 (UI) ──
    {
      serviceId: 'registry-ui',
      name: '레지스트리 UI',
      tier: 'frontend',
      team: 'platform',
      ownedPrefixes: [],
      consumedPrefixes: ['service'],
    },
    {
      serviceId: 'docs-explorer',
      name: '문서 탐색기',
      tier: 'frontend',
      team: 'platform',
      ownedPrefixes: [],
      consumedPrefixes: ['service'],
    },
    // ── 모니터링 ──
    {
      serviceId: 'prometheus',
      name: 'Prometheus',
      tier: 'infra',
      team: 'devops',
      url: 'http://localhost:9090',
      urls: { dev: 'http://localhost:9090' },
      gatewayPath: '/monitoring/prometheus',
      stripPrefix: true,
      ownedPrefixes: [],
      consumedPrefixes: [],
    },
    {
      serviceId: 'grafana',
      name: 'Grafana',
      tier: 'infra',
      team: 'devops',
      url: 'http://localhost:3000',
      urls: { dev: 'http://localhost:3000' },
      gatewayPath: '/monitoring/grafana',
      stripPrefix: true,
      ownedPrefixes: [],
      consumedPrefixes: [],
    },
  ];
  await configStore.set('demo', 'services', JSON.stringify(demoServices));
  logger.info({ count: demoServices.length }, 'seeded demo services to config store');

  try {
    const { getAllPacks } = await import('@qa-sdk/event-catalog');
    const serviceIds = new Set(demoServices.map((service) => service.serviceId));
    const adoptions = getAllPacks()
      .filter((pack) => pack.status === 'active' && serviceIds.has(pack.owner))
      .reduce<Array<{ serviceId: string; eventPacks: Array<{ packId: string; version: string }> }>>(
        (acc, pack) => {
          const existing = acc.find((item) => item.serviceId === pack.owner);
          if (existing) {
            existing.eventPacks.push({ packId: pack.packId, version: pack.version });
            return acc;
          }
          acc.push({
            serviceId: pack.owner,
            eventPacks: [{ packId: pack.packId, version: pack.version }],
          });
          return acc;
        },
        [],
      )
      .toSorted((a, b) => a.serviceId.localeCompare(b.serviceId))
      .map((item) => ({
        serviceId: item.serviceId,
        eventPacks: item.eventPacks.toSorted((a, b) => a.packId.localeCompare(b.packId)),
      }));

    await configStore.set('demo', EVENT_ADOPTION_CONFIG_TYPE, JSON.stringify(adoptions));
    logger.info({ count: adoptions.length }, 'seeded demo event adoption config');
  } catch (error) {
    logger.warn({ err: error }, 'Failed to seed event adoption config');
  }
}
