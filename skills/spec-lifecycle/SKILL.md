---
name: spec-lifecycle
description: "스펙 문서 생명주기 관리. 설계→구현→검증 단계별 문서 상태 전이, 구현 완료 후 코드 참조 전환, drift 점검을 수행한다."
triggers:
  - spec lifecycle
  - 문서 생명주기
  - 코드 참조 전환
  - spec drift
argument-hint: "<spec-doc-id|service>"
---

# Spec Lifecycle — 스펙 문서 생명주기 관리

설계 문서(spec)가 코드로 구현되는 전 과정의 상태 전이를 관리한다.

## 핵심 원칙

### 0. todo → spec 흡수 순서

**.spec 흡수는 코드 구현 + 테스트 통과 이후에만 한다.** 구현 전에 spec으로 이름만 바꾸면 문서가 코드보다 앞서 SSOT 행세를 하게 되어 drift 시 어느 쪽이 정답인지 결정이 불가능해진다 (메모리: `feedback_todo-impl-first`).

순서:

1. `.todo.md`에 미구현 항목을 체크박스로 둔다.
2. 코드 구현 → 테스트(`.test.md`로 명시한 시나리오 포함) 통과 확인.
3. 통과한 항목만 `.spec.md`로 이전. 미통과 항목은 `.todo.md`에 잔류.
4. 전부 끝나야 `.todo.md` 삭제.

`.todo.md`가 남아 있는 동안 `.spec.md`는 **현재 동작하는 부분만** 다룬다 — todo 항목을 spec에 미리 적어 두지 않는다.

### 1. 구현 완료 시 코드 참조로 전환

타입, API 시그니처 등 코드로 표현 가능한 내용은 구현 완료 후 **코드가 SSOT**가 된다.
문서에 코드를 복사하면 drift가 발생하므로, 소스 경로 참조로 전환한다.

```
❌ 구현 후에도 문서에 타입 정의를 유지
interface ContractEvidence {
  specId: string;
  status: "pass" | "fail";
}

✅ 구현 후 소스 참조로 전환
참조: packages/spec-tracker/src/types.ts:ContractEvidence
```

### 1.5. 문서 분할 후 코드 boundary 점검

문서가 E/C/I/S + L/P로 분리됐는데 구현 코드가 그대로 하나의 거대 파일에 남아 있으면 drift 위험이 남는다.

코드 작성 규칙은 `docs/specs/system/architecture-revealing-code-convention.rule.md`를 기준으로 본다. 목표는 코드 자체가 책임을 드러내고, 문서가 그 책임을 좌표화하는 것이다.

점검:

- Interface/Component/System behavior 문서마다 대응 source symbol 또는 source file이 있는가?
- Layout/Pack 문서가 behavior/data source를 직접 소유하고 있지는 않은가?
- 여러 문서가 같은 source file 전체를 참조한다면 실제 코드 책임도 나눌 수 있는가?
- test file도 같은 기준으로 분리돼 있는가? 필요하면 `test-split`을 사용한다.
- 코드가 이미 모듈화되어 있다면 각 모듈이 Component/Interface/System/Layout 중 어떤 책임인지 파일명/export로 드러나는가?

판정:

- 코드도 나눌 수 있으면 code split을 먼저 하거나 같은 변경 묶음에서 닫는다.
- 지금 나눌 수 없으면 문서에 shared source임을 명시하고 `.todo.md`에 code split follow-up을 남긴다.
- 코드가 충분히 나뉘어 있지만 같은 책임을 함께 구현한다면 문서는 하나로 유지하고 `sources`에 여러 파일을 나열한다.

#### tier 승격 트리거

문서 분할 후 자식 문서가 본인 책임을 갖기 시작하면 **부모 문서의 tier도 승격**한다. 근거: `docs/specs/system/validator-suppression-tags.rule.md` §1.2 (L47) — "실질적 system 을 component 로 분류하여 dup-coord 회피 금지 — tier 승격 또는 aspect 세분화가 정답".

