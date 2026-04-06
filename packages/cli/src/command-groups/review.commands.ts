import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
  type RestCommandHandler,
} from "../command-spec.js";
import {
  reviewBridgeRequest,
  reviewDashboard,
  reviewLog,
  reviewMark,
  reviewRequest,
  reviewRequests,
  reviewShowRequest,
  reviewStatus,
} from "../commands/review.js";

export const REVIEW_COMMAND_DESCRIPTORS = [
  { id: "review.mark", path: ["mark"], usage: "qa-sdk review mark <file|glob...> --reviewer <name> [--model <ai>]  리뷰 완료 기록", handlerKey: "review.mark" },
  { id: "review.status", path: ["status"], usage: "qa-sdk review status [--service <scope>] [--stale] [--unreviewed]  리뷰 상태 조회", handlerKey: "review.status" },
  { id: "review.dashboard", path: ["dashboard"], usage: "qa-sdk review dashboard            서비스별 리뷰 커버리지", handlerKey: "review.dashboard" },
  { id: "review.log", path: ["log"], usage: "qa-sdk review log <file>           파일 리뷰 이력", handlerKey: "review.log" },
  {
    id: "review.request",
    path: ["request"],
    usage: "qa-sdk review request [file|glob...] --reviewer <name> --purpose <text>  AI 피드백 요청 생성",
    continuation: [
      "[--dkg-target <nodeId>] [--decision-id <id>]",
      "[--decision-type <type> --title <text> --rationale <text>]",
    ],
    handlerKey: "review.request",
  },
  { id: "review.requests", path: ["requests"], usage: "qa-sdk review requests [--service <scope>] [--limit N]  피드백 요청 목록", handlerKey: "review.requests" },
  { id: "review.show-request", path: ["show-request"], usage: "qa-sdk review show-request <id>    피드백 요청 상세", handlerKey: "review.show-request" },
  { id: "review.bridge-request", path: ["bridge-request"], usage: "qa-sdk review bridge-request <id> --target <nodeId>  피드백 요청을 DKG observation/decision에 연결", handlerKey: "review.bridge-request" },
] as const satisfies readonly CommandDescriptor[];

export const REVIEW_COMMAND_TREE =
  descriptorsToTree(REVIEW_COMMAND_DESCRIPTORS) as readonly CliCommandNode[];

export const REVIEW_COMMAND_SPECS =
  collectCommandUsageSpecs(["review"], REVIEW_COMMAND_TREE) as readonly CommandUsageSpec<string>[];

export const REVIEW_HANDLER_REGISTRY = {
  "review.mark": reviewMark,
  "review.status": reviewStatus,
  "review.dashboard": reviewDashboard,
  "review.log": reviewLog,
  "review.request": reviewRequest,
  "review.requests": reviewRequests,
  "review.show-request": reviewShowRequest,
  "review.bridge-request": reviewBridgeRequest,
} satisfies Readonly<Record<string, RestCommandHandler>>;
