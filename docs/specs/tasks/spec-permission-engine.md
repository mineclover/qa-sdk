# permission-engine 스펙 작성

> 9개 모듈이 CLAUDE.md에만 문서화. 전용 스펙 디렉토리 + 문서 필요.

## 우선순위: 🔴 7순위 (테스트 후 스펙)

## 현재 상태

- CLAUDE.md에 아키텍처 상세 기술 (3-tier 프로토콜, 마스크 체계, PartialBinder 등)
- `docs/specs/`에 permission-engine 전용 스펙: **0건**
- 테스트: 5건 (in-package) + 7건 (demo-tests) = 12건

## 산출물

```
docs/specs/indexing/permission-engine/
├── README.md              패키지 인덱스
├── core.spec.md           PermissionSet, TernaryMask, ScopedEngine
├── codec.spec.md          PermissionCodec — 3-tier 프로토콜 (text↔integer↔bitmask)
├── resource.spec.md       resource 정규화, service-ref, permission-code
└── migration.spec.md      shape 변경 시 마스크 마이그레이션
```

## 각 스펙 범위

| 스펙 | 소스 모듈 | 핵심 내용 |
|---|---|---|
| core | permission-set.ts, ternary-mask.ts, scoped-engine.ts | binary/ternary mask, 계층 상속, env/region 스코프 |
| codec | permission-codec.ts | Tier 1↔2↔3 변환, `perm:42` 단축형 |
| resource | resource.ts, service-ref.ts, permission-code.ts | 리소스 패턴, 서비스 참조, `{svc}.{type}.{resource}.{action}` |
| migration | migration.ts | ID 매칭 자동 변환, CoordMapper 커스텀 |

## 인덱스 업데이트

- `docs/specs/indexing/README.md` — permission-engine 패키지 행 추가
- `docs/specs/README.md` — 패키지→스펙 매핑 테이블 보강
