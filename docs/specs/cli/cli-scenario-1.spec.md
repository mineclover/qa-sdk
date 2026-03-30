---
def:
  id: cli-scenario-1
  scope: feature
  aspect: scenario
  depth: specification
  lifecycle: draft
  svc: cli
  links:
    - target: cli-contract-spec
      type: refines
    - target: definition-catalog-spec
      type: depends_on
---
# def 문서 관리 워크플로우

## 목적 ^purpose

개발자가 CLI `qa-sdk def` 명령을 사용하여 definition-catalog 문서를 스캔·동기화·조회·검증·영향 분석하는 전체 워크플로우를 검증한다.

## 행위자 ^actor

- **개발자**: 모노레포에서 스펙 문서를 작성/관리하는 사람
- **CLI**: `qa-sdk def` 서브커맨드 (scan, list, get, validate, impact 등)
- **데이터 소스**: SQLite 직접 접근(--local) 또는 definition-service HTTP(--server, port 3700)

## 사전 조건 ^preconditions

- 모노레포 루트에 `docs/` 디렉토리가 존재하고 frontmatter가 있는 .md 파일이 1건 이상
- `def-config.json`이 `.qa-sdk/` 디렉토리에 존재 (또는 최초 scan으로 생성)
- --local 모드: SQLite DB 파일이 존재하거나 scan 후 sync로 생성
- --server 모드: definition-service가 localhost:3700에서 기동 중

## 스텝 ^steps

1. 개발자가 `qa-sdk def scan` 실행 → docs/ 디렉토리의 모든 .md 파일 frontmatter 파싱
2. scanAndBuild가 문서 등록 + 링크 추출 → 등록 건수/링크 건수/파싱 에러 출력
3. 개발자가 `qa-sdk def list --scope=feature --lifecycle=approved` 실행 → DefDataSource에서 필터 조회
4. CLI가 `[local|server] N-M / total건` 형식으로 페이지네이션 결과 출력
5. 개발자가 `qa-sdk def get <문서ID>` 실행 → 단건 메타데이터 조회 (scope, aspect, depth, lifecycle, layer, svc, address, tags, links)
6. 개발자가 `qa-sdk def validate` 실행 → 그래프 검증 (broken-link, circular-ref, self-ref, orphan, multi-parent, contains-depth)
7. 검증 결과: 통과 시 `✓ 검증 통과`, 실패 시 에러/경고 건수 + 이슈 목록 출력
8. 개발자가 `qa-sdk def impact <문서ID>` 실행 → blast radius 분석 (의존자, 제약, 추적/구체화 문서 열거)
9. CLI가 변경 규모 판단 출력: 소규모(의존자 < 3) 또는 대규모(의존자 >= 3, scope 내 일괄 검토 필요)

## 검증 ^assertions

- `qa-sdk def scan` → 등록 건수가 docs/ 내 frontmatter 보유 .md 파일 수와 일치
- `qa-sdk def list` → 필터 조건에 맞는 문서만 반환, 페이지네이션 정상 (offset/limit)
- `qa-sdk def list --q=검색어` → 전문 검색 결과가 0건 이상 반환 (FTS5 작동)
- `qa-sdk def get <ID>` → 존재하는 문서는 메타데이터 전체 출력, 미존재 시 `문서 "..." 없음`
- `qa-sdk def children <ID>` → contains 링크의 자식 문서 목록 반환
- `qa-sdk def parent <ID>` → contains 링크의 부모 문서 1건 반환 (없으면 `부모 없음`)
- `qa-sdk def validate` → broken-link가 있으면 error 심각도, orphan은 warning 심각도
- `qa-sdk def impact <ID>` → depends_on/implements로 참조하는 문서가 blast radius에 포함
- 데이터 소스 자동 감지: DB 파일 있으면 local, 없으면 server 시도

## 변형 ^variants

### V1: --server 모드 (definition-service 경유)

- 모든 조회가 HTTP API(localhost:3700) 경유
- 출력 형식 동일, `[server]` 접두사 표시
- definition-service 미기동 시 연결 에러 출력

### V2: 대규모 문서 그래프에서의 validate

- 문서 500건 이상, 링크 2000건 이상인 환경
- circular-ref 검증이 DAG 탐색으로 O(V+E) 이내 완료
- multi-parent 경고 시 cross-scope 태그 여부 확인

### V3: scan 후 sync 연계

- `qa-sdk def scan` → `POST /sync` (file → DB 동기화)
- DB 메타데이터가 SSOT, frontmatter는 읽기 전용 캐시
- sync 후 list 결과가 scan 결과와 일치

### V4: context + check 활용

- `qa-sdk def context <ID>` → 소속/의존/영향/concerns 전체 컨텍스트 조회
- `qa-sdk def check <ID>` → purpose 누락, 고립 문서, 대규모 변경 경고 출력

## 재검토 트리거 ^update-trigger

- cli-contract: def 서브커맨드 인터페이스 변경 시
- definition-catalog: scanAndBuild/validateGraph API 변경 시
- definition-service: API 엔드포인트 추가/변경 시
- definition-data-source: 데이터 소스 자동 감지 로직 변경 시
