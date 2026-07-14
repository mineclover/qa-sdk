// @def.doc doc-envelope-test

import { describe, expect, it } from 'vitest';

import { normalizeDocumentEnvelope } from './normalize.js';
import {
  CANONICAL_TODO_CATEGORY_LABELS,
  classifyTodoHeading,
  parseTodoFollowUps,
} from './todo-lifecycle.js';

const TODO_DOCUMENT = normalizeDocumentEnvelope({
  adapterId: 'definition-markdown',
  kind: 'todo',
  stableId: 'lifecycle-todo',
  path: 'docs/specs/lifecycle/lifecycle.todo.md',
  rawSource: {
    path: 'docs/specs/lifecycle/lifecycle.todo.md',
  },
});

describe('docs-control-plane TODO lifecycle parser', () => {
  it('preserves parent and child checkbox hierarchy context', () => {
    const followUps = parseTodoFollowUps(
      TODO_DOCUMENT,
      `# Lifecycle Todo

## Actionable — 실행 가능

- [ ] Parent work item.
  - [ ] Child checklist item.
    - [ ] Grandchild checklist item.
  - [x] Completed sibling.
- [ ] Next top-level item.
`,
    );

    expect(followUps).toEqual([
      expect.objectContaining({
        title: 'Parent work item.',
        pointer: 'line 5',
        depth: 0,
        headingPath: ['Actionable — 실행 가능'],
        category: 'actionable',
        categoryLabel: CANONICAL_TODO_CATEGORY_LABELS.actionable,
      }),
      expect.objectContaining({
        title: 'Child checklist item.',
        pointer: 'line 6',
        depth: 1,
        parentTitle: 'Parent work item.',
        headingPath: ['Actionable — 실행 가능'],
        category: 'actionable',
        categoryLabel: CANONICAL_TODO_CATEGORY_LABELS.actionable,
      }),
      expect.objectContaining({
        title: 'Grandchild checklist item.',
        pointer: 'line 7',
        depth: 2,
        parentTitle: 'Child checklist item.',
        headingPath: ['Actionable — 실행 가능'],
        category: 'actionable',
        categoryLabel: CANONICAL_TODO_CATEGORY_LABELS.actionable,
      }),
      expect.objectContaining({
        title: 'Next top-level item.',
        pointer: 'line 9',
        depth: 0,
        headingPath: ['Actionable — 실행 가능'],
        category: 'actionable',
        categoryLabel: CANONICAL_TODO_CATEGORY_LABELS.actionable,
      }),
    ]);
    expect(followUps[0]).not.toHaveProperty('parentTitle');
    expect(followUps[3]).not.toHaveProperty('parentTitle');
  });

  it('infers canonical, Korean, inherited, and uncategorized heading categories', () => {
    expect(classifyTodoHeading('Completed — 완료 기록')).toEqual({
      category: 'completed',
      label: CANONICAL_TODO_CATEGORY_LABELS.completed,
    });
    expect(classifyTodoHeading('실행 가능')).toEqual({
      category: 'actionable',
      label: CANONICAL_TODO_CATEGORY_LABELS.actionable,
    });
    expect(classifyTodoHeading('보류')).toEqual({
      category: 'deferred',
      label: CANONICAL_TODO_CATEGORY_LABELS.deferred,
    });
    expect(classifyTodoHeading('아이디어')).toEqual({
      category: 'parking-lot',
      label: CANONICAL_TODO_CATEGORY_LABELS['parking-lot'],
    });
    expect(classifyTodoHeading('운영 메모')).toEqual({
      category: 'uncategorized',
      label: '운영 메모',
    });

    const followUps = parseTodoFollowUps(
      TODO_DOCUMENT,
      `# Lifecycle Todo

## 구현 항목

### Actionable — 실행 가능

#### Policy Source Adapter

- [ ] Implement adapter.

### Deferred — 조건부 대기

#### Remote Activation

- [ ] Wait for API contract.

### Parking Lot — 후보 보관

#### Candidate Ideas

- [ ] Evaluate optional dashboard.

## 운영 메모

- [ ] Close uncategorized item.
`,
    );

    expect(followUps).toEqual([
      expect.objectContaining({
        title: 'Implement adapter.',
        category: 'actionable',
        categoryLabel: CANONICAL_TODO_CATEGORY_LABELS.actionable,
        headingPath: ['구현 항목', 'Actionable — 실행 가능', 'Policy Source Adapter'],
      }),
      expect.objectContaining({
        title: 'Wait for API contract.',
        category: 'deferred',
        categoryLabel: CANONICAL_TODO_CATEGORY_LABELS.deferred,
        headingPath: ['구현 항목', 'Deferred — 조건부 대기', 'Remote Activation'],
      }),
      expect.objectContaining({
        title: 'Evaluate optional dashboard.',
        category: 'parking-lot',
        categoryLabel: CANONICAL_TODO_CATEGORY_LABELS['parking-lot'],
        headingPath: ['구현 항목', 'Parking Lot — 후보 보관', 'Candidate Ideas'],
      }),
      expect.objectContaining({
        title: 'Close uncategorized item.',
        category: 'uncategorized',
        categoryLabel: '운영 메모',
        headingPath: ['운영 메모'],
      }),
    ]);
  });
});
