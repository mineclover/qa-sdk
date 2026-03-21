# Realization Plan: spec-core 패키지 개선/분해

> Status: draft
> Created: 2026-03-22

## 1. 현재 구조 분석

### 1.1 코드 규모

| 모듈 | 프로덕션 LOC | 테스트 LOC | 파일 수 | 비고 |
|------|-------------|-----------|---------|------|
| shared | 76 | 0 | 3 | 리프. 의존 없음 |
| schema | 1,096 | 444 | 11 | shared + graph-port에만 의존 |
| export-surface | 96 | 108 | 3 | shared에만 의존 |
| spec | 155 | 105 | 4 | shared + schema에 의존 |
| loader | 584 | 391 | 5 | spec + export-surface에 의존 |
| codegen | 690 | 150 | 9 | spec + loader에 의존 |
| **dkg** | **5,973** | **2,200** | **42** | graph-registry + types + bootstrap + skills 24개 |
| **convergence** | **4,205** | **2,654** | **35** | 집계/측정/비교/추천/기록/필터/패턴/metric |
| propagation | 1,083 | 759 | 13 | dkg + spec에 의존 |
| store | 660 | 239 | 4 | dkg + convergence.types에 의존 |
| visualization | 389 | 0 | 3 | convergence.types에 의존 |
| **합계** | **~15,000** | **~7,050** | **132** | dkg + convergence = 전체의 67% |

### 1.2 의존 방향 (현재)

```
shared (리프)
  ↑
schema ←── graph-port 인터페이스로 dkg 역방향 해소
  ↑
spec ←── export-surface
  ↑
loader → codegen

dkg.types (리프 — 타입만)
  ↑
graph-registry ← dkg.types에만 의존
  ↑
dkg/* (bootstrap, catalog-derive, dsl-bundle, ...)
  ↑                    ↕ (양방향)
dkg/skills/*  ──→  convergence/*
  ↑
propagation ──→ dkg + spec + schema
  ↑
store ──→ dkg (graph-registry, types) + convergence (types만)
```

### 1.3 양방향 의존 상세 (핵심 문제)

**dkg → convergence** (bootstrap.ts 단일 파일):
- `headroom-advisor.ts`, `symbol-comparator.ts`, `separation-record.ts`

**convergence → dkg** (type-only 14개 + runtime 2개):
- runtime: `scaffoldDecision` (headroom-advisor, separation-record — 2개 파일만)

**dkg/skills → convergence** (3개 skill):
- `converge-chain.ts` (6 imports — 핵심 오케스트레이터)
- `coverage-audit.ts` (2 imports)
- `flow-trace.ts` (1 import — AddressContextRecord 타입만)

---

## 2. 문제 진단

### 2.1 빌드 시간

단일 `tsc` 빌드로 132개 파일 한 번에 컴파일. convergence 한 줄 수정에도 spec-core 전체 재빌드 + 하류(cli, ingest-server, registry-service) 연쇄 재빌드.

### 2.2 변경 영향 범위

`./analysis` barrel이 232줄로, convergence + dkg 전체를 하나의 진입점으로 노출. 트리쉐이킹 불가. 패턴 규칙 수정이 codegen이나 propagation에도 영향.

### 2.3 진입 장벽

12개 내부 모듈의 의존 관계를 파악해야 신규 기여 가능. `./analysis` 하나에 DKG 타입 47종, skill 25종, convergence 함수 40종 이상이 혼재.

### 2.4 순환 의존의 실제 비용

`analysis/index.ts`로 합쳐서 순환을 "해소"했지만 본질적 해결이 아닌 회피. convergence가 `scaffoldDecision`을 runtime import하는 것이 유일한 실제 순환이며, 이 함수는 순수 함수로 추출 가능.

---

## 3. 분리 전략 비교

### 3.1 전략 A: 물리적 3-way split

`@qa-sdk/spec-core` + `@qa-sdk/dkg` + `@qa-sdk/convergence`

장점: 빌드 완전 분리, 독립 배포, 트리쉐이킹. 단점: 패키지 3개 관리, import 경로 전부 변경, 마이그레이션 비용 높음.

### 3.2 전략 B: 물리적 2-way split

`@qa-sdk/spec-core` (foundation + DKG) + `@qa-sdk/convergence`

장점: convergence만 추출, 마이그레이션 범위 작음. 단점: DKG가 여전히 spec-core 안에 큼. dkg/skills의 convergence 의존(3개 skill) 해소 필요.

### 3.3 전략 C: 논리적 경계 강화 (분리 없음)

