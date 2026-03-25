---
name: def-topdown
description: "definition-catalog 탑다운 조회. 시스템/그룹에서 시작하여 멤버 문서의 purpose/overview를 scope 순서로 조립한다."
---

# Definition Catalog — 탑다운 조회

시스템/그룹 문서에서 시작하여 contains 멤버의 purpose/overview를 수집하고, scope 순서(constraint → state → data → feature → flow → interface → ui)로 조립한다.

## 사용법

```
/def-topdown <그룹ID>
```

예: `/def-topdown gate-system`, `/def-topdown ingest-system`, `/def-topdown system-root`

## 절차

### 1단계: 그룹 문서 찾기

```bash
grep -rl "depth: overview" docs/specs/ | xargs grep -l "type: contains"
```

### 2단계: contains 멤버 수집

```bash
awk '/^  links:/,/^---/{if(/target:/)t=$NF; if(/type: contains/)print t}' <그룹파일>
```

### 3단계: 각 멤버의 ^purpose 섹션 수집

`## 목적 ^purpose` 헤더 아래 ~ 다음 `##` 전까지 본문 추출.

### 4단계: scope 순서로 정렬

```
constraint → state → data → feature → flow → interface → ui
```

"제약 → 상태 → 데이터 → 기능 → 흐름 → 접근"의 자연스러운 설명 순서.

### 5단계: 출력

```
# <그룹 제목>
<그룹 purpose>
concerns: <tags>

## [constraint] <제목>
<purpose>

## [state] <제목>
<purpose>
...
```

## 사용 가능한 그룹 (system-root 하위)

ingest-system, gate-system, df-system, pipeline-system, permission-system, decode-system, query-system, registry-system, dkg-system, wi-system, cq-system, browser-system, spec-engine-system, indexing-core-system, index-meta-system, viz-system, apm-system, storage-system, event-vocab-system, guides-system, analysis-system
