---
name: test-split
description: "테스트 파일의 패싯 분리와 시나리오 구조 표준화. 혼합된 관심사를 가진 테스트 파일을 분석하고, 소스 모듈별로 분리하고, 내부 구조를 표준화한다. 트리거: /test-split, '테스트 분할', '테스트 분리', 'test facet split'."
triggers:
  - /test-split
  - 테스트 분할
  - 테스트 분리
  - test facet split
argument-hint: "<test-file-path> [--analyze | --run | --structure]"
---

# Test Split — 패싯 기반 테스트 분리

혼합된 관심사를 가진 테스트 파일을 소스 모듈(패싯)별로 분리하고, 내부 구조를 표준화한다.

## 사용 시점

- 한 테스트 파일이 **2개 이상 소스 모듈**을 import하여 테스트할 때
- describe 블록이 **서로 다른 패싯**(직렬화/저장/검증/분석 등)을 혼합할 때
- 테스트 파일이 **50건 이상**으로 비대해졌을 때
- 새 모듈 추가 후 기존 파일에 테스트를 끼워 넣으려 할 때 (→ 별도 파일 생성)

## 모드

### 1. 분석 모드 (`--analyze`)

분리 필요 여부를 판단하고 제안한다. 파일을 변경하지 않는다.

```bash
/test-split src/pipe-infra.test.ts --analyze
```

분석 항목:
1. **import 소스 모듈 수**: 2개 이상이면 분리 신호
2. **describe 블록 목록**: 각 블록이 어떤 소스 함수를 테스트하는지 매핑
3. **테스트 수**: 현재 총 it() 수
4. **제안**: 어떤 describe를 어떤 파일로 분리할지

### 2. 실행 모드 (`--run`)

실제 분리를 수행하고 검증한다.

```bash
/test-split src/pipe-infra.test.ts --run
```

절차:
1. 분석 모드 실행 (분리 계획 수립)
2. 분리 전 테스트 수 기록
3. 패싯별 새 파일 생성
4. 원본 파일 삭제
5. 분리 후 테스트 실행 → 수 비교 → 불일치 시 중단
6. 결과 보고

### 3. 구조 검토 모드 (`--structure`)

기존 파일의 내부 구조가 표준을 따르는지 검토한다.

```bash
/test-split src/pipe-analyze.test.ts --structure
```

## 분리 판단 기준

### 분리 신호 (하나라도 해당하면 검토)

| 신호 | 설명 |
|------|------|
| import 2+ 소스 | `import { A } from "./x.js"; import { B } from "./y.js"` — 서로 다른 모듈 |
| describe 패싯 혼합 | "직렬화" + "저장" + "분석"이 한 파일에 |
| 50+ tests | 파일이 비대함 |
| fixture 충돌 | 같은 이름의 fixture가 다른 의미로 사용됨 |

### 분리하지 않는 경우

| 조건 | 이유 |
|------|------|
| describe 1~2개, 같은 소스 모듈 | 단일 패싯 |
| 통합 테스트 (여러 모듈 조합이 본질) | 분리하면 의미 상실 |
| 10건 이하 | 분리 비용 > 이익 |

## 파일명 규칙

```
{source-module}.test.ts  ↔  {source-module}.ts

예:
  pipe-serialize.ts  →  pipe-serialize.test.ts
  pipe-store.ts      →  pipe-store.test.ts
  pipe-validate.ts   →  pipe-validate.test.ts
  pipe-analyze.ts    →  pipe-analyze.test.ts
```

이미 같은 이름의 테스트 파일이 있으면 **병합**하거나 접미사로 구분:
- `pipe-simulate.test.ts` (시뮬 본체)
- `pipe-happy-path.test.ts` (matchHappyPath — 독립 관심사)

## 파일 내부 구조 표준