sub-path exports 세분화: `./dkg`, `./dkg/skills`, `./convergence` 추가.

장점: 즉시 실행, import 변경 최소. 단점: 빌드 단위 여전히 단일, 강제성 없음.

### 3.4 전략 D: 논리적 강화 + 점진적 분리 (권장)

Phase 1에서 논리적 경계를 강화하고, Phase 2에서 convergence만 물리적으로 분리.

---

## 4. 권장 방안: 전략 D

### Phase 1: 내부 경계 정리 (1-2일)

#### 1-1. scaffoldDecision을 dkg/skills → dkg 루트로 이동

convergence → dkg/skills 런타임 역방향 의존 제거.

#### 1-2. sub-path exports 세분화

```jsonc
{
  ".":              "shared + schema + spec + loader",
  "./codegen":      "codegen",
  "./dkg":          "dkg types + graph + bootstrap (신규)",
  "./dkg/skills":   "skills 전체 (신규)",
  "./convergence":  "convergence 전체 (신규, ./analysis 대체)",
  "./propagation":  "propagation",
  "./store":        "store",
  "./viz":          "visualization"
}
```

`./analysis`는 deprecated re-export로 유지.

#### 1-3. convergence → dkg 의존을 GraphPort 인터페이스로 전환

10개 파일에서 `GraphRegistry` → `GraphPort` 타입 전환. convergence는 shared/graph-port.ts 인터페이스 + dkg.types 타입만 참조.

#### 1-4. boundary lint 추가

```typescript
it("convergence는 dkg/skills를 runtime import하지 않는다", () => { ... });
```

### Phase 2: convergence 물리적 분리 (2-3일)

Phase 1 완료 전제.

#### 2-1. 새 패키지 생성

```
packages/convergence/
  package.json       ← "@qa-sdk/convergence"
  src/               ← 35개 파일 이동
```

dependencies: `@qa-sdk/core` (GraphPort, PrefixLike)

#### 2-2. dkg/skills의 convergence 의존 해소

| Skill | 해소 방안 |
|-------|----------|
| converge-chain.ts | `@qa-sdk/convergence` dependency 추가 |
| coverage-audit.ts | 동일 |
| flow-trace.ts | AddressContextRecord 타입을 @qa-sdk/core로 이동 |

spec-core → convergence 단방향. convergence → spec-core 없으므로 순환 없음.

#### 2-3. 외부 소비자 마이그레이션

```typescript
// 변경 전
import { aggregateUsageData } from "@qa-sdk/spec-core/analysis";
// 변경 후
import { aggregateUsageData } from "@qa-sdk/convergence";
```

하위 호환: `./analysis`에서 `@qa-sdk/convergence` re-export.

### Phase 3: 추가 분리 검토 (미래)

Phase 2 후 spec-core는 ~11,000 LOC. 관리 가능하면 추가 분리 불필요.

---

## 5. 의존 그래프 변경

### Phase 2 후

```
@qa-sdk/core ── GraphPort, PrefixLike, UsageData 타입
  ↑
@qa-sdk/spec-core
  ├── "." (foundation)
  ├── "./codegen"
  ├── "./dkg" ──→ @qa-sdk/core
  ├── "./dkg/skills" ──→ @qa-sdk/core + @qa-sdk/convergence
  ├── "./propagation" ──→ dkg + spec
  ├── "./store" ──→ dkg + @qa-sdk/core(UsageData)
  └── "./viz" ──→ @qa-sdk/core(UsageData)

@qa-sdk/convergence ──→ @qa-sdk/core (GraphPort, 타입만)
```

순환 없음.

---

## 6. 검증 기준

### Phase 1

- convergence → dkg/skills 런타임 import 0개
- `./dkg`, `./convergence` sub-path 개별 import 가능
- `./analysis` 하위 호환 유지
- 전체 테스트 통과

### Phase 2

- `@qa-sdk/convergence` 독립 빌드 성공
- convergence → spec-core 의존 없음 확인
- convergence 단독 변경 시 spec-core 재빌드 발생 안 함
- 전체 모노레포 빌드 + 테스트 통과

### 정량 목표

| 지표 | 현재 | Phase 1 후 | Phase 2 후 |
|------|------|-----------|-----------|
| spec-core LOC | 15,000 | 15,000 | ~11,000 |
| convergence LOC | (내부 4,205) | (내부 4,205) | 4,205 (독립) |
| analysis barrel LOC | 232 | 0 (deprecated) | 0 |
| sub-path exports | 6 | 8 | 7 |
| 빌드 영향 (convergence 변경) | spec-core 전체 | spec-core 전체 | convergence만 |
