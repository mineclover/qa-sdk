import { describe, it, expect } from "vitest";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readSnapshot, readSnapshots } from "./snapshot-io.js";

const TMP = join(tmpdir(), "qa-cli-test-" + Date.now());

const VALID: object = {
  id: "test-v1",
  axes: [{ id: "a", entries: ["x"], capacity: 8 }],
  composites: [],
};

describe("snapshot-io", () => {
  it("유효한 JSON 파일을 읽는다", async () => {
    await mkdir(TMP, { recursive: true });
    const p = join(TMP, "valid.json");
    await writeFile(p, JSON.stringify(VALID));

    const snap = await readSnapshot(p);
    expect(snap.id).toBe("test-v1");
    expect(snap.axes).toHaveLength(1);
    await rm(TMP, { recursive: true, force: true });
  });

  it("id 없으면 에러", async () => {
    await mkdir(TMP, { recursive: true });
    const p = join(TMP, "bad.json");
    await writeFile(p, JSON.stringify({ axes: [], composites: [] }));

    await expect(readSnapshot(p)).rejects.toThrow("id 누락");
    await rm(TMP, { recursive: true, force: true });
  });

  it("axis ID 중복이면 에러", async () => {
    await mkdir(TMP, { recursive: true });
    const p = join(TMP, "dup.json");
    await writeFile(p, JSON.stringify({
      id: "dup", axes: [{ id: "a", entries: [], capacity: 8 }, { id: "a", entries: [], capacity: 16 }], composites: [],
    }));
    await expect(readSnapshot(p)).rejects.toThrow('axis ID 중복 — "a"');
    await rm(TMP, { recursive: true, force: true });
  });

  it("composite dims가 존재하지 않는 axis를 참조하면 에러", async () => {
    await mkdir(TMP, { recursive: true });
    const p = join(TMP, "bad-ref.json");
    await writeFile(p, JSON.stringify({
      id: "ref", axes: [{ id: "a", entries: [], capacity: 8 }],
      composites: [{ id: "c", dims: ["a", "b"], owner: "x" }],
    }));
    await expect(readSnapshot(p)).rejects.toThrow('dim "b"이 axes에 없음');
    await rm(TMP, { recursive: true, force: true });
  });

  it("snapshotSupply가 있는 composite도 정상 파싱된다", async () => {
    await mkdir(TMP, { recursive: true });
    const p = join(TMP, "supply.json");
    await writeFile(p, JSON.stringify({
      id: "s", axes: [{ id: "a", entries: ["x"], capacity: 8 }],
      composites: [{ id: "c", dims: ["a"], owner: "x", snapshotSupply: { type: "envelope" } }],
    }));
    const snap = await readSnapshot(p);
    expect(snap.composites[0].snapshotSupply).toEqual({ type: "envelope" });
    await rm(TMP, { recursive: true, force: true });
  });

  it("디렉토리 내 모든 .json을 읽는다", async () => {
    await mkdir(TMP, { recursive: true });
    await writeFile(join(TMP, "a.json"), JSON.stringify({ ...VALID, id: "a" }));
    await writeFile(join(TMP, "b.json"), JSON.stringify({ ...VALID, id: "b" }));
    await writeFile(join(TMP, "readme.md"), "ignore");

    const snaps = await readSnapshots(TMP);
    expect(snaps).toHaveLength(2);
    expect(snaps.map((s) => s.id).toSorted()).toEqual(["a", "b"]);
    await rm(TMP, { recursive: true, force: true });
  });
});
