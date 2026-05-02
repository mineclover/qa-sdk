// @def.boundary sim-canary-controller
// spec 2026-05-02 §6 + §7 — DI tokens 단일 진입.
//
// 본 파일은 ActionModule / CatalogModule / AlertsAuditCatalogController 가 공유하는
// Symbol token 만 export — 순환 import 방지를 위해 module 정의와 분리.

export const SIM_SERVICE_CATALOG_TOKEN = Symbol("SIM_SERVICE_CATALOG");
export const PORT_REGISTRY_TOKEN = Symbol("PORT_REGISTRY");
export const SIM_TARGET_SERVICE_TOKEN = Symbol("SIM_TARGET_SERVICE");
