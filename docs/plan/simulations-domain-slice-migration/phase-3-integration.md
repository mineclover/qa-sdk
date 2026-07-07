# Phase 3 — Integration

직렬, 단일 에이전트. 병렬 작업이 만들어 놓은 결과물을 manifest, contracts, CI 에 합산한다.

## 1. architecture-manifest.ts 갱신

`simulations/enterprise-pm/scenarios/src/architecture/architecture-manifest.ts:64` 의 target path 가 현재 `services/pm-api/src/pm/assignment` 로 선언돼 있고 Phase 1 종료 시점부터 실재한다. 추가 작업:

- 슬라이스 인벤토리 22개에 대한 simulation slice 정의 추가
- target.kind 분류 (`service` / `metadata` / `contract` / `scenario`)
- responsibility 텍스트 작성 (각 슬라이스가 어느 source concept 에 매핑되는지)

`architecture-manifest.test.ts` 강화:

```ts
import { stat } from "node:fs/promises";

it("every simulation target path exists", async () => {
  const repoRoot = join(__dirname, "..", "..", "..", "..", "..");
  for (const slice of ARCHITECTURE_SIMULATION_SLICES) {
    for (const target of slice.targets) {
      const fullPath = join(repoRoot, target.path);
      const exists = await stat(fullPath).then(() => true, () => false);
      expect(exists, `${slice.id}: ${target.path}`).toBe(true);
    }
  }
});
```

## 2. OpenAPI merge

22 + 1 = 23 fragment 가 `contracts/openapi/src/domains/<slice>/spec.yaml` 에 분산. simulations 의 자체 merge 스크립트 (`contracts/openapi/scripts/check-merge.mjs`) 가 공통 path/component 충돌 없이 통합되는지 검증.

추가 작업:
- merge 결과를 `contracts/openapi/.merged.openapi.yaml` 에 출력
- `scripts/check-merge.mjs` 의 결과가 0 이 아니면 어떤 fragment 가 충돌을 일으켰는지 보고

merge 결과는 `gateway` service 가 라우팅 검증 시 참조 가능하도록 export.

## 3. Logger / Error 페이로드 일관성 점검

Phase 2 에서 각 에이전트가 sim-domain-slice-kit 의 LoggerPort, DomainExceptionFilter 를 정확히 사용했는지 확인하는 통합 테스트.

위치: `simulations/enterprise-pm/scenarios/src/scenarios/cross-slice-conventions.test.ts`

- 모든 슬라이스 컨트롤러가 `DomainExceptionFilter` 를 등록하고 있는가
- 모든 슬라이스 logger 가 표준 필드 (traceId, domain, useCase, outcome) 를 emit 하는가 (감지: vitest spy)
- 도메인 예외 throw → controller 응답이 `{ code, message, traceId, details }` shape 인가

## 4. CI gate

`.github/workflows/` 에 simulation 전용 gate 추가 또는 기존 def-gate 확장.

옵션 A — 기존 `def-gate.yml` 의 path filter 확장:
```yaml
paths:
  - 'simulations/enterprise-pm/services/**'
  - 'simulations/enterprise-pm/contracts/openapi/**'
  - 'simulations/enterprise-pm/packages/sim-domain-slice-kit/**'
```

옵션 B — 신규 `simulation-domain-slice-gate.yml`:
```yaml
on:
  pull_request:
    paths:
      - 'simulations/enterprise-pm/**'
jobs:
  validate:
    steps:
      - run: pnpm install
      - run: pnpm --filter sim-domain-slice-kit build
      # qa-scaffold 는 dist/cli.js 를 bin 으로 가리키므로 빌드 선행 필수
      - run: pnpm --filter @qa-sdk/scaffold build
      - run: pnpm exec qa-scaffold validate simulations/enterprise-pm/services
      - run: node simulations/enterprise-pm/contracts/openapi/scripts/check-merge.mjs
      - run: pnpm --filter @qa-sdk/sim-scenarios test architecture-manifest
      - run: pnpm --filter @qa-sdk/sim-scenarios test cross-slice-conventions
```

추천: B (격리). simulations 전용 gate 를 두면 def-gate 가 비대해지지 않는다.

## 5. current/ 문서 갱신

`architecture-samples/.../current/` 가 인용하는 reference 경로는 architecture-samples 자체. 그러나 simulations 에도 동등한 reference 가 생겼으므로, 두 reference 가 모두 유효함을 명시.

추가 작업:
- `current/README.md` 의 "Document Map" 아래에 "Live simulation" 섹션 추가:
  ```md
  ## Live Simulation

  The convention is exercised end-to-end in `simulations/enterprise-pm/`. See
  `services/pm-api/src/pm/assignment/` for the gold standard slice and
  `docs/plan/simulations-domain-slice-migration/` for the migration plan.
  ```
- 각 `current/0X-*.md` 의 "Reference implementation" 블록은 architecture-samples 경로를 유지 (변경 없음)

## 6. 기존 tests 폴더 정리

`simulations/enterprise-pm` 루트의 `tests/` 가 architecture-samples 의 테스트 형태였으나 simulations 에서는 슬라이스 내부 콜로케이션이 SSOT 가 된다. 루트 tests 는:
- 슬라이스 내부로 이전된 케이스는 삭제
- cross-slice 시나리오 (`billing-cross-domain-precondition.test.ts` 같은 것) 는 `scenarios/src/scenarios/` 로 이전

(참고: 위 tests/ 폴더는 architecture-samples 에 존재. simulations 에 존재하지 않으면 본 항목은 skip.)

## 7. dkg-audit 후행 점검

마이그레이션 결과로 새로 생긴 `<slice>.module.ts`, `LoggerPort` 호출, `OutboxPort` 적재가 DKG event taxonomy 와 충돌하지 않는지 점검.

```bash
pnpm gate:event-taxonomy
qa-sdk dkg audit-events --since 1h
```

drift 가 발견되면 prefix/event 명세 갱신 또는 LoggerPort 의 표준 필드 보완.

## 검증

```bash
# 1. 모든 슬라이스 fragment merge
node simulations/enterprise-pm/contracts/openapi/scripts/check-merge.mjs

# 2. manifest fileExists 검증
pnpm --filter @qa-sdk/sim-scenarios test architecture-manifest

# 3. cross-slice 컨벤션 검증
pnpm --filter @qa-sdk/sim-scenarios test cross-slice-conventions

# 4. 시뮬레이션 전체 빌드/테스트
pnpm --filter './simulations/enterprise-pm/**' build
pnpm --filter './simulations/enterprise-pm/**' test

# 5. CI gate workflow lint (act 또는 GitHub UI)
```

모두 통과 시 마이그레이션 종료.

## 종료 조건

- architecture-manifest.test 가 fileExists 검증 포함 통과
- OpenAPI merge gate 통과 (path/component 충돌 0)
- cross-slice-conventions test 통과
- 전용 CI gate 가 main branch 에 등록되고 첫 PR 에서 통과
- `current/README.md` 가 simulation reference 를 인용
- `docs/plan/simulations-domain-slice-migration/` 의 모든 phase 가 ✅ 표기되거나 README 의 phase 표가 종료 상태로 갱신됨
