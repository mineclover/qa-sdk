// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, it, expect } from "vitest";
import { getChildFlows } from "./pipe-flow-utils.js";
import type { PipeFlow } from "../types/pipe-spec.js";

const step = (facet = "소비"): PipeFlow => ({ kind: "step", facet });

describe("getChildFlows — 주요 flow kind 커버리지", () => {
  it("step → 빈 배열", () => {
    expect(getChildFlows(step())).toEqual([]);
  });

  it("emit → 빈 배열", () => {
    expect(getChildFlows({ kind: "emit", eventKey: "e" })).toEqual([]);
  });

  it("sequence → steps", () => {
    const flow: PipeFlow = { kind: "sequence", steps: [step(), step()] };
    expect(getChildFlows(flow)).toHaveLength(2);
  });

  it("branch → paths", () => {
    const flow: PipeFlow = { kind: "branch", condition: "x", paths: [step(), step()] };
    expect(getChildFlows(flow)).toHaveLength(2);
  });

  it("parallel → steps", () => {
    const flow: PipeFlow = { kind: "parallel", steps: [step(), step()] };
    expect(getChildFlows(flow)).toHaveLength(2);
  });

  it("optional → [step]", () => {
    const flow: PipeFlow = { kind: "optional", step: step() };
    expect(getChildFlows(flow)).toHaveLength(1);
  });

  it("retry → [step]", () => {
    const flow: PipeFlow = { kind: "retry", step: step(), maxAttempts: 3 };
    expect(getChildFlows(flow)).toHaveLength(1);
  });

  it("fallback → [try, catch]", () => {
    const flow: PipeFlow = { kind: "fallback", try: step(), catch: step() };
    expect(getChildFlows(flow)).toHaveLength(2);
  });

  it("compensate → [forward, compensate]", () => {
    const flow: PipeFlow = { kind: "compensate", forward: step(), compensate: step() };
    expect(getChildFlows(flow)).toHaveLength(2);
  });

  it("transition-scope → [body] (compensate 없음)", () => {
    const flow: PipeFlow = { kind: "transition-scope", transitionId: "t1", body: step(), events: ["e1"] };
    expect(getChildFlows(flow)).toHaveLength(1);
  });

  it("transition-scope → [body, compensate] (compensate 있음)", () => {
    const flow: PipeFlow = { kind: "transition-scope", transitionId: "t1", body: step(), events: ["e1"], compensate: step() };
    expect(getChildFlows(flow)).toHaveLength(2);
  });

  it("loop → [body]", () => {
    const flow: PipeFlow = { kind: "loop", body: step(), until: "done" };
    expect(getChildFlows(flow)).toHaveLength(1);
  });

  it("map → [itemFlow]", () => {
    const flow: PipeFlow = { kind: "map", itemFlow: step(), collection: "items" };
    expect(getChildFlows(flow)).toHaveLength(1);
  });

  it("reduce → [step]", () => {
    const flow: PipeFlow = { kind: "reduce", step: step(), initial: "0", accumulator: "sum" };
    expect(getChildFlows(flow)).toHaveLength(1);
  });

  it("tap → [observe, step]", () => {
    const flow: PipeFlow = { kind: "tap", observe: step(), step: step() };
    expect(getChildFlows(flow)).toHaveLength(2);
  });

  it("timeout → [body] (onTimeout 없음)", () => {
    const flow: PipeFlow = { kind: "timeout", body: step(), duration: 1000 };
    expect(getChildFlows(flow)).toHaveLength(1);
  });

  it("timeout → [body, onTimeout] (onTimeout 있음)", () => {
    const flow: PipeFlow = { kind: "timeout", body: step(), duration: 1000, onTimeout: step() };
    expect(getChildFlows(flow)).toHaveLength(2);
  });

  it("correlation → [onMatch] (onTimeout 없음)", () => {
    const flow: PipeFlow = { kind: "correlation", requestEvent: "req", responseEvent: "res", correlationKey: "id", onMatch: step() };
    expect(getChildFlows(flow)).toHaveLength(1);
  });

  it("finally → [body, cleanup]", () => {
    const flow: PipeFlow = { kind: "finally", body: step(), cleanup: step() };
    expect(getChildFlows(flow)).toHaveLength(2);
  });
});
