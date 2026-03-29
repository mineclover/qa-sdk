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
def find-by-file <파일경로>   # 코드 → 관련 문서
def list --svc=<서비스명>     # 서비스별 문서 전체
```

### 5. 품질 확인

```bash
def audit                     # 문서 품질 + 그래프 검증
def stats                     # scope/layer/level 분포
def link-rules                # LinkType 사용 규칙
```

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