```typescript
// ── imports (소스 모듈 1개만) ─────────────────────
import { describe, it, expect } from "vitest";
import { functionA, functionB } from "./{source-module}.js";
import type { TypeA, TypeB } from "./types/{type-module}.js";

// ── fixture 헬퍼 ─────────────────────────────────
const step = (facet = "소비"): PipeFlow => ({ kind: "step", facet });

// ── 공유 fixture ─────────────────────────────────
const simplePipe: PipeSpec = { ... };
const simpleGraph: PipeGraph = { ... };

// ── 기능 A ───────────────────────────────────────

describe("functionA", () => {
  it("정상 — 기본 입력", () => { ... });
  it("정상 — 변형 입력", () => { ... });
});

describe("functionA — 엣지 케이스", () => {
  it("빈 입력", () => { ... });
  it("경계값", () => { ... });
  it("에러 경로", () => { ... });
});

// ── 기능 B ───────────────────────────────────────

describe("functionB", () => {
  it("정상 케이스", () => { ... });
});
```

### 구조 규칙

| 규칙 | 설명 |
|------|------|
| **import 소스 1개** | 한 테스트 파일은 한 소스 모듈만 테스트. 타입 import는 예외 |
| **describe = 기능 단위** | 함수/클래스 하나당 describe 1개 |
| **엣지 케이스 분리** | `describe("X — 엣지 케이스")`로 정상 경로와 분리 |
| **fixture 상단 배치** | 공유 fixture는 파일 상단, describe 안에서만 쓰이면 describe 안에 |
| **한국어 테스트명** | `it("정상 — 기본 입력")`, `it("빈 배열 → 에러")` |
| **status 주석** | 섹션 구분에 `// ── 섹션명 ───` 주석 |

## Fixture 전략

| 상황 | 전략 |
|------|------|
| 1~2개 파일에서 사용 | 각 파일에 복사 |
| 3개 이상 파일에서 사용 | `__fixtures__/{domain}-fixtures.ts`로 추출 |
| describe 1개에서만 사용 | describe 내부에 선언 |

fixture 추출 시:
```
src/
  __fixtures__/
    pipe-fixtures.ts    ← step(), simplePipe, simpleGraph 등
  pipe-serialize.test.ts
  pipe-store.test.ts
```

## 검증

분리 후 반드시 확인:

```bash
# 1. 분리 전후 테스트 수 일치
pnpm --filter <pkg> exec vitest run  # 전체 수 비교

# 2. 원본 파일이 남아있지 않은지
ls src/<원본>.test.ts  # 없어야 함

# 3. 새 파일들이 각각 통과
pnpm --filter <pkg> exec vitest run src/<new-file>.test.ts
```

## 판단 원칙 (meta-semantic 기반)

def-split이 문서의 **패싯 경계**(생산·소비·정의·관리·저장)로 분할하듯,
test-split은 테스트의 **소스 모듈 경계**로 분할한다.

| def-split 개념 | test-split 대응 |
|----------------|----------------|
| 문서 1개 = 개념 1개 | 테스트 파일 1개 = 소스 모듈 1개 |
| 150줄+ leaf → 분할 | 50+ tests → 분할 검토 |
| module + leaf 구조 | describe(기능) + it(시나리오) 구조 |
| ^purpose 필수 | describe명에 목적 명시 |
| contains 링크 | import 관계 |
| qa-sdk def sync 검증 | vitest run 테스트 수 검증 |

## 예시: pipe-infra.test.ts 분리

```
Before:
  pipe-infra.test.ts (47 tests, 10 describes)
    imports: pipe-serialize, pipe-store, pipe-analyze, pipe-validate

After:
  pipe-serialize.test.ts  (4 tests)  ← 직렬화 라운드트립
  pipe-store.test.ts      (9 tests)  ← 인메모리 스토어 CRUD
  pipe-validate.test.ts   (20 tests) ← 숫자 범위 + 시맨틱 + 그래프 검증
  pipe-analyze.test.ts    (14 tests) ← 복잡도, 병목, 커버리지, 이벤트 수집

검증: 4 + 9 + 20 + 14 = 47 ✓
```

## 주의

- 통합 테스트(`meta-semantic-integration.test.ts`)는 분리 대상이 아니다
- 벤치마크(`pipe-benchmark.test.ts`)는 성능 관심사이므로 분리하지 않는다
- 시나리오 테스트(`pipe-simulate-scenarios.test.ts`)는 의도적 혼합이므로 유지한다
- 분리 시 기존 파일의 git history가 끊어진다 — 커밋 메시지에 원본 명시
