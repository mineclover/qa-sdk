---
def:
  id: pipe-flow-catalog
  level: module
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: domain
  tags: [cross-scope]
  links:
    - target: meta-semantic-pipe-catalog
      type: refines
    - target: pipe-types
      type: refines
    - target: pipe-flow-visual-semantics
      type: contains
    - target: pipe-flow-topology
      type: contains
    - target: pf-step
      type: contains
    - target: pf-sequence
      type: contains
    - target: pf-branch
      type: contains
    - target: pf-optional
      type: contains
    - target: pf-parallel
      type: contains
    - target: pf-race
      type: contains
    - target: pf-await
      type: contains
    - target: pf-retry
      type: contains
    - target: pf-fallback
      type: contains
    - target: pf-circuit-breaker
      type: contains
    - target: pf-loop
      type: contains
    - target: pf-feedback
      type: contains
    - target: pf-compensate
      type: contains
    - target: pipe-transition-scope
      type: contains
    - target: pf-emit
      type: contains
    - target: pf-finally
      type: contains
    - target: pf-timeout
      type: contains
    - target: pf-map
      type: contains
    - target: pf-reduce
      type: contains
    - target: pf-buffer
      type: contains
    - target: pf-filter
      type: contains
    - target: pf-throttle
      type: contains
    - target: pf-debounce
      type: contains
    - target: pf-split
      type: contains
    - target: pf-enrich
      type: contains
    - target: pf-tap
      type: contains
    - target: pf-resequence
      type: contains
    - target: pf-window
      type: contains
    - target: pf-dedup
      type: contains
    - target: pf-correlation
      type: contains
---

# PipeFlow 카탈로그 — 30종 표현·정의·검증·시각 방식

## 목적 ^purpose

PipeFlow 30종 각각의 표현 방식, 정의 방식, 검증 방식, 시각 표현을
카탈로그 관점에서 정리한다.
개별 flow kind의 상세는 각 `pf-*` 문서와 `pipe-transition-scope`가 책임진다.

## 방법 ^method

이 문서는 runtime flow를 직접 실행하는 구현 문서가 아니라
flow kind taxonomy를 정리하는 카탈로그 문서다. 자식 leaf가 `feature/func_def`여도,
상위 module은 "어떤 kind가 존재하고 어떻게 분류되는가"를 다루므로 `data/domain_data`를 유지한다.

## ^overview

`pipe-flow-catalog`은 크게 세 층으로 나뉜다.

- `pipe-flow-visual-semantics`
  각 kind의 기본 role / concerns / 색상 규칙을 정의한다.
- `pipe-flow-topology`
  flow kind를 fold topology 14종으로 묶어 "어떤 합성 형태를 외부에 노출하는가"를 설명한다.
- 개별 flow leaf
  `pf-*`와 `pipe-transition-scope`가 각 kind의 표현, 정의, 검증, 경로 계산을 설명한다.

## 위임 ^delegates

| 영역 | 하위 문서 |
|------|-----------|
| 시각 의미론 | `pipe-flow-visual-semantics` |
| topology 분류 | `pipe-flow-topology` |
| 기본 | `pf-step`, `pf-sequence` |
| 분기 | `pf-branch`, `pf-optional` |
| 동시성 | `pf-parallel`, `pf-race`, `pf-await` |
| 내결함/안정화 | `pf-retry`, `pf-fallback`, `pf-circuit-breaker`, `pf-timeout`, `pf-throttle`, `pf-debounce` |
| 반복/제어 | `pf-loop`, `pf-feedback`, `pf-finally` |
| 트랜잭션 | `pf-compensate`, `pipe-transition-scope` |
| 비동기/관측 | `pf-emit`, `pf-tap` |
| 배치/변환 | `pf-map`, `pf-reduce`, `pf-buffer`, `pf-filter`, `pf-split`, `pf-enrich` |
| 스트리밍/상태 | `pf-resequence`, `pf-window`, `pf-dedup`, `pf-correlation` |

## family 개요

| family | 포함 flow |
|--------|-----------|
| 기본 | `step`, `sequence` |
| 분기 | `branch`, `optional` |
| 동시성 | `parallel`, `race`, `await` |
| 내결함/안정화 | `retry`, `fallback`, `circuit-breaker`, `timeout`, `throttle`, `debounce` |
| 반복/제어 | `loop`, `feedback`, `finally` |
| 트랜잭션 | `compensate`, `transition-scope` |
| 비동기/관측 | `emit`, `tap` |
| 배치/변환 | `map`, `reduce`, `buffer`, `filter`, `split`, `enrich` |
| 스트리밍/상태 | `resequence`, `window`, `dedup`, `correlation` |

## 소비 ^consumes

- `pipe-types` — flow kind 타입 정의의 SSOT
- `pipe-static-lineage` — flow kind별 계보 해석과 연결
- `pf-*`, `pipe-transition-scope` — 개별 kind의 상세 계약
