# @qa-sdk/store — Specs

core 포트를 구현하는 저장소 어댑터. Drizzle/PostgreSQL + In-Memory.

## 진입점별 스펙

| 스펙 | 설명 | 상태 |
|---|---|---|
| [schema.spec.md](schema.spec.md) | PostgreSQL 테이블 스키마 | implemented |
| [adapters.spec.md](adapters.spec.md) | 8개 포트의 Drizzle + Memory 구현체 (DlqStore, CleanupStore 포함) | implemented |
