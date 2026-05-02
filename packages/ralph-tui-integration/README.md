# ralph-tui-integration

ralph-tui 고유의 파일시스템 관례(`.ralph-tui/` 세션 상태, flat-root JSON PRD 포맷)에 대한 어댑터와 완료 감지 유틸을 격리한 unscoped 라이브러리. `doc-envelope`(수집 계층)은 ralph-tui를 전혀 모르며, 본 패키지가 ralph 고유 지식을 독점적으로 소유한다.

## 공개 API

### Adapters

- `createRalphSessionAdapter(options)` — `.ralph-tui/session-meta.json` 읽기. Envelope 생성 시 `metadata.transient = true` 스탬프
- `RALPH_SESSION_ADAPTER_ID`, `RalphSessionAdapterOptions`
- `createRalphPrdJsonAdapter(options)` — flat-root `{ name, userStories[], ... }` 포맷 JSON PRD 파서
- `RALPH_PRD_JSON_ADAPTER_ID`, `RalphPrdJsonAdapterOptions`, `RalphPrdJsonSummary`
- `buildRalphPrdJsonEnvelopeFromContent(content, options)` — 파일 경유 없이 content string 파싱
- `readRalphPrdJsonSummary(path)` — 요약(story count, passed count, allStoriesPassing)만 추출

### Completed ralph PRD 감지

- `detectCompletedRalphPrdRecords({ documents })` — 모든 story가 `passes: true`인 `.ralph-prd-json`과 짝 PRD markdown을 completed record로 감지
- `CompletedRalphPrdDetectionOptions`

## 사용 패턴

cli(또는 환경 특화 소비자)가 두 감지 로직을 merge:

```typescript
import { detectCompletedRecords, deduplicateCompletedRecords } from "doc-envelope";
import { detectCompletedRalphPrdRecords } from "ralph-tui-integration";

const [todoRecords, ralphRecords] = await Promise.all([
  detectCompletedRecords({ rootDir, documents }),
  Promise.resolve(detectCompletedRalphPrdRecords({ documents })),
]);
const merged = deduplicateCompletedRecords([...todoRecords, ...ralphRecords]);
```

## 경계 원칙

- **doc-envelope은 ralph-tui를 모른다** — `.ralph-tui/` 경로, `ralph-session` kind, `ralph-prd-json` story 필드에 대한 하드코딩 모두 본 패키지 내부에만 존재
- **transient 플래그로 수집 계층 소통** — adapter가 envelope에 `metadata.transient: true` 스탬프. `doc-envelope.isTransientDocument()`는 이 플래그만 본다
- **완료 감지 로직 분리** — `.todo.md`와 ralph PRD는 서로 독립. caller가 조합 책임

## 의존

- `doc-envelope` — envelope 타입 + 수집 유틸
- node built-ins

## 비목표

- ralph-tui 자체를 실행하거나 세션 관리 — ralph-tui 프로젝트 영역
- PRD JSON 쓰기/변환 — cli의 `prd-to-ralph-json` orchestration이 담당
- 완료 감지 결과 자동 처리 (archive 이동 등) — operator review 용도의 candidate로만 surface
