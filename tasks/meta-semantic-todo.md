# Meta-Semantic TODO

> 최종 업데이트: 2026-04-01

## 현황

- 스펙: 71개 문서
- 구현: 32개 파일 (`@qa-sdk/core` + `definition-catalog`)
- 테스트: 425 tests 전부 통과

---

## 완료

### Phase 1 — 기반

- [x] 9가지 원자 개념 정의 (concepts/ 9 leaf)
- [x] IR 구조 (ir/ 3 leaf: module, data, pipe)
- [x] ScopeRegistry — 경로 모델 + N:M + 버전 관리 (14 tests)
- [x] ManifestRegistry — prefix + manifest 라이프사이클 (16 tests)
- [x] ASPECT_TO_SCOPES (N:M) + compat 분리
- [x] ^method 마커 체계 추가 (C10)
- [x] def-* 스킬 6개에 meta-semantic 판단 원칙 추가
- [x] 데이터 패싯 → "역할 분리" 재명명 (확장 가능)
- [x] "5원 분리" → "데이터 패싯 (Data Facets)" 전환

### Phase 2 — PipeSpec + PipeGraph

- [x] PipeFlow 29종 타입 정의
- [x] ConnectionKind 8종 타입 정의 (N:M PipeConnection)
- [x] countPipePaths / countGraphPaths (38 tests)
- [x] validatePipeSpec / validatePipeGraph
- [x] 직렬화 — serialize/deserialize JSON (4 tests)
- [x] 저장 — PipeGraphStore/PipeSpecStore + 인메모리 (9 tests)
- [x] 분석 — complexity, bottleneck, coverage (6 tests)
- [x] Phase 2 시뮬레이션 — simulate() + resolver (81 tests)
- [x] Phase 2→3 브릿지 — extractLineage, validateStepContracts, constraintResultToEvent
- [x] PipeFlow 카탈로그 (flows/ 29 leaf, connections/ 8 leaf)

### Phase 3 — 런타임

- [x] ConditionEvaluator — parseCondition + evaluateCondition (10 tests)
- [x] CancellationToken — 협력적 취소 + child 전파 (5 tests)
- [x] PipeContext — get/set/clone + 중첩 경로 (4 tests)
- [x] ExecutorRegistry — facet별 실행기
- [x] PipeRunner — run() + 에러 전파 + 이벤트 체인 (10 tests)
- [x] 벤치마크 — 전부 서브밀리초 (11 tests)

### Semantic Folding

- [x] computeFoldedContract — 서브그래프 경계 계약 도출
- [x] foldSubgraph — 파이프 그룹 → 단일 노드 축소
- [x] unfoldNode — 접힌 노드 → 원본 복원
- [x] detectFoldRegions — scope 클러스터 / 선형 체인 / SCC 자동 탐지
- [x] 성능 벤치마크 — 200파이프 depth=12, 3단계 중첩 fold 전부 서브밀리초 (38 tests)

### 연산자 안정화 (31종 PipeFlow × 6모듈)

- [x] validate — 빈 from/to 배열 검증, 숫자 범위 (duration>0, cooldown>0 등), correlation 자기참조 (+19 tests)
- [x] simulate — loop 반복, tap 에러 격리, dedup 상태 추적, 테스트 커버리지 확대 (+21 tests)
- [x] runtime — throttle 속도제한, debounce 대기, dedup 중복제거, filter skip 기록 (+10 tests)

### 데이터 계약

- [x] DataSchema — 컬럼 + 패싯 역할 (FacetRole)
- [x] DataRelation — 1:1/1:N/N:M + cascade
- [x] checkCompatibility — 스키마 호환 검증
- [x] LineageCollector — 10종 변환 + 원본/영향 추적
- [x] VersionCollector — 9종 변경 + backward/forward/breaking (36 tests)

### Constraint 엔진

- [x] ConstraintDef — subject × predicate × context × evidence
- [x] evaluatePredicate — 20종 op + and/or/not 중첩
- [x] executeConstraint → ConstraintResult + FailureTrace
- [x] ConstraintRegistry — 등록/조회/결과 수집/품질 지표 (24 tests)

### 표준 호환

- [x] CloudEvents — toCloudEvent/fromCloudEvent + 배치 + 직렬화 (14 tests)
- [x] AsyncAPI — generateAsyncApi + YAML/JSON 생성기 (4 tests)

### 테스트 추적 + 매칭

- [x] TestRegistry — 케이스/스위트/결과 수집 + 품질 지표 (18 tests)
- [x] PathMatcher — matchPath() + 판정 (pass/warn/fail) (8 tests)

---

## 진행 중

(없음)

---

## 미완료

### 레이어 2 — 해석 (PipeGraph 네이티브)

- [x] PipeConcern 8종 자동 추출 — extractPipeConcerns (flow 패턴 → 관심사)
- [x] 전파 규칙 테이블 — PIPE_PROPAGATION_RULES (ConnectionKind × PipeConcern × 방향)
- [x] concern 전파 BFS — propagatePipeConcerns (전이적 전파 축소 포함)
- [x] 변경 영향 분석 — analyzePipeImpact (blastRadius + byConcern)
- [x] 파이프 역할 분류 — classifyPipeRole (producer/consumer/transformer/router/observer)
- [x] 테스트 23건 통과

잔여 (definition-catalog 브릿지 — 별도 레이어):
- [ ] lifecycle — definition 쪽 lifecycle 조회 브릿지
- [ ] layer 영향 전파 — definition 쪽 canPropagate 브릿지
- [ ] tags — definition 쪽 tags 조회 브릿지

### 시각화

- [ ] PipeGraph → Mermaid 변환
- [ ] PipeGraph → D3/SVG 변환
- [ ] Semantic Folding 줌 레벨 시각화

### 인프라 통합

- [ ] ManifestStore 영속화 — 인메모리 → SQLite
- [ ] registry-service 연동 — 매니페스트 API 노출
- [ ] PipeGraphStore 영속화 — 인메모리 → SQLite
- [ ] toCloudEvent → 실제 EventRecord 타입 연결

### v2 마이그레이션 잔여

- [ ] ScenarioSpec → PipeGraph 마이그레이션 가이드
- [ ] graph-matcher → PathMatcher 전환 (feature flag)
- [ ] VerdictReport v1 → v2 전환
- [ ] compat 파일 제거 체크리스트

### 스펙 정리

- [ ] test-tracking.spec 구현 완료 반영
- [ ] execution-semantics.spec PathMatcher 구현 완료 반영
- [ ] pipe-impl leaf 문서들 구현 소스 참조 업데이트
