---
name: gform-parser
description: >
  Google Form URL로부터 필드 메타데이터(레이블, 타입, entry ID, 선택지, 필수 여부)를
  자동 추출하고, JS config 파일이나 HTML 폼을 생성한다.
  Google Form URL이 주어지거나 폼 필드 정보 추출이 필요할 때 사용한다.
  트리거: google form, form parser, 폼 필드 추출, 설문 폼 config.
allowed-tools: Bash, Read, Write, Edit, WebFetch, Glob, Grep
---

# Google Form Parser

Google Form의 `/viewform` 페이지에 포함된 `FB_PUBLIC_LOAD_DATA_` 변수를 파싱하여 폼 메타데이터를 추출한다.

## 실행 전제

이 스킬은 폼 파서가 포함된 저장소에서 사용할 수 있는 portable workflow다. 현재 qa-sdk에는 `packages/gform-parser`가 없으므로, 이 저장소에서 해당 경로의 명령을 실행하지 않는다. 먼저 `test -d packages/gform-parser`로 호스트 패키지 존재 여부를 확인한다.

- 패키지가 있으면 아래의 repo-local parser 명령을 사용한다.
- 패키지가 없으면 URL의 `/viewform` 응답에서 `FB_PUBLIC_LOAD_DATA_`를 확인하고, `references/fb-public-load-data.md`의 구조에 따라 메타데이터를 추출한다. config/HTML 생성은 현재 작업 저장소의 실제 builder가 확인된 경우에만 수행한다.

## 핵심 기능

1. **폼 메타데이터 추출**: URL → 제목, 설명, 필드 목록
2. **필드 정보 파싱**: entry ID, 레이블, 타입, 선택지, 필수 여부
3. **Config 파일 생성**: `FORM_CONFIG` 객체 포함 JS 파일
4. **HTML 페이지 생성**: `@gform/builder`로 config → 완성된 HTML 자동 생성

## 사용법

### 1. pnpm 루트 명령어 (권장)

```bash
# 필드 정보 테이블 출력
pnpm run parse -- "<GOOGLE_FORM_URL>"

# JSON 출력
pnpm run parse -- "<GOOGLE_FORM_URL>" --json

# Config JS 파일 생성
pnpm run parse -- "<GOOGLE_FORM_URL>" --config ksa

# 전체 폼 파싱 + HTML 생성 (gform.config.js 기반)
pnpm run generate
```

### 2. 스크립트 직접 실행

```bash
node packages/gform-parser/bin/gform-parser.js "<GOOGLE_FORM_URL>"
node packages/gform-parser/bin/gform-parser.js "<GOOGLE_FORM_URL>" --json
node packages/gform-parser/bin/gform-parser.js "<GOOGLE_FORM_URL>" --config survey
```

### 3. Claude에게 요청

Google Form URL을 주면서:
- "이 폼의 필드 정보 추출해줘"
- "이 폼으로 config 파일 만들어줘"
- "이 폼에 맞는 HTML 폼 만들어줘"

## URL 형식

다음 형식 모두 지원:
- `https://docs.google.com/forms/d/e/{ID}/viewform`
- `https://docs.google.com/forms/d/e/{ID}/formResponse`
- `https://docs.google.com/forms/d/{ID}/viewform`

---

## 모노레포 구조

pnpm workspaces + TypeScript 기반 4패키지 모노레포.

