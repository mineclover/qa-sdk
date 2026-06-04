---
id: GOV-PRD-20260527-SCOPE-DSL
type: PRDDocument
title: "Test DSL Spec"
date: 2026-05-27
scope: SCOPE-DSL
lifecycle:
  state: active
  created_at: 2026-05-27
  updated_at: 2026-05-27
tags: ["test","dsl"]
refs: []
---

# PRD: Test DSL Spec

## 목적 ^purpose
이 사양 문서는 SCOPE-DSL 범위 하위 요구사항 및 구현 스펙을 정의합니다.

## 1. 핵심 요구사항
* R-1: 아키텍처 문서화 폴더 구조를 초기화하는 기능 지원.
* R-2: 명명 규칙과 시퀀스(NNN) 자동 추적을 포함하는 템플릿 문서 생성.
* R-3: JSON Schema 및 14가지 의미적 규칙을 완전히 보장하는 검증.

## 2. 검증 기준 (Verification Criteria)
* VC-1: \`archi validate\` 통과율 100% 만족.
* VC-2: 타임라인에 누락된 세션 문서가 없는지 여부 확인.
