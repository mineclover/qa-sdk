---
def:
  id: facet-test-isolation-rule
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [structural, testing]
  links:
    - target: facet-test-isolation
      type: refines
---

# Facet Test Isolation — 운영 규칙

## 목적 ^purpose

격리 테스트 패키지의 운영 방법, 서비스 온보딩 절차, 향후 확장 방식을 정의한다. spec이 "무엇을 만드는가"를 기술한다면, 이 문서는 "어떻게 운영하고 확장하는가"를 기술한다.

---

## 1. 테스트 패키지 체계

### 3종 패키지 역할

| 패키지 | 목적 | 동기화 | 환경 의존 처리 | 실행 빈도 |
|--------|------|--------|--------------|:---------:|
| `facet-tests` | 순수 로직 단위 테스트 | `@facet` 파일 + 의존만 | path alias → `__mocks__/` | 매 PR |
| `simulation-tests` | 서비스 간 통합 시뮬레이션 | rclone 폴더 동기화 | path alias → `__mocks__/` | 주 1회 |
| `e2e-isolated` | 종단 간 격리 테스트 | 통째 복제 + mock 덮어쓰기 | `src/` 내 block 파일 교체 | 릴리스 전 |

### 기존 테스트 패키지와의 관계

| 기존 | 역할 | 격리 테스트와의 관계 |
|------|------|-------------------|
| `demo-tests` | 라이브러리 cross-package 통합 | 유지 — 서비스가 아닌 라이브러리 대상 |
| `e2e` (기존) | Playwright 브라우저 E2E | 유지 — UI E2E는 별도 |
| 서비스 내 `*.test.ts` | 서비스 자체 단위 테스트 | **점진적 마이그레이션** — facet-tests로 이동 가능 |

서비스 내 테스트를 강제로 옮기지 않는다. `@facet` 마커가 있는 파일의 테스트만 facet-tests에서도 실행 가능하게 한다.

---

## 2. 서비스 온보딩 절차

### 새 서비스를 facet 테스트에 추가할 때

```bash
# 1. 서비스 코드에 @facet 마커 추가
# packages/{service}/src/순수로직.ts 상단에:
# // @facet

# 2. 스캔 + include-list 생성
qa-sdk facet scan --service {service} --output packages/facet-tests/include-{service}.txt --deps

# 3. rclone 동기화
rclone sync packages/{service}/ packages/facet-tests/synced/{service}/ \
  --include-from packages/facet-tests/include-{service}.txt

# 4. export 주입 (필요 시)
qa-sdk facet inject packages/facet-tests/synced/{service}/

# 5. mock stub 생성
mkdir -p packages/facet-tests/__mocks__/{service}/src/config
# → env.ts 등 block 파일의 stub 작성

# 6. vitest alias 추가
# packages/facet-tests/vitest.config.ts의 resolve.alias에 서비스별 mock 경로 추가

# 7. 테스트 작성
# packages/facet-tests/tests/{service}/*.test.ts

# 8. 실행
pnpm --filter @qa-sdk/facet-tests test
```

### vitest.config.ts alias 관리

서비스가 추가될 때마다 alias를 추가한다:

```ts
resolve: {
  alias: {
    // gate-service
    "../config/env.js": resolve(__dirname, "__mocks__/gate-service/src/config/env.ts"),
    // query-service
    "../config/env.js": resolve(__dirname, "__mocks__/query-service/src/config/env.ts"),
  },
},
```

**주의**: 같은 상대 경로가 여러 서비스에서 사용되면 충돌. 이 경우 synced/ 내부의 디렉토리 구조를 활용하여 절대 경로 alias로 전환.

---

## 3. 동기화 운영

### rclone 실행 패턴

| 시점 | 명령 | 자동화 |
|------|------|:------:|
| 개발 중 | `qa-sdk facet sync --service {svc}` | 수동 |
| PR 전 | `qa-sdk facet sync --all` | CI 스크립트 |
| CI | `rclone sync` + `facet inject` | GitHub Actions |

### 동기화 순서 (중요)

```
1. facet scan → include-list 생성
2. rclone sync → synced/ 갱신
3. facet inject → export 주입
4. vitest → 테스트 실행
```

3번(inject) 없이 2번만 하면 `@facet export` 함수에 export가 없어서 import 실패.

### 동기화 빈도 체크리스트

- [ ] 서비스 코드 변경 후 → facet sync 실행
- [ ] `@facet` 마커 추가/제거 후 → include-list 재생성
- [ ] block 파일 변경 후 → `__mocks__/` stub 갱신 필요 여부 확인
- [ ] 새 환경 의존 추가 후 → `BLOCK_PATTERNS` 업데이트 검토

