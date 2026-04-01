import { describe, it, expect } from "vitest";
import { MemoryPipeGraphStore, MemoryPipeSpecStore } from "./pipe-store.js";
import type { PipeSpec, PipeGraph, PipeFlow } from "./types/pipe-spec.js";

const step = (facet = "소비"): PipeFlow => ({ kind: "step", facet });

const simplePipe: PipeSpec = {
  pipeId: "p1", version: "v1",
  trigger: { eventKey: "e1" },
  flow: step(),
};

const branchPipe: PipeSpec = {
  pipeId: "p2", version: "v1",
  trigger: { eventKey: "e2" },
  flow: { kind: "branch", condition: "x", paths: [step("생산"), step("저장")] },
};

const simpleGraph: PipeGraph = {
  graphId: "g1", version: "v1",
  pipes: [simplePipe, branchPipe],
  connections: [{ from: "p1", to: "p2", kind: "next" }],
  entryPipeId: "p1",
};

describe("MemoryPipeGraphStore", () => {
  it("save + get", () => {
    const store = new MemoryPipeGraphStore();
    store.save(simpleGraph);
    expect(store.get("g1", "v1")).not.toBeNull();
    expect(store.get("g1", "v1")!.graphId).toBe("g1");
  });

  it("getLatest", () => {
    const store = new MemoryPipeGraphStore();
    store.save({ ...simpleGraph, version: "v1" });
    store.save({ ...simpleGraph, version: "v2" });
    expect(store.getLatest("g1")!.version).toBe("v2");
  });

  it("listVersions", () => {
    const store = new MemoryPipeGraphStore();
    store.save({ ...simpleGraph, version: "v1" });
    store.save({ ...simpleGraph, version: "v2" });
    expect(store.listVersions("g1")).toHaveLength(2);
  });

  it("listAll (최신 버전만)", () => {
    const store = new MemoryPipeGraphStore();
    store.save({ ...simpleGraph, version: "v1" });
    store.save({ ...simpleGraph, version: "v2" });
    store.save({ ...simpleGraph, graphId: "g2", version: "v1" });
    expect(store.listAll()).toHaveLength(2);
  });

  it("remove", () => {
    const store = new MemoryPipeGraphStore();
    store.save(simpleGraph);
    expect(store.remove("g1", "v1")).toBe(true);
    expect(store.get("g1", "v1")).toBeNull();
  });

  it("findByPipeId", () => {
    const store = new MemoryPipeGraphStore();
    store.save(simpleGraph);
    expect(store.findByPipeId("p1")).toHaveLength(1);
    expect(store.findByPipeId("unknown")).toHaveLength(0);
  });

  it("findByTriggerEvent", () => {
    const store = new MemoryPipeGraphStore();
    store.save(simpleGraph);
    expect(store.findByTriggerEvent("e1")).toHaveLength(1);
    expect(store.findByTriggerEvent("e2")).toHaveLength(1);
    expect(store.findByTriggerEvent("unknown")).toHaveLength(0);
  });
});

describe("MemoryPipeSpecStore", () => {
  it("save + get + getLatest", () => {
    const store = new MemoryPipeSpecStore();
    store.save(simplePipe);
    store.save({ ...simplePipe, version: "v2" });
    expect(store.get("p1", "v1")).not.toBeNull();
    expect(store.getLatest("p1")!.version).toBe("v2");
  });

  it("listAll + remove", () => {
    const store = new MemoryPipeSpecStore();
    store.save(simplePipe);
    store.save(branchPipe);
    expect(store.listAll()).toHaveLength(2);
    store.remove("p1", "v1");
    expect(store.listAll()).toHaveLength(1);
  });
});
