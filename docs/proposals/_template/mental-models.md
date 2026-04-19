---
status: draft
date: YYYY-MM-DD
part_of: <topic-name>
role: mental-models
supersedes: -
superseded_by: -
---

# <Proposal Name> — Mental Models (읽기 지도)

## 목적
이 제안을 온전히 이해하기 위해 독자가 가져야 할 **구조적 관점(Mental Models)**들을 정의한다. 각 모델은 직교적이며, 독자는 자신의 배경지식에 맞는 모델을 선택해 제안에 접근할 수 있다.

---

## Model 1 — [첫 번째 모델 이름, 예: 구조적 계층]

새로운 제안이 정의하는 핵심 축이나 구조적 분류(Taxonomy) 체계.

### Taxonomy
```
축 이름 ∈ { 값1, 값2, ... }
```

### 각 값의 의미
| 값 | 역할 | 특징 |
|---|---|---|
| 값1 | 역할 설명 | 특징 설명 |

---

## Model 2 — [두 번째 모델 이름, 예: 프로세스/생명주기]

새로운 제안이 기존 시스템의 생명주기나 워크플로우와 어떻게 맞물리는지 설명.

---

## 관점 (Perspective) — 쿼리 및 활용 예시

위에서 정의한 모델들을 조합하여 **어떻게 유의미한 하위 집합(Subset)을 필터링하거나 조회할 수 있는지**를 예시로 보여준다.

### 예시 관점
```text
## Perspective: "[관점 이름]"
filter: 조건 A AND 조건 B
결과: 이 조합이 의미하는 바 (어떤 문서/데이터를 찾게 되는지)
```

---

## 읽는 순서 권장

독자의 배경에 따라 어떤 순서로 이 제안서 패키지를 읽어야 하는지 안내한다.

| 독자 배경 | 권장 읽기 순서 |
|---------|-------------|
| [배경 A] | Model 1 → Model 2 → 00-design |
| [배경 B] | 관점 섹션 → Model 1 |

---

## 연결 문서
- [00-design.md](./00-design.md) — 전체 설계 허브
- [01-migration.md](./01-migration.md) — 마이그레이션 가이드
- [03-decisions.md](./03-decisions.md) — 결정 레지스트리
