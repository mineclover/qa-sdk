// @def.doc ralph-tui-integration-test

import { describe, expect, it } from 'vitest';

import { normalizeDocumentEnvelope } from 'doc-envelope';
import type { DocumentEnvelope, DocumentEnvelopeInput } from 'doc-envelope';

import { detectCompletedRalphPrdRecords } from './completed-ralph-prd.js';

describe('ralph-tui-integration — completed ralph PRD detection', () => {
  it('detects completed PRD markdown records from paired passing ralph PRD JSON', () => {
    const prd = document({
      adapterId: 'prd-markdown',
      kind: 'prd',
      stableId: 'tasks/checkout-prd',
      familyId: 'tasks/checkout-prd',
      path: 'tasks/checkout-prd.md',
      metadata: {
        title: 'Checkout PRD',
      },
    });
    const passingJson = document({
      adapterId: 'ralph-prd-json',
      kind: 'ralph-prd-json',
      stableId: 'tasks/checkout-prd',
      familyId: 'tasks/checkout-prd',
      path: 'tasks/checkout-prd.json',
      metadata: {
        name: 'Checkout PRD',
        storyCount: 2,
        passedStoryCount: 2,
      },
      tasks: [
        {
          id: 'US-001',
          title: 'Complete checkout docs',
          metadata: { passes: true },
        },
        {
          id: 'US-002',
          title: 'Validate checkout docs',
          metadata: { passes: true },
        },
      ],
    });
    const incompletePrd = document({
      adapterId: 'prd-markdown',
      kind: 'prd',
      stableId: 'tasks/inventory-prd',
      familyId: 'tasks/inventory-prd',
      path: 'tasks/inventory-prd.md',
      metadata: {
        title: 'Inventory PRD',
      },
    });
    const incompleteJson = document({
      adapterId: 'ralph-prd-json',
      kind: 'ralph-prd-json',
      stableId: 'tasks/inventory-prd',
      familyId: 'tasks/inventory-prd',
      path: 'tasks/inventory-prd.json',
      metadata: {
        name: 'Inventory PRD',
        storyCount: 2,
        passedStoryCount: 1,
      },
    });
    const missingJsonPrd = document({
      adapterId: 'prd-markdown',
      kind: 'prd',
      stableId: 'tasks/billing-prd',
      familyId: 'tasks/billing-prd',
      path: 'tasks/billing-prd.md',
      metadata: {
        title: 'Billing PRD',
      },
    });
    const archivedPrd = document({
      adapterId: 'prd-markdown',
      kind: 'prd',
      stableId: 'tasks/archive/checkout-prd',
      familyId: 'tasks/archive/checkout-prd',
      path: 'tasks/archive/checkout-prd.md',
      metadata: {
        title: 'Archived Checkout PRD',
      },
    });
    const archivedJson = document({
      adapterId: 'ralph-prd-json',
      kind: 'ralph-prd-json',
      stableId: 'tasks/archive/checkout-prd',
      familyId: 'tasks/archive/checkout-prd',
      path: 'tasks/archive/checkout-prd.json',
      metadata: {
        name: 'Archived Checkout PRD',
        storyCount: 1,
        passedStoryCount: 1,
      },
    });

    const records = detectCompletedRalphPrdRecords({
      documents: [
        prd,
        passingJson,
        incompletePrd,
        incompleteJson,
        missingJsonPrd,
        archivedPrd,
        archivedJson,
      ],
    });

    expect(records).toEqual([
      {
        source: 'prd-markdown',
        kind: 'prd',
        documentId: 'tasks/checkout-prd',
        path: 'tasks/checkout-prd.md',
        state: 'completed-record',
        title: 'Checkout PRD',
        pairedDocumentId: 'tasks/checkout-prd',
        pairedPath: 'tasks/checkout-prd.json',
        storyCount: 2,
        passedStoryCount: 2,
        reason: 'paired ralph PRD JSON has all stories passing',
      },
    ]);
  });
});

function document(input: Omit<DocumentEnvelopeInput, 'rawSource'>): DocumentEnvelope {
  return normalizeDocumentEnvelope({
    ...input,
    rawSource: {
      path: input.path,
    },
  });
}
