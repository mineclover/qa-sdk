# AGENT.md — Definition System 진행 상황

> 이 문서는 에이전트 간 컨텍스트 공유용. 사람이 읽어도 되지만 주 독자는 다음 에이전트.

## 프로젝트 목표

문서 기반 소프트웨어 정의 관리 체계를 구축하고, NestJS 서비스로 운영한다.
핵심 철학: **코드 전체가 아니라 핵심 분기만 관리. 코드에 담을 수 없는 의미와 의도가 문서에 담긴다.**

## 완료된 작업

### definition-catalog (라이브러리)
- 7 scope × 22 aspect × 4 depth 좌표 체계
- 4계층 DefLayer: domain / operation / mediation / experience
- 8종 계약 마커 + 가역성(Reversibility) + 주소 의도(SliceIntent) + 소비율(Consumption)
- HyEvo 기반: contract assembly → workflow compilation → reflect
- 453건 문서 관리 (390 approved), 전부 layer 부여
- 57 prefix 문서 (gen-prefix-docs.mjs), 20 skill 문서 (gen-skill-docs.mjs)
- 410 tests 통과

### definition-service (NestJS, port 3700)
- 7 NestJS 모듈: docs, prefixes, intents, consumption, graph, sync, tests
- core/ 분리 완료 (doc-versioner, intent-resolver, consumption-diagnostics, sync-engine)
- DB: SQLite 파일 기반 (7 테이블)
- prefix 공급: registry-service → fetch → DB (fallback 없음, DB 캐시만)
- 26개 API 엔드포인트 스모크 테스트 통과

### definition-client
- 순수 HTTP 클라이언트 + NestJS DI 모듈 (DefinitionModule.forRoot)
- 21개 메서드 (docs, prefixes, intents, consumption, graph, sync, tests)
- 10 tests 통과

### registry-service Phase 1 완료
- core/ 분리: seed-catalog, seed-config, seed-endpoints, seed-events, types
- server.ts → core/ import로 교체, 기존 동작 불변
- 170 tests 통과

## 현재 진행 중: registry-service NestJS 전환 (Phase 2~4)

### Phase 2: NestJS 모듈 구조 생성
9개 모듈로 분리:
- catalog, prefixes, versions, axes, services, events, workspace, dashboard, seed
- definition-service에서 검증된 패턴: @Global DatabaseModule + @Inject(DATABASE) + 명시적 @Inject()

### Phase 3: prefix SDK 자체 적용
- DefinitionModule.forRoot() import
- prefix 활성화/삭제 → definition-service에 자동 보고
- 영향 테스트 자동 식별

### Phase 4: Hono 제거 + 테스트 전환
- routes/ 삭제, app.ts 삭제, server.ts → main.ts
- TestingModule 기반 테스트

## 아키텍처 원칙

### 4계층 (DefLayer)
- domain: "이것이 참이다" — 삭제하면 진실이 사라짐
- operation: "시스템이 돌아가게 한다" — 삭제하면 성능 저하
- mediation: "진실을 소비 가능하게 변환" — 삭제하면 유저 불편
- experience: "사용자 행동을 유도한다" — 삭제하면 유도 소멸

### 영향 전파
- domain → domain + operation + mediation (experience 직접 영향 없음)
- operation → operation 내부만 (독립)
- mediation → mediation + experience (domain 역전파 없음)
- experience → experience 내부만

### import 제약 (core/ 분리 원칙)
- core/ → definition-catalog (라이브러리) 허용
- core/ → stores/ 금지 (interfaces만 정의)
- core/ → http/routes/modules 금지
- stores/ → core/ 허용
- modules/ → core/ + stores/ 허용

### 문서 철학
- 문서 = 코드에 담을 수 없는 의미/의도 저장소. 코드 중복 zero.
- ^purpose (왜 존재), ^intent (설계 근거), ^context (사용 맥락), ^feedback (피드백 규칙), ^caveat (주의)
- 각 NestJS 모듈 = 1 definition-catalog 문서 (코드-문서 1:1 매핑)

## 서비스 포트
- ingest(3200), registry(3300), gate(3400), query(3500), decode(3600), definition(3700)

## 주요 파일 위치
- definition-catalog: packages/definition-catalog/src/
- definition-service: packages/definition-service/src/
- definition-client: packages/definition-client/src/
- registry-service core/: packages/registry-service/src/core/
- prefix 문서: docs/specs/prefix-catalog/
- skill 문서: docs/specs/skill-catalog/
- 문서 생성 스크립트: packages/definition-catalog/scripts/