```
packages/
├── gform-types/        # 공유 TypeScript 인터페이스 (@gform/types)
│   └── src/index.ts    # FormConfig, FormField, FieldType, ParsedForm, BuildConfig
├── gform-parser/       # Google Form → FORM_CONFIG 파서 (@gform/parser)
│   ├── src/            # TypeScript 소스
│   │   ├── fetcher.ts  # fetchFormData()
│   │   ├── parser.ts   # parseForm(), TYPE_MAP
│   │   ├── formatters/ # table.ts, config.ts
│   │   ├── cli.ts
│   │   └── index.ts    # public API
│   ├── dist/           # 컴파일 출력 (gitignored)
│   ├── bin/            # CLI 진입점
│   └── __tests__/      # vitest 테스트 + fixtures
├── gform-builder/      # FORM_CONFIG → HTML 생성기 (@gform/builder)
│   ├── src/
│   │   ├── generator.ts
│   │   ├── templates/  # page, field, consent, modal
│   │   ├── cli.ts
│   │   └── index.ts
│   ├── dist/
│   ├── bin/
│   └── __tests__/
└── gform-site/         # 프록시 사이트 (Cloudflare Pages)
    ├── gform.config.js # 폼 정의 (URL, 메타, 동의 설정)
    ├── generate.js     # 파이프라인: parser → builder → public/
    └── public/         # 배포 대상
        ├── form-core.js  # IIFE 런타임 (수동 관리)
        ├── form.css      # 공통 CSS (수동 관리)
        ├── index.html    # 랜딩 (수동 관리)
        ├── ksa.html      # 빌더가 생성
        ├── survey.html   # 빌더가 생성
        └── config/       # 파서가 생성
```

### 데이터 흐름

```
Google Form URL → [parser] → config.js ─┐
                                         ├→ [site/public] → Cloudflare Pages
                  [builder] → HTML page ─┘
```

### 주요 명령어

```bash
pnpm install          # 의존성 설치
pnpm -w run build     # 전체 TypeScript 빌드
pnpm -w run test      # 전체 테스트 (vitest, 33 tests)
pnpm run parse -- "<URL>"              # 폼 파싱
pnpm run generate                      # 전체 config + HTML 생성
pnpm run dev                           # 로컬 개발 서버
pnpm run deploy                        # Cloudflare Pages 배포
```

---

## FORM_CONFIG 스키마

`@gform/types`에서 TypeScript 인터페이스로 정의. 파서 출력과 사이트 런타임의 유일한 계약(contract).

```typescript
interface FormField {
  entry: string;         // 'entry.NNNNNN'
  label: string;         // 한글 레이블
  type: FieldType;       // 'short_text' | 'paragraph' | 'radio' | ...
  required: boolean;
  role?: 'consent';      // 동의 게이트 필드
  consentValue?: string; // 라디오 동의 값 접두사
  options?: string[];    // 선택지 목록
}

interface FormConfig {
  formUrl: string;       // Google Forms /formResponse URL
  downloadPath: string;  // 다운로드 파일 경로
  fields: FormField[];
}
```

**Entry ID 존재 위치 (2곳만):**
| 위치 | 역할 |
|------|------|
| `config/{name}-config.js` | 소스 오브 트루스 — 파서가 자동 생성 |
| HTML `name` 속성 | 폼 제출 시 매핑 — 빌더가 자동 생성 |

`form-core.js`에는 entry ID가 0개.

---

## 폼 추가/변경

### 새 폼 추가 (원커맨드)

```bash
# 1. gform.config.js에 새 폼 정의 추가
# 2. generate 실행
pnpm run generate

# → config + HTML 자동 생성 → pnpm run dev로 확인 → pnpm run deploy
```

### gform.config.js 형식

```javascript
module.exports = {
  forms: [
    {
      url: 'https://docs.google.com/forms/d/e/.../viewform',
      slug: 'ksa',      // URL 슬러그 + config 파일명
      page: {            // 페이지 메타데이터
        title: '...',
        description: '...',
        ctaLabel: '안내자료 다운로드',
        ctaDescription: '...',
        formDescription: '모든 항목은 필수입니다.',
        doneTitle: '신청이 완료되었습니다.',
        doneDescription: '...',
        doneButtonLabel: '안내자료 다운로드',
      },
      consent: {         // 동의 섹션 커스터마이징 (선택)
        title: '개인정보 수집·이용 동의서',
        text: '<p>수집 목적: ...</p>',
        questionLabel: '1. 개인정보 수집 및 이용 동의',
      }
    }
  ]
};
```

