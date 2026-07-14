// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import {
  collectCommandUsageSpecs,
  descriptorsToTree,
  type CliCommandNode,
  type CommandDescriptor,
  type CommandUsageSpec,
  type RestCommandHandler,
} from '../command-spec.js';
import { cliDocs } from '../commands/docs.js';
import {
  DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_DEPTH,
  DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_LIMIT,
  MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH,
  MAX_DOCUMENT_GRAPH_TRAVERSAL_LIMIT,
} from '../lib/docs-control-plane/index.js';

export const DOCS_COMMAND_DESCRIPTORS = [
  {
    id: 'docs.help',
    path: ['help'],
    usage: 'qa-sdk docs help                  docs control-plane help',
    handlerKey: 'docs.help',
  },
  {
    id: 'docs.status',
    path: ['status'],
    usage: 'qa-sdk docs status [doc-id|path] [--family-only] [--include-session] [--json]',
    handlerKey: 'docs.status',
    options: [
      {
        flag: '--family-only',
        type: 'boolean',
        description: 'limit inventory scope to same-family role docs and direct module children',
      },
      {
        flag: '--include-session',
        type: 'boolean',
        description: 'include transient .ralph-tui session state with --family-only',
      },
      { flag: '--json', type: 'boolean', description: 'emit structured JSON' },
      {
        flag: '--root',
        valueHint: '<dir>',
        type: 'string',
        description: 'repository root override',
      },
    ],
  },
  {
    id: 'docs.explore',
    path: ['explore'],
    usage: 'qa-sdk docs explore <doc-id|path> [--mode intent|map|diagnostic] [--json]',
    handlerKey: 'docs.explore',
    options: [
      { flag: '--json', type: 'boolean', description: 'emit structured JSON' },
      {
        flag: '--mode',
        valueHint: 'intent|map|diagnostic',
        type: 'string',
        description: 'choose intent summary, family map, or diagnostics view',
      },
      {
        flag: '--root',
        valueHint: '<dir>',
        type: 'string',
        description: 'repository root override',
      },
    ],
  },
  {
    id: 'docs.collect',
    path: ['collect'],
    usage:
      'qa-sdk docs collect <doc-id|path> [--graph] [--family-only] [--include-session] [--axis <csv>] [--filter-axis <csv>] [--kind <csv>] [--role <csv>] [--follow-up-category <csv>] [--include-archive] [--direction out|in|both] [--depth <n>] [--limit <n>] [--preset <name>] [--json]',
    handlerKey: 'docs.collect',
    options: [
      {
        flag: '--graph',
        type: 'boolean',
        description: 'use graph traversal; defaults to the family preset',
      },
      {
        flag: '--family-only',
        type: 'boolean',
        description: 'limit inventory scope to same-family role docs and direct module children',
      },
      {
        flag: '--include-session',
        type: 'boolean',
        description: 'include transient .ralph-tui session state with --family-only',
      },
      {
        flag: '--axis',
        valueHint: '<csv>',
        type: 'string',
        description: 'traversal axes, repeatable or comma-separated',
      },
      {
        flag: '--filter-axis',
        valueHint: '<csv>',
        type: 'string',
        description: 'post-traversal view axes, repeatable or comma-separated',
      },
      {
        flag: '--kind',
        valueHint: '<csv>',
        type: 'string',
        description: 'post-traversal document kind filter',
      },
      {
        flag: '--role',
        valueHint: '<csv>',
        type: 'string',
        description: 'post-traversal artifact role filter',
      },
      {
        flag: '--follow-up-category',
        valueHint: '<csv>',
        type: 'string',
        description: 'post-traversal follow-up category filter',
      },
      {
        flag: '--include-archive',
        type: 'boolean',
        description: 'include archived documents in ranked/filtered views',
      },
      {
        flag: '--direction',
        valueHint: 'out|in|both',
        type: 'string',
        description: 'traversal direction',
      },
      {
        flag: '--depth',
        valueHint: '<n>',
        type: 'string',
        description: `non-negative traversal depth (default ${DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_DEPTH}, max ${MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH})`,
      },
      {
        flag: '--limit',
        valueHint: '<n>',
        type: 'string',
        description: `maximum returned nodes (default ${DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_LIMIT}, max ${MAX_DOCUMENT_GRAPH_TRAVERSAL_LIMIT})`,
      },
      { flag: '--preset', valueHint: '<name>', type: 'string', description: 'traversal preset' },
      { flag: '--json', type: 'boolean', description: 'emit structured JSON' },
      {
        flag: '--root',
        valueHint: '<dir>',
        type: 'string',
        description: 'repository root override',
      },
    ],
  },
  {
    id: 'docs.closure',
    path: ['closure'],
    usage: 'qa-sdk docs closure <doc-id|path|source-file[:symbol]> [--json]',
    handlerKey: 'docs.closure',
    options: [
      { flag: '--json', type: 'boolean', description: 'emit structured JSON' },
      {
        flag: '--root',
        valueHint: '<dir>',
        type: 'string',
        description: 'repository root override',
      },
    ],
  },
  {
    id: 'docs.graph',
    path: ['graph'],
    usage:
      'qa-sdk docs graph <target> [--axis <csv>] [--filter-axis <csv>] [--kind <csv>] [--role <csv>] [--follow-up-category <csv>] [--include-archive] [--direction out|in|both] [--depth <n>] [--limit <n>] [--preset <name>] [--verbose] [--json]',
    handlerKey: 'docs.graph',
    options: [
      {
        flag: '--axis',
        valueHint: '<csv>',
        type: 'string',
        description: 'traversal axes, repeatable or comma-separated',
      },
      {
        flag: '--filter-axis',
        valueHint: '<csv>',
        type: 'string',
        description: 'post-traversal view axes; --axis still controls traversal',
      },
      {
        flag: '--kind',
        valueHint: '<csv>',
        type: 'string',
        description: 'post-traversal document kind filter',
      },
      {
        flag: '--role',
        valueHint: '<csv>',
        type: 'string',
        description: 'post-traversal artifact role filter',
      },
      {
        flag: '--follow-up-category',
        valueHint: '<csv>',
        type: 'string',
        description: 'post-traversal follow-up category filter',
      },
      {
        flag: '--include-archive',
        type: 'boolean',
        description: 'include archived documents in ranked/filtered views',
      },
      {
        flag: '--direction',
        valueHint: 'out|in|both',
        type: 'string',
        description: 'traversal direction',
      },
      {
        flag: '--depth',
        valueHint: '<n>',
        type: 'string',
        description: `non-negative traversal depth (default ${DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_DEPTH}, max ${MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH})`,
      },
      {
        flag: '--limit',
        valueHint: '<n>',
        type: 'string',
        description: `maximum returned nodes (default ${DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_LIMIT}, max ${MAX_DOCUMENT_GRAPH_TRAVERSAL_LIMIT})`,
      },
      { flag: '--preset', valueHint: '<name>', type: 'string', description: 'traversal preset' },
      {
        flag: '--verbose',
        type: 'boolean',
        description: 'include raw graph nodes, edge reasons, and role groups in text output',
      },
      { flag: '--json', type: 'boolean', description: 'emit structured JSON' },
      {
        flag: '--root',
        valueHint: '<dir>',
        type: 'string',
        description: 'repository root override',
      },
    ],
  },
  {
    id: 'docs.search',
    path: ['search'],
    usage:
      'qa-sdk docs search <selector|query> [--selector-scope root|family|owned] [--kind <kind>] [--metadata key=value] [--json]',
    handlerKey: 'docs.search',
    options: [
      {
        flag: '--kind',
        valueHint: '<kind>',
        type: 'string',
        description: 'document kind filter, repeatable or comma-separated',
      },
      {
        flag: '--selector-scope',
        valueHint: 'root|family|owned',
        type: 'string',
        description: 'selector result scope when query is service:/owner:/family:/doc:',
      },
      {
        flag: '--metadata',
        valueHint: 'key=value',
        type: 'string',
        description: 'metadata exact-match filter, repeatable or comma-separated',
      },
      { flag: '--json', type: 'boolean', description: 'emit structured JSON' },
      {
        flag: '--root',
        valueHint: '<dir>',
        type: 'string',
        description: 'repository root override',
      },
    ],
  },
  {
    id: 'docs.drift',
    path: ['drift'],
    usage: 'qa-sdk docs drift [--prd <file>] [--include-session] [--json]',
    handlerKey: 'docs.drift',
    options: [
      {
        flag: '--prd',
        valueHint: '<file>',
        type: 'string',
        description: 'scope drift checks to a PRD markdown/JSON family',
      },
      {
        flag: '--include-session',
        type: 'boolean',
        description: 'include transient .ralph-tui session state in drift checks',
      },
      { flag: '--json', type: 'boolean', description: 'emit structured JSON' },
      {
        flag: '--root',
        valueHint: '<dir>',
        type: 'string',
        description: 'repository root override',
      },
    ],
  },
  {
    id: 'docs.cleanup.review',
    path: ['cleanup', 'review'],
    usage:
      'qa-sdk docs cleanup review [doc-id|path] [--prd <file>] [--family-only] [--include-session] [--json]',
    handlerKey: 'docs.cleanup.review',
    options: [
      {
        flag: '--prd',
        valueHint: '<file>',
        type: 'string',
        description: 'scope cleanup review to a PRD markdown/JSON family',
      },
      {
        flag: '--family-only',
        type: 'boolean',
        description:
          'accepted for parity with inventory commands; cleanup review already scopes to the resolved family',
      },
      {
        flag: '--include-session',
        type: 'boolean',
        description: 'include transient session state when resolving the family scope',
      },
      { flag: '--json', type: 'boolean', description: 'emit structured JSON' },
      {
        flag: '--root',
        valueHint: '<dir>',
        type: 'string',
        description: 'repository root override',
      },
    ],
  },
  {
    id: 'docs.cleanup.plan',
    path: ['cleanup', 'plan'],
    usage:
      'qa-sdk docs cleanup plan <record-path|doc-id|paired-path> --action archive|memo-conversion|promote-spec|rewrite [--override <json-file|inline-json>] [--dry-run] [--json]',
    handlerKey: 'docs.cleanup.plan',
    options: [
      {
        flag: '--action',
        valueHint: 'archive|memo-conversion|promote-spec|rewrite',
        type: 'string',
        description: 'cleanup action to plan',
      },
      { flag: '--all', type: 'boolean', description: 'plan every cleanup candidate in scope' },
      {
        flag: '--recommended',
        type: 'boolean',
        description: 'derive batch actions from cleanup review recommendations',
      },
      {
        flag: '--action-map',
        valueHint: '<json-file|inline-json>',
        type: 'string',
        description: 'explicit completed-record -> action mapping for batch cleanup',
      },
      {
        flag: '--override',
        valueHint: '<json-file|inline-json>',
        type: 'string',
        description: 'explicit override object for a single cleanup target',
      },
      { flag: '--dry-run', type: 'boolean', description: 'preview only; default behavior' },
      {
        flag: '--apply',
        type: 'boolean',
        description: 'unsupported until an explicit write workflow is approved',
      },
      { flag: '--json', type: 'boolean', description: 'emit structured JSON' },
      {
        flag: '--root',
        valueHint: '<dir>',
        type: 'string',
        description: 'repository root override',
      },
    ],
  },
  {
    id: 'docs.cleanup.apply',
    path: ['cleanup', 'apply'],
    usage:
      'qa-sdk docs cleanup apply <record-path|doc-id|paired-path> --action archive|memo-conversion|promote-spec|rewrite [--override <json-file|inline-json>] [--json]',
    handlerKey: 'docs.cleanup.apply',
    options: [
      {
        flag: '--action',
        valueHint: 'archive|memo-conversion|promote-spec|rewrite',
        type: 'string',
        description:
          'cleanup action to execute; rewrite uses explicit overrides on the selected record',
      },
      {
        flag: '--all',
        type: 'boolean',
        description: 'apply every cleanup candidate in bounded scope',
      },
      {
        flag: '--recommended',
        type: 'boolean',
        description: 'derive batch actions from cleanup review recommendations',
      },
      {
        flag: '--action-map',
        valueHint: '<json-file|inline-json>',
        type: 'string',
        description: 'explicit completed-record -> action mapping for batch cleanup',
      },
      {
        flag: '--override',
        valueHint: '<json-file|inline-json>',
        type: 'string',
        description: 'explicit override object for a single cleanup target',
      },
      { flag: '--json', type: 'boolean', description: 'emit structured JSON' },
      {
        flag: '--root',
        valueHint: '<dir>',
        type: 'string',
        description: 'repository root override',
      },
    ],
  },
  {
    id: 'docs.bdd.list',
    path: ['bdd', 'list'],
    usage: 'qa-sdk docs bdd list <doc-id|path> [--family-only] [--json]',
    handlerKey: 'docs.bdd.list',
    options: [
      {
        flag: '--family-only',
        type: 'boolean',
        description: 'include same-family role docs and direct module children',
      },
      { flag: '--json', type: 'boolean', description: 'emit structured JSON' },
      {
        flag: '--root',
        valueHint: '<dir>',
        type: 'string',
        description: 'repository root override',
      },
    ],
  },
  {
    id: 'docs.bdd.validate',
    path: ['bdd', 'validate'],
    usage: 'qa-sdk docs bdd validate <doc-id|path> [--family-only] [--json]',
    handlerKey: 'docs.bdd.validate',
    options: [
      {
        flag: '--family-only',
        type: 'boolean',
        description: 'include same-family role docs and direct module children',
      },
      { flag: '--json', type: 'boolean', description: 'emit structured JSON' },
      {
        flag: '--root',
        valueHint: '<dir>',
        type: 'string',
        description: 'repository root override',
      },
    ],
  },
  {
    id: 'docs.bdd.units',
    path: ['bdd', 'units'],
    usage: 'qa-sdk docs bdd units <doc-id|path> [--family-only] [--json]',
    handlerKey: 'docs.bdd.units',
    options: [
      {
        flag: '--family-only',
        type: 'boolean',
        description: 'include same-family role docs and direct module children',
      },
      { flag: '--json', type: 'boolean', description: 'emit structured JSON' },
      {
        flag: '--root',
        valueHint: '<dir>',
        type: 'string',
        description: 'repository root override',
      },
    ],
  },
  {
    id: 'docs.bdd.compile',
    path: ['bdd', 'compile'],
    usage:
      'qa-sdk docs bdd compile <doc-id|path> [--format scenario|pipe|both] [--family-only] [--json]',
    handlerKey: 'docs.bdd.compile',
    options: [
      {
        flag: '--format',
        valueHint: 'scenario|pipe|both',
        type: 'string',
        description: 'compile output format (default: scenario)',
      },
      {
        flag: '--family-only',
        type: 'boolean',
        description: 'include same-family role docs and direct module children',
      },
      { flag: '--json', type: 'boolean', description: 'emit structured JSON' },
      {
        flag: '--root',
        valueHint: '<dir>',
        type: 'string',
        description: 'repository root override',
      },
    ],
  },
  {
    id: 'docs.bdd.test-plan',
    path: ['bdd', 'test-plan'],
    usage: 'qa-sdk docs bdd test-plan <doc-id|path> [--family-only] [--json]',
    handlerKey: 'docs.bdd.test-plan',
    options: [
      {
        flag: '--family-only',
        type: 'boolean',
        description: 'include same-family role docs and direct module children',
      },
      { flag: '--json', type: 'boolean', description: 'emit structured JSON' },
      {
        flag: '--root',
        valueHint: '<dir>',
        type: 'string',
        description: 'repository root override',
      },
    ],
  },
  {
    id: 'docs.bdd.impl-plan',
    path: ['bdd', 'impl-plan'],
    usage: 'qa-sdk docs bdd impl-plan <doc-id|path> [--family-only] [--json]',
    handlerKey: 'docs.bdd.impl-plan',
    options: [
      {
        flag: '--family-only',
        type: 'boolean',
        description: 'include same-family role docs and direct module children',
      },
      { flag: '--json', type: 'boolean', description: 'emit structured JSON' },
      {
        flag: '--root',
        valueHint: '<dir>',
        type: 'string',
        description: 'repository root override',
      },
    ],
  },
  {
    id: 'docs.prd.context',
    path: ['prd', 'context'],
    usage:
      'qa-sdk docs prd context <topic|doc-id> [--family-only] [--include-session] [--kind <csv>] [--role <csv>] [--filter-axis <csv>] [--follow-up-category <csv>] [--include-archive] [--json]',
    handlerKey: 'docs.prd.context',
    options: [
      {
        flag: '--family-only',
        type: 'boolean',
        description: 'limit authoring context to active family documents',
      },
      {
        flag: '--include-session',
        type: 'boolean',
        description: 'include transient .ralph-tui session state with --family-only',
      },
      {
        flag: '--kind',
        valueHint: '<csv>',
        type: 'string',
        description: 'post-traversal document kind filter',
      },
      {
        flag: '--role',
        valueHint: '<csv>',
        type: 'string',
        description: 'post-traversal artifact role filter',
      },
      {
        flag: '--filter-axis',
        valueHint: '<csv>',
        type: 'string',
        description: 'post-traversal view axes',
      },
      {
        flag: '--follow-up-category',
        valueHint: '<csv>',
        type: 'string',
        description: 'post-traversal follow-up category filter',
      },
      {
        flag: '--include-archive',
        type: 'boolean',
        description: 'include archived documents in ranked/filtered views',
      },
      { flag: '--json', type: 'boolean', description: 'emit structured JSON' },
      {
        flag: '--root',
        valueHint: '<dir>',
        type: 'string',
        description: 'repository root override',
      },
    ],
  },
  {
    id: 'docs.prd.scaffold',
    path: ['prd', 'scaffold'],
    usage: 'qa-sdk docs prd scaffold <topic|doc-id> --output <file> [--json]',
    handlerKey: 'docs.prd.scaffold',
    options: [
      {
        flag: '--output',
        valueHint: '<file>',
        type: 'string',
        description: 'markdown scaffold output path',
      },
      { flag: '--json', type: 'boolean', description: 'emit structured JSON' },
      {
        flag: '--root',
        valueHint: '<dir>',
        type: 'string',
        description: 'repository root override',
      },
    ],
  },
  {
    id: 'docs.prd.to-ralph-json',
    path: ['prd', 'to-ralph-json'],
    usage: 'qa-sdk docs prd to-ralph-json <prd.md> --output <prd.json> [--json]',
    handlerKey: 'docs.prd.to-ralph-json',
    options: [
      {
        flag: '--output',
        valueHint: '<prd.json>',
        type: 'string',
        description: 'ralph-compatible PRD JSON output path',
      },
      { flag: '--json', type: 'boolean', description: 'emit structured JSON' },
      {
        flag: '--root',
        valueHint: '<dir>',
        type: 'string',
        description: 'repository root override',
      },
    ],
  },
  {
    id: 'docs.prd.sync-completion',
    path: ['prd', 'sync-completion'],
    usage:
      'qa-sdk docs prd sync-completion --prd <prd.json> --dry-run [--family-only] [--include-session] [--json]',
    handlerKey: 'docs.prd.sync-completion',
    options: [
      {
        flag: '--prd',
        valueHint: '<prd.json>',
        type: 'string',
        description: 'completed ralph PRD JSON path',
      },
      {
        flag: '--dry-run',
        type: 'boolean',
        description: 'preview docs update plan without writing files',
      },
      {
        flag: '--family-only',
        type: 'boolean',
        description: 'limit completion candidates to active family documents',
      },
      {
        flag: '--include-session',
        type: 'boolean',
        description: 'include transient .ralph-tui session state in completion preview',
      },
      { flag: '--json', type: 'boolean', description: 'emit structured JSON' },
      {
        flag: '--root',
        valueHint: '<dir>',
        type: 'string',
        description: 'repository root override',
      },
    ],
  },
  {
    id: 'docs.transform.metadata',
    path: ['transform', 'metadata'],
    usage: 'qa-sdk docs transform metadata --rule <json-file|inline-json> [--dry-run]',
    handlerKey: 'docs.transform.metadata',
    options: [
      {
        flag: '--rule',
        valueHint: '<json-file|inline-json>',
        type: 'string',
        description: 'metadata transform rule',
      },
      { flag: '--dry-run', type: 'boolean', description: 'preview only; default behavior' },
      {
        flag: '--apply',
        type: 'boolean',
        description: 'unsupported in this PRD; returns structured error',
      },
      { flag: '--json', type: 'boolean', description: 'emit structured JSON' },
      {
        flag: '--root',
        valueHint: '<dir>',
        type: 'string',
        description: 'repository root override',
      },
    ],
  },
] as const satisfies readonly CommandDescriptor[];

export const DOCS_COMMAND_TREE = descriptorsToTree(
  DOCS_COMMAND_DESCRIPTORS,
) as readonly CliCommandNode[];

export const DOCS_COMMAND_SPECS = collectCommandUsageSpecs(
  ['docs'],
  DOCS_COMMAND_TREE,
) as readonly CommandUsageSpec<string>[];

export const DOCS_HANDLER_REGISTRY = new Proxy({} as Record<string, RestCommandHandler>, {
  get(_target, prop) {
    if (typeof prop !== 'string' || !prop.startsWith('docs.')) return undefined;
    return async (rest: string[]) => {
      const subcommand = prop.slice(5).split('.');
      await cliDocs([...subcommand, ...rest]);
    };
  },
});
