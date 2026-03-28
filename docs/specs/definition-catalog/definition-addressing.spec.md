---
def:
  id: definition-addressing
  level: leaf
  address: def_document:v2:342161
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: draft
  layer: domain
  svc: definition-service
  tags: [entry-point, tier-system]
  links:
    - target: definition-taxonomy
      type: refines
---
# Definition Addressing — 문서 주소 체계

## 목적 ^purpose

문서마다 유일한 정수 주소를 부여하여, 주소가 곧 불변 식별자가 되게 한다. kebab-case id는 사람이 읽는 라벨로 전환하고, 링크/참조/저장은 주소 기반으로 통합한다.

## 설계 근거 ^intent

### 현재 문제

```
id="gate-api"       address="def_document:v1:537"
id="record-spec"    address="def_document:v1:537"   ← 같은 주소!
```

address = scope×aspect×depth로 계산되므로 같은 유형 문서 79건이 같은 주소를 공유. 주소가 분류용이지 식별용이 아님.

### 변경 후

```
id="gate-api"       address="def_document:v1:142"   ← 유일!
id="record-spec"    address="def_document:v1:283"   ← 유일!
```

주소 공간에 문서 엔트리(doc_entry) 축을 추가하여, 같은 scope×aspect×depth 내에서도 각 문서가 고유 주소를 가진다.

## 이중 관리 원칙

| 역할 | 필드 | 특성 |
|------|------|------|
| **불변 식별자** | `address` (정수) | 한번 부여되면 절대 변경 안 됨. 링크/참조/저장의 앵커 |
| **표시 라벨** | `id` (kebab-case) | 사람이 읽는 이름. 변경 가능 (rename 시 주소는 유지) |

### 참조 방식

```yaml
# 현재: id로 참조 (id 변경 시 깨짐)
links:
  - target: gate-api
    type: depends_on

# 변경: 주소로 참조 (id 변경해도 안 깨짐)
# frontmatter에는 id로 작성 → DB 저장 시 주소로 변환
links:
  - target: gate-api          # 작성 시 id 사용 (사람이 읽기 위해)
    type: depends_on
    # DB에는 target_address: 142 로 저장
```

## 주소 공간

```
현재:  scope(16) × aspect(64) × depth(8) = 8,192
변경:  scope(16) × aspect(64) × depth(8) × doc_seq(128) = 1,048,576
```

doc_seq = 같은 scope×aspect×depth 내 순번. capacity 128이면 같은 유형에 최대 128건.

## 마이그레이션

1. 기존 548건에 유일 주소 부여 (scope×aspect×depth×seq로 재계산)
2. 기존 id 기반 링크를 주소 기반으로 변환 (id → address 매핑 테이블)
3. frontmatter의 address 필드 업데이트
4. id는 표시용으로 유지 (frontmatter에 그대로)

## 제약 조건 ^constraint

- 주소는 한번 부여되면 변경 불가
- 같은 scope×aspect×depth×seq 조합은 시스템 전체에서 유일
- id(라벨) 변경 시 주소는 유지
- 문서 삭제 시 주소는 재사용하지 않음 (tombstone)
