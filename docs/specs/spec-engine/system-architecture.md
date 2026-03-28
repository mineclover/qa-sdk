---
def:
  id: spec-system-architecture
  address: def_document:v1:1073
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: deprecated
  tags: [tier-system]
  links:
    - target: convergence-layer-spec
      type: refines
---

# System Architecture — 구현 구조 스펙

## 목적 ^purpose

차원 압축 기반 DSL DB의 전체 구현 구조를 정의한다.
3개 패키지(spec-core, sdk, cli)의 모듈 구성, 의존 관계, 타입 계층.

---

## 패키지 구성

```
@qa-sdk/spec-core    핵심 엔진 (순수 TS, framework-agnostic)
@qa-sdk/sdk          앱 코드 진입점 (QaContext, QaLogger)
@qa-sdk/cli          개발자 도구 (DKG 조회, encode/decode, 관리)
demo-snapshot        DEMO_CATALOG (SSOT) + encode/decode primitives
```

### 의존 방향

```
cli → spec-core → demo-snapshot
sdk → demo-snapshot
spec-core → demo-snapshot

cli → sdk (선택적)
spec-core ← cli (역방향 금지)
spec-core ← sdk (역방향 금지)
```

---

## spec-core 내부 구조

```
src/                           12 디렉토리, 62 구현 파일, 28 테스트, 94 exports
├── shared/                    에러 + Result 유틸
├── schema/                    6종 카테고리 + 타입 규칙 + validator
├── export-surface/            ExportSurface registry
├── spec/                      PrefixSpec + SpecDocument 타입
├── loader/                    DEMO_CATALOG ↔ PrefixSpec 변환
├── codegen/                   IR → TS/JS/Proto/JSON Schema
├── dkg/                       Design Knowledge Graph 엔진
│   └── skills/                11개 분석/검증/수렴 skill
├── convergence/               14개 집계/비교/감지/최적화 도구
├── propagation/               publish → seal → activate 파이프라인
└── store/                     SQLite 영속화
```

### 모듈 역할표

| 모듈 | 파일 | 역할 | 핵심 export |
|---|---|---|---|
| **shared** | 2 | 공유 에러/유틸 | `SpecError`, `ok`, `err` |
| **schema** | 5 | 타입 시스템 | `SchemaCategory(6종)`, `CATEGORY_RULES`, `SchemaValidator` |
| **export-surface** | 2 | 공개 인터페이스 | `ExportSurfaceRegistry` |
| **spec** | 3 | 스펙 타입 | `PrefixSpec`, `SpecDocument`, `SpecDocumentRegistry` |
| **loader** | 2 | 카탈로그 변환 | `catalogToPrefixSpecs`, `loadSpecs` |
| **codegen** | 6 | 코드 생성 | `buildIR`, `generateFromIR`, `generateProtoFromIR` |
| **dkg** | 10 | 그래프 엔진 | `GraphRegistry`, `bootstrapDkg`, `resolve`, `defineFlow` |
| **dkg/skills** | 11 | 분석 skill | 아래 상세 |
| **convergence** | 14 | 수렴 분석 | 아래 상세 |
| **propagation** | 4 | 전파 파이프라인 | `publishSpec`, `seal`, `activateAndPropagate` |
| **store** | 2 | 영속화 | `DkgSqliteStore` |

---

## DKG 타입 계층

### 노드 12종

```
승계 (CATALOG/spec-engine):
  AxisNode        — 1D 축 (entries + capacity + versions)
  PrefixNode      — N-D 주소 공간 (dims + category)
  SpecNode        — 설계 근거 문서
  SchemaNode      — 구조 정의

설계:
  DecisionNode    — 의사결정 (context + rationale + alternatives)
  VersionEventNode — 버전 전환 (changes + impact)
  ConstraintNode  — 불변 규칙 (rule + formal + scope)
  ObservationNode — 운영 관찰 (finding + suggestion + resolution)

구조:
  DomainNode      — prefix 그룹 바운더리 (boundary.exports/internal)
  ConsumerNode    — 설계된 소비자 (intendedPrefixes)
  IntentLinkNode  — 연결 의도 (endpoints + via + invariant)
  DslBundleNode   — DSL 번들 (memberPrefixes + serviceBinding)
```

### 엣지 18종

```
spec-engine 승계 (5): satisfies, implements, tests, traces-to, depends-on
설계 순방향 (5):       composes, references, governs, justifies, constrains
도메인/소비/연결 (4):   contains, bridges, consumes, binds
운영 역방향 (2):       observes, prompts
진화 추적 (2):         evolves-from, supersedes
```

---

## Schema Category 6종 — prefix 타입 규칙

| category | 설명 | 규칙 | prefix 예시 |
|---|---|---|---|
| **entity** | 정체성을 가진 것 | dims 2~6 | service, content, tracking |
| **event** | 발생한 것 | action 관련 축 필수 | cart_event, deploy_event |
| **relation** | 둘 이상의 연결 | dims ≥ 3 | relational |
| **state** | 상태 스냅샷 | dims ≥ 2 | (향후) |
| **policy** | 권한/판정 | role/action 축 필수 | permission, rbac |
| **observation** | 관측/추적 | service 참조 필수 | page_view, endpoint, flow_point |

카테고리는 `inferSchemaCategory()`로 prefix 구조에서 자동 추론.
`validateAllCategories()`로 전체 검증 (현재 19/19 통과).

---

## Skills — 11개 + 3개 체인

### 분석 skill

