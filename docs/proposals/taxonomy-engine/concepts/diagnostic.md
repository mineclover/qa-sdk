# Diagnostic — 진단

> validate/parse/codegen이 emit하는 검증 결과 단위.

## 정의

위반 또는 정보 메시지를 표현하는 객체. severity + code + message + 위치 + meta.

## 구조

```typescript
{
  severity: "error" | "warning" | "info"
  code: DiagnosticCode               // 안정 식별자
  message: string                    // 사람용 (한국어)
  ref?: string                       // 위치 (Tier 1 path)
  location?: { file?, line?, column? }
  hint?: string                      // 수정 제안
  meta?: Record<string, unknown>     // code별 추가 정보
}
```

## DiagnosticCode

template literal union — 8 prefix:
- `parse-*`, `structural-*`, `capacity-*`, `ref-*`, `constraint-*`, `axis-5q-*`, `version-*`, `codegen-*` + `doctor-*` (v0.3 추가)

전체 카탈로그: [`diagnostics-catalog.md`](./diagnostics-catalog.md)

## fail 정책

| 단계 | 정책 |
|------|------|
| parse | fail-fast — 첫 syntax error에서 종료 |
| validate | fail-collect — 모든 진단 수집 |
| show/resolveRef | fail-open — undefined, throw 안 함 |
| codegen | fail-fast — validate errors=0 아니면 거부 |

## 다른 개념과의 관계

- [[constraint]] 위반 → `constraint-violated` Diagnostic
- doctor drift → `doctor-{drift,missing,unexpected}` Diagnostic
- yaml syntax error → `parse-yaml-syntax`

## 참조

- spec: `../00-design.md` §7
- 코드: `packages/taxonomy-engine/src/schema/diagnostic.ts`
- 카탈로그: `diagnostics-catalog.md`
