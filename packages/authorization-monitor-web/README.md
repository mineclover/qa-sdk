# @qa-sdk/authorization-monitor-web

`@qa-sdk/authorization-monitor-web`는 authorization ontology의 proxy enforcement와 application enforcement를 분리해서 관측하는 독립 Vite 앱이다.

## 먼저 볼 문서

- [authorization-ontology-system.spec.md](../../docs/specs/authorization-ontology/authorization-ontology-system.spec.md) — 전체 권한 온톨로지
- [authorization-ontology-auth-chain.spec.md](../../docs/specs/authorization-ontology/authorization-ontology-auth-chain.spec.md) — proxy/auth chain 모델
- [authorization-ontology-application-enforcement.spec.md](../../docs/specs/authorization-ontology/authorization-ontology-application-enforcement.spec.md) — app middleware enforcement 모델
- [authorization-ontology-audit-layer.spec.md](../../docs/specs/authorization-ontology/authorization-ontology-audit-layer.spec.md) — 선언/적용/관측 audit 모델

## 패키지 역할

- proxy route gate와 application domain-resource gate를 같은 graph로 시각화한다.
- Cerbos policy가 `proxy_route`와 `domain_resource`를 어떻게 보호하는지 보여준다.
- decision observation이 principal/resource/action/policy/enforcement point를 어떻게 연결하는지 보여준다.
- 현재는 브라우저 안전성을 위해 샘플 graph view model을 사용한다. 실제 store/API 연동은 별도 adapter로 추가한다.

## 실행

```bash
pnpm --filter @qa-sdk/authorization-monitor-web dev
pnpm --filter @qa-sdk/authorization-monitor-web build
```
