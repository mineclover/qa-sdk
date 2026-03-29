---
def:
  id: definition-service-scenario-3
  scope: feature
  aspect: scenario
  depth: specification
  lifecycle: draft
  svc: definition-service
  links:
    - target: definition-service-system
      type: refines
    - target: def-svc-sync-module
      type: depends_on
---
# file↔DB 양방향 동기화

## 목적 ^purpose

마크다운 파일(frontmatter)과 SQLite DB 간 양방향 동기화가 올바르게 동작하는지 검증한다. DB가 메타데이터 SSOT이고, 파일은 id + address만 소유한다. 동기화 엔진(scanAndBuild → detectDrift → upsert)과 역동기화(DB → frontmatter writer)의 정합성을 확인한다.

## 행위자 ^actor

- **개발자**: 마크다운 파일의 frontmatter를 직접 편집하는 역할
- **definition-service**: 동기화 엔진 (SyncEngine, FrontmatterWriter)
- **def-config.json**: 동기화 시각 + 문서별 content hash 저장소

## 사전 조건 ^preconditions

- definition-service 기동 + 마이그레이션 완료
- docs/ 디렉토리에 마크다운 파일 3건 이상 존재 (유효한 frontmatter 포함)
- 초기 `POST /sync` 1회 실행 → 파일 내용이 DB에 반영된 상태
- def-config.json에 초기 동기화 시각과 각 파일의 content hash 기록

## 스텝 ^steps

1. 초기 상태 확인 → `GET /docs` 호출하여 DB에 3건 이상 존재 확인
2. 개발자가 파일 A의 frontmatter에서 `lifecycle: draft` → `lifecycle: review`로 수정
3. 개발자가 파일 B의 본문(purpose 섹션)을 변경 (frontmatter는 유지)
4. `POST /sync` 호출 → file → DB 동기화 실행
5. sync 응답에서 변경 감지 결과 확인 (파일 A: frontmatter 변경, 파일 B: 본문 변경)
6. `GET /docs/파일A의id` 조회 → DB에 lifecycle: review 반영 확인
7. `GET /docs/파일B의id` 조회 → DB의 content hash 갱신 확인
8. DB에서 파일 C의 메타데이터를 `PATCH /docs/파일C의id` + `{ layer: "mediation", tags: ["security"] }` 업데이트
9. `POST /sync/to-files` 호출 → DB → file 역동기화 실행
10. 파일 C의 frontmatter에 `layer: mediation`과 `tags: [security]` 기록 확인
11. 파일 A, B의 frontmatter는 역동기화 시에도 DB 값과 일치 (step 4에서 이미 정합)
12. def-config.json의 동기화 시각이 갱신되고, 각 파일의 hash가 최신 상태

## 검증 ^assertions

- POST /sync → 200 OK, 변경/추가/무변경 문서 수 요약 반환
- file → DB 동기화 후: frontmatter 변경 사항이 DB에 정확히 반영
- file → DB 동기화 후: 본문 변경 → content hash 갱신, 메타데이터 필드는 불변
- DB에 이미 존재하는 문서의 id와 address는 sync로 덮어쓰지 않음 (파일 소유 필드)
- POST /sync/to-files → 200 OK, 기록된 파일 수 반환
- DB → file 역동기화 후: DB의 layer/lifecycle/tags가 frontmatter에 기록
- 역동기화 시 파일의 id/address는 변경되지 않음 (파일 소유 필드 보존)
- def-config.json의 동기화 시각이 POST /sync 호출 이후 시점으로 갱신
- 변경 없는 파일 → detectDrift에서 skip (hash 일치 시 upsert 미실행)
- 존재하지 않는 파일이 DB에만 있는 경우 → 삭제 마킹 또는 경고

## 변형 ^variants

### V1: 새 파일 추가 감지

- docs/ 디렉토리에 새 마크다운 파일 추가 (유효 frontmatter 포함)
- POST /sync → 신규 문서로 DB에 insert
- address가 자동 계산되어 부여됨

### V2: frontmatter 없는 파일

- frontmatter가 없거나 잘못된 YAML인 파일 존재
- POST /sync → 해당 파일 skip + 경고 로그, 나머지 파일은 정상 처리

### V3: 동시 수정 충돌

- 개발자가 파일 frontmatter에서 `lifecycle: review`로 변경
- 동시에 다른 경로로 DB에서 같은 문서를 `lifecycle: approved`로 업데이트
- POST /sync → DB가 SSOT이므로 file의 값이 DB에 반영, 이후 역동기화 시 DB 최종값으로 파일 정합

### V4: 대량 파일 동기화 성능

- 100건 이상 마크다운 파일 동기화
- detectDrift가 hash 비교로 변경분만 upsert (전체 재기록 아님)
- 무변경 파일 비율이 높을수록 처리 시간 감소

## 재검토 트리거 ^update-trigger

- def-svc-sync-module: scanAndBuild/detectDrift/역동기화 로직 변경 시
- definition-catalog/frontmatter.ts: frontmatter 파싱/기록 규칙 변경 시
- def-svc-data-model: documents 테이블 컬럼 추가/삭제 시
- definition-harness: 하네스 상태가 동기화 흐름에 영향을 줄 때
