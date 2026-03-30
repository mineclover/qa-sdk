---
def:
  id: cli-scenario-3
  scope: feature
  aspect: scenario
  depth: specification
  lifecycle: draft
  svc: cli
  links:
    - target: cli-contract-spec
      type: refines
    - target: codegen-cli-contract
      type: depends_on
---
# codegen 타입 생성

## 목적 ^purpose

개발자가 CLI `qa-sdk codegen` 명령으로 Catalog/SchemaSnapshot에서 TypeScript 타입과 Protobuf 정의를 생성하고, 결정론적 출력과 버전 관리를 검증하는 흐름을 정의한다.

## 행위자 ^actor

- **개발자**: 타입 안전한 SDK를 생성하려는 사람
- **CLI**: `qa-sdk codegen` 명령 (--registry, --catalog, --input 입력 소스 선택)
- **codegen-core**: generateCatalogTypes / generateProto / generateTypescript 순수 함수
- **config-loader**: Catalog .ts/.js/.json 파일 자동 감지 + 폴백 체인

## 사전 조건 ^preconditions

- 입력 소스 중 하나가 유효:
  - --registry: registry-service가 기동 중이고 카탈로그가 등록됨
  - --catalog: 로컬 Catalog 파일(.ts/.js/.json)이 존재
  - --input: SchemaSnapshot JSON 파일 또는 디렉토리가 존재
- --output 디렉토리가 쓰기 가능 (없으면 자동 생성)
- Catalog에 prefix와 axes가 1건 이상 정의

## 스텝 ^steps

1. 개발자가 `qa-sdk codegen --catalog ./catalog.ts --format ts --output ./generated` 실행
2. config-loader가 Catalog 파일 로드 (TS/JS/JSON 자동 감지)
3. DkgConfig 로드 시도: --dkg-config 경로 → 로컬 자동 감지 → undefined (선택적)
4. generateCatalogTypes(catalog, dkgConfig, { lockVersion }) 호출 → 타입 파일 + contentHash 생성
5. --output 디렉토리에 파일 쓰기 → `Generated → <경로>` 출력
6. 최종 요약: `N file(s) generated from catalog "..." (hash: <contentHash>)`
7. 개발자가 동일 Catalog로 재실행 → 동일 contentHash 확인 (결정론성 검증)
8. 개발자가 `--lock-version v1` 옵션 추가 → 특정 prefix version으로 고정된 타입 생성

## 검증 ^assertions

- --catalog 모드: Catalog 파일 로드 성공 시 prefix 수/axes 수가 콘솔에 출력
- 생성된 파일 수가 1 이상 (최소 index.d.ts 또는 .proto 1건)
- 동일 Catalog 입력 → 동일 contentHash (결정론성: timestamp 1회 캡처)
- --lock-version 지정 시 `version locked to: <v>` 메시지 출력
- --format ts → .d.ts 확장자 파일 생성
- --format proto → .proto 확장자 파일 생성
- --output 디렉토리가 없으면 자동 생성 (mkdir recursive)
- --registry 모드: fetch 실패 시 로컬 Catalog 폴백 → `Local fallback:` 메시지 출력
- --registry 모드: deprecated/draft prefix version 사용 시 경고 출력
- SchemaSnapshot 모드 (--input): JSON 파일마다 format별 파일 생성

## 변형 ^variants

### V1: Registry 기반 codegen

- `qa-sdk codegen --registry http://localhost:3300 --format ts --output ./gen`
- registry-service에서 Catalog fetch → generateCatalogTypes 실행
- DkgConfig도 registry에서 시도 → 실패 시 로컬 폴백
- prefix version lifecycle 검증: deprecated → 경고, draft → 경고

### V2: SchemaSnapshot 기반 codegen (레거시)

- `qa-sdk codegen --input ./snapshots --format ts --format proto --output ./gen`
- 디렉토리 내 모든 JSON을 SchemaSnapshot으로 읽기
- 각 snapshot × 각 format → 개별 파일 생성
- Catalog 기반과 달리 contentHash 없음

### V3: Registry fetch 실패 → 로컬 폴백

- registry-service 미기동 또는 네트워크 에러
- `Registry fetch failed:` 경고 후 로컬 Catalog 로드 시도
- 로컬도 실패 시 DEMO_CATALOG 최종 폴백
- 생성 결과는 정상 (입력 소스만 다름)

### V4: prefix version 업그레이드 시 migration test

- `qa-sdk codegen --test-migration --prefix permission --from v1 --to v2`
- multi-version 라운드트립 검증 (encode v1 → decode → re-encode v2)
- 마이그레이션 호환성 확인

### V5: catalogId 지정

- `qa-sdk codegen --registry http://localhost:3300 --catalog-id custom-catalog`
- 기본값 "demo" 대신 특정 catalog ID로 fetch
- 해당 catalog 미존재 시 에러 → 로컬 폴백

## 재검토 트리거 ^update-trigger

- codegen-cli-contract: 명령 인터페이스(옵션/플래그) 변경 시
- codegen-core: generateCatalogTypes/generateProto 입출력 변경 시
- config-loader: Catalog 로드 폴백 체인 변경 시
- registry-service: /catalogs/:id 엔드포인트 스키마 변경 시
- core/Catalog: Catalog 타입 구조 변경 시 (prefix/axes 스키마)
