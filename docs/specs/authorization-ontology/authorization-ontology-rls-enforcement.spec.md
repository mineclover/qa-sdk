---
def:
  tier: component
  id: authorization-ontology-rls-enforcement
  type: spec
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: draft
  layer: operation
  svc: authorization-ontology
  tags: [security, structural, database, rls]
  links:
    - target: authorization-ontology-system
      type: traces_to
    - target: authorization-ontology-resource-lifecycle
      type: refines
    - target: authorization-ontology-application-enforcement
      type: refs
    - target: authorization-ontology-cerbos-mapping
      type: refs
    - target: authorization-ontology-audit-layer
      type: traces_to
---

# Authorization Ontology RLS Enforcement — DB 레벨 권한 방어

## 목적 ^purpose

application enforcement(미들웨어 bitmap + policy)는 API 레이어의 방어다. 관리 CLI·마이그레이션 스크립트·분석 쿼리처럼 **API를 우회해 DB에 직접 접근**하는 경로가 존재하면 미들웨어 방어를 통과하지 못한다. 본 스펙은 PostgreSQL RLS(Row-Level Security)를 이용해 **DB 엔진이 직접 권한을 강제**하는 2차 방어선을 정의한다.

근거: resource-lifecycle 스펙의 "주의사항 — 직접 DB 접근 bypass" 항목을 구체화.

## 구성 ^overview

RLS는 application enforcement와 **직교하는** 방어선이다. 둘은 대체 관계가 아니라 보완 관계.

- **application enforcement**: API 요청 경로에서 빠르게 거절 (bitmap O(1) + policy)
- **RLS enforcement**: 어떤 경로로든 DB에 도달한 쿼리에 대해 엔진이 마지막 방어

RLS 적용 대상:

1. `resource_policies` 기반 인스턴스 레벨 접근 (UNREGISTERED → owner만)
2. `resource_type` 단위 정적 권한 (bitmap을 DB session에서 조회)
3. 조직·테넌트 경계 강제 (cross-tenant row 접근 차단)

## 정의 ^defines

### 1. Session context 주입

RLS가 policy를 판정하려면 현재 세션의 actor 정보가 DB에 있어야 한다. PostgreSQL에서는 `SET LOCAL` 또는 `session_user` custom GUC로 주입.

```sql
-- 연결 풀에서 connection 획득 직후 매 요청마다:
SET LOCAL app.user_id = 'user-1';
SET LOCAL app.tenant_id = 'tenant-acme';
SET LOCAL app.bitmap_version = 'perm:pv2';
SET LOCAL app.bitmap_mask = '\x01a4f3...';  -- bytea로 직렬화된 bitmap
```

SET LOCAL은 트랜잭션 종료 시 자동 소거 → 세션 재사용 시 권한 유출 방지.

### 2. Helper functions

```sql
-- 현재 세션의 actor ID
CREATE OR REPLACE FUNCTION auth.current_user_id() RETURNS TEXT
  LANGUAGE sql STABLE
  AS $$ SELECT current_setting('app.user_id', true) $$;

-- bitmap에서 특정 bit 조회
CREATE OR REPLACE FUNCTION auth.has_bit(pos INTEGER) RETURNS BOOLEAN
  LANGUAGE plpgsql STABLE AS $$
DECLARE
  mask BYTEA := decode(current_setting('app.bitmap_mask', true), 'hex');
  byte_idx INTEGER := pos / 8;
  bit_idx INTEGER := pos % 8;
BEGIN
  IF mask IS NULL OR octet_length(mask) <= byte_idx THEN
    RETURN false;
  END IF;
  RETURN (get_byte(mask, byte_idx) & (1 << bit_idx)) <> 0;
END;
$$;

-- resource_policies에서 state 조회
CREATE OR REPLACE FUNCTION auth.resource_state(rid TEXT) RETURNS TEXT
  LANGUAGE sql STABLE
  AS $$ SELECT state FROM resource_policies WHERE resource_id = rid $$;
```

### 3. RLS 정책 템플릿

각 보호 테이블에 2-pass 체크를 RLS로 번역:

```sql
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Pass 1: 타입 레벨 bitmap 체크 (document 읽기 비트 = address 42 가정)
-- Pass 2: 인스턴스 레벨 policy 체크
CREATE POLICY documents_read_policy ON documents
  FOR SELECT
  USING (
    auth.has_bit(42)  -- 타입 레벨 정적 권한
    AND (
      -- UNREGISTERED: owner만
      (auth.resource_state(id) = 'UNREGISTERED' AND owner_id = auth.current_user_id())
      OR
      -- REGISTERED/DELEGATED: application layer에서 판정됐다고 신뢰
      -- (DB 직접 접근 시에는 REGISTERED 이상 리소스 접근 금지 — 아래 참조)
      FALSE
    )
  );
```

**핵심 결정**: REGISTERED/DELEGATED 인스턴스의 복잡한 정책 판정은 RLS 내에서 수행하지 않는다. Cerbos 호출·그래프 탐색은 DB 외부 로직이므로 RLS에 내장하면 성능·복잡도 모두 감당 불가.

대신 **DB 직접 접근자는 REGISTERED 이상 리소스에 접근 금지**로 제약. 이는 관리 CLI·배치 작업이 인스턴스 정책이 등록된 민감 리소스를 직접 건드릴 수 없게 하는 보수적 규율.

