---
name: spec-lifecycle
description: "스펙 문서 생명주기 관리. 설계→구현→검증 단계별 문서 상태 전이, 구현 완료 후 코드 참조 전환, drift 점검을 수행한다."
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

## 주의

- 전환 시 코드 경로가 실제로 존재하는지 확인 (파일 + export 이름)
- deprecated 전환은 대체 문서가 있을 때만. 무조건 deprecated하지 않음
- 문서의 가치는 "왜(intent)" — 코드로 옮겨지는 건 "무엇(what)"
- level 변경은 주소에 영향 없음 — 메타데이터 필드
- CLAUDE.md 컨벤션 14: 인라인 코드 블록 금지 원칙과 동일 맥락
