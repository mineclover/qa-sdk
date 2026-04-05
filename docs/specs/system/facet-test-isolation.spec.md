---
def:
  id: facet-test-isolation
  level: module
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, testing]
  links:
    - target: meta-semantic-ir
      type: depends_on
    - target: meta-semantic-prefix-annotation
      type: depends_on
---

# Facet Test Isolation — 코드 패싯 추출 + 격리 테스트 인프라

## 목적 ^purpose

서비스 코드에서 환경 의존 없는 비즈니스 로직만 추출하여 별도 패키지에서 테스트한다. 서비스 코드베이스는 가볍게 유지하면서 복잡한 테스트 인프라를 구축하고, rclone 기반 동기화로 항상 최신 데이터를 패칭한다.

## 핵심 원칙

1. **서비스에 영향 없음** — 테스트가 원본 로직에 영향을 주지 않는다
2. **export 최소화** — 서비스 코드에 테스트를 위한 export를 추가하지 않는다
3. **마커가 SSOT** — `@facet` 주석이 추출 대상을 선언, 나머지는 파생
4. **동기화로 최신 유지** — rclone으로 언제든 최신 원본 반영

## 정의 ^defines

- `@facet` 마커 규약 — 순수 로직 선언 + 선택적 export 주입
- 2-레이어 테스트 구조 — Facet(단위) + Simulation(통합)
- CLI `facet scan` 명령 — 마커 스캔 → 파일 목록/include-list 생성
- rclone 동기화 흐름 — 서버/래퍼 모드

## 소비 ^consumes

- `@prefix` 마커 (prefix-annotation) — prefix/version/dim 바인딩
- `@def.doc` 마커 (definition-catalog) — 문서 ID + 심볼 연결
- 서비스 레지스트리 (seed-config) — serviceId 단위 관리

---

## 1. 아키텍처

```
서비스 코드베이스                    테스트 코드베이스
┌─────────────────┐                ┌─────────────────────────┐
│ gate-service/    │                │ facet-tests/            │
│   src/gate.ts    │  ─@facet──→   │   synced/gate-service/  │
│   // @facet      │   CLI scan    │     gate.ts (복사본)     │
│   // @def.doc    │       │       │   tests/                │
│   // @prefix     │       ↓       │     gate.test.ts        │
│   src/server.ts  │  rclone sync  │                         │
│   (환경 의존)    │   (선택적)    │ simulation-tests/       │
│                  │               │   synced/gate-service/  │
│   전체 폴더 ─────┼─ rclone sync ─│     (구조 통째로)       │
│                  │   (전체)      │   scenarios/            │
└─────────────────┘                └─────────────────────────┘
```

## 2. 레이어

| 레이어 | 목적 | 동기화 | 대상 |
|--------|------|--------|------|
| **A. Facet** | 순수 로직 단위 테스트 | `@facet` 파일만 선택 복사 | 타입, 순수 함수, 비즈니스 규칙 |
| **B. Simulation** | 통합 시뮬레이션 | rclone 폴더 전체 클로닝 | 서비스 전체 구조 |

## 3. `@facet` 마커 규약

### 기본 선언 — "이 파일은 추출 대상"

```ts
// @facet
export function validateOrder(order: Order): ValidationResult {
  // 환경 의존 없는 순수 비즈니스 로직
}
```

`@facet` 하나로 충분. 분류/역할은 `@def.doc`(문서 scope/aspect)과 `@prefix`(좌표 바인딩)에서 파생.

### export 주입 — "이 함수를 테스트용으로 공개"

```ts
// @facet export validateOrder, calculateDiscount
function calculateDiscount(items: Item[]): number {
  // 원래 export 아님 — 복사본에서만 export 추가
}
```

동기화 시 처리:
```
원본 (서비스)                          복사본 (synced/)
─────────                             ─────────
function calculateDiscount() {         export function calculateDiscount() {
  // @facet export calculateDiscount     // @facet export calculateDiscount
```

- 원본: 변경 없음 (export 추가 안 함)
- 복사본: `@facet export` 목록의 함수에 `export` 키워드 자동 주입
- 서비스 빌드에 영향 없음

### 마커 위치 규칙

| 위치 | 의미 | 예시 |
|------|------|------|
| 파일 상단 | 파일 전체가 추출 대상 | `// @facet` (첫 줄) |
| 함수/클래스 위 | 해당 선언만 추출 대상 | 함수 직전 `// @facet` |
| `export` 키워드 | 복사본에 export 주입 | `// @facet export fn1, fn2` |

### `@facet`이 붙지 않는 것

- `process.env` 접근하는 파일 (config/env.ts)
- HTTP 서버 바인딩 (server.ts, main.ts)
- DB 드라이버 초기화 (drizzle, better-sqlite3)
- 로거 생성 (createLogger)
- 외부 서비스 호출 (fetch, gRPC)

