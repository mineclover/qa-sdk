# FB-2026-07-27-02 — spec-management platform의 qa-sdk 분리

| 항목 | 값 |
|---|---|
| 상태 | `in-progress` |
| 우선순위 | P0 — parser/evidence 추출 완료, control-plane 전환 보류 |
| 등록일 | 2026-07-27 |
| 출처 | taxonomy 관리·문서 파싱/추적·코드 분석 보완 방향 검토 |
| 대상 | definition-control-plane과 taxonomy tooling의 범용 platform 경계 |

## 피드백

taxonomy 관리, 문서 파싱·추적, source-map, 코드 분석, evidence 검증은 qa-sdk의 특정
업무 도메인보다 넓은 재사용 가능성을 가진다. qa-sdk 내부 기능으로 계속 확장하면 QA 좌표계,
registry, ingest runtime과 범용 spec-management concerns가 한 변경 경로에 묶인다.

따라서 이 기능군은 독립 **spec-management platform**으로 분리하고, qa-sdk는 그 platform의
consumer 및 QA-specific adapter로 전환한다.

초기 제품 쐐기와 첫 구현 범위는 **문서 파싱 기반 플랫폼**이다. taxonomy 관리, source-map,
코드 분석, evidence 검증은 파서가 생산한 중립 Document IR을 소비하는 확장으로 둔다.

## 초기 제품 쐐기 — 문서 파싱 플랫폼

첫 release는 특정 문서 체계를 판단하거나 고치지 않는다. 여러 repository의 문서를 안정적으로
읽어 아래 공통 IR로 반환하는 데 집중한다.

```text
Markdown / YAML / repository files
        │
        ▼
Parser adapters ──► Document IR ──► Snapshot + diagnostics
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
      taxonomy plugin  code analyzer  verification profiles
```

최소 Document IR은 다음 사실만 가진다.

- 문서 identity, 경로, title, body/section, raw frontmatter
- typed metadata와 parse diagnostics
- 문서 간 link, source reference, 위치(span)
- snapshot revision, parser version, source root

이 단계의 비범위:

- qa-sdk의 `def`, E/C/I/S, tier, address, prefix/axis vocabulary를 core schema에 강제
- closure severity와 lifecycle policy를 parser 자체에 포함
- DB·HTTP service를 파서보다 먼저 확정

따라서 taxonomy는 Document IR의 metadata/relationship을 해석하는 plugin이고, 코드 분석은
source reference와 code annotation을 추가 evidence로 결합하는 plugin이다. 어느 쪽도 Markdown
parser의 기본 출력 의미를 바꾸지 않는다.

## Plugin과 lint 실행 모델

정보 수집은 parsing pipeline 안에서 자동 실행하되, parser core가 특정 taxonomy를 아는 방식으로
구현하지 않는다. plugin은 선언된 입력을 읽고 immutable fact 또는 diagnostic을 추가한다.

```text
source files
  → core parser                  # Document IR + parse diagnostic
  → collector/enricher plugins   # taxonomy fact, source-map fact, code fact
  → linter plugins               # policy violation, coverage, conflict diagnostic
  → sealed Evidence Snapshot     # producer/version/source span이 남은 결과
```

| plugin 종류 | 입력 | 출력 | 수정 권한 |
|---|---|---|---|
| parser adapter | 파일/문자열 | Document IR, parse diagnostic | 없음 |
| collector/enricher | Document IR, 허용된 repository root | typed fact와 provenance | 없음 |
| taxonomy projector | Document IR + taxonomy schema | taxon assignment, relation candidate | 없음 |
| linter | sealed snapshot + rule config | severity 있는 diagnostic | 없음 |
| writer/fixer (별도 opt-in) | snapshot + 명시적 적용 요청 | patch plan 또는 patch | 명시적 apply 때만 |

모든 plugin output에는 `pluginId`, `pluginVersion`, `snapshotId`, `sourceSpan`을 남긴다. 이로써
어떤 taxonomy 정보·경고가 어느 plugin의 어느 규칙에서 나왔는지 추적할 수 있다.

### 최소 plugin contract

