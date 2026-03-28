---
def:
  id: dsl-schema-domain-model
  address: def_document:v2:342173
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: qa-sdk-cli
  tags: [tier-system]
  links:
    - target: dsl-schemas-spec
      type: refines
---

# DSL 스키마 도메인 모델

## 목적 ^purpose

Git, K8s, APM signal 도메인이 SchemaSnapshot 안에서 어떤 축과 composite 조합으로 표현되는지 공통 모델을 정리한다.

## 구성 ^overview

- `6종 카테고리 기반 분류`: entity/event/relation/state/policy/observation으로 도메인 축을 분류한다.
- `SchemaAxis 공통 구조`: 모든 도메인이 공유하는 축 정의(axisId, required, multi, valueType)를 기술한다.
- `도메인별 축 패턴`: Git/K8s/APM 각 도메인의 prefix-axis 조합 패턴을 정리한다.
- `composite 사용 원칙`: 개별 축 조합으로 상위 의미를 만드는 규칙과 제한을 명시한다.

## 6종 카테고리 기반 분류

모든 도메인의 prefix는 6종 SchemaCategory 중 하나에 속한다. 카테고리는 도메인이 아니라 **구조 역할(role of structure)** 기준이다 (spec-core/src/schema/schema.types.ts).

| 카테고리 | 역할 | 구조 조건 (CATEGORY_RULES) |
|----------|------|---------------------------|
| entity | 정체성을 가진 것 | 2-6 dims |
| event | 발생한 것 | action 관련 축 필수, 최소 2 dims |
| relation | 둘 이상의 객체 간 연결 | 최소 3 dims |
| state | 상태 스냅샷 | 최소 2 dims |
| policy | 권한/판정 구조 | role/action/resource 축 포함 |
| observation | 관측/추적 | svc_ref(service 참조) 필수 |

category-rules.ts의 `validatePrefixCategory(prefixId, graph)`가 prefix의 카테고리 규칙 준수를 검증한다.

## SchemaAxis 공통 구조

도메인에 무관하게 모든 축은 동일한 SchemaAxis 인터페이스를 따른다:

```typescript
// spec-core/src/schema/schema.types.ts
interface SchemaAxis {
  axisId: string;                      // 축 ID
  required: boolean;                   // 필수 여부
  multi: boolean;                      // 복수 값 허용
  valueType: SchemaValueType;          // "vocabulary" | "ref" | "literal" | "coordinate"
  vocabularyRef?: string;              // vocabulary 축 참조
  defaultValue?: string | number;      // 기본값
}
```

valueType별 의미:
- `vocabulary`: 유한한 엔트리 집합에서 선택 (action, status 등)
- `ref`: 다른 prefix/table/axis 참조 (prefix_ref, table_ref)
- `literal`: 자유 문자열/숫자 (이름, 설명 등)
- `coordinate`: 좌표 값 (정수 주소)

## 도메인별 축 패턴

### Git DSL
- **카테고리**: event (커밋, 푸시, 머지), entity (리포지토리, 브랜치)
- **핵심 축**: git_action (commit/push/merge/rebase), branch_type (main/feature/release)
- **composite**: git_flow_point = git_action + branch_type + repo_ref

### K8s DSL
- **카테고리**: state (파드 상태), observation (헬스체크), event (배포 이벤트)
- **핵심 축**: k8s_resource (pod/deployment/service), k8s_namespace, health_status
- **composite**: k8s_workload = k8s_resource + k8s_namespace + cluster_ref

### APM Signal
- **카테고리**: observation (로그, 메트릭, 트레이스)
- **핵심 축**: record_type (log/span/metric), svc_ref, env (build environment)
- EventRecord의 record_kind 필드가 APM signal의 기본 카테고리를 결정한다.

## composite 사용 원칙

- composite는 개별 축을 조합해 상위 의미를 만드는 용도이며, 도메인별 별도 포맷이 아니라 **공통 PrefixDef 구조**를 따른다.
- 도메인별 차이는 축/entry 집합에서 표현하고, SchemaSnapshot shape 자체는 공유한다.
- 새 도메인 추가 시 기존 6종 카테고리 중 가장 가까운 것을 선택한다. 도메인 전용 카테고리를 만들지 않는다.
- Fragment(HasActor, HasTarget, HasOutcome, Identified)를 재사용하여 도메인 간 공통 구조를 일관되게 유지한다.
