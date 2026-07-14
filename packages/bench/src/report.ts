import type { BenchmarkRunSummary } from './types.js';

export interface BenchmarkReportOptions {
  format?: 'text' | 'markdown';
  title?: string;
  metadata?: Record<string, string | number | boolean | undefined>;
}

export function renderBenchmarkReport(
  summary: BenchmarkRunSummary,
  options: BenchmarkReportOptions = {},
): string {
  const format = options.format ?? 'text';
  if (format === 'markdown') {
    return renderMarkdownReport(summary, options);
  }
  return renderTextReport(summary, options);
}

function renderMarkdownReport(
  summary: BenchmarkRunSummary,
  options: BenchmarkReportOptions,
): string {
  const lines: string[] = [];
  lines.push(`# ${options.title ?? 'Benchmark Report'}`);
  lines.push('');
  lines.push(`- Scenario: \`${summary.scenarioName}\` (\`${summary.scenarioId}\`)`);
  lines.push(`- Started: \`${summary.startedAt}\``);
  lines.push(`- Completed: \`${summary.completedAt}\``);
  lines.push(`- Elapsed: \`${summary.elapsedMs} ms\``);
  lines.push('');

  if (options.metadata && Object.keys(options.metadata).length > 0) {
    lines.push('## Configuration');
    lines.push('');
    for (const [key, value] of Object.entries(options.metadata)) {
      if (value !== undefined) {
        lines.push(`- ${key}: \`${String(value)}\``);
      }
    }
    lines.push('');
  }

  lines.push('## Throughput');
  lines.push('');
  lines.push(`- Scenario rate: \`${summary.scenarioRate}/s\``);
  lines.push(`- Sessions: \`${summary.counters.sessionsStarted}\``);
  lines.push(`- Events: \`${summary.counters.eventsEmitted}\``);
  lines.push(`- Metrics: \`${summary.counters.metricsEmitted}\``);
  lines.push(`- Flush calls: \`${summary.counters.flushCalls}\``);
  lines.push('');
  lines.push('## Latency');
  lines.push('');
  lines.push('| metric | ms |');
  lines.push('|---|---:|');
  lines.push(`| min | ${summary.scenarioLatencyMs.min} |`);
  lines.push(`| avg | ${summary.scenarioLatencyMs.avg} |`);
  lines.push(`| p50 | ${summary.scenarioLatencyMs.p50} |`);
  lines.push(`| p95 | ${summary.scenarioLatencyMs.p95} |`);
  lines.push(`| p99 | ${summary.scenarioLatencyMs.p99} |`);
  lines.push(`| max | ${summary.scenarioLatencyMs.max} |`);
  lines.push('');

  if (summary.transport) {
    lines.push('## Transport');
    lines.push('');
    lines.push('| metric | value |');
    lines.push('|---|---:|');
    lines.push(`| envelopes | ${summary.transport.envelopesSent} |`);
    lines.push(`| records | ${summary.transport.recordsSent} |`);
    lines.push(`| failed sends | ${summary.transport.failedSends} |`);
    if (typeof summary.transport.bytesSent === 'number') {
      lines.push(`| bytes | ${summary.transport.bytesSent} |`);
    }
    lines.push(`| send p50 ms | ${summary.transport.sendLatencyMs.p50} |`);
    lines.push(`| send p95 ms | ${summary.transport.sendLatencyMs.p95} |`);
    lines.push(`| send p99 ms | ${summary.transport.sendLatencyMs.p99} |`);
    lines.push('');

    if (summary.transport.addressContext) {
      lines.push('## Address Context');
      lines.push('');
      lines.push(
        `- Records tagged: \`${summary.transport.addressContext.recordsWithAddressContext}/${summary.transport.addressContext.totalRecords}\``,
      );
      lines.push(
        `- Unique prefixes: \`${summary.transport.addressContext.uniquePrefixes.join(', ') || '-'}\``,
      );
      lines.push('');
      lines.push('| prefix | records |');
      lines.push('|---|---:|');
      for (const prefixId of summary.transport.addressContext.uniquePrefixes) {
        lines.push(`| ${prefixId} | ${summary.transport.addressContext.prefixes[prefixId]} |`);
      }
      lines.push('');
    }
  }

  if (summary.errors) {
    lines.push('## Errors');
    lines.push('');
    lines.push(`- Total: \`${summary.errors.total}\``);
    for (const [context, count] of Object.entries(summary.errors.byContext)) {
      lines.push(`- ${context}: \`${count}\``);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

function renderTextReport(summary: BenchmarkRunSummary, options: BenchmarkReportOptions): string {
  const lines: string[] = [];
  lines.push(`${options.title ?? 'Benchmark Report'}`);
  lines.push('');
  lines.push(`Scenario      : ${summary.scenarioName} (${summary.scenarioId})`);
  lines.push(`Started       : ${summary.startedAt}`);
  lines.push(`Completed     : ${summary.completedAt}`);
  lines.push(`Elapsed       : ${summary.elapsedMs} ms`);
  lines.push(`Rate          : ${summary.scenarioRate}/s`);
  lines.push('');

  if (options.metadata && Object.keys(options.metadata).length > 0) {
    lines.push('Configuration');
    for (const [key, value] of Object.entries(options.metadata)) {
      if (value !== undefined) {
        lines.push(`  ${key.padEnd(14)}: ${String(value)}`);
      }
    }
    lines.push('');
  }

  lines.push('Counters');
  lines.push(`  sessions      : ${summary.counters.sessionsStarted}`);
  lines.push(`  events        : ${summary.counters.eventsEmitted}`);
  lines.push(`  metrics       : ${summary.counters.metricsEmitted}`);
  lines.push(`  flush calls   : ${summary.counters.flushCalls}`);
  lines.push('');
  lines.push('Latency (ms)');
  lines.push(
    `  min/avg       : ${summary.scenarioLatencyMs.min} / ${summary.scenarioLatencyMs.avg}`,
  );
  lines.push(
    `  p50/p95/p99   : ${summary.scenarioLatencyMs.p50} / ${summary.scenarioLatencyMs.p95} / ${summary.scenarioLatencyMs.p99}`,
  );
  lines.push(`  max           : ${summary.scenarioLatencyMs.max}`);

  if (summary.transport) {
    lines.push('');
    lines.push('Transport');
    lines.push(`  envelopes     : ${summary.transport.envelopesSent}`);
    lines.push(`  records       : ${summary.transport.recordsSent}`);
    lines.push(`  failed sends  : ${summary.transport.failedSends}`);
    if (typeof summary.transport.bytesSent === 'number') {
      lines.push(`  bytes         : ${summary.transport.bytesSent}`);
    }
    lines.push(
      `  send p50/p95  : ${summary.transport.sendLatencyMs.p50} / ${summary.transport.sendLatencyMs.p95}`,
    );

    if (summary.transport.addressContext) {
      lines.push('');
      lines.push('Address Context');
      lines.push(
        `  tagged records: ${summary.transport.addressContext.recordsWithAddressContext}/${summary.transport.addressContext.totalRecords}`,
      );
      lines.push(
        `  prefixes      : ${summary.transport.addressContext.uniquePrefixes.join(', ') || '-'}`,
      );
    }
  }

  if (summary.errors) {
    lines.push('');
    lines.push('Errors');
    lines.push(`  total         : ${summary.errors.total}`);
    for (const [context, count] of Object.entries(summary.errors.byContext)) {
      lines.push(`  ${context.padEnd(14)}: ${count}`);
    }
  }

  return lines.join('\n');
}
