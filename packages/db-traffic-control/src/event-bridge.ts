/**
 * event-bridge — 쿼리 메트릭의 event_key ↔ event-catalog 교차 검증.
 *
 * db-traffic-control은 event-catalog에 직접 의존하지 않음 (역방향 금지).
 * 대신 검증 함수가 매핑 조회 콜백을 받아 교차 검증 수행.
 */

/** event-bridge가 필요로 하는 메트릭 수집 포트 — 구체 클래스 비의존 */
export interface EventKeyCollector {
  collectEventKeys(): string[];
  collectTransitionGroups(): Map<string, string[]>;
}

export interface EventBridgeIssue {
  readonly severity: "warning";
  readonly eventKey: string;
  readonly message: string;
}

/**
 * 쿼리 메트릭에서 수집된 event_key가 event-catalog에 등록되어 있는지 검증.
 *
 * @param collector - 메트릭 수집기
 * @param hasMapping - event_key가 event-catalog에 매핑 있는지 판별 콜백
 */
export function validateQueryEventKeys(
  collector: EventKeyCollector,
  hasMapping: (eventKey: string) => boolean,
): EventBridgeIssue[] {
  const issues: EventBridgeIssue[] = [];
  const eventKeys = collector.collectEventKeys();

  for (const ek of eventKeys) {
    if (!hasMapping(ek)) {
      issues.push({
        severity: "warning",
        eventKey: ek,
        message: `쿼리 event_key "${ek}" → event-catalog에 매핑 없음`,
      });
    }
  }

  return issues;
}

/**
 * 쿼리 메트릭의 transition 그룹이 TransitionDef와 일치하는지 검증.
 *
 * @param collector - 메트릭 수집기
 * @param getTransitionEvents - transitionId로 등록된 events 조회 콜백
 */
export function validateQueryTransitions(
  collector: EventKeyCollector,
  getTransitionEvents: (transitionId: string) => string[] | undefined,
): EventBridgeIssue[] {
  const issues: EventBridgeIssue[] = [];
  const groups = collector.collectTransitionGroups();

  for (const [transitionId, queryEvents] of groups) {
    const defEvents = getTransitionEvents(transitionId);

    if (!defEvents) {
      issues.push({
        severity: "warning",
        eventKey: transitionId,
        message: `쿼리 transition "${transitionId}" → TransitionDef에 미등록`,
      });
      continue;
    }

    const defSet = new Set(defEvents);
    for (const ek of queryEvents) {
      if (!defSet.has(ek)) {
        issues.push({
          severity: "warning",
          eventKey: ek,
          message: `쿼리 transition "${transitionId}" 내 event_key "${ek}" → TransitionDef.events에 없음`,
        });
      }
    }
  }

  return issues;
}
