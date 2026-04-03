import type { DiffDelta, DiffFile, Repository } from "es-git";
import type { BranchChangeFile, BranchChangeStats } from "./branch-conflicts-types.js";

export function collectChangedFiles(
  repo: Repository,
  oldOid: string,
  newOid: string,
): { files: BranchChangeFile[]; diffStats: BranchChangeStats } {
  if (oldOid === newOid) {
    return {
      files: [],
      diffStats: { filesChanged: 0, insertions: 0, deletions: 0 },
    };
  }

  const oldTree = repo.getCommit(oldOid).tree();
  const newTree = repo.getCommit(newOid).tree();
  const diff = repo.diffTreeToTree(oldTree, newTree);

  try {
    diff.findSimilar();
  } catch {
    // rename 탐지는 선택적 기능이므로 실패해도 기본 diff는 계속 사용한다.
  }

  const files = collectIteratorValues(diff.deltas())
    .map((delta) => mapDiffDelta(delta))
    .toSorted((left, right) => left.path.localeCompare(right.path));
  const stats = diff.stats();

  return {
    files,
    diffStats: {
      filesChanged: Number(stats.filesChanged),
      insertions: Number(stats.insertions),
      deletions: Number(stats.deletions),
    },
  };
}

function mapDiffDelta(delta: DiffDelta): BranchChangeFile {
  const oldFile = delta.oldFile();
  const newFile = delta.newFile();
  const path = newFile.path() ?? oldFile.path();

  if (path === null) {
    throw new Error("diff delta 경로를 해석할 수 없음");
  }

  const previousPath = oldFile.path();

  return {
    path,
    previousPath: previousPath !== null && previousPath !== path ? previousPath : null,
    status: delta.status(),
    oldOid: normalizeDiffOid(oldFile),
    newOid: normalizeDiffOid(newFile),
    binary: oldFile.isBinary() || newFile.isBinary(),
  };
}

function normalizeDiffOid(file: DiffFile): string | null {
  if (!file.exists() || !file.isValidId()) return null;
  return file.id();
}

function collectIteratorValues<T>(iterator: Iterator<T, void, void>): T[] {
  const values: T[] = [];

  while (true) {
    const next = iterator.next();
    if (next.done) return values;
    values.push(next.value);
  }
}