| 현재 tier | 승격 트리거 | 다음 tier |
|----------|-------------|----------|
| `entry` / shape 전용 | behavior(동작)를 직접 보유하기 시작 | `component` |
| `component` | `contains` 자식 문서가 새로 발생했거나 독립 behavior(동작/계약)를 가진다 | `component` 유지 검토 후 `system`으로 |
| `component` | 다른 문서가 이 문서를 system처럼 참조하고 있다 (직접 의존 진입점) | `system` |

승격 후에는 `duplicate-coordinate` 면제가 사라지므로 좌표 유일성을 다시 점검한다 (validate.ts L361 면제 조건).

### 2. 문서에 남는 것 vs 코드로 옮기는 것

| 문서에 남는다 (코드로 표현 불가) | 코드로 옮긴다 (구현 시점에) |
|------|------|
| ^purpose — 왜 존재하는가 | 타입 정의 (interface, type) |
| ^intent — 설계 의도/판단 근거 | 함수 시그니처 |
| ^constraint — 불변 조건 규칙 | API 엔드포인트 목록 |
| ^decision-point — 분기 판단 기준 | 에러 코드 enum |
| ^context — 사용 맥락 | 설정 스키마 |
| 관계 (links) | — |
| 분류 (scope/aspect/layer/tags) | — |

### 3. depth별 전환 시점

| depth | 언제 작성 | 구현 후 전환 |
|-------|----------|------------|
| overview | 시스템 설계 시 | purpose/overview 유지. 코드 블록 없음 |
| specification | 상세 설계 시 | 타입/API → 소스 참조로 전환. ^constraint/^intent 유지 |
| implementation | 구현 중 | 구현 완료 후 코드가 SSOT. 문서는 "왜" 중심으로 축소 |
| validation | 테스트 설계 시 | 테스트 파일 참조. ^evidence 마커 유지 |

## 생명주기 전이

```
draft → review → approved → (구현 시작)
                     ↓
              specification 문서에 코드 블록 존재
                     ↓
              코드 구현 완료
                     ↓
              코드 블록 → 소스 참조로 전환
              lifecycle 유지 (approved)
              svc 필드 확인/추가
                     ↓
              deprecated (대체 문서 있을 때만)
              traces_to 로 대체 문서 연결
```

## 실행 흐름

### 1단계: 구현 전 — 스펙 작성

```bash
# 새 스펙 문서 생성 (/def-new 사용)
# → draft lifecycle으로 시작
# → 타입, API, 흐름을 ^inputs, ^api-surface 마커에 작성
```

### 2단계: 구현 완료 — 코드 참조 전환

대상 문서 확인:
```bash
qa-sdk def list --svc <service> --depth=specification
```

