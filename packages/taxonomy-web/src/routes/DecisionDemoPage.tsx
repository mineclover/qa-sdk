import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  parseDecisionFile,
  toFlowSchema,
  toMarkdownText,
  extractEvidence,
  extractOptionAnnotations,
  type DecisionFile,
} from 'taxonomy-decision-bridge';
import type { FlowSchema, GateSchema } from 'decision-flow';
import {
  SAMPLE_SKELETON,
  SAMPLE_SINGLE_GATE,
  SAMPLE_MULTI_GATE,
} from '../data/decisionDemoSamples';
import {
  detectSkeleton,
  analyzeEvidenceFanout,
  detectCycles,
  findUnknownMarkers,
  computeMarkerStats,
} from '../lib/decisionDemo';
import { MarkerCheatsheet } from '../components/decision/MarkerCheatsheet';
import { RoundtripDiff } from '../components/decision/RoundtripDiff';
import { SchemaGraph } from '../components/decision/SchemaGraph';
import { EvidenceFanoutWarning } from '../components/decision/EvidenceFanoutWarning';
import { ParseErrorPanel } from '../components/decision/ParseErrorPanel';
import { CycleWarning } from '../components/decision/CycleWarning';
import { UnknownMarkersPanel } from '../components/decision/UnknownMarkersPanel';
import { MarkerStatsPanel } from '../components/decision/MarkerStatsPanel';
import { RoundtripBadge } from '../components/decision/RoundtripBadge';
import { MarkerAutocomplete } from '../components/decision/MarkerAutocomplete';
import { DecisionFilePicker } from '../components/decision/DecisionFilePicker';
import { SyncPreviewPanel } from '../components/decision/SyncPreviewPanel';

type SampleKey = 'skeleton' | 'single' | 'multi';

type ParseState =
  | { kind: 'ok'; file: DecisionFile; schema: FlowSchema }
  | { kind: 'error'; message: string };

export function DecisionDemoPage() {
  const [text, setText] = useState<string>(SAMPLE_MULTI_GATE);
  const [active, setActive] = useState<SampleKey>('multi');
  const [roundtrip, setRoundtrip] = useState<string | null>(null);

  const deferredText = useDeferredValue(text);
  const state: ParseState = useMemo(() => {
    try {
      const file = parseDecisionFile(deferredText);
      const schema = toFlowSchema(file);
      return { kind: 'ok', file, schema };
    } catch (e) {
      return { kind: 'error', message: (e as Error).message };
    }
  }, [deferredText]);

  function loadSample(key: SampleKey) {
    setActive(key);
    setRoundtrip(null);
    setText(
      key === 'skeleton'
        ? SAMPLE_SKELETON
        : key === 'single'
          ? SAMPLE_SINGLE_GATE
          : SAMPLE_MULTI_GATE,
    );
  }

  function downloadMarkdown() {
    const fileName = state.kind === 'ok' ? `${state.file.meta.id}.md` : 'decision.md';
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  function runRoundtrip() {
    if (state.kind !== 'ok') return;
    const evidence = extractEvidence(state.file);
    const md = toMarkdownText({
      schema: state.schema,
      lifecycle: state.file.meta.lifecycle,
      evidence,
      optionAnnotations: extractOptionAnnotations(state.file),
      outcome: state.file.markers.outcome,
      created: state.file.meta.created,
      updated: state.file.meta.updated,
    });
    setRoundtrip(md);
  }

  // 단축키: Cmd/Ctrl + Enter → round-trip, Cmd/Ctrl + 1/2/3 → sample
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        runRoundtrip();
        return;
      }
      if (e.key === '1') {
        e.preventDefault();
        loadSample('skeleton');
      } else if (e.key === '2') {
        e.preventDefault();
        loadSample('single');
      } else if (e.key === '3') {
        e.preventDefault();
        loadSample('multi');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="p-4 h-full flex flex-col gap-3">
      <header className="flex items-center gap-2 flex-wrap">
        <h2 className="font-semibold text-lg">Decision Demo</h2>
        <span className="text-xs text-gray-500">
          markdown → 마커 추출 → FlowSchema → 역방향 라운드트립
        </span>
        {state.kind === 'ok' && <RoundtripBadge file={state.file} schema={state.schema} />}
        <div className="ml-auto flex gap-1 items-center">
          <DecisionFilePicker
            onLoad={(md) => {
              setActive('multi');
              setRoundtrip(null);
              setText(md);
            }}
          />
          <button
            onClick={downloadMarkdown}
            className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
            title="현재 markdown을 .md 파일로 다운로드"
          >
            ⬇ .md 다운로드
          </button>
          <span className="w-px h-5 bg-gray-300 mx-1" />
          <SampleButton active={active === 'skeleton'} onClick={() => loadSample('skeleton')}>
            🌱 skeleton
          </SampleButton>
          <SampleButton active={active === 'single'} onClick={() => loadSample('single')}>
            single-gate
          </SampleButton>
          <SampleButton active={active === 'multi'} onClick={() => loadSample('multi')}>
            multi-gate
          </SampleButton>
        </div>
      </header>
      <div className="text-[10px] text-gray-400">
        단축키 — ⌘/Ctrl+Enter: round-trip · ⌘/Ctrl+1/2/3: sample 전환
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-0">
        <EditorPane
          text={text}
          onChange={(v) => {
            setText(v);
            setRoundtrip(null);
          }}
          canRoundtrip={state.kind === 'ok'}
          onRoundtrip={runRoundtrip}
          roundtrip={roundtrip}
        />

        <div className="flex flex-col gap-3 min-h-0 overflow-auto">
          <MarkerCheatsheet />
          {state.kind === 'error' ? (
            <ParseErrorPanel message={state.message} />
          ) : (
            <ParsedView file={state.file} schema={state.schema} body={state.file.body} />
          )}
        </div>
      </div>
    </div>
  );
}

