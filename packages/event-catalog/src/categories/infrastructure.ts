// @def.boundary event-vocab-system
import type { CoreEventDef } from '../types.js';

/**
 * 인프라 관측 이벤트 — 시스템 내부 상태 변경을 추적.
 *
 * 사용자 행동이 아닌 시스템 자체의 상태 변화를 관측한다.
 * 메트릭 수집, 패턴 분류, 스키마 검증, 생명주기 전이 등.
 */
export const infrastructureEvents: CoreEventDef[] = [
  // ── 메트릭/관측 ──
  {
    event_key: 'metric.collected',
    event_version: '1',
    mode: 'core',
    category: 'infrastructure',
    channel: ['backend'],
    display_name: '메트릭 수집',
    description: '수렴 분석에서 메트릭 값을 수집하고 관측 노드로 변환',
    auto_collectable: false,
    graph_hint: { role: 'observation', goal_eligible: false, loopable: true },
  },

  // ── 패턴 분류 ──
  {
    event_key: 'pattern.classified',
    event_version: '1',
    mode: 'core',
    category: 'infrastructure',
    channel: ['backend'],
    display_name: '패턴 분류',
    description: '세션별 이벤트 패턴을 규칙 기반으로 분류',
    auto_collectable: false,
    graph_hint: { role: 'observation', goal_eligible: false, loopable: true },
  },
  {
    event_key: 'pattern.anomaly_detected',
    event_version: '1',
    mode: 'core',
    category: 'infrastructure',
    channel: ['backend'],
    display_name: '패턴 이상 감지',
    description: '이전 패턴 통계 대비 이상치 감지 (비율 편이, 볼륨 급등)',
    auto_collectable: false,
    graph_hint: { role: 'observation', goal_eligible: false, loopable: true },
  },

  // ── 스키마/레코드 ──
  {
    event_key: 'schema.validated',
    event_version: '1',
    mode: 'core',
    category: 'infrastructure',
    channel: ['backend'],
    display_name: '스키마 검증',
    description: '수신 이벤트의 스키마 정합성 검증',
    auto_collectable: false,
    graph_hint: { role: 'observation', goal_eligible: false, loopable: true },
  },
  {
    event_key: 'record.ingested',
    event_version: '1',
    mode: 'core',
    category: 'infrastructure',
    channel: ['backend'],
    display_name: '레코드 수집',
    description: 'ingest-server에 이벤트 레코드 저장 완료',
    auto_collectable: false,
    graph_hint: { role: 'transition', goal_eligible: false, loopable: true },
  },

  // ── 정책/검증 ──
  {
    event_key: 'policy.evaluated',
    event_version: '1',
    mode: 'core',
    category: 'infrastructure',
    channel: ['backend'],
    display_name: '데이터 정책 평가',
    description: '데이터 정책 규칙 평가 (제약 조건 통과/위반)',
    auto_collectable: false,
    graph_hint: { role: 'observation', goal_eligible: false, loopable: true },
  },

  // ── 버전/게이트 관측 ──
  {
    event_key: 'version.observed',
    event_version: '1',
    mode: 'core',
    category: 'infrastructure',
    channel: ['backend'],
    display_name: '버전 관측',
    description: 'prefix 버전 상태 관측 (headroom, 생명주기)',
    auto_collectable: false,
    graph_hint: { role: 'observation', goal_eligible: false, loopable: true },
  },
  {
    event_key: 'gate.observed',
    event_version: '1',
    mode: 'core',
    category: 'infrastructure',
    channel: ['backend'],
    display_name: '게이트 관측',
    description: 'GateEngine 주소 상태 관측 (active/inactive/open/reserved)',
    auto_collectable: false,
    graph_hint: { role: 'observation', goal_eligible: false, loopable: true },
  },

  // ── 리소스/태그 생명주기 ──
  {
    event_key: 'resource.lifecycle_changed',
    event_version: '1',
    mode: 'core',
    category: 'infrastructure',
    channel: ['backend'],
    display_name: '리소스 생명주기 변경',
    description: '시스템 리소스의 생명주기 상태 전이',
    auto_collectable: false,
    graph_hint: { role: 'transition', goal_eligible: false, loopable: true },
  },
  {
    event_key: 'tag.lifecycle_changed',
    event_version: '1',
    mode: 'core',
    category: 'infrastructure',
    channel: ['backend'],
    display_name: '태그 생명주기 변경',
    description: '태그의 생명주기 상태 전이 (부여/제거/전파)',
    auto_collectable: false,
    graph_hint: { role: 'transition', goal_eligible: false, loopable: true },
  },

  // ── Decision-Flow 관측 ──
  {
    event_key: 'flow.path_resolved',
    event_version: '1',
    mode: 'core',
    category: 'infrastructure',
    channel: ['backend', 'sdk'],
    display_name: '의사결정 경로 확정',
    description: '의사결정 플로우 완료 시 최종 경로를 좌표로 인코딩',
    auto_collectable: false,
    graph_hint: { role: 'terminal', goal_eligible: false, loopable: false },
  },
  {
    event_key: 'flow.model_applied',
    event_version: '1',
    mode: 'core',
    category: 'infrastructure',
    channel: ['backend', 'sdk'],
    display_name: '인지 모델 적용',
    description: '의사결정에 인지 모델(편향 보정, 프레임워크)을 적용',
    auto_collectable: false,
    graph_hint: { role: 'observation', goal_eligible: false, loopable: true },
  },

  // ── CLI 관측 ──
  {
    event_key: 'cli.tracking',
    event_version: '1',
    mode: 'core',
    category: 'infrastructure',
    channel: ['sdk'],
    display_name: 'CLI 추적',
    description: 'CLI 명령 실행 추적 (패키지/모듈/플로우)',
    auto_collectable: false,
    graph_hint: { role: 'transition', goal_eligible: false, loopable: true },
  },
  {
    event_key: 'test.coverage_report',
    event_version: '1',
    mode: 'core',
    category: 'infrastructure',
    channel: ['sdk'],
    display_name: '테스트 커버리지 리포트',
    description: '테스트 실행 결과와 커버리지 메트릭 수집',
    auto_collectable: false,
    graph_hint: { role: 'observation', goal_eligible: false, loopable: true },
  },

  // ── 문서 그래프 관측 ──
  {
    event_key: 'graph.structure_changed',
    event_version: '1',
    mode: 'core',
    category: 'infrastructure',
    channel: ['backend', 'sdk'],
    display_name: '그래프 구조 변경',
    description: '문서 그래프 링크 추가/삭제, 문서 역할(level) 승격/강등, 분할/병합',
    auto_collectable: false,
    graph_hint: { role: 'transition', goal_eligible: false, loopable: true },
  },
  {
    event_key: 'context_runtime_observation',
    event_version: '1',
    mode: 'core',
    category: 'infrastructure',
    channel: ['backend', 'agent'],
    display_name: '컨텍스트 런타임 관측',
    description: 'Discovery/Working Context의 route, closure, usage metadata 관측',
    auto_collectable: false,
    graph_hint: { role: 'observation', goal_eligible: false, loopable: true },
  },
];