각 문서에서:
1. 코드 블록 (```typescript 등)을 찾는다
2. 해당 타입/함수가 코드에 구현됐는지 확인한다
3. 구현됐으면 코드 블록을 소스 참조로 교체한다

```markdown
## 교체 전
\```typescript
interface DriftReport {
  specId: string;
  coverage: number;
}
\```

## 교체 후
참조: `packages/spec-analyzer/src/types.ts:DriftReport`
```

4. svc 필드가 없으면 추가한다
5. E/C/I/S + L/P 문서가 여럿인데 같은 source file 전체만 참조하면 code boundary split 또는 symbol-level reference를 검토한다

### 3단계: 검증 — drift 점검

```bash
# 문서에 남은 코드 블록이 있는지 확인
qa-sdk def check <문서ID>

# 전체 감사
qa-sdk def audit

# 소스 파일 ↔ 문서 역추적 (sources: frontmatter 기반)
qa-sdk def find-by-file packages/<pkg>/src/types.ts
qa-sdk def find-by-file packages/<pkg>/src/types.ts:DriftReport

# 미연결 코드 점검 — 정식 게이트
# 근거: docs/specs/definition-catalog/definition-code-link-coverage.spec.md
# 근거: docs/specs/system/layer-separation.rule.md L78, L150
qa-sdk def code-link-gaps --scope=<scope>
qa-sdk def code-link-gaps --json

# raw frontmatter/link 감사 (DB 미사용 — sync 전 빠른 점검)
qa-sdk def scan-audit
```

| 명령 | 입력 | 검증하는 것 |
|------|------|-------------|
| `find-by-file <path[:symbol]>` | 코드 경로 + 선택 심볼 | 어떤 문서가 sources로 이 코드를 소유하는가 |
| `code-link-gaps` | (전체 스캔) | `@def.boundary`/`sources:` 어느 쪽으로도 연결 안 된 코드 목록 |
| `scan-audit` | 디렉토리 | sync 없이 frontmatter/link 정합성 즉시 검사 |

## 판단 기준

### 코드 블록을 남겨야 하는 경우

- **의사 코드** (pseudo-code) — 실제 API가 아닌 개념 설명
- **사용 예시** — 소비자 관점의 호출 패턴 (구현이 아닌 사용법)
- **미구현** — 아직 코드가 없는 설계 단계

### 소스 참조로 전환해야 하는 경우

- **타입 정의** — interface, type, enum이 코드에 존재
- **API 엔드포인트** — 라우터에 실제 등록된 경로
- **함수 시그니처** — export된 public API
- **에러 코드** — enum이나 상수로 정의된 값

### 전환 형식

본문 — 소스 경로를 사람이 읽기 좋은 설명과 함께 나열:

```markdown
## 관련 소스

- `packages/<pkg>/src/types.ts` — 핵심 타입 (ContractEvidence, DriftReport)
- `packages/<pkg>/src/collector.ts:createSpecTracker` — 수집기 팩토리
- `packages/<pkg>/src/routes.ts:POST /sync` — 동기화 엔드포인트
```

frontmatter `sources:` — DB 역추적/`code-link-gaps` 게이트의 1급 입력 (배열 형식):

```yaml
---
def:
  id: <doc-id>
  ...
  sources:
    - packages/<pkg>/src/types.ts
    - packages/<pkg>/src/types.ts:DriftReport
    - packages/<pkg>/src/collector.ts:createSpecTracker
    - packages/<pkg>/src/routes.ts
---
```

규칙:

- 항목 형식: `<레포 상대경로>` 또는 `<레포 상대경로>:<symbol>` — symbol은 export name 또는 라우트(`POST /sync`).
- 경로는 항상 레포 루트 기준. `./`, `../`, 절대경로 금지.
- 같은 파일을 여러 symbol로 분리해서 등록 가능 — boundary 책임이 갈리면 등록도 분리.
- `sources`가 비어 있으면 `code-link-gaps`에서 해당 문서 영역 코드가 미연결로 잡힌다.
- 본문 "관련 소스" 목록과 `sources:` 배열은 **둘 다 유지**한다 — 본문은 사람용 설명, frontmatter는 도구용 SSOT.

예시 참고: `docs/specs/sim-identifier-grammar/sim-identifier-grammar.spec.md` (다중 source 파일).

## 분해 시 E/C/I/S + L/P 전환

문서가 분해되면 먼저 책임을 전환한다:

1. behavior owner이면 `tier: system`으로 둔다.
2. 소비 계약이면 `scope: interface` 문서로 분리한다.
3. data/state/evidence vocabulary이면 `tier: component`로 분리한다.
4. stable id/value이면 `tier: entry` 또는 identity 문서로 분리한다.
5. 조망/배치/pack이면 `tier: layout` + `refs`로 둔다.

`level: group|module|leaf`는 아직 contains 검증에 쓰이는 보조 메타데이터다. 새 authoring 판단은 E/C/I/S + L/P가 우선이다.

## 문서 유형 공존 컨벤션 (7종)

하나의 기능 단위에 대해 여러 유형 파일이 **같은 id로 공존**할 수 있다:

| 파일 | 역할 | 내용 | lifecycle |
|------|------|------|-----------|
| `<id>.spec.md` | 현재 — 구현된 것 | 타입, API, 검증, 소스 참조 | approved |
| `<id>.rule.md` | 소비 규칙 — 사용 시 확인사항 | 체크리스트, 판별 기준, 좌표 매핑 | spec 따름 |
| `<id>.todo.md` | 계획 — 해야 하는 것 | 목표, 기획, 미구현 Phase, 제약 | draft |
| `<id>.test.md` | 검증 — 어떻게 테스트하는가 | 시나리오, 기대 결과, test.ts 참조 | spec 따름 |
| `<id>.memo.md` | 기록 — 왜 이렇게 했는가 | 결정 배경, 대안 검토 | — |
| `<id>.plan.md` | 방향 — 어디로 가는가 | 현재/장기 목표 | — |

### 규칙

1. **구현 완료 시**: `.todo.md`의 해당 항목을 `.spec.md`로 병합하고 `.todo.md`에서 삭제
2. **전부 구현 시**: `.todo.md` 파일 삭제 (`.spec.md`만 남음)
3. **신규 기획 시**: `.todo.md`만 먼저 작성 가능 (코드 없으면 `.spec.md` 불필요)
4. **같은 id**: frontmatter `id`는 동일. 두 파일이 하나의 기능을 다른 시점에서 기술
5. **contains**: 부모 문서는 id 하나만 참조 (두 파일을 개별 참조하지 않음)
6. **같은 stem 유지**: `{id}.spec.md`와 `{id}.todo.md`는 basename이 같아야 scan 단계에서 공존으로 인식된다
7. **test 문서 연결**: `.test.md`는 spec 또는 상위 System/Interface/Behavior 문서의 authored link(`refines`, `depends_on`, 또는 필요한 경우 `contains`)가 있어야 orphan 경고가 나지 않는다

### 예시

```
# 초기 — 기획만
prefix-path-summation.todo.md  ← 계획 전체

# Phase 1~2 구현 완료 후
prefix-path-summation.spec.md  ← 구현된 타입/연산/테스트
prefix-path-summation.todo.md  ← 미구현 Phase 3~5

# 전부 완료
prefix-path-summation.spec.md  ← 전체 스펙
(todo 삭제)
```

### .spec.md에 들어가는 것

- 구현된 타입과 소스 참조
- 검증된 테스트와 커버리지
- 확정된 제약 조건
- 동작하는 API 목록

### .todo.md에 들어가는 것

- 미구현 Phase의 목표와 설계
- 예상 인터페이스 (의사 코드 허용)
- 선행 조건과 의존 관계
- 검토 필요 사항

### 완료된 todo 처리 규칙

- 체크박��가 전부 `[x]`이면:
  1. 코드 참조와 테스트 수를 `.spec.md`의 "소스 코드" 섹션에 병합
  2. `.todo.md` 삭제 (spec이 유일한 진실)
- ��현 요약과 결정 기록을 보존해야 하면 `.memo.md` 또는 knowledge 문서로 전환한��.
- 실제 잔여가 1���이라도 남으면 `.todo.md`에 **��여만** 남긴다.
- `.todo.md`를 `lifecycle: deprecated`로 남기지 않는다 — deprecated는 spec에만 사용.

### rule.md 관리

- `.rule.md`는 종속 spec과 같은 디렉토리에 배치
- spec 변경 시 rule도 함께 갱신 (체크리스트, 판별 기준 drift 방지)
- spec deprecated → rule도 삭제
- rule만 단독 존재 불가 (종속 spec 필수)

## 주의

- 전환 시 코드 경로가 실제로 존재하는지 확인 (파일 + export 이름)
- deprecated 전환은 대체 문서가 있을 때만. 무조건 deprecated하지 않음
- 문서의 가치는 "왜(intent)" — 코드로 옮겨지는 건 "무엇(what)"
- level 변경은 주소에 영향 없음 — 메타데이터 필드
- 인라인 코드 블록 금지 — `docs/specs/system/architecture-revealing-code-convention.rule.md` (구현 후 문서에 코드 사본을 남기지 말고 소스 참조로 전환). CLAUDE.md "코딩 컨벤션" 항목과 동일 맥락.
