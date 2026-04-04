---
def:
  id: test-name-tokens
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [cross-scope]
  links:
    - target: pipe-static-lineage
      type: depends_on
    - target: doc-type-convention
      type: implements
---

# Test Name Tokens — 구조화된 테스트 이름 생성 체계

## 목적 ^purpose

테스트 describe/it 이름을 구조화된 메타데이터에서 파생한다.
토큰은 spec 문서의 `^defines`에서 추출하여 SSOT 기반으로 이름을 생성.
test.md 시나리오 ID와 자동 매칭 가능한 파싱 가능 형식.

## ^defines

### testName — 단일 테스트 이름 생성

```ts
// 참조: core/pipe/test-name.ts
function testName(input: TestNameInput): TestNameResult
```

입력:

| 필드 | 출처 | 역할 |
|------|------|------|
| `module` | spec id에서 파생 (`deriveTestTokens`) | describe 앞부분 |
| `fn` | spec `^defines` 테이블 | describe 뒷부분 |
| `facet` | 데이터 흐름 패싯 | 그룹핑 태그 |
| `category` | 고정 7종 + 확장 | it 앞부분 |
| `input` | 입력 서술 | it 중간 |
| `resolved` | 출력/해결된 것 | it 화살표 뒤 |
| `expect` | 기대 서술 | it 대시 뒤 |
| `verify` | 검증 방법 | 메타데이터 (이름에 미노출) |

출력 형식:

```
describe: "{module} > {fn} [{facet}]"
it:       "{category}: {input} → {resolved} — {expect}"
id:       "{module} > {fn}[{facet}] > {category}: {input} → {resolved}"
```

### testGroup — 배치 생성

```ts
// 참조: core/pipe/test-name.ts
function testGroup(input: TestGroupInput): TestGroupResult
```

같은 module/fn/facet에 여러 case를 한번에 생성.

### deriveTestTokens — spec에서 토큰 파생

```ts
// 참조: core/pipe/test-tokens.ts
function deriveTestTokens(specId: string, rootDir?: string): TestTokens | null
```

spec 문서의 `^defines` 섹션에서 함수 목록 추출:
- backtick 함수명 파싱 (소문자 시작, 타입/상수 제외)
- `docs/specs/` 하위 재귀 탐색 (symlink 제외, 깊이 8 제한)

### 카테고리 (7종)

| 카테고리 | 의미 |
|---------|------|
| `정상` | happy path |
| `엣지` | 경계/예외 |
| `소비` | 소비 구분 |
| `체인` | 다단계 추적 |
| `충돌` | 이름/ID 충돌 |
| `연동` | 외부 모듈 연동 |
| `직렬화` | 라운드트립/diff |

`string` 타입 허용으로 확장 가능.

### 검증 방법 (verify 값)

| verify | 의미 |
|--------|------|
| `lineage-sources` | sources[] 포함 확인 |
| `lineage-exclusion` | sources에 미포함 확인 |
| `chain-count` | chain 레코드 수 |
| `summary-outputs` | outputLineage 매칭 |
| `roundtrip` | 직렬화 왕복 |
| `diff-detect` | diff 변경 감지 |
| `binding-check` | data-object 바인딩 정합 |

## 토큰 출처 체인 ^method

```
spec 문서 (.spec.md)
  ↓ ^defines 섹션 파싱
deriveTestTokens(specId)
  ↓ { module, functions }
testName({ module, fn: functions[i], ... })
  ↓ { describe, it, id, meta }
describe(name.describe, () => { it(name.it, () => { ... }) })
```

test.md 매칭:
```
test.md S-001 → id: "pipe-static-lineage > deriveStaticLineage[기여추적] > 정상: a+b → c"
test.ts describe > it → 동일 id
```

## ^consumes

- spec 문서 `^defines` 섹션 (backtick 함수명)
- `docs/specs/` 디렉토리 구조
- `doc-type-convention.spec.md` (문서 유형 컨벤션)

## 구현 참조

- 구현: `core/pipe/test-name.ts`, `core/pipe/test-tokens.ts`
- 테스트: `core/pipe/test-name.test.ts` (5건), `core/pipe/test-tokens.test.ts` (7건)
