import { describe, it, expect } from "vitest";
import { generateTypescript } from "./typescript.js";
import type { SchemaSnapshot } from "../lib/types.js";

const SNAPSHOT: SchemaSnapshot = {
  id: "k8s-dsl-v1",
  axes: [
    { id: "k8s_cluster", entries: ["prod-east", "staging", "dev"], capacity: 32 },
    { id: "k8s_workload_type", entries: ["deployment", "statefulset"], capacity: 8 },
    { id: "k8s_service", entries: [], capacity: 256 },
  ],
  composites: [
    { id: "k8s_workload_addr", dims: ["k8s_cluster", "k8s_workload_type", "k8s_service"], owner: "k8s-dsl-v1" },
  ],
};

describe("generateTypescript", () => {
  it("축별 const 객체를 생성한다", () => {
    const ts = generateTypescript(SNAPSHOT);
    expect(ts).toContain("export const K8S_CLUSTER = {");
    expect(ts).toContain('PROD_EAST: "prod-east",');
    expect(ts).toContain('STAGING: "staging",');
    expect(ts).toContain("} as const;");
  });

  it("축별 유니온 타입을 생성한다", () => {
    const ts = generateTypescript(SNAPSHOT);
    expect(ts).toContain("export type K8sCluster = typeof K8S_CLUSTER[keyof typeof K8S_CLUSTER];");
  });

  it("composite Dims 인터페이스를 생성한다", () => {
    const ts = generateTypescript(SNAPSHOT);
    expect(ts).toContain("export interface K8sWorkloadAddrDims {");
    expect(ts).toContain("k8s_cluster: K8sCluster;");
    expect(ts).toContain("k8s_workload_type: K8sWorkloadType;");
    // entries가 비어있으면 string 타입
    expect(ts).toContain("k8s_service: string;");
  });

  it("코어 APM 타입을 포함한다", () => {
    const ts = generateTypescript(SNAPSHOT);
    expect(ts).toContain("export interface ApmRecord {");
    expect(ts).toContain("export interface ApmEnvelope {");
    expect(ts).toContain("export interface MetricPayload {");
    expect(ts).toContain('export type RecordKind = "log" | "span" | "metric";');
  });

  it("capacity 주석을 포함한다", () => {
    const ts = generateTypescript(SNAPSHOT);
    expect(ts).toContain("/** k8s_cluster axis entries (capacity: 32) */");
    expect(ts).toContain("/** k8s_service axis entries (capacity: 256) */");
  });

  it("자동 생성 경고를 포함한다", () => {
    const ts = generateTypescript(SNAPSHOT);
    expect(ts).toContain("자동 생성 파일");
  });

  it("GENERATION 상수를 포함한다", () => {
    const ts = generateTypescript(SNAPSHOT);
    expect(ts).toContain('export const GENERATION = "k8s-dsl-v1" as const;');
  });

  it("PREFIXES에 capacity/stride가 포함된다", () => {
    const ts = generateTypescript(SNAPSHOT);
    expect(ts).toContain("capacity:");
    expect(ts).toContain("stride:");
  });
});
