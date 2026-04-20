---
def:
  id: spec-analyzer-system
  tier: system
  address: def_document:v2:68807
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  svc: spec-analyzer
  tags: [testing]
  links:
    - target: spec-verification-system
      type: refines
    - target: definition-catalog-spec
      type: contains
    - target: spec-analyzer-drift
      type: contains
    - target: spec-analyzer-types
      type: contains
    - target: spec-analyzer-extractor
      type: contains
---
# Spec Analyzer — 정적 코드 분석기

## 목적 ^purpose

코드를 분석하여 스펙 문서에 정의된 API/기능/타입이 실제 코드에 존재하는지 검증하는 정적 분석 도구. "이 spec에 적힌 것이 코드에 존재하는가?"를 문서↔코드 매칭으로 답한다. AST 파싱 없이 패턴 매칭으로 동작하여 빠르고 가볍다.

## 구성 ^overview

- `spec-analyzer-types`: DeclaredSymbol, DriftReport 등 핵심 타입
- `spec-analyzer-extractor`: 마크다운 계약 마커(^api-surface, ^inputs 등)에서 검증 대상 추출
- `spec-analyzer-scanner`: TypeScript 소스에서 export된 심볼 수집 (패턴 매칭)
- `spec-analyzer-drift`: 선언 vs 구현 gap 분석 → DriftReport 생성

## 분석 흐름 ^flow-steps

```
1. definition-catalog에서 svc 필드가 있는 spec 문서 수집
2. 각 문서의 계약 마커(^api-surface, ^inputs, ^outputs)에서 선언 추출
   - API 엔드포인트: GET /path, POST /path → kind: "endpoint"
   - 함수 시그니처: functionName(args): ReturnType → kind: "function"
   - 타입 이름: interface/type/class Name → kind: "type"/"class"
3. svc → packages/ 디렉토리 매핑
4. 해당 패키지의 src/**/*.ts에서 export된 심볼 수집
5. 선언 vs 구현 매칭 → DriftReport 생성
```

## 핵심 타입 ^inputs

참조: `packages/spec-analyzer/src/types.ts` — DeclaredSymbol, ImplementedSymbol, DriftReport, AnalysisSummary

3계층: 선언(DeclaredSymbol) + 구현(ImplementedSymbol) → gap 분석(DriftReport) → 전체 요약(AnalysisSummary)

## 퍼블릭 API ^api-surface

참조: `packages/spec-analyzer/src/index.ts` — 전체 export surface

- `extractDeclarations(markdown, specId)` — 마크다운 마커에서 선언 추출 (`packages/spec-analyzer/src/extractor.ts`)
- `scanImplementations(packageDir)` — TS 소스에서 export 심볼 수집 (`packages/spec-analyzer/src/scanner.ts`)
- `analyzeDrift(specId, svc, declared, implemented)` — gap 분석 (`packages/spec-analyzer/src/drift.ts`)

## CLI 인터페이스

```bash
# 전체 drift 분석
qa-sdk spec drift

# 특정 서비스만
qa-sdk spec drift --svc registry-service

# 특정 문서만
qa-sdk spec drift --spec registry-api

# JSON 출력
qa-sdk spec drift --json
```

## 매칭 규칙 ^constraint

### 엔드포인트 매칭

문서의 `GET /prefixes`, `POST /workspaces/:id` 같은 패턴을
코드의 `app.get("/prefixes"`, `router.post("/workspaces/:id"` 패턴과 매칭.

- HTTP method + path로 매칭
- path parameter (`:id`, `{id}`) 정규화
- Hono, Express, NestJS 라우터 패턴 지원

### 함수/타입 매칭

문서의 `createMotionPlayer(composition)` 같은 패턴을
코드의 `export function createMotionPlayer` 패턴과 매칭.

- `export function`, `export class`, `export interface`, `export type` 감지
- 이름 기반 exact match (시그니처 비교는 하지 않음)

### undocumented 처리

코드에 있지만 문서에 없는 심볼은 **정보용**으로만 표시.
error가 아니라 "문서화 후보" 제안.

## 제약 조건

- AST 파싱 없음 — regex 패턴 매칭만 사용 (빠르고 의존성 없음)
- 시그니처 일치 검증 안 함 — 이름 존재 여부만 확인 (정밀도보다 속도)
- svc 필드 없는 문서는 분석 대상에서 제외
- packages/ 디렉토리 구조에 의존 (모노레포 기준)
