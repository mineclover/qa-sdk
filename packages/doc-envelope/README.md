# doc-envelope

문서형 소스를 하나의 neutral read-only data shape로 표현하는 **수집 계층 라이브러리**. PRD, 정의 markdown, ralph PRD JSON, ralph session, artifact evidence를 `DocumentEnvelope`로 정규화하고, 그 위의 순수 scope 유틸(family/archive/session 판정, completed-record 감지, TODO 생명주기 파싱)을 제공한다.

해석(graph ranking, FSM readiness, drift 등)은 소비 패키지가 수행한다. 본 패키지는 의미를 부여하지 않는다.

## 공개 API

### Envelope 타입

- `DocumentEnvelope` — 정규화된 문서 read model
- `DocumentEnvelopeInput` — normalize 이전 입력
- `DocumentMetadata`, `DocumentLink`, `DocumentSource`, `DocumentTask`, `DocumentEvidence`, `DocumentSection`, `DocumentDiagnostic` — envelope 구성 요소
- `DocumentAdapter`, `DocumentAdapterCapabilities`, `DocumentAdapterCapabilityDeclaration` — adapter 인터페이스
- `DocumentCollectionQuery`, `DocumentChange`, `DocumentChangeSet` — 조회/변경 컨테이너

### 정규화

- `normalizeDocumentEnvelope(input)` — envelope factory (path 정규화, metadata 표준화)
- `normalizeRawSourcePointer(input)` — raw source pointer 정규화
- `defineDocumentAdapter(spec)` / `declareDocumentAdapterCapabilities(spec)` — adapter 정의 헬퍼

### Query

- `matchesDocumentQuery(envelope, query)` — envelope가 쿼리에 부합하는지 boolean 판정

### Family scope

- `collectDocumentFamilyOnlyScope(documents, { target, includeTransient? })` — 같은 `familyId`를 공유하는 role 문서들 + `contains` 자식 수집
- `isArchivedPrdDocument(doc)` — `tasks/archive/` 아래 PRD 여부
- `isTransientDocument(doc)` — `metadata.transient === true`인지 판단. 플래그 설정은 adapter 책임 (예: `ralph-tui-integration`의 ralph-session adapter가 `.ralph-tui/` 세션 envelope에 `transient: true` 스탬프)

### Completed record 감지

- `detectCompletedRecords({ rootDir, documents, readDocument? })` — 열린 체크박스 0 + 완료 체크박스 ≥ 1 인 `.todo.md`를 반환 (범용)
- `deduplicateCompletedRecords(records)` — 여러 감지 함수 결과를 병합할 때 중복 제거 + 정렬
- `isActiveCompletedRecordDocument(doc)` — archive/transient 문서 제외 필터 (다른 감지 로직에서 재사용)

특정 도구(ralph-tui 등)의 PRD/JSON 완료 감지는 해당 도구 통합 패키지(`ralph-tui-integration`의 `detectCompletedRalphPrdRecords`)에서 제공하며, caller가 `deduplicateCompletedRecords`로 결과를 병합한다.

### TODO lifecycle 파싱

- `parseTodoFollowUps(content)` — TODO 섹션 헤딩을 follow-up 후보로 파싱
- `classifyTodoHeading(heading)` — 헤딩 카테고리 분류 (`actionable`/`deferred`/`parking-lot`/`completed`)
- `countMarkdownCheckboxes(content)` — `[ ]` / `[x]` 개수 집계
- `CANONICAL_TODO_CATEGORY_LABELS` — 카테고리 한국어 라벨 상수

## 비목표

- **의미 부여 금지**: envelope 필드에 대한 decision logic (ranking, drift, FSM 등)은 소비자 영역
- **파싱 소유 금지**: 원본 schema(markdown, yaml, json) 파싱은 adapter/`definition-catalog`가 담당
- **쓰기 금지**: adapter interface는 read-only collection만 선언, `DocumentChangeSet`은 향후 opt-in 컨테이너

## 의존

- 런타임: node built-ins만 (`node:fs/promises`, `node:path`)
- peer: 없음
