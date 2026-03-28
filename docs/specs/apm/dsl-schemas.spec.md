---
def:
  id: dsl-schemas-spec
  address: def_document:v1:2673
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: deprecated
  layer: domain
  tags: [observability, tier-system]
  links:
    - target: address-context-spec
      type: depends_on
    - target: meta-registry-spec
      type: depends_on
---

# DSL Schemas — Git/K8s/APM Signal 축 정의

## 목적 ^purpose

registry-service의 SchemaSnapshot 형식으로 Git, K8s, APM Signal 도메인 축과 composite를 정의한다.

## 설계 원칙

1. **축은 분류용** — 고카디널리티 값(pod_name, commit_hash, branch_name)은 축이 아닌 **payload**에 배치
2. **53비트 안전 범위** — composite별 `Π capacity`가 `Number.MAX_SAFE_INTEGER` 이내
3. **SchemaSnapshot 호환** — `POST /schema/import` 호환 JSON 형식으로 정의
4. **capacity headroom** — 현재 entries 대비 2~4× 여유. 축 추가 시 마이그레이션 없이 entry만 append
5. **Snapshot Supply** — entry 버전 공급 전략 ([`indexing/conventions.md §5`](../indexing/conventions.md) 참조). composite별로 axis/envelope/context/implicit 중 선택

---

## Snapshot Supply 적용

> 전략 정의, 비교표, 파이프라인 처리는 [`indexing/conventions.md §5`](../indexing/conventions.md)에 정의되어 있다. 이 섹션은 APM DSL에 적용한 구체 사항만 기술한다.

### schema_version 공통 축

axis 전략을 사용하는 composite을 위해 정의. 모든 DSL이 공유한다.

| Axis ID | entries | capacity | 비고 |
|---|---|---|---|
| `schema_version` | `s1` | 32 | axis 전략 composite의 첫 번째 차원 |

---

## Git DSL

### 축 정의

| Axis ID | 설명 | 예시 entries | capacity | 근거 |
|---|---|---|---|---|
| `git_repo` | 저장소 | `qa-sdk`, `frontend`, `backend` | 64 | 조직 내 저장소 수. 중형 조직 기준 ~30개, 2× headroom |
| `git_branch_type` | 브랜치 분류 | `main`, `feature`, `release`, `hotfix` | 8 | enum. 분류 유형 고정적 |
| `git_change_type` | 변경 유형 (Conventional Commits) | `feat`, `fix`, `refactor`, `docs`, `test`, `chore` | 8 | cc_type 축 재사용. 카테고리 안정 |
| `git_file_scope` | 파일 범위 (패키지/디렉토리) | `weighted-index`, `ingest-server`, `core` | 64 | 모노레포 패키지 수. qa-sdk 기준 ~15, 4× headroom |
| `git_author` | 작성자 (pseudonymized) | `author_a1b2`, `author_c3d4` | 256 | PII 회피. 해시 토큰으로 저장 |

### Composite 정의

| Composite ID | Dims | snapshotSupply | 총 capacity |
|---|---|---|---|
| `git_commit_addr` | [`git_repo`, `git_branch_type`, `git_change_type`, `git_file_scope`] | `envelope` | 64 × 8 × 8 × 64 = **262,144** |
| `git_build_addr` | [`git_repo`, `git_branch_type`, `git_file_scope`] | `implicit` | 64 × 8 × 64 = **32,768** |

> git_commit_addr는 커밋별 entry snapshot 추적 필요 → envelope. git_build_addr는 CI 빌드 주소로 snapshot 구분 불필요 → implicit.

### Bit Budget 검증

- `git_commit_addr`: 262,144 = 2^18 → **18비트** (53비트 한계 내)
- `git_build_addr`: 32,768 = 2^15 → **15비트**

### SchemaSnapshot JSON

