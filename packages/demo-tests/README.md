# demo-tests

> 완성된 데이터 구조로 의도를 표현하고, 그 위에서 cross-package 동작을 검증하는 통합 테스트

## 목적

특정 목적의 데이터 구조를 기반으로 테스트하기 때문에, **완성된 데이터 구조로 의도를 표현하는 것**이 핵심이다.

개별 패키지(weighted-index, index-meta, permission-engine)의 유닛 테스트는 각 패키지에 남아있고, 여기서는 **데이터 구조의 의미**가 여러 패키지에 걸쳐 올바르게 동작하는지 검증한다.

## 데이터 도메인

`demo-snapshot` 패키지가 5개 도메인의 데이터 구조를 정의한다:

| 도메인 | 구조 | 용도 |
|--------|------|------|
| **Shopping** | service(4D) × permission(2D) × event(3D) | 쇼핑 플랫폼 인덱스 체계 — 크로스인덱스, v1/v2 마이그레이션 |
| **RBAC** | role × action × resource | 역할 기반 접근 제어 — 정책 규칙, 게이트 제어 |
| **Content** | tag(1D) + article(3D) + feed(2D) | 콘텐츠 플랫폼 — 태그/기사/피드 크로스인덱스, headroom |
| **Tracking** | action × page × userType | 사용자 행동 추적 — 이커머스 이벤트 분석 |
| **Relational** | subject_kind × predicate × object_kind | 관계 모델 — RBAC 관계 표현, 정책 평가 |

## 테스트 구조

```
src/
  index-meta/                    ← MetaRegistry 기반 시나리오
    shopping-platform.test.ts      쇼핑 플랫폼 3-index 크로스인덱스
    search-index.test.ts           콘텐츠 플랫폼 태그/기사/피드
    relational-engine.test.ts      관계 엔진 유닛
    relational-engine-e2e.test.ts  관계 엔진 E2E (정책 평가)
    gate-engine.test.ts            게이트 상태 관리 (inactive/open)
    sdk-lifecycle-e2e.test.ts      SDK 풀 라이프사이클 (v1→v2)
    index-sdk.test.ts              SDK API (트래킹 도메인)
    codegen.test.ts                RBAC 스키마 코드 생성
    policy-resolver.test.ts        정책 규칙 매칭/충돌 해결
    invariants.test.ts             크로스인덱스 불변 조건
    distributed-e2e.test.ts        분산 클라이언트 E2E
    decode-distribution-e2e.test.ts 분산 디코딩 E2E
    table-flow-e2e.test.ts         defineTable→compile→sync 파이프라인
    store-lifecycle-e2e.test.ts    SQL 스토어 라이프사이클
    address-vs-info-e2e.test.ts    주소 파싱 vs 정보 조회
    registry-backup-api-e2e.test.ts 백업/복원 API
    gate-engine-sql-e2e.test.ts    SQL 게이트 엔진

  permission-engine/             ← PermissionSet 기반 시나리오
    scenario.test.ts               G-SHOP API 게이트웨이 시나리오
    e2e-check.test.ts              E2E 권한 체크
    permission-codec.test.ts       서비스/타입/리소스/액션 코덱
    resource.test.ts               리소스 경로 검증
    service-ref.test.ts            서비스 ID 참조
    permission-code.test.ts        PermCode 포매팅

  merge-contract/                ← 의미적 중복 제거 계약 (indexing-merge-plan)
    d1-label-map-parity.test.ts    PermissionCodec ↔ LabelRegistry 맵 동등성
    d2-d5-meta-registry-shape.test.ts  MetaRegistry shape 경로 일관성 + unresolved ref
    d3-capacity-parity.test.ts     compileSchema ↔ MetaRegistry capacity 일치
    d4-stride-parity.test.ts       calcWeights() ↔ WeightedIndex.strides 일치
    error-parity.test.ts           코덱 간 에러 거부 동작 패리티

  bit-field-roundtrip.test.ts    bit-field-layout 변환 경로 라운드트립 (Number/BigInt/hex/bytes)
  dim-pack-roundtrip.test.ts     BitIndex 차원별 비트 패킹 라운드트립 + O(1) 추출 검증
  encoding-comparison.test.ts    WeightedIndex vs BitIndex 역할 분담 증명 + use case 검증
  encoding-bridge.test.ts        IndexBridge 양방향 변환 전수 왕복 + DB↔인메모리 파이프라인
  bit-mask-set-e2e.test.ts       BitMaskSet grant/filter/대수/직렬화 + Bridge 연동

  registry-service-e2e.test.ts   Registry Service 쇼핑 플랫폼 E2E (DAG·simulate·lock·release·resolve)
  registry-service-format-exploration.test.ts  서비스 등록 포맷 탐색 (Format A~D 비교)
  registry-dsl-git.test.ts       Git 버전 관리 체계 DSL (pkg·semver·ccType 축 + 주소 인코딩)

  permission-view-e2e.test.ts    PermissionView/Cache + BitMaskSet 교차 E2E (filter/patch/cache/hasBit)
  platform-api-contract.test.ts  platform-demo-api 응답 contract + mask API + SSOT 정합성

  permission-engine (캐시/최적화)
    permission-view-cache.test.ts  캐시 기본/패치/무효화/Singleflight/LRU/고트래픽 시뮬레이션
    bench-bit-optimization.test.ts BitIndex 최적화 벤치마크 (§1-§6)
  registry-codec.test.ts         MetaRegistry 코덱 라운드트립
  position-stability.test.ts     v1→v2 위치 안정성
  permission-migration.test.ts   권한 마이그레이션 통합
  schema-consistency.test.ts     스키마 일관성 검증
```

## 실행

```bash
pnpm --filter @qa-sdk/demo-tests test
```
