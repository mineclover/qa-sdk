import { normalizeObservationContract } from "./normalize.js";
import type {
  ContractMetadata,
  EvaluationFinding,
  EvaluationResult,
  EvaluationStatus,
  ObservationContract,
  ObservationContractInput,
  RequestContract,
} from "./types.js";

const EMPTY_METADATA: ContractMetadata = Object.freeze({});

function finding(code: string, message: string): EvaluationFinding {
  return {
    code,
    severity: "error",
    message,
    metadata: EMPTY_METADATA,
  };
}

function textCorpus(observation: ObservationContract): string {
  return [
    ...observation.logs,
    ...observation.usedActions,
    ...observation.artifacts.flatMap((artifact) => [
      artifact.id,
      artifact.kind,
      artifact.summary ?? "",
    ]),
    ...observation.errors.flatMap((error) => [error.code, error.message]),
  ]
    .join("\n")
    .toLowerCase();
}

function includesText(corpus: string, expected: string): boolean {
  return corpus.includes(expected.toLowerCase());
}

function determineStatus(
  observation: ObservationContract,
  findings: readonly EvaluationFinding[],
): EvaluationStatus {
  if (observation.errors.some((error) => error.blocking)) {
    return "blocked";
  }

  if (!observation.completed) {
    return "failure";
  }

  return findings.length === 0 ? "success" : "partial";
}

export function evaluateObservation(
  contract: RequestContract,
  observationInput: ObservationContractInput | ObservationContract,
): EvaluationResult {
  const observation = normalizeObservationContract(observationInput);
  const corpus = textCorpus(observation);
  const findings: EvaluationFinding[] = [];

  for (const criterion of contract.successCriteria) {
    if (!includesText(corpus, criterion)) {
      findings.push(
        finding(
          "successCriteria.unmet",
          `성공 기준을 충족하지 못했습니다: ${criterion}`,
        ),
      );
    }
  }

  for (const required of contract.constraints.mustInclude) {
    if (!includesText(corpus, required)) {
      findings.push(
        finding("constraints.mustInclude.missing", `필수 요소가 누락되었습니다: ${required}`),
      );
    }
  }

  for (const excluded of [
    ...contract.constraints.mustExclude,
    ...contract.constraints.forbiddenActions,
  ]) {
    const signal = observation.constraintSignals.find(
      (item) => item.rule === excluded,
    );
    if (signal?.violated === true) {
      findings.push(
        finding("constraints.violation", signal.message ?? `제약을 위반했습니다: ${excluded}`),
      );
    }
  }

  for (const error of observation.errors) {
    findings.push(finding(`error.${error.code}`, error.message));
  }

  const status = determineStatus(observation, findings);

  return {
    status,
    findings,
    replanRequired: status === "partial" || status === "failure",
  };
}
