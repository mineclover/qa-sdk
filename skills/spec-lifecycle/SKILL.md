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

### 3단계: 검증 — drift 점검

```bash
# 문서에 남은 코드 블록이 있는지 확인
qa-sdk def check <문서ID>

# 전체 감사
qa-sdk def audit
```

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

```markdown
## 관련 소스

- `packages/<pkg>/src/types.ts` — 핵심 타입 (ContractEvidence, DriftReport)
- `packages/<pkg>/src/collector.ts:createSpecTracker` — 수집기 팩토리
- `packages/<pkg>/src/routes.ts:POST /sync` — 동기화 엔드포인트
```

## 분해 시 level 전환

문서가 분해(하위 문서 생성)되면 level을 전환한다:

```
1. leaf → module로 변경 (하위 문서를 가지게 됨)
2. contains 링크로 하위 문서 연결
3. 주소는 불변 (level은 좌표에 포함하지 않음)
```

예: `record-spec`(leaf)이 분해되면:
```yaml
# record-spec.md — level: leaf → module로 변경
def:
  id: record-spec
  level: module          # leaf에서 변경
  scope: data
  aspect: domain_data
  links:
    - target: record-schema
      type: contains
    - target: record-validation
      type: contains
```

## 문서 유형 공존 컨벤션 (6종)

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
7. **test 문서 연결**: `.test.md`는 spec 또는 상위 module의 authored link(`refines` 또는 `contains`)가 있어야 orphan 경고가 나지 않는다

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
- CLAUDE.md 컨벤션 14: 인라인 코드 블록 금지 원칙과 동일 맥락
