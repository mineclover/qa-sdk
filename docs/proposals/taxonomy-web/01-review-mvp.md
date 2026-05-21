---
status: draft
date: 2026-05-21
part_of: taxonomy-web
role: spec
supersedes: -
superseded_by: -
---

# Taxonomy Web v1 MVP — 리뷰 사이트

## 목적 ^purpose

텍소노미 구조 (axis/entry/relation/constraint)를 정확히 식별하고 명칭된 피드백을 워크플로 안에서 관리하는 로컬 웹 인터페이스. taxonomy-engine 라이브러리 위에서 동작.

해결 대상:
1. **리뷰 대상의 정확한 식별** — 모든 단위에 3-tier ref grammar 활용 (taxonomy-engine 기존 자원)
2. **고유 식별된 대상의 조회** — show + slice + walkByCoordinate API 활용
3. **명칭화 피드백** — ref + 태그 + 상태 + 텍스트 + 상태 변경 워크플로

## 결정 사항 (브레인스토밍 결과)

| 항목 | 결정 | 근거 |
|------|------|------|
| 사용 맥락 | 개인 로컬 (자기 머신 + 동료 1-2명) | 인증/서버 불필요, 정적 사이트 + dev mode 쓰기 |
| 피드백 단위 | ref + 태그 + 상태 + 텍스트 (워크플로 있음) | 결정 기록 성격, open/resolved/rejected |
| 저장 형식 | 단일 JSONL (`docs/taxonomies/.reviews.jsonl`) | git diff 친화, conflict 최소, append-only |
| UI 스택 | Vite + React | 친숙, 큰 ecosystem, taxonomy-engine ESM 직접 사용 |
| MVP 범위 | 조회 + 피드백 작성 + 상태 변경 워크플로 | v1의 의미 있는 단위. diff/git 통합은 v2 |
| 식별 grammar | 기존 3-tier ref 그대로 | taxonomy-engine 자원 재사용, 학습 비용 0 |

## 아키텍처 ^defines

```
packages/taxonomy-web/  (신규 @qa-sdk/taxonomy-web)
  ├─ Vite + React SPA
  ├─ 빌드 시점: docs/taxonomies/*.yaml → public/data/<name>.json (taxonomy-engine parse)
  ├─ 런타임: 정적 JSON 로드 + taxonomy-engine ESM (show/parseRef/diff)
  └─ Vite dev plugin: POST/PATCH /api/feedbacks → .reviews.jsonl 직접 write
```

**원칙**:
- **읽기는 정적** — 빌드 시점 yaml → JSON pre-compute
- **쓰기는 dev 모드만** — `pnpm dev` 띄워둔 상태에서만 피드백 작성/수정
- **빌드 결과는 read-only** — git push로 공유 시 동료가 보지만 수정은 자기 머신에서
- 별도 서버/인증 없음 (사용 맥락 정합)

## 데이터 모델

### Feedback (JSONL 한 줄)

```typescript
type Feedback = {
  id: string;                      // "f-YYYYMMDD-NNN" — 클라이언트 timestamp + counter
  ref: string;                     // 3-tier ref (taxonomy-engine parseRef로 검증)
  tag: FeedbackTag;
  status: FeedbackStatus;
  text: string;
  createdAt: string;               // ISO-8601
  updatedAt: string;               // ISO-8601
  history: StatusChange[];
};

type FeedbackTag = "bug" | "improvement" | "question" | "approval" | "concern";
type FeedbackStatus = "open" | "resolved" | "rejected";

type StatusChange = {
  at: string;                      // ISO-8601
  from: FeedbackStatus;
  to: FeedbackStatus;
  note?: string;
};
```

저장 위치: `docs/taxonomies/.reviews.jsonl`

### Compiled taxonomy data (빌드 산출물)

각 yaml별 별도 JSON:
```
packages/taxonomy-web/public/data/
  ├─ qa-sdk-coordinate-system.json
  ├─ lesson-builder-content.json
  ├─ dkg-schema.json
  ├─ ingest-coords.json
  └─ qa-sdk-def-catalog.json
```

각 JSON: `{ name, version, axes, relations, constraints, contentHash }` (IR-like, Map은 object로 직렬화).

또 `index.json`: 5 yaml 메타 목록 (이름, version, 마지막 수정 시각).

## 컴포넌트 구조

```
src/
├── App.tsx
├── routes/
│   ├── TaxonomyListPage.tsx     (홈 — 5 yaml 사이드바 + 인덱스)
│   ├── TaxonomyViewPage.tsx     (한 yaml 상세, axis/relation/constraint 트리)
│   ├── FeedbacksPage.tsx        (전체 피드백 — filter: tag/status/yaml)
│   └── RefDetailPage.tsx        (한 ref의 상세 + 피드백 패널)
├── components/
│   ├── TaxonomyTree.tsx         (axis/entry/relation 트리)
│   ├── RefBar.tsx               (3-tier ref 입력 + show 결과)
│   ├── FeedbackPanel.tsx        (한 ref의 피드백 목록 + 새 폼)
│   ├── FeedbackList.tsx         (전체 피드백 표)
│   ├── FeedbackForm.tsx         (새 피드백 작성)
│   ├── StatusBadge.tsx          (open/resolved/rejected)
│   ├── TagPill.tsx              (bug/improvement/... 색상)
│   └── StatusChangeDialog.tsx   (상태 변경 + note)
├── data/
│   ├── loadStaticTaxonomies.ts  (public/data/*.json fetch)
│   ├── loadFeedbacks.ts         (api/feedbacks GET)
│   └── feedbacksApi.ts          (POST/PATCH wrapper)
├── lib/
│   ├── refFormat.ts             (ref 표시/parse helper)
│   ├── filterFeedback.ts        (tag/status/yaml 필터)
│   └── newFeedbackId.ts         (id 발급)
└── api/
    └── (vite plugin 호출 wrapper)

plugins/
└── feedback-api.ts              (vite dev plugin)
```

