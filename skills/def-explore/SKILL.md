---
name: def-explore
description: "qa-sdk 시스템 구조와 문서 체계를 탐색하고 이해한다. 시스템 철학, 분해 레벨, 분류 체계, 서비스 구조를 안내한다."
---

# Definition Explore — 시스템 이해 가이드

시스템 구조와 문서 체계를 이해하기 위한 탐색 도구.

## 진입점

```bash
qa-sdk def guide                # 시스템 전체 구조 안내
qa-sdk def guide concepts       # 핵심 개념 (좌표, prefix, 축)
qa-sdk def guide classification # 문서 분류 체계 (scope, level, layer)
qa-sdk def guide services       # 서비스 구조 (6개 인프라 + 보조)
qa-sdk def guide philosophy     # 시스템 철학
qa-sdk def concepts             # knowledge/concept 문서 목록
```

## 탐색 경로

### 1. 전체 구조 파악

```bash
def list --level=group        # 그룹 (묶임의 이유)
def list --level=module       # 모듈 (단일 개념 + 구성)
def children <group-id>       # 그룹 내 모듈/하위 그룹 목록
```

### 2. 핵심 개념 이해

```bash
def get system-concepts       # 이벤트, 좌표, 축, Prefix 기본 개념
def get definition-taxonomy   # 문서 분류 체계 전체 (scope/aspect/depth/level/layer)
def get definition-level      # 분해 레벨 설계 근거 (왜 level이 필요한가)
def get definition-addressing # 주소 체계 (이중 관리: address + id)
def concepts                  # concept 문서만 모아서 조회
def search "철학"             # 시스템 철학 문서
```

### 3. 서비스 탐색

```bash
def children system-infra     # 인프라 서비스 6개
def children system-support   # 보조 서비스 (권한, APM, 가이드)
def get <service-id>          # 서비스 상세 (children/links/purpose)
def topdown <service-id>      # 서비스 내부 문서 조립
def context <service-id>      # 소속/의존/영향 컨텍스트
```

### 4. 코드 연결

```bash
def find-by-file <파일경로[:symbol]>   # 코드 → 관련 문서
def body <문서ID>            # 최신 본문 전체 확인
def list --svc=<서비스명>     # 서비스별 문서 전체
```

`def find-by-file`는 DB의 `code_references`만 사용한다.
입력은 문서 frontmatter `source:`와 코드 주석 `@def.boundary[#symbol]`, `@def.doc[#symbol]`이며, `qa-sdk def sync` 이후에만 반영된다.
결과가 없으면 아직 구조적 code-boundary-map이 정의되지 않은 것이다.

### 5. Meta-Semantic IR 탐색

```bash
def get meta-semantic-system    # 시스템 전체 (group, 15 members)
def get meta-semantic-ir        # IR 3종 모듈 (Module·Data·Pipe)
def children meta-semantic-ir   # IR 하위: pipe/data/module/rule/usecases
def get meta-semantic-extraction # LLM 기반 코드 추출 파이프라인
```

IR 코드: `packages/core/src/meta-semantic/` (11 source files, 124 tests)

문서 유형 7종: `.spec.md`(정의) / `.rule.md`(소비 규칙) / `.todo.md`(계획) / `.test.md`(검증) / `.cases.md`(시나리오) / `.memo.md`(기록) / `.plan.md`(방향)

### 6. 추적 3축 + 격리 테스트

```bash
def get tracking-three-axes     # 이벤트 × 패싯 × 데이터 분류 3축
def get facet-test-isolation    # 패싯 추출 + 격리 테스트 인프라
```

추적 3축:
- 이벤트 (유저 시나리오) — event-catalog, prefix-mapping
- 패싯 (데이터 계보) — DataIR 4패싯, pipe-lineage
- 데이터 분류 (core vs UX) — DefLayer (domain/experience)

격리 테스트:
- `qa-sdk facet scan --service {svc}` → `@facet` 파일 + 의존 분석
- `qa-sdk facet inject {dir}` → 복사본에 export 주입
- `facet-tests/` (단위), `simulation-tests/` (통합)

### 7. 품질 확인

```bash
def audit                     # 문서 품질 + 그래프 검증
def stats                     # scope/layer/level 분포
def link-rules                # LinkType 사용 규칙
```

### 8. 도메인 기준 필터

링크 그래프 기반으로 파생된 `domain_root`를 필터로 삼아 도메인 단위 탐색을 수행한다.

```bash
# 도메인 루트 식별
def audit --by-domain

# 특정 도메인의 모든 문서 (id 정렬)
def list --domain-root <rootId>

# 특정 도메인의 일부만 (include-children 없이 상위 aspect 한정)
def list --domain-root <rootId> --aspect <aspect>

# 특정 문서의 파생 root + owner_system 정합성
def context <docId>
```

권장 진입 패턴: `def audit --by-domain`에서 상위 루트 → `def list --domain-root <rootId>`로 멤버 훑기 → `def context <docId>`로 개별 문서 컨텍스트. owner_system과 파생 root가 어긋나면 컨텍스트 출력 끝에 `⚠ owner_system ... 과 파생 root ... 불일치` 경고가 붙는다.

### 9. Aspect family + 소스 확장자 필터 (Phase C-2, Gap 3)

```bash
# aspect family rollup (self + 하위 descendants 자동 전개)
def list --aspect func_def --include-children   # func_def + 10 후손 aspect 통합 조회
def audit --rollup-aspect                       # root aspect 별 전체 rollup

# 소스 확장자 필터 — `.rule.md`, `.cases.md`, `.test.md`
def list --type=rule                            # *.rule.md 만 (현재 19건)
def list --type=cases                           # *.cases.md — consumer 기대 시나리오
def list --type=test                            # *.test.md — provider 계약 문서
def list --ext=rule                             # --type=rule 과 동치 (명시형)
```

`--type={rule|cases|test|todo|plan|memo}` 는 `source_path` 기반 파일 확장자 필터다 (doc_type 컬럼이 아님). `--type={spec|knowledge|design}` 은 기존 `doc_type` 컬럼 필터 — backcompat 유지.

system-wide rule 인덱스: `docs/specs/system/README.md` — 9 건의 rule.md 가 테이블로 정리되어 있다.

## 핵심 개념 요약

### 분해 레벨 (level)
group → module → leaf. 3단계 모델. scope보다 상위 개념.
- group: "왜 이것들이 함께 있는가?" — 묶임의 이유
- module: "이 개념은 무엇인가?" — 단일 개념 + 구성 참조
- leaf: "이 구성 요소는 어떻게 동작하는가?" — 최종 명세 (기본값)

### 분류 (scope)
ui, feature, flow, state, constraint, data, interface. "이 단위는 어떤 종류인가?"

### 존재 이유 (layer)
domain(본질), operation(인프라), mediation(중재), experience(경험). "왜 존재하는가?"

### 관계 (link_type)
contains(소속), depends_on(의존), implements(구현), refines(구체화), constrains(제약), traces_to(추적)

### 주소 (address)
불변 정수 식별자. id(kebab-case)는 표시 라벨. 이중 관리.

## 이 스킬을 사용할 때

- 사용자가 "시스템이 뭐야", "구조 설명해줘", "어디서 시작해" 같은 질문을 할 때
- 새로운 기여자가 프로젝트를 이해하려 할 때
- 특정 개념(scope, level, 좌표)의 의미를 물을 때
- CLI 도구 사용법을 물을 때

항상 CLI 커맨드를 실행하여 **실제 데이터 기반**으로 답한다. 문서 내용을 암기에서 답하지 않는다.
