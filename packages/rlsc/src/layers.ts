import type { RLSCNode, LayerStack, LayerRole } from "./types.js";

/**
 * z-index 기반으로 노드를 레이어 스택으로 분류한다.
 *
 * | 범위       | 역할       |
 * |-----------|-----------|
 * | < 0       | background |
 * | 0–9       | content    |
 * | 10–99     | sticky     |
 * | 100–999   | overlay    |
 * | 1000–9999 | modal      |
 * | ≥ 10000   | tooltip    |
 */
export function classifyLayers(nodes: readonly RLSCNode[]): LayerStack[] {
  const groups = new Map<number, RLSCNode[]>();

  for (const node of nodes) {
    if (!node.visible) continue;
    const z = node.zIndex;
    if (!groups.has(z)) groups.set(z, []);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- .has() 직후 .get()
    groups.get(z)!.push(node);
  }

  const stacks: LayerStack[] = [];

  for (const [z, zNodes] of groups) {
    const totalArea = zNodes.reduce(
      (sum, n) => sum + n.rect.width * n.rect.height,
      0,
    );

    stacks.push({
      zIndex: z,
      role: classifyRole(z),
      nodeIds: zNodes.map((n) => n.id),
      totalArea,
    });
  }

  // z-index 순서로 정렬
  stacks.sort((a, b) => a.zIndex - b.zIndex);

  return stacks;
}

function classifyRole(z: number): LayerRole {
  if (z < 0) return "background";
  if (z < 10) return "content";
  if (z < 100) return "sticky";
  if (z < 1000) return "overlay";
  if (z < 10000) return "modal";
  return "tooltip";
}

/** 레이어 스택을 텍스트로 출력 */
export function layersToText(layers: readonly LayerStack[]): string {
  const lines: string[] = [];
  for (const layer of layers) {
    const ids =
      layer.nodeIds.length > 5
        ? `${layer.nodeIds.slice(0, 5).join(", ")} +${layer.nodeIds.length - 5}`
        : layer.nodeIds.join(", ");
    lines.push(
      `  z:${layer.zIndex.toString().padStart(5)}  ${layer.role.padEnd(12)} [${ids}]`,
    );
  }
  return lines.join("\n");
}
