---
def:
  id: spec-arch-group
  address: def_document:v1:2136
  scope: constraint
  aspect: tech_constraint
  depth: overview
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [structural, tier-system]
  links:
    - target: spec-arch-layers
      type: contains
    - target: spec-arch-nestjs
      type: contains
    - target: spec-arch-interceptors
      type: contains
---

# Spec Engine 아키텍처

## 목적 ^purpose

spec-engine의 계층 분리 원칙, NestJS 모듈 구성, Decorator/Interceptor 설계.

## 구성 ^overview

- `spec-arch-layers`: spec-engine의 계층 분리 원칙.
- `spec-arch-nestjs`: NestJS 모듈 구성과 의존 그래프.
- `spec-arch-interceptors`: Decorator와 Interceptor 설계.

| 문서 | 핵심 |
|------|------|
| [spec-arch-layers](spec-arch-layers.spec.md) | core → adapter → service 계층 분리 원칙 |
| [spec-arch-nestjs](spec-arch-nestjs.spec.md) | NestJS 모듈 구성과 의존 그래프 |
| [spec-arch-interceptors](spec-arch-interceptors.spec.md) | Decorator와 Interceptor 설계 |