## Vite plugin (피드백 API)

`plugins/feedback-api.ts`:

```typescript
import type { Plugin } from "vite";
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";

export function feedbackApiPlugin(jsonlPath: string): Plugin {
  return {
    name: "taxonomy-web:feedback-api",
    configureServer(server) {
      server.middlewares.use("/api/feedbacks", async (req, res, next) => {
        if (req.method === "GET") {
          const lines = existsSync(jsonlPath)
            ? readFileSync(jsonlPath, "utf8").split("\n").filter(Boolean)
            : [];
          const feedbacks = lines.map((l) => JSON.parse(l));
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(feedbacks));
          return;
        }
        if (req.method === "POST") {
          const body = await readBody(req);
          const feedback = JSON.parse(body);
          appendFileSync(jsonlPath, JSON.stringify(feedback) + "\n");
          res.statusCode = 201;
          res.end(JSON.stringify(feedback));
          return;
        }
        if (req.method === "PATCH") {
          const body = await readBody(req);
          const { id, ...patch } = JSON.parse(body);
          // 전체 다시 읽고 해당 line 교체 + write
          const lines = readFileSync(jsonlPath, "utf8").split("\n").filter(Boolean);
          const updated = lines.map((l) => {
            const f = JSON.parse(l);
            return f.id === id ? JSON.stringify({ ...f, ...patch, updatedAt: new Date().toISOString() }) : l;
          });
          writeFileSync(jsonlPath, updated.join("\n") + "\n");
          res.statusCode = 200;
          res.end();
          return;
        }
        next();
      });
    },
  };
}
```

빌드 시점 (vite build)에는 plugin이 없으므로 read-only.

## Pre-build 데이터 변환

`scripts/taxonomy-web-build-data.mjs`:

빌드 직전 실행 — `docs/taxonomies/*.yaml` → `packages/taxonomy-web/public/data/*.json`. taxonomy-engine의 `parse`로 IR 생성, Map을 object로 직렬화.

vite.config.ts의 `buildStart` hook 또는 별도 npm script (`build:data`)로 `build` 전 실행.

## 빌드/스크립트

`packages/taxonomy-web/package.json`:

```json
{
  "name": "@qa-sdk/taxonomy-web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build:data": "node ../../scripts/taxonomy-web-build-data.mjs",
    "dev": "pnpm build:data && vite",
    "build": "pnpm build:data && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "taxonomy-engine": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.8.2",
    "vite": "^5.4.0",
    "vitest": "^1.6.1"
  }
}
```

## 사용 흐름

1. `pnpm --filter @qa-sdk/taxonomy-web dev`
2. http://localhost:5173
3. 좌측 사이드바: 5 taxonomy 목록 → 한 선택
4. 중앙: axis/relation/constraint 트리. 클릭 시 ref 자동 채워짐
5. 우측 패널: 선택 ref의 피드백 (filter: tag/status) + 새 폼
6. 새 피드백 제출 → POST /api/feedbacks → JSONL append → 즉시 UI 반영
7. 상태 변경 (resolved/rejected): 다이얼로그 → note 입력 → PATCH /api/feedbacks → history entry append

## 디자인 / UX

- **Tailwind 기본** (직접 설정 — shadcn은 v2)
- **3-pane 레이아웃**: 사이드바(taxonomy) + 메인(트리/ref) + 우측 패널(피드백)
- **태그 색상**: bug=red, improvement=blue, question=amber, approval=green, concern=purple
- **상태 색상**: open=blue, resolved=green, rejected=gray
- **단축키 (v1.5)**: `/` 검색, `n` 새 피드백, `Esc` 닫기

## 테스트

- **vitest unit** — 헬퍼/유틸 (refFormat, filterFeedback, newFeedbackId)
- **컴포넌트 테스트 minimal** — React Testing Library, FeedbackForm 제출 시 API 호출 확인
- **e2e playwright** — v1.5

## CI 통합

`tax:ci`에 추가 (선택):
- `pnpm --filter @qa-sdk/taxonomy-web build` — 빌드 통과
- (v1.5) `pnpm --filter @qa-sdk/taxonomy-web test`

## fail 정책

- Vite plugin API 호출 실패 → UI에 toast 알림 (피드백 손실 방지 위해 form 데이터 유지)
- 빌드 시 yaml parse 실패 → vite 빌드 fail
- ref 형식 오류 (피드백 폼) → form 검증으로 사전 차단

## 미결 사항 (Open Issues)

- [ ] `.reviews.jsonl` 위치 — `docs/taxonomies/` 안 hidden vs 별도 `docs/reviews/`
- [ ] gitignore 정책 — 피드백 commit할지 (팀 공유 의도 — commit), 또는 개인 정보 우려 시 ignore
- [ ] v2: `tax git-diff` 통합 — 변경된 ref 하이라이트, PR 리뷰 워크플로
- [ ] v2: 외부 멘션 (`@username`) — multi-user 갈 때
- [ ] v3: 검색 인덱스 (대량 피드백 시 필요)
- [ ] v3: 외부 host (사용 맥락 옵션 C 갈 때 — 인증/서버 spec 별도)

## 참고

- 큰 비전 spec: [`00-design.md`](./00-design.md) (v0.5 brainstorming 결과 — generic Web UI 옵션 비교)
- 라이브러리: [`../taxonomy-engine/api-surface.md`](../taxonomy-engine/api-surface.md)
- 1급 개념: [`../taxonomy-engine/concepts/`](../taxonomy-engine/concepts/)
- 5 도그푸딩: `docs/taxonomies/*.yaml`