---

## 4. 디렉토리 네이밍 규칙

```
packages/facet-tests/
  synced/{serviceId}/          ← 서비스 레지스트리의 serviceId와 동일
  __mocks__/{serviceId}/       ← 동일 구조
  tests/{serviceId-short}/     ← 약칭 허용 (gate, query 등)

packages/simulation-tests/
  synced/{serviceId}/
  __mocks__/{serviceId}/
  scenarios/{flow-name}.test.ts

packages/e2e-isolated/
  src/{serviceId}/
  e2e/{scenario-name}.test.ts
  __mocks__/
```

serviceId는 `seed-config.ts`의 값과 일치: `gate-service`, `query-service`, `ingest-server` 등.

---

## 5. __mocks__/ stub 작성 규칙

### stub은 원본의 export 시그니처만 유지

```ts
// 원본: packages/gate-service/src/config/env.ts
import { z } from "zod";
import { getServicePort } from "@qa-sdk/core";
const DEFAULT_PORT = getServicePort("gate-service") ?? 3400;
export const envSchema = z.object({
  PORT: z.coerce.number().int().default(DEFAULT_PORT),
  SQLITE_DRIVER: z.enum(["node", "better"]).default("node"),
  SQLITE_PATH: z.string().default("data/gate-service.sqlite"),
});
export const env = envSchema.parse(process.env);

// stub: packages/facet-tests/__mocks__/gate-service/src/config/env.ts
export const env = {
  PORT: 3400,
  SQLITE_DRIVER: "node" as const,
  SQLITE_PATH: ":memory:",
};
```

### stub 작성 체크리스트

- export 이름과 타입이 원본과 일치하는가
- 환경 접근(`process.env`, `fetch`, DB 연결)이 제거되었는가
- 테스트에 필요한 기본값이 합리적인가 (`:memory:`, localhost 등)
- zod 스키마 등 런타임 검증을 제거했는가 (stub은 정적 값)

---

## 6. 향후 확장

### Phase 1 (현재) — Facet 단위 테스트

```
facet-tests/
  synced/gate-service/
  tests/gate/
```

### Phase 2 — Simulation 추가

```
simulation-tests/        ← 새 패키지
  synced/gate-service/   ← 전체 폴더
  synced/query-service/
  __mocks__/
  scenarios/
    gate-query-flow.test.ts
  .gitignore             ← synced/ 제외
  vitest.config.ts
  package.json
```

facet-tests와 동일한 패턴. 차이: `@facet` 필터 없이 전체 동기화.

### Phase 3 — E2E 격리 추가

```
e2e-isolated/            ← 새 패키지
  src/gate-service/      ← 통째 복제
  e2e/
    gate-e2e.test.ts
  __mocks__/
  setup.ts               ← mock 덮어쓰기 자동화
  .gitignore             ← src/ 제외
```

차이: path alias가 아닌 파일 교체 방식.

### Phase 4 — 별도 Repo

모노레포에서 분리 시:
```
qa-sdk-test-infra/       ← 독립 repo
  rclone.conf            ← 원본 repo 위치
  facet-tests/
  simulation-tests/
  e2e-isolated/
  scripts/
    sync-all.sh
```

`rclone.conf`에 원본 위치를 설정하고, `sync-all.sh`로 일괄 동기화.

---

## 7. 루트 .gitignore 권장

현재는 `facet-tests/.gitignore`로 충분하지만, 향후 simulation/e2e 추가 시 루트에도 범용 규칙 추가 권장:

```gitignore
# 격리 테스트 — rclone 복제본
**/synced/
**/include-list*.txt
```

---

## 8. CI 통합 (향후)

```yaml
# .github/workflows/facet-tests.yml
name: Facet Tests
on:
  push:
    paths:
      - 'packages/gate-service/src/**'
      - 'packages/query-service/src/**'
      - 'packages/facet-tests/tests/**'

jobs:
  test:
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      # scan + sync (rclone 없이 cp로 대체 가능)
      - run: |
          qa-sdk facet scan --service gate-service --output /tmp/gate.txt --deps
          rsync -a --files-from=/tmp/gate.txt packages/gate-service/ packages/facet-tests/synced/gate-service/
          qa-sdk facet inject packages/facet-tests/synced/gate-service/
      - run: pnpm --filter @qa-sdk/facet-tests test
```

CI에서는 rclone 대신 `rsync --files-from`으로도 충분.
