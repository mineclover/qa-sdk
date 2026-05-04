// @def.boundary motion-workspace-service-spec
export const MOTION_WORKSPACE_SERVICE_ID = "motion-workspace-service";

export interface MotionWorkspaceServiceInfo {
  readonly serviceId: typeof MOTION_WORKSPACE_SERVICE_ID;
  readonly status: "http-ready";
  readonly defaultPersistence: "sqlite";
}

export function createMotionWorkspaceServiceInfo(): MotionWorkspaceServiceInfo {
  return {
    serviceId: MOTION_WORKSPACE_SERVICE_ID,
    status: "http-ready",
    defaultPersistence: "sqlite",
  };
}