```json
{
  "id": "git-dsl-v1",
  "axes": [
    { "id": "schema_version", "entries": ["s1"], "capacity": 32 },
    { "id": "git_repo", "entries": ["qa-sdk", "frontend", "backend"], "capacity": 64 },
    { "id": "git_branch_type", "entries": ["main", "feature", "release", "hotfix"], "capacity": 8 },
    { "id": "git_change_type", "entries": ["feat", "fix", "refactor", "docs", "test", "chore"], "capacity": 8 },
    { "id": "git_file_scope", "entries": ["weighted-index", "ingest-server", "core", "engine", "store"], "capacity": 64 },
    { "id": "git_author", "entries": [], "capacity": 256 }
  ],
  "composites": [
    { "id": "git_commit_addr", "dims": ["git_repo", "git_branch_type", "git_change_type", "git_file_scope"], "owner": "git-dsl-v1", "snapshotSupply": { "type": "envelope" } },
    { "id": "git_build_addr", "dims": ["git_repo", "git_branch_type", "git_file_scope"], "owner": "git-dsl-v1", "snapshotSupply": { "type": "implicit" } }
  ]
}
```

---

## K8s DSL

### 축 정의

| Axis ID | 설명 | 예시 entries | capacity | 근거 |
|---|---|---|---|---|
| `k8s_cluster` | 클러스터 | `prod-east`, `prod-west`, `staging`, `dev` | 32 | 느린 성장. 대형 조직 기준 ~10개, 3× headroom |
| `k8s_namespace` | 네임스페이스 | `default`, `monitoring`, `production`, `kube-system` | 128 | 클러스터당 ~30개, 중간 빈도 변동 |
| `k8s_workload_type` | 워크로드 종류 | `deployment`, `statefulset`, `daemonset`, `job`, `cronjob` | 8 | K8s 워크로드 리소스 타입. enum, 안정적 |
| `k8s_service` | 서비스/배포명 | `gateway`, `auth-server`, `user-api`, `payment` | 256 | 높은 카디널리티. 대형 클러스터 ~100개 서비스, 2.5× headroom |
| `k8s_node_pool` | 노드 풀 분류 | `general`, `compute`, `memory`, `gpu` | 16 | 인프라 티어. 클라우드 인스턴스 계열 기반 |

### Composite 정의

| Composite ID | Dims | snapshotSupply | 총 capacity |
|---|---|---|---|
| `k8s_workload_addr` | [`schema_version`, `k8s_cluster`, `k8s_namespace`, `k8s_workload_type`, `k8s_service`] | `axis` (capacity=32) | 32 × 32 × 128 × 8 × 256 = **268,435,456** |
| `k8s_infra_addr` | [`k8s_cluster`, `k8s_node_pool`, `k8s_workload_type`] | `implicit` | 32 × 16 × 8 = **4,096** |

> k8s_workload_addr는 크로스-버전 분석이 핵심 → axis. k8s_infra_addr는 인프라 뷰로 snapshot 구분 불필요 → implicit.

### Bit Budget 검증

- `k8s_workload_addr`: 268,435,456 = 2^28 → **28비트** (53비트 한계 내)
- `k8s_infra_addr`: 4,096 = 2^12 → **12비트**

### SchemaSnapshot JSON

```json
{
  "id": "k8s-dsl-v1",
  "axes": [
    { "id": "schema_version", "entries": ["s1"], "capacity": 32 },
    { "id": "k8s_cluster", "entries": ["prod-east", "prod-west", "staging", "dev"], "capacity": 32 },
    { "id": "k8s_namespace", "entries": ["default", "monitoring", "production", "kube-system"], "capacity": 128 },
    { "id": "k8s_workload_type", "entries": ["deployment", "statefulset", "daemonset", "job", "cronjob"], "capacity": 8 },
    { "id": "k8s_service", "entries": ["gateway", "auth-server", "user-api", "payment"], "capacity": 256 },
    { "id": "k8s_node_pool", "entries": ["general", "compute", "memory", "gpu"], "capacity": 16 }
  ],
  "composites": [
    { "id": "k8s_workload_addr", "dims": ["schema_version", "k8s_cluster", "k8s_namespace", "k8s_workload_type", "k8s_service"], "owner": "k8s-dsl-v1", "snapshotSupply": { "type": "axis", "capacity": 32 } },
    { "id": "k8s_infra_addr", "dims": ["k8s_cluster", "k8s_node_pool", "k8s_workload_type"], "owner": "k8s-dsl-v1", "snapshotSupply": { "type": "implicit" } }
  ]
}
```