| skill | 입력 | 출력 |
|---|---|---|
| `analyzeImpact` | 변경 유형 + 대상 | cascade 범위 + 영향 consumer |
| `checkConstraints` | 대상 ID | violation/passed 목록 |
| `safeEntryAdd` | axis + entry | headroom + impact + 종합 판정 |
| `checkDomainHealth` | domain ID | prefix 정합성 + constraint + issues |
| `auditCoverage` | UsageData | dormant/phantom entry + Observation |
| `traceFlows` | address_context records | IntentLink invariant 위반 |

### 생성 skill

| skill | 입력 | 출력 |
|---|---|---|
| `scaffoldDecision` | 결정 유형 + 파라미터 | DecisionNode 템플릿 |
| `versionEventFromDiff` | version diff | VersionEventNode |
| `inferMigrator` | diff 정보 | 마이그레이션 패턴 + 판단 |

### 체인

| chain | 단계 | 용도 |
|---|---|---|
| `entryAddChain` | safe-add → constraint → domain → decision | entry 추가 전체 검증 |
| `systemHealthChain` | constraint → domain → observation | 시스템 건강 진단 |
| `convergeChain` | merge + deactivate + simplify + observe | 4가지 행위 구분 |

---

## Convergence — 14개 도구

| 도구 | 역할 |
|---|---|
| `usage-aggregator` | address_context → UsageData 집계 |
| `deployment-skew` | version별 사용량 → 배포 스큐 감지 |
| `category-filter` | UsageData를 category별 슬라이싱 |
| `entry-coverage` | entry 관측 커버리지 분석 |
| `symbol-comparator` | 축/prefix 중복 감지 (Jaccard) |
| `decision-comparator` | Decision 충돌/중복 검사 |
| `causal-discovery` | co-occurrence → 인과 후보 |
| `simplification-advisor` | 단일값 차원/저사용 entry 감지 |
| `boundary-recommender` | 새 prefix 경계 추천 |
| `headroom-advisor` | headroom 부족 감지 + Decision 생성 |
| `capacity-optimizer` | 최적 capacity 산출 (optimalCapacity) |
| `separation-record` | 분리 유지 근거 기록 |
| `ref-entries-sync` | refEntries 정합성 검증 |
| `collection-health` | 수집 건전성 (고아/구버전/디코드실패) |

---

## SDK — QaContext

```typescript
createQaContext({ env, region, service, namespace, catalog })
  → qa.encode(prefix, dims)         // 문자열 → 주소 (환경 자동 주입)
  → qa.decode(serialized)           // 주소 → 문자열
  → qa.resolve(serialized)          // 자동 마이그레이션
  → qa.track(prefixes)              // address_context 생성
  → qa.readContext(address_context)  // 복원
  → qa.useDsl(dslId, members)       // DSL 모드 (멤버 prefix만 허용)
  → qa.serviceAddress()             // 현재 service 주소
  → qa.executionMode                // live/test/synthetic/replay
```

환경 변수: `QA_ENV`, `QA_REGION`, `QA_SERVICE`, `QA_NAMESPACE`

---

## CLI — DKG + DX 명령어

### DKG 관리 (dkg.ts, 555 lines)

```
qa dkg report        전체 현황 + SQLite 상태 + 배포 스큐
qa dkg refresh       bootstrap 재실행 → SQLite 저장
qa dkg axes          축 목록 (페이지네이션)
qa dkg prefixes      prefix 목록 (페이지네이션)
qa dkg domains       도메인 목록
qa dkg impact <axis> 영향 분석
qa dkg overlaps      축 중복 스캔
qa dkg history       스냅샷 히스토리
qa dkg skew          배포 스큐 상세
qa dkg coverage      entry 관측 커버리지
qa dkg skills        skill 목록
qa dkg export        SQLite → JSON
qa dkg import        JSON → SQLite
```

### DX 도구 (dx.ts, 325 lines)

```
qa encode <prefix> --dim value    문자열 → 주소
qa decode "prefix:v:addr"         주소 → 문자열
qa resolve "prefix:v:addr"        자동 마이그레이션
qa find-version <axis> <entry>    문자열이 있는 버전 찾기
qa derive-refs --check            refEntries 정합성
qa impact --axis <id>             영향 분석
qa list-prefixes                  prefix 목록 (JSON 지원)
qa list-axes                      축 목록 (JSON 지원)
```

---

## Store — SQLite 영속화

```sql
dkg_nodes           (id, kind, data JSON)
dkg_edges           (type, from_id, to_id, meta JSON)
usage_snapshots     (collected_at, period, data JSON)
version_usages      (snapshot_id, prefix, version, count, sessions JSON)
dkg_meta            (key, value)
```

JSON export/import 지원 → git 추적/팀 공유.

---

## DEMO_CATALOG — SSOT

```
39 axes (174 entries, capacity 1312)
19 prefixes (5 categories)
6 tables

refEntries: 의미(catalog-builder.ts)에서 자동 파생. 정수 하드코딩 없음.
capacity: optimalCapacity 규칙 적용 (전부 32 또는 64).
```

---

## 의존 규칙 (MODULE_BOUNDARIES.md)

```
허용:
  shared ← 모든 모듈
  dkg.types ← convergence (타입 참조만)
  convergence ← dkg/skills (분석 도구 사용)

금지:
  shared → 어디에도 의존하면 안 됨
  convergence → dkg/skills (역방향)
  store → convergence (직접 의존 금지)
  codegen → dkg (코드 생성은 그래프 몰라도 됨)
```
