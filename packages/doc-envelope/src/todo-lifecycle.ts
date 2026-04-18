import type { DocumentEnvelope } from "./types.js";

export type TodoFollowUpCategory =
  | "completed"
  | "actionable"
  | "deferred"
  | "parking-lot"
  | "uncategorized";

export interface TodoHeadingCategory {
  readonly category: TodoFollowUpCategory;
  readonly label: string;
}

export interface TodoLifecycleFollowUp {
  readonly source: string;
  readonly kind: string;
  readonly documentId: string;
  readonly path: string;
  readonly state: string;
  readonly title: string;
  readonly pointer: string;
  readonly depth: number;
  readonly parentTitle?: string;
  readonly headingPath?: readonly string[];
  readonly category: TodoFollowUpCategory;
  readonly categoryLabel: string;
  readonly reason: string;
}

export const CANONICAL_TODO_CATEGORY_LABELS = {
  completed: "Completed — 완료 기록",
  actionable: "Actionable — 실행 가능",
  deferred: "Deferred — 조건부 대기",
  "parking-lot": "Parking Lot — 후보 보관",
  uncategorized: "Uncategorized",
} as const satisfies Record<TodoFollowUpCategory, string>;

export function parseTodoFollowUps(
  document: DocumentEnvelope,
  content: string,
): readonly TodoLifecycleFollowUp[] {
  const followUps: TodoLifecycleFollowUp[] = [];
  let currentCategory = classifyTodoHeading("");
  const headingStack: { level: number; title: string; category: TodoHeadingCategory }[] = [];
  const checklistStack: { indent: number; title: string }[] = [];

  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    const heading = line.match(/^(#{2,6})\s+(.+?)\s*$/);
    if (heading) {
      const level = heading[1]?.length ?? 2;
      const title = heading[2]?.trim() ?? "";
      while (headingStack.length > 0 && headingStack[headingStack.length - 1]!.level >= level) {
        headingStack.pop();
      }
      checklistStack.length = 0;
      const classifiedCategory = classifyTodoHeading(title);
      currentCategory = classifiedCategory.category === "uncategorized"
        ? (headingStack[headingStack.length - 1]?.category ?? classifiedCategory)
        : classifiedCategory;
      headingStack.push({ level, title, category: currentCategory });
      return;
    }

    const checkbox = line.match(/^(\s*)[-*]\s+\[([ xX])\]\s+(.+?)\s*$/);
    if (!checkbox) return;
    const indent = indentationWidth(checkbox[1] ?? "");
    while (checklistStack.length > 0 && checklistStack[checklistStack.length - 1]!.indent >= indent) {
      checklistStack.pop();
    }
    const title = checkbox[3]?.trim() ?? "";
    const parentTitle = checklistStack[checklistStack.length - 1]?.title;
    const depth = checklistStack.length;
    const headingPath = headingStack.map((headingItem) => headingItem.title);

    if ((checkbox[2] ?? "").trim() === "") {
      followUps.push({
        source: document.adapterId,
        kind: document.kind,
        documentId: document.stableId,
        path: document.path,
        state: "open",
        title,
        pointer: `line ${index + 1}`,
        depth,
        ...(parentTitle ? { parentTitle } : {}),
        ...(headingPath.length > 0 ? { headingPath } : {}),
        category: currentCategory.category,
        categoryLabel: currentCategory.label,
        reason: `${currentCategory.label} TODO item`,
      });
    }

    checklistStack.push({ indent, title });
  });

  return followUps;
}

export function countMarkdownCheckboxes(content: string): { readonly open: number; readonly completed: number } {
  let open = 0;
  let completed = 0;
  for (const line of content.split(/\r?\n/)) {
    const checkbox = line.match(/^\s*[-*]\s+\[([ xX])\]\s+/);
    if (!checkbox) continue;
    if ((checkbox[1] ?? "").trim() === "") {
      open += 1;
    } else {
      completed += 1;
    }
  }
  return { open, completed };
}

export function classifyTodoHeading(
  heading: string,
): TodoHeadingCategory {
  const normalized = heading.toLowerCase();
  if (/\bcompleted\b|완료 기록/.test(normalized)) {
    return { category: "completed", label: CANONICAL_TODO_CATEGORY_LABELS.completed };
  }
  if (/\bactionable\b|실행 가능|바로\s*prd|바로 실행/.test(normalized)) {
    return { category: "actionable", label: CANONICAL_TODO_CATEGORY_LABELS.actionable };
  }
  if (/\bdeferred\b|조건부|대기|보류|trigger|blocked/.test(normalized)) {
    return { category: "deferred", label: CANONICAL_TODO_CATEGORY_LABELS.deferred };
  }
  if (/parking\s*lot|후보 보관|아이디어|보관/.test(normalized)) {
    return { category: "parking-lot", label: CANONICAL_TODO_CATEGORY_LABELS["parking-lot"] };
  }
  return { category: "uncategorized", label: heading.trim() || CANONICAL_TODO_CATEGORY_LABELS.uncategorized };
}

function indentationWidth(value: string): number {
  return [...value].reduce((width, character) => width + (character === "\t" ? 4 : 1), 0);
}