---

## APM Signal

### 축 정의

| Axis ID | 설명 | entries | capacity | 근거 |
|---|---|---|---|---|
| `apm_signal_type` | 신호 종류 | `log`, `span`, `metric`, `event` | 8 | OpenTelemetry 3 signal + custom event. 확장 headroom |
| `apm_severity` | 심각도 | `trace`, `debug`, `info`, `warn`, `error`, `fatal` | 8 | 표준 로그 레벨. 안정 |

### Cross-Domain Composite

| Composite ID | Dims | snapshotSupply | 총 capacity |
|---|---|---|---|
| `apm_k8s_signal` | [`k8s_workload_addr`, `apm_signal_type`, `apm_severity`] | 상위 composite(k8s_workload_addr)의 axis 전략 상속 | 268,435,456 × 8 × 8 = **17,179,869,184** |

### Bit Budget 검증

- `apm_k8s_signal`: 17,179,869,184 ≈ 2^34 → **34비트** (53비트 한계 내)
- k8s_workload_addr가 axis 전략이므로 schema_version이 내포됨 → cross-domain composite에서도 version 필터 자연스럽게 동작

> `k8s_workload_addr`를 이미 인코딩된 1D 정수로 취급하면 composite 중첩이 가능하다. registry-service의 composite ref 메커니즘으로 구현.

---

## Payload 배치 기준

축에 넣지 않고 **payload**로 처리하는 고카디널리티 값:

| 필드 | 이유 |
|---|---|
| `pod_name` | 노드 스케일링/재배포마다 변경. 카디널리티 무한 |
| `container_id` | Pod 재시작마다 변경 |
| `commit_hash` | 커밋마다 고유. 축 공간 낭비 |
| `branch_name` | feature 브랜치 수 무한. `branch_type`으로 분류 |
| `file_path` | 파일 경로 무한. `file_scope`(패키지)로 분류 |
| `user_email` | PII. 축 노출 부적절 |
| `request_id` / `trace_id` | 요청당 고유. 기존 trace context로 관리 |

---

## 축 공유 및 재사용

- `git_change_type`은 기존 `qa-sdk-git` 프리셋의 `cc_type` 축과 동일한 entry set 사용
- `k8s_service`는 기존 `shopping-platform` 프리셋의 `svc_name`과 유사하나 capacity를 256으로 확장
- 축 ID는 도메인 prefix(`git_`, `k8s_`, `apm_`)로 네임스페이스 충돌 방지

## 버전 관리

### snapshotSupply별 버전 운영

| 전략 | Minor Version (entry append) | Major Version (capacity 변경) |
|---|---|---|
| **axis** | schema_version 축에 entry append (s1→s2). stride 불변. 크로스-버전 Range Query 가능 | v 세그먼트 변경 (v1→v3). stride 변경. 마이그레이션 필요 |
| **envelope** | entry_snapshot 필드 값 변경 (s1→s2). 주소 불변 | v 세그먼트 변경. 마이그레이션 필요 |
| **implicit** | 추적 없음 | v 세그먼트 변경. 마이그레이션 필요 |

### axis 전략: 크로스-버전 Range Query

k8s_workload_addr (axis 전략) 예시:

```typescript
// "s1과 s2 모두에서 prod-east의 deployment"
calcAddressRanges(shape, [
  { positions: [1, 2] },    // schema_version = s1 OR s2  ← 네이티브!
  { positions: [1] },       // k8s_cluster = prod-east
  { positions: null },       // k8s_namespace = wildcard
  { positions: [1] },       // k8s_workload_type = deployment
  { positions: null },       // k8s_service = wildcard
]);
```

### envelope 전략: snapshot 필터

git_commit_addr (envelope 전략) 예시:

```sql
SELECT * FROM event_records
WHERE address_context->>'git_commit_addr' BETWEEN 'git_commit_addr:v1:100' AND 'git_commit_addr:v1:200'
  AND entry_snapshot = 's2'
```