### 4. Admin bypass

운영에는 admin 접근 필수 (마이그레이션, 데이터 복구 등):

```sql
CREATE POLICY documents_admin_bypass ON documents
  FOR ALL
  USING (current_setting('app.role', true) = 'admin');
```

`app.role=admin` 설정이 있으면 정책 우회. admin 연결은 별도 role (PG user)로 분리하고 감사 로그 필수.

### 5. Insert/Update/Delete

SELECT 외 연산에도 정책 적용:

```sql
-- INSERT: owner_id가 현재 세션과 일치해야 함 (대리 생성 방지)
CREATE POLICY documents_insert_policy ON documents
  FOR INSERT
  WITH CHECK (owner_id = auth.current_user_id() AND auth.has_bit(43));

-- UPDATE: SELECT 조건 + WITH CHECK
CREATE POLICY documents_update_policy ON documents
  FOR UPDATE
  USING (/* SELECT policy와 동일 */)
  WITH CHECK (owner_id = auth.current_user_id());

-- DELETE
CREATE POLICY documents_delete_policy ON documents
  FOR DELETE
  USING (owner_id = auth.current_user_id() AND auth.has_bit(44));
```

## 소비 ^consumes

- `authorization-ontology-resource-lifecycle` — `resource_policies` 테이블·상태 모델 사용
- `authorization-ontology-permission-engine-bridge` — bitmap 발급·session 주입 경로
- `authorization-ontology-cerbos-mapping` — Cerbos policy는 API 경로에서만 호출되며 RLS 내 호출 안 함
- `authorization-ontology-audit-layer` — RLS 거절·admin bypass 감사 로그

## 위임 ^delegates

- **실제 bitmap 발급**: `permission-engine-bridge` (Cerbos/DB 조회 후 생성)
- **Cerbos 정책 판정**: API 레이어 (RLS 범위 밖)
- **ACL 그래프 탐색**: authorization-graph-store (RLS 범위 밖)

## 방법 ^method

### 적용 순서

1. **Phase 1 — helper functions + 스키마**
   - `auth` schema 생성, helper 함수 배포
   - `resource_policies` 테이블이 먼저 존재해야 함 (resource-lifecycle Phase 1 선행)
   - unit test: has_bit 정확성, resource_state 조회

2. **Phase 2 — 보호 대상 식별**
   - 권한 경계 리소스 테이블 목록 작성 (documents, projects, ...)
   - 각 테이블별 정책 템플릿 생성 스크립트

3. **Phase 3 — application 레이어 통합**
   - 연결 풀에서 요청마다 SET LOCAL 실행
   - Drizzle middleware 또는 connection hook으로 자동화
   - bitmap serialize/deserialize 검증

4. **Phase 4 — shadow mode**
   - 정책을 `FORCE ROW LEVEL SECURITY` 없이 활성화
   - RLS 거절 로그만 수집, 실제 차단 안 함
   - false positive 분석

5. **Phase 5 — enforce**
   - `FORCE` 활성화, 실제 차단
   - admin bypass 연결만 예외
   - 거절 메트릭 모니터링

### 테스트 전략

- **Helper 함수 단위 테스트**: has_bit의 bit 오프셋, bytea 파싱
- **정책 시나리오**: owner/non-owner/admin × SELECT/INSERT/UPDATE/DELETE 매트릭스
- **세션 격리**: SET LOCAL이 트랜잭션 종료 시 소거되는지
- **연결 풀 재사용 안전성**: connection 재할당 시 이전 세션 context 유출 방지
- **shadow/enforce 일치**: application 레이어 거절과 RLS 거절 결과 교차 검증

## 주의사항

- **RLS는 application enforcement를 대체하지 않는다** — API 미들웨어의 Pass 2(Cerbos/ACL)는 유지. RLS는 DB 직접 접근 방어 전용.
- **REGISTERED 이상 리소스의 DB 직접 접근 금지** — admin도 원칙적으로 API 경유 권장. 직접 접근은 임시·감사 대상.
- **bitmap 크기 제한** — bytea 컬럼을 session에 주입하므로 권한 공간이 2^20 (128KB)을 넘으면 부담. 압축 또는 샤딩 검토.
- **SET LOCAL 누락 방어** — helper 함수가 `current_setting(..., true)`의 null 반환을 안전하게 처리해야 함. 정책 조건에서 null은 false로 취급되어 default deny.
- **admin bypass 감사** — `app.role=admin` 연결은 별도 PG role로 분리하고 pgAudit 같은 감사 확장으로 전체 쿼리 로깅.
- **마이그레이션 중 RLS 비활성화 금지** — `DISABLE ROW LEVEL SECURITY`는 emergency 외 금지. 필요 시 scoped admin bypass로 우회.
- **cross-schema**: auth schema는 별도 PG role로 소유, 권한 제한. 함수 정의 수정에는 별도 승인 필요.

## 용어

- **RLS (Row-Level Security)**: PostgreSQL의 row 단위 접근 제어 기능. 정책을 쿼리 조건으로 자동 삽입.
- **Session context**: `SET LOCAL`로 주입된 트랜잭션 범위의 config 값.
- **Shadow mode**: RLS 정책을 활성화하되 실제 차단하지 않고 로그만 수집하는 검증 단계.
- **Admin bypass**: 운영 목적의 정책 우회 — 별도 PG role + 감사 필수.