## 4. CLI 명령

### `qa-sdk facet scan`

```bash
# 서비스의 @facet 파일 목록 출력
qa-sdk facet scan --service gate-service
#   src/gate.ts
#   src/policy-rule.ts
#   src/errors.ts

# include-list 파일 생성 (rclone용)
qa-sdk facet scan --service gate-service --output include-list.txt

# 전체 서비스 스캔
qa-sdk facet scan --all

# export 주입이 필요한 파일 목록
qa-sdk facet scan --service gate-service --exports
#   src/gate.ts: validateGate, classifyAddress
#   src/policy-rule.ts: matchRule
```

### `qa-sdk facet sync` (선택 — rclone 래퍼)

```bash
# facet 파일만 동기화
qa-sdk facet sync --service gate-service --dest ./facet-tests/synced/

# 전체 폴더 동기화 (simulation용)
qa-sdk facet sync --service gate-service --dest ./simulation-tests/synced/ --full

# dry-run
qa-sdk facet sync --service gate-service --dry-run
```

내부: rclone 서버에 연결하거나 rclone CLI 래퍼로 실행.

## 5. rclone 연동

### 동기화 모드

| 모드 | 사용 | 명령 |
|------|------|------|
| **서버 모드** | rclone serve로 상시 실행 | `rclone serve http packages/ --addr :8080` |
| **래퍼 모드** | CLI에서 직접 호출 | `rclone sync source dest --include-from list.txt` |

### include-list 형식 (facet scan 출력)

```
# gate-service @facet files
+ src/gate.ts
+ src/policy-rule.ts
+ src/errors.ts
+ src/types/**
- **
```

### 동기화 후 후처리 — export 주입

```bash
# 동기화 후 @facet export 처리
qa-sdk facet inject-exports --dir ./facet-tests/synced/gate-service/
```

이 명령이 synced/ 디렉토리의 복사본을 순회하며:
1. `@facet export fn1, fn2` 마커를 파싱
2. 해당 함수에 `export` 키워드가 없으면 추가
3. 원본은 건드리지 않음 (synced/ 디렉토리만)

## 6. 디렉토리 구조

### 같은 모노레포 내

```
packages/
  gate-service/          ← 서비스 코드 (원본)
  query-service/
  facet-tests/           ← 패싯 단위 테스트
    synced/              ← rclone 동기화 대상 (읽기 전용)
      gate-service/
        src/gate.ts
        src/policy-rule.ts
      query-service/
        src/query.ts
    tests/               ← 테스트 코드 (직접 작성)
      gate/
        gate-validate.test.ts
        gate-classify.test.ts
      query/
        query-resolve.test.ts
    package.json
  simulation-tests/      ← 통합 시뮬레이션
    synced/              ← rclone 전체 동기화 (읽기 전용)
      gate-service/      ← 폴더 구조 통째로
      query-service/
    scenarios/           ← 시뮬레이션 시나리오
      gate-query-integration.test.ts
    package.json
```

### 별도 repo (확장 시)

```
qa-sdk-test-infra/      ← 별도 repo
  facet-tests/
  simulation-tests/
  rclone.conf            ← 원본 repo 위치 설정
  sync.sh               ← 동기화 스크립트
```

## 7. 서비스 레지스트리 연결

기존 `seed-config.ts`의 serviceId 단위와 동일:

```ts
{
  serviceId: "gate-service",
  // 기존
  ownedPrefixes: [],
  consumedPrefixes: ["service"],
  // 새로 추가 (선택)
  facetScanPath: "packages/gate-service/src/",
}
```

또는 `facetScanPath`를 레지스트리에 추가하지 않고, CLI가 `packages/{serviceId}/src/`를 기본 경로로 사용.

## 8. synced/ 파일 규칙

1. **읽기 전용** — synced/ 파일을 직접 수정하지 않는다
2. **git 추적 안 함** — `.gitignore`에 `synced/` 추가
3. **export 주입만 허용** — `@facet export` 처리는 자동화 도구가 수행
4. **원본 변경 시 재동기화** — `qa-sdk facet sync` 또는 rclone 직접 실행
5. **import 경로** — 테스트에서 `../synced/gate-service/src/gate.js`로 상대 import

## 9. 제약과 한계

| 제약 | 이유 | 대응 |
|------|------|------|
| TypeScript만 | 마커 파싱 + export 주입이 TS 문법 의존 | 확장 가능하지만 현재 TS만 |
| 순환 의존 | 추출 파일이 환경 의존 파일을 import하면 깨짐 | `@facet` 붙이기 전에 import 체인 확인 |
| 타입 import | 추출 파일이 공유 타입을 import → 타입 파일도 함께 동기화 | `@facet` 파일의 import 분석 → 타입 파일 자동 포함 |
| rclone 설치 | 외부 도구 의존 | CI에서 사전 설치 또는 docker |