```ts
interface SpecPlatformPlugin {
  manifest: {
    id: string;
    version: string;
    phase: 'collect' | 'lint';
    requires?: string[];
    provides?: string[];
  };
  collect?(input: DocumentSnapshot, context: PluginContext): readonly EvidenceFact[];
  lint?(input: EvidenceSnapshot, context: PluginContext): readonly Diagnostic[];
}
```

plugin은 기본적으로 network와 write 권한이 없고, manifest의 dependency graph 순서로 결정론적으로
실행한다. lint는 수집된 fact를 읽을 뿐 parser output이나 다른 plugin의 fact를 덮어쓰지 않는다.
충돌은 platform이 producer provenance와 함께 diagnostic으로 낸다.

### qa-sdk taxonomy plugin

qa-sdk adapter가 제공할 첫 plugin은 QA taxonomy schema를 읽어 다음을 projection한다.

- frontmatter와 section marker에서 candidate taxonomy value 추출
- `links`, `sources`, `@def.boundary`에서 relation/ownership candidate 수집
- E/C/I/S + L/P, tier, scope/aspect/depth, lifecycle 규칙 lint
- QA coordinate/address와 DKG 연결은 optional QA extension으로만 추가

이 plugin의 결과는 core metadata를 자동 덮어쓰지 않는다. canonical frontmatter와 충돌하면
`taxonomy-conflict` diagnostic과 source span을 남기고, writer/fixer가 명시적으로 적용할 후보만 만든다.

## 현재 근거

- `definition-catalog`은 qa-sdk 내부 9개 소비자를 가진 foundation 패키지다.
- `doc-envelope`는 CLI, deterministic-label-registry, ontology-pack-validate,
  ralph-tui-integration이 함께 소비하는 이미 범용적인 document model이다.
- definition-control-plane surface에는 `definition-catalog`, definition-service/client,
  definition-data-source, doc-envelope, ontology-pack-validate, docs-explorer,
  deterministic-label-registry, ralph-tui-integration이 함께 묶여 있다.
- definition-service는 `@qa-sdk/core`, `@qa-sdk/logger`, `work-domain`에 의존하므로
  그대로 외부로 옮기면 qa-sdk runtime을 역으로 끌고 간다.

근거:

- [`definition-control-plane surface`](../../scripts/package-surfaces.mjs)
- [`definition-catalog package`](../../packages/definition-catalog/package.json)
- [`definition-service package`](../../packages/definition-service/package.json)
- [`doc-envelope package`](../../packages/doc-envelope/package.json)
- [`definition-data-source package`](../../packages/definition-data-source/package.json)

## 목표 경계

### 독립 platform이 소유

- 문서 파서와 중립 Document IR schema
- Markdown/JSON/코드 주석 adapter와 Evidence Snapshot 수집
- graph/ownership/coverage/closure 검증 규칙
- snapshot 저장소, query API, generic CLI 또는 SDK
- test/build 결과를 evidence로 수집하는 확장 포트

### qa-sdk가 계속 소유

- QA 좌표 vocabulary, `weighted-index` 기반 address와 prefix/axis 정책
- DKG, registry, ingest, deployment, decision-flow와의 product-specific bridge
- qa-sdk repository layout(`docs/`, `packages/`)과 서비스 registry를 platform에 주입하는 adapter
- 기존 `qa-sdk def ...` 명령의 호환 surface와 qa-sdk 관측 이벤트

### 분리하지 않는 원칙

- 범용 platform이 qa-sdk의 `@qa-sdk/core`, logger, work-domain, registry-service를 직접 import하지 않는다.
- qa-sdk가 platform core의 storage schema나 parser 내부를 직접 수정하지 않는다.
- `@def.boundary`의 owner 의미와 qa-sdk coordinate 의미를 같은 relation으로 합치지 않는다.

## 권장 package 구성

```text
spec-management-platform/
  packages/
    document-model/        # doc-envelope 역할
    document-parser/       # parser adapters → Document IR, diagnostics, spans
    evidence-model/        # EvidenceSnapshot, typed relation, verification result
    document-catalog/      # graph와 taxonomy-neutral validation
    evidence-store/        # SQLite/Postgres adapter, revision/freshness
    verification-engine/   # structural / ownership / closure / execution profiles
    platform-client/       # HTTP/local query port
    platform-cli/          # generic operator surface

qa-sdk/
  packages/
    qa-spec-platform-adapter/  # QA layout, coordinate, DKG/registry bridge
    definition-compat/         # qa-sdk def command compatibility during migration
```

