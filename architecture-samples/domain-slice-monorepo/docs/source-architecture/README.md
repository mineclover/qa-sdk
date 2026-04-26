# Source Architecture References

This folder keeps the original architecture references and the current
Domain Slice Architecture adaptation side by side.

## Layout

| Folder | Purpose |
|---|---|
| `raw/` | Unmodified copies from `/Users/junwoobang/document/아키텍처` |
| `current/` | Updated references aligned to the current scaffold, sample monorepo, and Responsibility Topology |

## Current References

| Current doc | Source focus |
|---|---|
| [README.md](current/README.md) | shared terms, slice boundary, responsibility topology, read model vs BFF |
| [01-domain-slice-reference.md](current/01-domain-slice-reference.md) | backend manifesto, domain module standard, CQRS diagram |
| [02-command-query-contracts.md](current/02-command-query-contracts.md) | write model, read model, OpenAPI/interface contracts |
| [03-transaction-events-cache.md](current/03-transaction-events-cache.md) | outbox, saga, transaction API, cache key DSL |
| [04-governance-logging-testing-bff.md](current/04-governance-logging-testing-bff.md) | OpenMetadata, logging/error conventions, tests, BFF/read model boundary |

## Raw To Current Mapping

`current/` is not a one-to-one rewrite of `raw/`. It is the smaller,
implementation-oriented maintenance set. Raw documents remain as preserved
source material; current documents consolidate duplicate concepts and point to
the scaffold specs when the rule is now enforced by code.

| Raw source | Current maintenance target | Scaffold/system target | Status |
|---|---|---|---|
| `백엔드-시스템-아키텍처-및-구현-세부-정의서.md` | `current/01-domain-slice-reference.md`, `current/README.md` | `docs/specs/scaffold/scaffold-system.spec.md` | consolidated |
| `도메인-계층-구조-및-모듈-설계-표준.md` | `current/01-domain-slice-reference.md`, `current/README.md` | `docs/specs/scaffold/scaffold-domain-development-convention.rule.md` | consolidated |
| `표준-컨벤션-CQRS-데이터-흐름-다이어그램.md` | `current/02-command-query-contracts.md`, `current/03-transaction-events-cache.md` | `docs/specs/scaffold/scaffold-domain-schematic.spec.md` | consolidated |
| `Write-Model-및-Command-인터페이스-명세서.md` | `current/02-command-query-contracts.md`, `current/03-transaction-events-cache.md` | `docs/specs/scaffold/scaffold-domain-development-convention.rule.md` | consolidated |
| `Read-Model-및-조회-인터페이스-명세서.md` | `current/02-command-query-contracts.md`, `current/04-governance-logging-testing-bff.md` | `docs/specs/scaffold/scaffold-cache-key-dsl.spec.md` | consolidated |
| `Saga-트랜잭션-및-이벤트-처리-명세서.md` | `current/03-transaction-events-cache.md` | `docs/specs/scaffold/scaffold-domain-development-convention.rule.md` | consolidated |
| `데이터-거버넌스-및-메타데이터-관리-전략.md` | `current/04-governance-logging-testing-bff.md` | `docs/specs/scaffold/scaffold-governance-metadata.spec.md`, `docs/specs/scaffold/scaffold-openmetadata-storage.spec.md` | consolidated |
| `메타데이터-태깅-및-데이터-품질-구현-규약.md` | `current/04-governance-logging-testing-bff.md` | `docs/specs/scaffold/scaffold-governance-metadata.spec.md` | consolidated |
| `공통-예외-처리-및-에러-응답-규약.md` | `current/04-governance-logging-testing-bff.md` | `docs/specs/scaffold/scaffold-domain-development-convention.rule.md` | consolidated |
| `계층별-테스트-전략-및-규약.md` | `current/04-governance-logging-testing-bff.md` | `docs/specs/scaffold/scaffold-domain-development-convention.rule.md`, `docs/specs/scaffold/scaffold-architecture-validator.spec.md` | consolidated |
| `테스트-용이성-규약.md` | `current/04-governance-logging-testing-bff.md` | `docs/specs/scaffold/scaffold-template-catalog.spec.md`, `docs/specs/scaffold/scaffold-architecture-validator.spec.md` | consolidated |

## Maintenance Rule

- Do not edit files under `raw/`; refresh them only when the original source
  folder intentionally changes.
- Update `current/` when terminology, scenario shape, or implementation guidance
  changes.
- Update `docs/specs/scaffold/` when the rule is enforced by scaffold templates,
  CLI commands, validators, or tests.
- If a raw concept is not carried forward, record the reason in this README
  rather than deleting the raw source.
