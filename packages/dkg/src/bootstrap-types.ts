import type { Catalog } from "@qa-sdk/core";
import type { TransitionSpec } from "spec-transition";
import type { GraphRegistry } from "./graph-registry.js";
import type {
  ConsumerNode,
  ConstraintNode,
  DecisionNode,
  DomainNode,
  DslBundleNode,
  IntentLinkNode,
  SkillNode,
  SpecNode,
  TransitionSpecNode,
} from "./dkg.types.js";

/** decision-flow FlowSchema와 구조 호환 — kernel tier에서 logic import 방지 */
export interface FlowSchemaLike {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly gates: readonly {
    readonly id: string;
    readonly name: string;
    readonly phase: string;
    readonly weight?: string;
    readonly subFlowId?: string;
    readonly branches?: readonly unknown[];
  }[];
}

export interface FlowSchemaEntry {
  readonly schema: FlowSchemaLike;
  readonly observedPrefixIds?: readonly string[];
  readonly axisIds?: readonly string[];
  readonly domainId?: string;
}

export interface DkgConfigInput {
  readonly domains: readonly DomainNode[];
  readonly consumers: readonly ConsumerNode[];
  readonly constraints: readonly ConstraintNode[];
  readonly dslBundles: readonly DslBundleNode[];
  readonly intentLinks: readonly IntentLinkNode[];
  readonly skills: readonly SkillNode[];
  readonly specs?: readonly SpecNode[];
  readonly decisions?: readonly DecisionNode[];
  readonly flowSchemas?: readonly FlowSchemaEntry[];
  readonly transitionSpecs?: readonly TransitionSpecNode[];
  readonly reviewPairs?: readonly { readonly a: string; readonly b: string; readonly reason: string }[];
}

export interface BootstrapDkgOptions {
  catalog: Catalog;
  config: DkgConfigInput;
  date?: string;
  transitionSpecs?: readonly TransitionSpec[];
  existingGraph?: GraphRegistry;
}