function EditorPane({
  text,
  onChange,
  canRoundtrip,
  onRoundtrip,
  roundtrip,
}: {
  text: string;
  onChange: (v: string) => void;
  canRoundtrip: boolean;
  onRoundtrip: () => void;
  roundtrip: string | null;
}) {
  return (
    <div className="flex flex-col gap-2 min-h-0">
      <div className="text-xs font-semibold text-gray-600 flex items-center gap-2">
        <span>입력 (markdown)</span>
        <span className="text-[10px] text-gray-400">^ 입력 시 마커 자동완성</span>
        <button
          onClick={onRoundtrip}
          disabled={!canRoundtrip}
          className="ml-auto text-xs px-2 py-0.5 rounded border bg-white hover:bg-gray-50 disabled:opacity-40"
        >
          ↻ round-trip <span className="text-gray-400 text-[10px]">⌘↵</span>
        </button>
      </div>
      <MarkerAutocomplete
        value={text}
        onChange={onChange}
        className="flex-1 min-h-[16rem] font-mono text-xs p-2 border rounded resize-none bg-white"
      />
      {roundtrip && <RoundtripDiff original={text} regenerated={roundtrip} />}
    </div>
  );
}

function SampleButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2 py-1 rounded border ${
        active ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

function ParsedView({
  file,
  schema,
  body,
}: {
  file: DecisionFile;
  schema: FlowSchema;
  body: string;
}) {
  const skeleton = detectSkeleton(file, schema);
  const fanout = analyzeEvidenceFanout(schema);
  const cycles = detectCycles(schema);
  const unknownMarkers = findUnknownMarkers(body);
  const stats = computeMarkerStats(file);

  return (
    <>
      <MetaBlock file={file} skeletonStatus={skeleton.reason} />
      {skeleton.isSkeleton && (
        <div className="text-xs px-3 py-2 rounded bg-amber-50 border border-amber-200 text-amber-800">
          🌱 skeleton — {skeleton.reason}. 마커를 추가하면 schema가 채워집니다.
        </div>
      )}
      <CycleWarning cycles={cycles} />
      <UnknownMarkersPanel markers={unknownMarkers} />
      {schema.gates.length > 1 && <SchemaGraph schema={schema} cycles={cycles} />}
      <EvidenceFanoutWarning fanout={fanout} />
      <MarkerStatsPanel stats={stats} />
      <SyncPreviewPanel file={file} />
      <MarkersBlock file={file} />
      <SchemaBlock schema={schema} />
    </>
  );
}

function MetaBlock({ file, skeletonStatus }: { file: DecisionFile; skeletonStatus: string }) {
  const { meta } = file;
  return (
    <section className="border rounded p-2 bg-white">
      <h3 className="text-xs font-semibold text-gray-600 mb-1">meta</h3>
      <div className="text-xs grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 font-mono">
        <span className="text-gray-500">id</span>
        <span>{meta.id}</span>
        <span className="text-gray-500">subject</span>
        <span>{meta.subject}</span>
        <span className="text-gray-500">lifecycle</span>
        <span>
          <LifecyclePill value={meta.lifecycle} />
        </span>
        <span className="text-gray-500">status</span>
        <span className="text-gray-700 font-sans">{skeletonStatus}</span>
      </div>
    </section>
  );
}

function LifecyclePill({ value }: { value: string }) {
  const color =
    value === 'approved'
      ? 'bg-green-100 text-green-800'
      : value === 'review'
        ? 'bg-blue-100 text-blue-800'
        : value === 'deprecated' || value === 'archived'
          ? 'bg-gray-200 text-gray-700'
          : 'bg-amber-100 text-amber-800';
  return <span className={`px-1.5 rounded ${color}`}>{value}</span>;
}

function MarkersBlock({ file }: { file: DecisionFile }) {
  const m = file.markers;
  const isMulti = m.gates.length > 0;
  return (
    <section className="border rounded p-2 bg-white">
      <h3 className="text-xs font-semibold text-gray-600 mb-1">
        markers {isMulti ? `(multi-gate × ${m.gates.length})` : '(single-gate)'}
      </h3>
      {m.purpose && <MarkerRow label="^purpose" body={m.purpose} />}
      {m.context && <MarkerRow label="^context" body={m.context} />}
      {!isMulti && (
        <>
          <OptionList options={m.options} />
          <ChipRow
            label="^evidence"
            items={m.evidence.map((e) => `${e.kind}(w=${e.weight}) ${e.content}`)}
          />
          {m.phase && <Chip label={`^phase:${m.phase}`} />}
          {m.weight && <Chip label={`^weight:${m.weight}`} />}
          {m.dependsOn.length > 0 && (
            <ChipRow label="^depends_on" items={m.dependsOn.map((d) => `${d.gateId}:${d.kind}`)} />
          )}
        </>
      )}
      {isMulti && (
        <div className="space-y-1.5 mt-1">
          {m.gates.map((g) => (
            <div key={g.id} className="border-l-2 border-blue-300 pl-2">
              <div className="text-xs font-mono text-blue-700">^gate:{g.id}</div>
              <div className="text-xs flex flex-wrap gap-1 mt-0.5">
                {g.phase && <Chip label={`phase:${g.phase}`} />}
                {g.weight && <Chip label={`weight:${g.weight}`} />}
                {g.dependsOn.map((d, i) => (
                  <Chip key={i} label={`→${d.gateId}:${d.kind}`} tone="purple" />
                ))}
              </div>
              <OptionList options={g.options} />
              {g.evidence.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {g.evidence.map((e, i) => (
                    <Chip key={i} label={`${e.kind}(w=${e.weight})`} tone="green" />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {m.outcome && <MarkerRow label="^outcome" body={m.outcome} />}
    </section>
  );
}

function MarkerRow({ label, body }: { label: string; body: string }) {
  return (
    <div className="text-xs mt-1">
      <span className="font-mono text-gray-500">{label}</span>{' '}
      <span className="text-gray-800">{body}</span>
    </div>
  );
}

function OptionList({
  options,
}: {
  options: readonly {
    id: string;
    body: string;
    annotations?: readonly { kind: string; body: string }[];
  }[];
}) {
  if (options.length === 0) return null;
  return (
    <div className="text-xs mt-1 space-y-1">
      <div className="font-mono text-gray-500">^option</div>
      <ul className="ml-2 space-y-1">
        {options.map((o) => (
          <li key={o.id} className="border-l-2 border-blue-200 pl-2">
            <div>
              <span className="font-mono text-blue-700">{o.id}</span>
              <span className="text-gray-700"> — {o.body}</span>
            </div>
            {o.annotations && o.annotations.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {o.annotations.map((a, i) => (
                  <AnnotationChip key={i} kind={a.kind} body={a.body} />
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnnotationChip({ kind, body }: { kind: string; body: string }) {
  const color =
    kind === 'cost'
      ? 'bg-red-50 text-red-700 border-red-200'
      : kind === 'benefit'
        ? 'bg-green-50 text-green-700 border-green-200'
        : 'bg-amber-50 text-amber-700 border-amber-200';
  return (
    <span className={`px-1.5 py-0.5 rounded text-[11px] border ${color}`}>
      <span className="font-mono">{kind}</span>
      <span className="ml-1">{body}</span>
    </span>
  );
}

function ChipRow({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="text-xs mt-1 flex flex-wrap items-center gap-1">
      <span className="font-mono text-gray-500">{label}</span>
      {items.map((s, i) => (
        <Chip key={i} label={s} />
      ))}
    </div>
  );
}

function Chip({
  label,
  tone = 'gray',
}: {
  label: string;
  tone?: 'gray' | 'blue' | 'green' | 'purple';
}) {
  const colors: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    purple: 'bg-purple-100 text-purple-700',
  };
  return <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${colors[tone]}`}>{label}</span>;
}

function SchemaBlock({ schema }: { schema: FlowSchema }) {
  return (
    <section className="border rounded p-2 bg-white">
      <h3 className="text-xs font-semibold text-gray-600 mb-1">
        FlowSchema ({schema.gates.length} gate{schema.gates.length > 1 ? 's' : ''})
      </h3>
      <div className="text-xs font-mono text-gray-600 mb-2">
        {schema.id} · {schema.name}
      </div>
      <div className="space-y-1.5">
        {schema.gates.map((g) => (
          <GateNode key={g.id} gate={g} />
        ))}
      </div>
      {schema.outcomes && schema.outcomes.length > 0 && (
        <div className="mt-2 pt-2 border-t">
          <div className="text-xs text-gray-500 mb-0.5">outcomes</div>
          {schema.outcomes.map((o) => (
            <div key={o.id} className="text-xs font-mono">
              ✓ {o.id} — {o.label}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function GateNode({ gate }: { gate: GateSchema }) {
  return (
    <div className="border-l-2 border-gray-300 pl-2 py-0.5">
      <div className="text-xs font-mono">
        <span className="text-blue-700">{gate.id}</span>
        {gate.name !== gate.id && <span className="text-gray-500"> · {gate.name}</span>}
        <span className="ml-2 text-gray-400">
          phase={gate.phase} weight={gate.weight ?? 'tactical'}
        </span>
      </div>
      {gate.branches && gate.branches.length > 0 && (
        <div className="ml-2 mt-0.5 text-xs">
          {gate.branches.map((b) => (
            <div key={b.id} className="font-mono">
              ├ {b.id} <span className="text-gray-600">— {b.label}</span>
            </div>
          ))}
        </div>
      )}
      {gate.requiredEvidence && gate.requiredEvidence.length > 0 && (
        <div className="ml-2 text-xs text-gray-500">
          requires: {gate.requiredEvidence.join(', ')}
        </div>
      )}
      {gate.affects && gate.affects.length > 0 && (
        <div className="ml-2 text-xs text-purple-600">
          affects: {gate.affects.map((d) => `${d.gateId}(${d.kind})`).join(', ')}
        </div>
      )}
    </div>
  );
}
