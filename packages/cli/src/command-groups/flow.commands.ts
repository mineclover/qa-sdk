// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
  type RestCommandHandler,
} from "../command-spec.js";
import {
  flowAnalyze,
  flowCompare,
  flowHistory,
  flowJudge,
  flowList,
  flowLookup,
  flowPolicyApprove,
  flowPolicyCandidates,
  flowPolicyLearn,
  flowPolicyList,
  flowPolicyReject,
  flowSelect,
  flowStart,
  flowStatus,
  flowTrace,
  flowVerdict,
} from "../commands/flow.js";

export const FLOW_COMMAND_DESCRIPTORS = [
  { id: "flow.list", path: ["list"], usage: "qa-sdk flow list                              플로우 스키마 목록", handlerKey: "flow.list" },
  { id: "flow.start", path: ["start"], usage: "qa-sdk flow start <schema-id>                 플로우 시작", handlerKey: "flow.start" },
  { id: "flow.select", path: ["select"], usage: "qa-sdk flow select <branch-id>                현재 gate 선택", handlerKey: "flow.select" },
  { id: "flow.status", path: ["status"], usage: "qa-sdk flow status [instance-id]              실행 상태 조회", handlerKey: "flow.status" },
  { id: "flow.trace", path: ["trace"], usage: "qa-sdk flow trace <instance-id>               코어 경로 추적", handlerKey: "flow.trace" },
  { id: "flow.analyze", path: ["analyze"], usage: "qa-sdk flow analyze <schema-id>               구조/영향 분석", handlerKey: "flow.analyze" },
  { id: "flow.compare", path: ["compare"], usage: "qa-sdk flow compare [options]                 쌍/분포/시간 비교", handlerKey: "flow.compare" },
  { id: "flow.policy.candidates", path: ["policy", "candidates"], usage: "qa-sdk flow policy candidates                 정책 후보 목록", handlerKey: "flow.policy.candidates" },
  { id: "flow.policy.approve", path: ["policy", "approve"], usage: "qa-sdk flow policy approve <id>               후보 승인 + 정책 등록", handlerKey: "flow.policy.approve" },
  { id: "flow.policy.reject", path: ["policy", "reject"], usage: "qa-sdk flow policy reject <id>                후보 거부", handlerKey: "flow.policy.reject" },
  { id: "flow.policy.list", path: ["policy", "list"], usage: "qa-sdk flow policy list                       등록된 정책 목록", handlerKey: "flow.policy.list" },
  { id: "flow.policy.learn", path: ["policy", "learn"], usage: "qa-sdk flow policy learn <schema-id>          패턴 감지 + 후보 생성", handlerKey: "flow.policy.learn" },
  { id: "flow.lookup", path: ["lookup"], usage: "qa-sdk flow lookup <keyword>                  키워드로 의사결정 이력 조회", handlerKey: "flow.lookup" },
  { id: "flow.history", path: ["history"], usage: "qa-sdk flow history [schema-id]               완료된 인스턴스 이력 (-n 20)", handlerKey: "flow.history" },
  { id: "flow.verdict", path: ["verdict"], usage: "qa-sdk flow verdict <instance-id>             판정 상태 + 성공 기준 조회", handlerKey: "flow.verdict" },
  { id: "flow.judge", path: ["judge"], usage: "qa-sdk flow judge <instance-id>              판정 기록 (성공/실패/보류)", handlerKey: "flow.judge" },
] as const satisfies readonly CommandDescriptor[];

export const FLOW_COMMAND_TREE =
  descriptorsToTree(FLOW_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];

export const FLOW_COMMAND_SPECS =
  collectCommandUsageSpecs(["flow"], FLOW_COMMAND_TREE) as readonly CommandUsageSpec<string>[];

export const FLOW_HANDLER_REGISTRY = {
  "flow.list": () => flowList(),
  "flow.start": flowStart,
  "flow.select": flowSelect,
  "flow.status": flowStatus,
  "flow.trace": flowTrace,
  "flow.analyze": flowAnalyze,
  "flow.compare": flowCompare,
  "flow.policy.candidates": flowPolicyCandidates,
  "flow.policy.approve": flowPolicyApprove,
  "flow.policy.reject": flowPolicyReject,
  "flow.policy.list": () => flowPolicyList(),
  "flow.policy.learn": flowPolicyLearn,
  "flow.lookup": flowLookup,
  "flow.history": flowHistory,
  "flow.verdict": flowVerdict,
  "flow.judge": flowJudge,
} satisfies Readonly<Record<string, RestCommandHandler>>;
