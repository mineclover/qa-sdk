/**
 * PrefixMeta — prefix 유형별 의미 메타데이터.
 *
 * 각 prefix가 시스템에서 어떤 역할을 하는지,
 * 클릭했을 때 어떤 정보를 보여줄지 정의한다.
 *
 * 원칙:
 *   - prefix는 자체로 의미적 기능을 담는다
 *   - 유형마다 다른 시각 형태 + 다른 상세 정보
 *   - 실제 코드/스키마/설정 위치까지 연결
 */

// ═══════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════

/** prefix의 시각 형태 힌트 */
export type VisualShape =
  | "cube"      // 기본 큐브 (observation, entity)
  | "thin-bar"  // 얇은 바 (policy — 권한은 pass/fail 이진)
  | "flat-tile" // 납작한 타일 (event — 발생하고 사라짐)
  | "column"    // 세로 컬럼 (table — DB 컬럼)
  | "sphere"    // 구형 (relation — 관계)
  ;

/** 클릭 시 표시할 상세 정보 유형 */
export type DetailKind =
  | "schema"      // DB 스키마 (table)
  | "permission"  // 권한 매트릭스 (policy)
  | "event-def"   // 이벤트 구조 — actor×action×target (event)
  | "endpoint"    // API 경로 + 메서드 (observation/endpoint)
  | "flow-step"   // 흐름 단계 설명 (observation/flow_point)
  | "config"      // 설정/파라미터 (entity/service, data_policy)
  | "metric"      // 메트릭/통계 (pipeline_point)
  | "generic"     // 기본 정보
  ;

/** 소스 코드/설정 위치 */
export interface SourceLocation {
  /** 파일 경로 (상대) */
  readonly file?: string;
  /** 라인 번호 */
  readonly line?: number;
  /** 모듈/패키지 이름 */
  readonly module?: string;
  /** 외부 URL (문서, 대시보드 등) */
  readonly url?: string;
}