`weighted-index`에 직접 의존하는 현재 `definition-catalog`은 그대로 외부로 옮기지 않는다.
문서 graph와 Evidence Snapshot의 범용 core를 먼저 분리하고, coordinate/addressing은 qa-sdk
extension 또는 optional plugin으로 남긴다.

## 전환 순서

| 단계 | 작업 | qa-sdk에 남는 것 | 종료 기준 |
|---|---|---|---|
| P0 | 현재 parser 입력·출력·diagnostic과 public type·CLI·SQLite·HTTP 계약 inventory를 fixture로 고정 | 모든 기존 surface | 이동 전후 파싱 결과를 비교할 fixture 확보 |
| P1 | `document-model`, `document-parser`, plugin manifest/runtime을 qa-sdk 의존성 없이 추출 | compatibility adapter | qa-sdk 밖에서 Markdown fixture를 Document IR로 수집하고 read-only plugin 실행 가능 |
| P2 | parser/graph/ownership verifier와 typed lint profile을 platform core로 이동 | QA coordinate/taxonomy plugin | generic repository layout을 config로 주입하고 plugin provenance를 조회 가능 |
| P3 | store/service/client를 port 기반으로 분리 | qa registry/ingest adapter | platform service가 qa runtime 없이 기동 |
| P4 | qa-sdk CLI를 platform client로 전환 | `qa-sdk def` compatibility alias | qa-sdk가 parser/store 내부를 직접 import하지 않음 |

## 진행 기록

- 2026-07-27: `/Users/junwoobang/workflow/spec-management-platform` workspace를 새로 만들었다.
- P0 완료: 현재 `definition-control-plane`의 dependency/consumer inventory와 독립 경계를 고정했다.
  `definition-catalog`은 `weighted-index`를 직접 사용하고 내부 소비자 9개를 가지므로 wholesale move 대상이
  아니다. `definition-service`의 qa runtime 의존성도 외부 platform으로 옮기지 않는다.
- P1 완료: `document-model`, `document-parser`, `plugin-runtime`, `repository-collector`를 qa-sdk runtime
  의존성 없이 구현했다. parser는 legacy `key: -` frontmatter를 손실 없이 빈 배열로 정규화하고 provenance가
  있는 Document Snapshot을 만든다.
- P2 완료: `code-analysis-plugin`, `verification-engine`, `platform-cli`와 `qa-sdk-taxonomy-plugin`을
  구현했다. `@def.boundary`와 `@def.doc`는 명시적 code reference로만 수집하며, 생성 JSON 본문의 문자열은
  주석으로 오인하지 않는다. 중립 verifier는 duplicate ID, unresolved link/boundary, competing boundary를
  판정한다.
- QA consumer profile 완료: `@spec-platform/qa-sdk-adapter`가 QA의 `docs/`, `packages/` 기본 경로와
  taxonomy plugin을 조합한다. 이 adapter는 qa-sdk runtime package를 import하지 않는다.
- P3 완료: `evidence-store`는 immutable Evidence Snapshot 저장 port와 portable file adapter를 제공하고,
  `platform-client`는 저장 구현과 무관한 document/diagnostic query port를 제공한다. QA adapter도 이 port로
  verified snapshot을 저장·조회한다. SQLite/HTTP server 선택은 이 interface를 구현하는 후속 adapter의 문제로
  분리했다.
- P4 1차 완료: `qa-spec-platform verify`를 QA profile의 공식 executable로 추가했고,
  `qa-sdk def platform-verify`는 parser/store를 import하지 않고 이 executable만 호출한다. local development는
  `--platform-bin=<qa-spec-platform.js>`로, 배포 뒤에는 published executable로 실행한다.
- P4 2차 완료: `qa-spec-platform scan-audit`와 `code-link-gaps`를 같은 Evidence Snapshot 기반
  query로 추가했다. `QA_SPEC_PLATFORM_BIN` 또는 `--platform-bin`을 지정한 legacy 명령이 이 query를
  호출하며, 실제 qa-sdk에서 기존 code-link 수치(`1,869 / 1,781 / 88 / 95.3%`)를 재현했다.
