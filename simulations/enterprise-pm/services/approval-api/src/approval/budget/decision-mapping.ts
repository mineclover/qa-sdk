// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

/** REST API 표면 — 동사 형태 (Plan 13b scenario 요구). */
export type ApiDecision = "approve" | "reject";

/** 내부 storage — 상태 형태 (approval_steps.decision 컬럼과 정렬). */
export type StorageDecision = "approved" | "rejected" | "pending";

/**
 * REST body 값 → storage 값 변환.
 *
 * @throws api decision 이 enum 밖이면 에러 (zod 로 1차 방어 후 내부 방어층).
 */
export function toStorageDecision(api: ApiDecision): "approved" | "rejected" {
  switch (api) {
    case "approve":
      return "approved";
    case "reject":
      return "rejected";
    default:
      throw new Error(`unknown api decision: ${String(api)}`);
  }
}

/**
 * storage 값 → api 표면. pending 은 API 응답에 포함 불가 (controller 가 필터링).
 */
export function fromStorageDecision(storage: StorageDecision): ApiDecision {
  switch (storage) {
    case "approved":
      return "approve";
    case "rejected":
      return "reject";
    case "pending":
      throw new Error("pending storage decision is internal — must not be exposed via API");
    default:
      throw new Error(`unknown storage decision: ${String(storage)}`);
  }
}
