# Plans

각 버전의 구현 계획 + task 분해.

| 버전 | 핵심 |
|------|------|
| [v0.1](./v0.1.md) | T-0~T-10: 라이브러리 + 도그푸딩 (T-10 CLI는 분리) |
| [v0.2](./v0.2.md) | T-A~T-D: I-1~I-4 fix + 확장 + CLI + lesson-builder |
| [v0.3](./v0.3.md) | T-E1~T-E5: walkByCoordinate + doctor + AST + 로컬 CI + DSL |
| [v0.4](./v0.4.md) | T-F1~T-G1: yaml lib 통합 + doctor 자동화 + CLI codegen/diff/--registry + ingest 사례 |
| [v0.5](./v0.5.md) | T-H + T-I1: 자동 추출 확장 + diff rule-level + Web UI spec |
| [v0.6](./v0.6.md) | T-J1~T-J4: CLI 활성화 (doctor/--registry/git-diff) |
| [v0.7](./v0.7.md) | T-K~T-M: 모듈화 라운드 |
| [v0.8](./v0.8.md) | A~H: Stage 1 lifecycle + placeholder(tbd) + decisionLink |
| [v0.9](./v0.9.md) | A~D: Stage 2 diff breakingLevel + migrationPlan + CLI/Web |
| [v0.10](./v0.10.md) | A~E: Stage 3 decision-sync 양방향 + def-catalog 통합 + Web DecisionPanel |
| [v0.11](./v0.11.md) | A~D: 부채 #6 — decision-flow 변환 어댑터(toFlowSchema + CLI analyze) |
| [v0.12](./v0.12.md) | A~C: analyze UX + 마커 확장(^phase/^weight/^depends_on) + 역방향 변환(toMarkdown + CLI render) |
| [v0.13](./v0.13.md) | A~D: multi-gate decision (^gate:&lt;id&gt; 마커, single→multi backward compat) |
| [v0.14](./v0.14.md) | A~C: def_scope enum에 decision 추가 (8→9, capacity 32) + scope-registry 도미노 정리 |
