---
def:
  id: spec-analyzer-system
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: operation
  svc: spec-analyzer
  tags: [testing, tier-system]
  links:
    - target: spec-verification-system
      type: refines
    - target: definition-catalog-spec
      type: depends_on
    - target: spec-analyzer-types
      type: contains
    - target: spec-analyzer-extractor
      type: contains
    - target: spec-analyzer-scanner
      type: contains
    - target: spec-analyzer-drift
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

```typescript
/** 문서에서 추출한 선언 1건 */
interface DeclaredSymbol {
  name: string;                      // 함수명, 타입명, API 경로
  kind: "function" | "type" | "endpoint" | "class";
  marker: ContractMarkerKind;        // 어떤 마커에서 추출했는지
  specId: string;                    // 출처 문서 ID
  line?: number;                     // 문서 내 라인 번호
}

/** 코드에서 발견된 구현 1건 */
interface ImplementedSymbol {
  name: string;
  kind: "function" | "type" | "endpoint" | "class";
  filePath: string;                  // 소스 파일 경로
  line?: number;
  exported: boolean;                 // export 여부
}

/** spec 1건의 drift 분석 결과 */
interface DriftReport {
  specId: string;
  svc: string;
  declared: readonly DeclaredSymbol[];       // 문서에 선언됨
  implemented: readonly ImplementedSymbol[]; // 코드에 존재함
  missing: readonly DeclaredSymbol[];        // 문서 O, 코드 X
  undocumented: readonly ImplementedSymbol[];// 코드 O, 문서 X (정보용)
  coverage: number;                          // declared 중 implemented 비율 (0~1)
}

/** 전체 분석 결과 */
interface AnalysisSummary {
  reports: readonly DriftReport[];
  totalSpecs: number;
  totalDeclared: number;
  totalMissing: number;
  overallCoverage: number;
  generatedAt: string;
}
```

## 퍼블릭 API ^api-surface

```typescript
/** 마크다운에서 계약 선언 추출 */
extractDeclarations(specDir: string, filter?: { svc?: string }): DeclaredSymbol[];

/** 코드에서 export 심볼 수집 */
scanImplementations(packageDir: string): ImplementedSymbol[];

/** 선언 vs 구현 gap 분석 */
analyzeDrift(declarations: DeclaredSymbol[], implementations: ImplementedSymbol[]): DriftReport;

/** 전체 분석 (scan + extract + drift) */
analyzeAll(options: { docsDir: string; packagesDir: string; svc?: string }): AnalysisSummary;
```

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
