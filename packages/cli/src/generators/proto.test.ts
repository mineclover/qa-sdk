import { describe, it, expect } from "vitest";
import { generateProto } from "./proto.js";
import type { SchemaSnapshot } from "../lib/types.js";

const SNAPSHOT: SchemaSnapshot = {
  id: "k8s-dsl-v1",
  axes: [
    { id: "k8s_cluster", entries: ["prod-east", "staging"], capacity: 32 },
    { id: "k8s_workload_type", entries: ["deployment", "statefulset", "daemonset"], capacity: 8 },
    { id: "k8s_service", entries: ["gateway", "auth-server"], capacity: 256 },
  ],
  composites: [
    { id: "k8s_workload_addr", dims: ["k8s_cluster", "k8s_workload_type", "k8s_service"], owner: "k8s-dsl-v1" },
  ],
};

describe("generateProto", () => {
  it("축별 enum을 생성한다", () => {
    const proto = generateProto(SNAPSHOT);
    expect(proto).toContain("enum K8sCluster {");
    expect(proto).toContain("K8S_CLUSTER_UNSPECIFIED = 0;");
    expect(proto).toContain("K8S_CLUSTER_PROD_EAST = 1;");
    expect(proto).toContain("K8S_CLUSTER_STAGING = 2;");
  });

  it("entry 순서가 1-based index와 일치한다", () => {
    const proto = generateProto(SNAPSHOT);
    expect(proto).toContain("K8S_WORKLOAD_TYPE_DEPLOYMENT = 1;");
    expect(proto).toContain("K8S_WORKLOAD_TYPE_STATEFULSET = 2;");
    expect(proto).toContain("K8S_WORKLOAD_TYPE_DAEMONSET = 3;");
  });

  it("코어 메시지를 포함한다", () => {
    const proto = generateProto(SNAPSHOT);
    expect(proto).toContain("message ApmRecord {");
    expect(proto).toContain("message ApmEnvelope {");
    expect(proto).toContain("message MetricPayload {");
    expect(proto).toContain("enum RecordKind {");
    expect(proto).toContain("enum MetricType {");
  });

  it("커스텀 package 이름을 지정할 수 있다", () => {
    const proto = generateProto(SNAPSHOT, { packageName: "my.custom.v2" });
    expect(proto).toContain("package my.custom.v2;");
  });

  it("syntax proto3을 포함한다", () => {
    const proto = generateProto(SNAPSHOT);
    expect(proto).toContain('syntax = "proto3";');
  });

  it("capacity 주석을 포함한다", () => {
    const proto = generateProto(SNAPSHOT);
    expect(proto).toContain("// k8s_cluster (capacity: 32)");
    expect(proto).toContain("// k8s_service (capacity: 256)");
  });
});
