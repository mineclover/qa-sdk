# Domain Slice Architecture Reference

## Source Mapping

This document adapts:

- `raw/백엔드-시스템-아키텍처-및-구현-세부-정의서.md`
- `raw/도메인-계층-구조-및-모듈-설계-표준.md`
- `raw/표준-컨벤션-CQRS-데이터-흐름-다이어그램.md`

## Shared Baseline

The canonical name, slice folder boundary, Responsibility Topology, and
dependency direction are defined in [README.md](README.md). This document only
adds the expansion rule for applying that baseline.

## Expansion Rule

Do not split a slice only because folders are growing. Split when ownership or
runtime scaling changes:

- independent aggregate lifecycle
- independent read model projector
- independent BFF/UI composition cadence; see [README.md](README.md#read-model-vs-bff)
- independent worker/scaling profile
- separate OpenMetadata owner or data quality policy