- P4 3차 완료: `@spec-platform/qa-sdk-adapter`에 public executable/package contract를 명시하고,
  full specification journey에서 built `qa-spec-platform` 실행·`pnpm pack` archive·workspace dependency
  치환·test/source 제외를 검증한다. release publication 자체는 실행하지 않는다.
- P4 4차 완료: 11개 transitive platform package tarball을 clean npm consumer에 설치해 `.bin/qa-spec-platform`
  실행을 검증했다. 이 과정에서 npm bin symlink 때문에 main-module 판정이 실패하던 실제 결함을
  adapter와 generic CLI의 realpath 비교로 수정했다.
- P4 5차 완료: clean consumer에 함께 설치되는 공개 platform dependency 전체에 `dist-only`,
  `publishConfig.access=public`, Node `>=22`, test artifact 제외 contract를 통일하고 archive 검증을
  full journey에 고정했다.
- P4 6차 완료: `qa-sdk def scan-audit`와 `code-link-gaps`에 `--platform=auto` 호환 모드를 추가했다.
  PATH에 설치된 `qa-spec-platform`이 있을 때만 external query를 선택하고, 없으면 legacy collector로
  폴백한다. 명시적 `--platform=true`, `--platform-bin`, `QA_SPEC_PLATFORM_BIN`은 기존처럼 실행 실패를
  숨기지 않는다. 이로써 registry publication 전에도 설치 여부에 따른 route selection을 검증할 수 있다.
- P4 7차 release readiness audit: platform build/typecheck와 full specification journey(`5 pass, 2 skip`)를
  재실행했다. 11개 `@spec-platform/*` 이름은 npm registry에서 모두 `404 Not Found`였고,
  `npm whoami --registry=https://registry.npmjs.org`는 `401 Unauthorized`였다. 따라서 archive/clean
  consumer 검증은 완료됐지만 실제 registry publication과 registry consumer 검증은 아직 완료되지 않았다.
  이번 단계에서는 publish를 실행하지 않았다. publish 후에는 `SPEC_PLATFORM_REGISTRY_SMOKE=1`
  live consumer gate가 registry 설치와 `qa-spec-platform verify`를 자동 검증하도록 추가했다.
- P4 8차 release runner: adapter dependency closure 11개를 dependency-first로 정렬하고,
  `pnpm pack` 후 `npm publish <tarball>`을 수행하는 guarded `corepack pnpm release:packages`를 추가했다.
  기본 실행은 publish dry-run이며, 실제 publish는 `--publish`와
  `SPEC_PLATFORM_PUBLISH_CONFIRM=1`을 모두 요구한다. 11개 archive dry-run 경로를 고정했다.
- P4 9차 운영 전환 준비: `qa-sdk def scan-audit`와 `code-link-gaps`가
  `QA_SPEC_PLATFORM_MODE=auto` 환경 변수로도 설치된 `qa-spec-platform`을 자동 선택하도록 확장했다.
  CLI의 `--platform=<값>`이 환경 변수보다 우선하고 `--platform=false`로 명시적 비활성화가 가능하다.
  adapter가 설치되지 않은 현재 환경에서는 legacy collector로 폴백하며, registry publication과 기본 경로
  전환은 여전히 보류한다. 빌드된 adapter executable을 임시 PATH shim으로 연결한 runtime smoke에서
  환경 모드는 external 결과(`snapshotId` 포함)를 반환했고, `--platform=false`는 legacy 결과로 복귀했다.
- P4 10차 release preflight 경고 정리: `corepack pnpm release:packages`가 pnpm 전용 환경 설정을
  npm 자식 프로세스에 전달해 발생시키던 `Unknown env config` 경고를 차단했다. `test:release` sanitizer
  단위 테스트와 11개 archive dry-run을 다시 실행해 warning-free 결과를 확인했고, full specification
  journey는 `5 pass, 2 skip`으로 유지됐다.