### 기존 폼 변경

Google Form 내용이 바뀌었을 때:

```bash
pnpm run generate    # → 최신 폼 파싱 → config + HTML 재생성
pnpm run dev         # → 확인
pnpm run deploy      # → 배포
```

`form-core.js`와 `form.css`는 수정 불필요.

---

## @gform/builder — HTML 생성기

`BuildConfig` → 완성된 HTML 문서 생성. 필드 타입별 스마트 매핑:

| config type | HTML | 자동 힌트 |
|-------------|------|-----------|
| `short_text` | `<input type="text">` | 라벨에 "이메일" → `type="email"`, "연락처" → `type="tel"` + placeholder |
| `paragraph` | `<textarea>` | — |
| `radio` | `<input type="radio">` | consent 필드면 `onchange="toggleSubmit()"` 자동 추가 |
| `checkbox` | `<input type="checkbox">` | consent 필드면 `onchange="toggleSubmit()"` 자동 추가 |
| `dropdown` | `<select>` | — |
| `date` | `<input type="date">` | — |
| `time` | `<input type="time">` | — |
| `scale` | 라디오 그룹 | — |

---

## form-core.js (IIFE 런타임)

IIFE로 래핑. 내부 변수(`LABELS`, `_CONSENT`, `pendingData`) 외부 미노출. HTML에서 호출하는 함수만 `window`에 노출:

| window 함수 | 역할 |
|------|------|
| `showForm()` | CTA 숨기고 폼 표시 |
| `toggleSubmit()` | 동의 상태에 따라 제출 버튼 활성화/비활성화 |
| `handleSubmit(e)` | 폼 제출 가로채기 → 미리보기 모달 표시 |
| `closeModal()` | 모달 닫기 |
| `confirmSubmit()` | hidden iframe POST로 Google Form 제출 → 완료 화면 |

내부 전용: `collectFormData(form)`, `showModal(data)`, `esc(s)`

---

## 제출 방식

| 방식 | 한계 |
|------|------|
| **hidden iframe POST** (사용 중) | 성공/실패 콜백 없음 |
| `fetch` + `no-cors` | **body 빈 채로 전송 — 사용 금지** |
| CF Functions 프록시 | 서버 필요 |

---

## FB_PUBLIC_LOAD_DATA_ 구조 요약

상세 구조는 [references/fb-public-load-data.md](references/fb-public-load-data.md) 참조.

### 타입 코드

| 코드 | 타입 | 코드 | 타입 |
|------|------|------|------|
| 0 | 단답형 | 5 | 선형 배율 |
| 1 | 장문형 | 7 | 객관식 그리드 |
| 2 | 객관식(라디오) | 8 | 섹션 헤더 |
| 3 | 드롭다운 | 9 | 날짜 |
| 4 | 체크박스 | 10 | 시간 |

### 필드 배열

```
field[0] = questionId    field[3] = typeCode
field[1] = title         field[4] = answerEntries
field[2] = description
```

### 응답 엔트리

```
entry[0] = entryId       entry[1] = options       entry[2] = required (0/1)
```

### ID 체계

| ID | 위치 | 용도 |
|----|------|------|
| questionId | `field[0]` | 미리채우기 URL |
| entryId | `field[4][0][0]` | POST 제출 (실제 input name) |

두 ID 모두 `/formResponse` POST에 사용 가능.

---

## 흔한 실수와 해결

| 실수 | 해결 |
|------|------|
| `fetch` + `no-cors` 사용 | hidden iframe POST로 교체 |
| entry ID 불일치 | `pnpm run generate`로 재생성 |
| config보다 form-core.js 먼저 로드 | script 순서: config → form-core.js |
| 빌더 없이 HTML 수동 작성 | `gform.config.js`에 정의 후 `pnpm run generate` |
