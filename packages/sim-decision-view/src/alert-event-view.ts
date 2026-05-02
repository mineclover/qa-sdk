// @def.boundary sim-decision-view
// spec 2026-05-02 §4

export interface AlertEventView { cycleId: string; kind: string; occurredAt: string; details?: Record<string, unknown>; }