/** prefix 의미 메타데이터 */
export interface PrefixMetadata {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  readonly shape: VisualShape;
  readonly detailKind: DetailKind;
  /** 시각적 높이 비율 (1=기본, 0.3=얇은 바, 2=높은 컬럼) */
  readonly heightRatio: number;
  /** 소스 위치 */
  readonly source?: SourceLocation;
  /** 상세 정보 데이터 (유형별) */
  readonly detail?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════
//  Schema Detail (table용)
// ═══════════════════════════════════════════════════

export interface SchemaDetail {
  readonly table: string;
  readonly columns: readonly SchemaColumn[];
}

export interface SchemaColumn {
  readonly name: string;
  readonly type: string;
  readonly refKind: "scalar" | "axis_ref" | "table_ref" | "prefix_ref";
  /** 참조 대상 (axis_ref: axisId, table_ref: table, prefix_ref: prefixId) */
  readonly refTarget?: string;
}

// ═══════════════════════════════════════════════════
//  Event Detail (event용)
// ═══════════════════════════════════════════════════

export interface EventDetail {
  readonly structure: string; // "actor × action × target"
  readonly slots: readonly EventSlot[];
}

export interface EventSlot {
  readonly name: string;
  readonly kind: "axis" | "table_ref" | "prefix_ref";
  readonly target: string;
  readonly description: string;
}

// ═══════════════════════════════════════════════════
//  DEMO_CATALOG용 프리셋
// ═══════════════════════════════════════════════════

export const DEMO_PREFIX_META: Record<string, PrefixMetadata> = {
  // ── Observation ──
  page_view: {
    id: "page_view", displayName: "화면 관측", description: "어떤 화면을 어떤 사용자가 보는가",
    shape: "cube", detailKind: "generic", heightRatio: 1,
    source: { module: "demo-snapshot", file: "demo-catalog.ts" },
  },
  tracking: {
    id: "tracking", displayName: "행동 추적", description: "사용자의 클릭/조회/스크롤 행동을 추적",
    shape: "cube", detailKind: "generic", heightRatio: 1,
    source: { module: "browser-sdk", file: "auto-capture.ts" },
  },
  endpoint: {
    id: "endpoint", displayName: "API 엔드포인트", description: "어떤 서비스의 어떤 API가 호출되는가",
    shape: "cube", detailKind: "endpoint", heightRatio: 1,
    source: { module: "ingest-server", file: "routes/ingest.ts" },
    detail: { routes: [
      { method: "GET", path: "/v1/products", handler: "listProducts" },
      { method: "POST", path: "/v1/orders", handler: "createOrder" },
      { method: "POST", path: "/v1/auth/login", handler: "login" },
    ]},
  },
  flow_point: {
    id: "flow_point", displayName: "흐름 관측", description: "비즈니스 흐름의 어디에 있는가",
    shape: "cube", detailKind: "flow-step", heightRatio: 1,
    source: { module: "spec-core", file: "dkg/flow-definition.ts" },
  },
  pipeline_point: {
    id: "pipeline_point", displayName: "파이프라인 관측", description: "수집 파이프라인의 어떤 단계인가",
    shape: "cube", detailKind: "metric", heightRatio: 1,
    source: { module: "ingest-server", file: "lib/phase-two-worker.ts" },
  },
  data_policy: {
    id: "data_policy", displayName: "데이터 정책", description: "마스킹/원본/해시 정책",
    shape: "flat-tile", detailKind: "config", heightRatio: 0.5,
    source: { module: "sdk", file: "masking.ts" },
  },

  // ── Policy (얇은 바) ──
  permission: {
    id: "permission", displayName: "권한", description: "서비스별 역할 기반 권한",
    shape: "thin-bar", detailKind: "permission", heightRatio: 0.3,
    source: { module: "permission-engine", file: "permission-set.ts" },
    detail: { matrix: "perm_svc × role → grant/deny" },
  },
  rbac: {
    id: "rbac", displayName: "RBAC", description: "역할 × 액션 × 리소스 접근 제어",
    shape: "thin-bar", detailKind: "permission", heightRatio: 0.3,
    source: { module: "permission-engine", file: "permission-set.ts" },
  },

  // ── Event (납작한 타일) ──
  cart_event: {
    id: "cart_event", displayName: "장바구니 이벤트", description: "회원이 상품을 장바구니에 담는 행위",
    shape: "flat-tile", detailKind: "event-def", heightRatio: 0.5,
    source: { module: "demo-snapshot", file: "demo-catalog.ts" },
    detail: { structure: "actor(member) × action × target(item)", slots: [
      { name: "actor", kind: "table_ref", target: "members", description: "행위 주체" },
      { name: "action", kind: "axis", target: "cart_action", description: "add/remove/checkout" },
      { name: "target", kind: "table_ref", target: "items", description: "대상 상품" },
    ]},
  },
  auth_event: {
    id: "auth_event", displayName: "인증 이벤트", description: "로그인/로그아웃/토큰갱신",
    shape: "flat-tile", detailKind: "event-def", heightRatio: 0.5,
    source: { module: "demo-snapshot" },
    detail: { structure: "actor(member) × action", slots: [
      { name: "actor", kind: "table_ref", target: "members", description: "사용자" },
      { name: "action", kind: "axis", target: "auth_action", description: "login/logout/token_refresh" },
    ]},
  },
  order_event: {
    id: "order_event", displayName: "주문 이벤트", description: "주문 생성/취소/환불/완료",
    shape: "flat-tile", detailKind: "event-def", heightRatio: 0.5,
    source: { module: "demo-snapshot" },
    detail: { structure: "service_ctx × actor(member) × action × order(table)", slots: [
      { name: "service_ctx", kind: "prefix_ref", target: "service", description: "서비스 컨텍스트" },
      { name: "action", kind: "axis", target: "order_action", description: "create/cancel/refund/complete" },
    ]},
  },
  deploy_event: {
    id: "deploy_event", displayName: "배포 이벤트", description: "서비스 배포/롤백/스케일",
    shape: "flat-tile", detailKind: "event-def", heightRatio: 0.5,
    source: { module: "spec-core", file: "dkg/bootstrap.ts" },
  },
  health_event: {
    id: "health_event", displayName: "헬스 이벤트", description: "서비스 상태 변화",
    shape: "flat-tile", detailKind: "config", heightRatio: 0.5,
    source: { module: "ingest-server" },
  },
  engine_event: {
    id: "engine_event", displayName: "엔진 평가", description: "제약 연산자 × 판정 결과",
    shape: "flat-tile", detailKind: "metric", heightRatio: 0.5,
    source: { module: "engine", file: "matching/constraint-evaluator.ts" },
  },
  schema_event: {
    id: "schema_event", displayName: "스키마 마이그레이션", description: "마이그레이션 패턴 × 배포 행위",
    shape: "flat-tile", detailKind: "config", heightRatio: 0.5,
    source: { module: "spec-core", file: "dkg/skills/infer-migrator.ts" },
  },

  // ── Entity ──
  service: {
    id: "service", displayName: "서비스", description: "env × region × svc_name × namespace 4D 서비스 주소",
    shape: "cube", detailKind: "config", heightRatio: 1,
    source: { module: "demo-snapshot", file: "demo-catalog.ts" },
    detail: { dims: ["env", "region", "svc_name", "namespace"] },
  },
  event: {
    id: "event", displayName: "이벤트 로그", description: "시스템 이벤트 기록",
    shape: "cube", detailKind: "generic", heightRatio: 0.8,
    source: { module: "ingest-server" },
  },
  content: {
    id: "content", displayName: "콘텐츠", description: "tag × category × status × locale × channel",
    shape: "cube", detailKind: "generic", heightRatio: 1,
  },
  relational: {
    id: "relational", displayName: "관계 모델", description: "subjectKind × predicate × objectKind",
    shape: "sphere", detailKind: "generic", heightRatio: 1,
    source: { module: "spec-core", file: "dkg/dkg.types.ts" },
  },

  // ── Table (세로 컬럼) ──
  members: {
    id: "members", displayName: "회원 테이블", description: "사용자 정보",
    shape: "column", detailKind: "schema", heightRatio: 1.5,
    detail: { table: "members", columns: [
      { name: "id", type: "integer", refKind: "scalar" },
      { name: "name", type: "string", refKind: "scalar" },
      { name: "role", type: "string", refKind: "axis_ref", refTarget: "role" },
      { name: "org_id", type: "integer", refKind: "table_ref", refTarget: "orgs" },
    ]},
  },
  orders: {
    id: "orders", displayName: "주문 테이블", description: "주문 정보",
    shape: "column", detailKind: "schema", heightRatio: 1.5,
    detail: { table: "orders", columns: [
      { name: "id", type: "integer", refKind: "scalar" },
      { name: "member_id", type: "integer", refKind: "table_ref", refTarget: "members" },
      { name: "service_addr", type: "integer", refKind: "prefix_ref", refTarget: "service" },
      { name: "status", type: "string", refKind: "axis_ref", refTarget: "order_action" },
      { name: "amount", type: "number", refKind: "scalar" },
    ]},
  },
  items: {
    id: "items", displayName: "상품 테이블", description: "상품 정보",
    shape: "column", detailKind: "schema", heightRatio: 1.5,
    detail: { table: "items", columns: [
      { name: "id", type: "integer", refKind: "scalar" },
      { name: "name", type: "string", refKind: "scalar" },
      { name: "category", type: "string", refKind: "axis_ref", refTarget: "category" },
      { name: "warehouse_addr", type: "integer", refKind: "prefix_ref", refTarget: "service" },
    ]},
  },
  orgs: {
    id: "orgs", displayName: "조직 테이블", description: "조직 정보",
    shape: "column", detailKind: "schema", heightRatio: 1.5,
    detail: { table: "orgs", columns: [
      { name: "id", type: "integer", refKind: "scalar" },
      { name: "name", type: "string", refKind: "scalar" },
      { name: "region_addr", type: "integer", refKind: "prefix_ref", refTarget: "service" },
    ]},
  },
  carts: {
    id: "carts", displayName: "장바구니", description: "장바구니",
    shape: "column", detailKind: "schema", heightRatio: 1.2,
    detail: { table: "carts", columns: [
      { name: "id", type: "integer", refKind: "scalar" },
      { name: "member_id", type: "integer", refKind: "table_ref", refTarget: "members" },
    ]},
  },
  cart_items: {
    id: "cart_items", displayName: "장바구니 항목", description: "장바구니 내 상품",
    shape: "column", detailKind: "schema", heightRatio: 1.2,
    detail: { table: "cart_items", columns: [
      { name: "cart_id", type: "integer", refKind: "table_ref", refTarget: "carts" },
      { name: "item_id", type: "integer", refKind: "table_ref", refTarget: "items" },
      { name: "qty", type: "integer", refKind: "scalar" },
    ]},
  },
};

// ═══════════════════════════════════════════════════
//  상세 정보 포맷터
// ═══════════════════════════════════════════════════

/** 클릭 시 표시할 HTML 생성 */
export function formatDetail(meta: PrefixMetadata, entry?: string): string {
  const lines: string[] = [];
  lines.push(`<div style="font-size:11px;font-weight:600;color:#e0e4ec">${meta.displayName}</div>`);
  lines.push(`<div style="font-size:9px;color:#556;margin:3px 0">${meta.description}</div>`);

  if (meta.source) {
    const loc = meta.source;
    const parts: string[] = [];
    if (loc.module) parts.push(loc.module);
    if (loc.file) parts.push(loc.file);
    if (loc.line) parts.push(`L${loc.line}`);
    lines.push(`<div style="font-size:8px;color:#334;margin-top:4px">📁 ${parts.join(" / ")}</div>`);
    if (loc.url) lines.push(`<div style="font-size:8px"><a href="${loc.url}" target="_blank" style="color:#64ffda">📎 docs</a></div>`);
  }

  switch (meta.detailKind) {
    case "schema": {
      const schema = meta.detail as SchemaDetail | undefined;
      if (schema?.columns) {
        lines.push(`<div style="margin-top:6px;font-size:8px;color:#445;letter-spacing:1px">SCHEMA</div>`);
        for (const col of schema.columns) {
          const ref = col.refKind !== "scalar" ? ` <span style="color:${col.refKind === 'axis_ref' ? '#00e676' : col.refKind === 'table_ref' ? '#ff5252' : '#00e5ff'}">→${col.refTarget}</span>` : "";
          const highlight = entry && col.name === entry ? "color:var(--mint);font-weight:600" : "color:#667";
          lines.push(`<div style="font-size:9px;${highlight}">${col.name} <span style="color:#334">${col.type}</span>${ref}</div>`);
        }
      }
      break;
    }
    case "event-def": {
      const evt = meta.detail as EventDetail | undefined;
      if (evt) {
        lines.push(`<div style="margin-top:6px;font-size:8px;color:#445;letter-spacing:1px">EVENT STRUCTURE</div>`);
        lines.push(`<div style="font-size:9px;color:#ff9100">${evt.structure}</div>`);
        if (evt.slots) {
          for (const slot of evt.slots) {
            const kindColor = slot.kind === "table_ref" ? "#ff5252" : slot.kind === "prefix_ref" ? "#00e5ff" : "#00e676";
            lines.push(`<div style="font-size:9px;color:#667">${slot.name} <span style="color:${kindColor}">${slot.kind}→${slot.target}</span></div>`);
          }
        }
      }
      break;
    }
    case "permission":
      lines.push(`<div style="margin-top:6px;font-size:8px;color:#445;letter-spacing:1px">PERMISSION</div>`);
      lines.push(`<div style="font-size:9px;color:#00e676">${(meta.detail as any)?.matrix || "role-based grant/deny"}</div>`);
      break;
    case "endpoint": {
      const routes = (meta.detail as any)?.routes;
      if (routes) {
        lines.push(`<div style="margin-top:6px;font-size:8px;color:#445;letter-spacing:1px">ROUTES</div>`);
        for (const r of routes) {
          lines.push(`<div style="font-size:9px;color:#667"><span style="color:#00e5ff">${r.method}</span> ${r.path}</div>`);
        }
      }
      break;
    }
    default:
      break;
  }

  return lines.join("");
}