- P4 11차 publish 보호 강화: 명시적 `--publish` 경로가 `npm whoami` 인증 preflight를 먼저 수행하도록
  추가했다. 인증 실패는 archive 생성·publish 전에 중단되며, `SPEC_PLATFORM_REGISTRY`로 대상 registry를
  명시할 수 있다. 잘못된 local registry로 preflight fail-fast를 확인했고 실제 registry publish는 실행하지 않았다.
- P4 12차 registry 대상 정합성: full specification journey의 live registry consumer smoke도
  `SPEC_PLATFORM_REGISTRY`를 사용하도록 맞춰 publish runner와 동일한 staging/private registry를 검증할 수 있게 했다.
- P4 13차 private registry smoke 보완: `SPEC_PLATFORM_REGISTRY_TOKEN`을 선택적으로 받아 임시 mode-0600
  npm user config에 registry-scoped auth를 주입하고 cleanup하도록 했다. 토큰은 출력하지 않으며 public npm
  smoke의 익명 동작은 그대로 유지한다.
- P4 14차 local workspace 소비 경로: sibling `spec-management-platform`의
  `@spec-platform/qa-sdk-adapter` workspace package를 build된 executable로 연결하는
  `platform:workspace` runner를 QA-SDK에 추가했다. npm publish 없이도 동일한 `qa-sdk def` bridge를
  검증하며, platform repository를 QA workspace에 합치지 않고 독립 경계를 유지한다.
- 실저장소 검증: 현재 QA profile에서 **1,718 documents, 36,107 facts, error 0, warning 727**을
  재현했다. warning은 기존 legacy frontmatter와 현재 code-link coverage의 baseline 신호이며,
  새 platform 오류로 합산하지 않는다.
- `qa-sdk def platform-verify --platform-bin=… --store=…`로 외부 adapter가 실제 snapshot을 저장하는
  end-to-end 경로를 확인했다. 기존 `qa-sdk def`의 SQLite/HTTP read model과 address/DKG bridge는 별도
  product capability이므로 아직 유지한다.

### 단계 판정

| 단계 | 판정 | 근거 |
|---|---|---|
| P0 contract inventory | 완료 | 기존 package boundary와 비이관 대상 확인 |
| P1 neutral parser/runtime | 완료 | 독립 workspace test/typecheck 통과 |
| P2 graph/code verifier + QA profile | 완료 | 실 qa-sdk 0 error collect/verify |
| P3 store/client port | 완료 | immutable file store + storage-agnostic query client + QA adapter round-trip |
| P4 `qa-sdk def` compatibility transition | 진행 중 | `platform-verify`, `--platform=auto`/`QA_SPEC_PLATFORM_MODE=auto`, publish contract, dependency-first release runner, clean archive/install smoke, full journey 통과; registry package는 아직 미공개이고 consumer default 전환은 보류 |

## 남은 선행 결정

1. npm scope ownership, publish 권한, 버전 및 dependency-first publication 순서를 확정한다.
2. 실제 registry에 dependency packages와 `@spec-platform/qa-sdk-adapter`를 publish한 뒤,
   tarball이 아닌 registry 설치로 clean consumer의 `qa-spec-platform verify`를 검증한다.
3. registry consumer 검증 후 `qa-spec-platform`을 기본 실행 경로로 삼을 시점과 legacy fallback의
   호환 기간을 결정한다.
4. SQLite/Postgres/HTTP adapter를 어느 deployment에서 제공할지와 snapshot freshness 정책을 결정한다.

## 종료 조건

P0–P3와 P4의 external compatibility entrypoint는 충족했다. legacy control-plane 제거의 종료는 다음을
모두 만족할 때만 선언한다.

- platform core가 qa-sdk workspace dependency 없이 fixture repository를 수집·검증한다.
- published platform client/executable이 저장소 또는 서비스 경계를 통해 snapshot과 query를 제공한다.
- qa-sdk는 그 공식 adapter/client port만 통해 parsing/evidence surface를 소비한다.
- qa-sdk coordinate/DKG/registry 특화 기능은 platform core가 아니라 extension에 존재한다.
- 기존 QA 사용자 workflow의 compatibility test가 통과한 뒤에만 legacy `def` 구현을 deprecate 또는 제거한다.
- `@spec-platform/qa-sdk-adapter`가 registry에 publish되고 clean consumer install에서 `qa-spec-platform verify`가 동작한다.
