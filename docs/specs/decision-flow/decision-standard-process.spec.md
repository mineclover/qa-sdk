---
def:
  id: decision-standard-process
  address: def_document:v2:137346
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: domain
  svc: decision-flow
  tags: [decision]
  links:
    - target: decision-standard
      type: refines
---

# Decision Standard 프로세스

## 목적 ^purpose

새 요구사항이 들어왔을 때 기존 prefix 재사용과 신규 prefix 정의 중 어떤 경로를 택할지 판단하는 표준 프로세스를 정리한다.

## 구성 ^overview

- `진입: 컨텍스트 확인`: ContextProvider로 기존 결정 이력과 패턴을 조회하는 단계를 정의한다.
- `분기: 기존 vs 신규`: 기존 prefix 재사용과 신규 prefix 정의를 판별하는 기준을 기술한다.
- `기존 변경 경로`: entry 추가, version 승격, capacity 확장의 산출물을 명시한다.
- `신규 정의 경로`: 축 설계, prefix 정의, DKG 등록, codegen의 산출물을 정리한다.

## 진입: 컨텍스트 확인

새 요구사항이 들어오면 먼저 ContextProvider (decision-flow/src/context-provider.ts)로 기존 맥락을 확인한다:

```typescript
const ctx = contextProvider.provide(schemaId, { feature: "new-requirement" });
// → history: 이 스키마의 이전 결정 이력 요약
// → patterns: 감지된 반복 패턴 ("보통 이렇게 결정한다")
// → activePolicies: 적용 가능한 자동 정책
// → modelHints: 인지 모델 힌트
// → openQuestions: 이전 결정에서 남긴 열린 질문
```

`contextProvider.lookup(keyword)`로 기존에 관련 결정이 있었는지 검색한다. relatedInstances, relatedPolicies, relatedPatterns, openQuestions를 종합하여 중복 결정을 방지한다.

## 분기: 기존 vs 신규

시스템 정체성(차원 압축 DSL DB)과 현재 prefix 집합을 보고 판별한다:

```
요구사항 → [기존 좌표계 안에서 닫히는가?]
  ├── 예 → 기존 변경 경로
  └── 아니오 → 신규 정의 경로
```

판별 기준 (표준 질문 체크리스트 1-3번):
1. 기존 prefix의 entry 추가만으로 표현 가능한가?
2. 기존 축을 공유할 수 있는가?
3. prefix_ref로 계층 구조를 표현할 수 있는가?

하나라도 "예"면 기존 변경 경로. 모두 "아니오"면 신규 정의 경로.

## 기존 변경 경로

기존 좌표계 내에서 변경하는 3가지 경우와 산출물:

| 경우 | 조건 | 산출물 |
|------|------|--------|
| **entry 추가** | headroom > 0 | DEMO_CATALOG 수정 → codegen 재실행 |
| **version 승격** | headroom = 0이거나 구조 변경 | 새 PrefixVersionDef → seal → activate |
| **capacity 확장** | capacity 부족 | nextPowerOf2(entries * 2) 이상으로 확장 |

산출물 체크리스트:
- [ ] DEMO_CATALOG에 entry/version 추가
- [ ] `pnpm --filter demo-types build` → 타입 재생성
- [ ] `pnpm --filter demo-tests test` → 테스트 통과 확인
- [ ] headroom 확인 (getPrefixProfile)

## 신규 정의 경로

새 prefix를 만들어야 하는 경우의 4단계 프로세스:

### 1단계: 축 설계
- 5Q Checklist로 각 차원이 axis인지 판단
- capacity 산정: `nextPowerOf2(entries * 2)` 이상
- SchemaCategory 6종 중 적합한 카테고리 선택

### 2단계: prefix 정의
- PrefixDef 작성: id, name, labels, dims(DimRef 3종), versions
- PrefixMeta 작성: category, layer, visualShape, detailKind
- DEMO_CATALOG에 추가

### 3단계: DKG 등록
- bootstrapDkg → 새 prefix가 DKG graph에 노드로 추가
- IntentLink/observation 필요 시 DKG config에 선언
- ownedPrefixes: 이벤트를 생산하는 서비스에서 선언

### 4단계: codegen + 검증
- `pnpm --filter demo-types build` → 타입 코드 자동 생성
- `validateAllCategories(graph)` → 카테고리 규칙 준수 확인
- `checkAddressHealth()` → 기존 데이터와의 호환성 확인

**핵심 원칙**: 프로세스는 복잡한 설계를 늘리기보다 **DSL이 제어해야 할 경우의 수를 줄이는 방향**으로 진행한다.
