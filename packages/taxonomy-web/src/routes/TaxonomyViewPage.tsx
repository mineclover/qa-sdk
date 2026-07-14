import { useEffect, useMemo, useState } from 'react';
import type { Lifecycle } from 'taxonomy-engine';
import type { StaticTaxonomy } from '../types/taxonomy';
import type { Feedback } from '../types/feedback';
import type { TaxonomyIndex } from '../types/taxonomy';
import { loadTaxonomy, loadTaxonomyIndex } from '../data/loadStaticTaxonomies';
import { fetchFeedbacks } from '../data/feedbacksApi';
import { TaxonomyTree } from '../components/TaxonomyTree';
import { LIFECYCLE_VALUES, LifecycleBadge } from '../components/LifecycleBadge';
import { RefBar } from '../components/RefBar';
import { FeedbackPanel } from '../components/FeedbackPanel';
import { UnitDetailPanel } from '../components/UnitDetailPanel';
import { RelatedRulesPanel } from '../components/RelatedRulesPanel';
import { RelatedConstraintsPanel } from '../components/RelatedConstraintsPanel';
import { SiblingEntriesView } from '../components/SiblingEntriesView';
import { GitLogPanel } from '../components/GitLogPanel';
import { RelatedDocsPanel } from '../components/RelatedDocsPanel';
import { DiffContextPanel } from '../components/DiffContextPanel';
import { FeedbackHistoryPanel } from '../components/FeedbackHistoryPanel';
import { Collapsible } from '../components/Collapsible';
import { CoordinateFlowView } from '../components/CoordinateFlowView';
import { DecisionPanel } from '../components/DecisionPanel';
import { parseRef } from 'taxonomy-engine';

export function TaxonomyViewPage({ file }: { file: string }) {
  const [tax, setTax] = useState<StaticTaxonomy | null>(null);
  const [yamlFile, setYamlFile] = useState<string>('');
  const [selectedRef, setSelectedRef] = useState('');
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);

  useEffect(() => {
    loadTaxonomy(file).then(setTax);
  }, [file]);

  // taxonomy → yaml 경로 추정 (index.json의 file 필드 활용)
  useEffect(() => {
    loadTaxonomyIndex().then((idx: TaxonomyIndex) => {
      const t = idx.taxonomies.find((x) => x.file === file);
      if (t) setYamlFile(`docs/taxonomies/${t.name}.yaml`);
    });
  }, [file]);

  const refresh = () => fetchFeedbacks().then(setFeedbacks);
  useEffect(() => {
    refresh();
  }, []);

  const [activeLifecycles, setActiveLifecycles] = useState<Set<Lifecycle | '_none'>>(new Set());

  const lifecycleCounts = useMemo(() => {
    if (!tax) return {} as Record<string, number>;
    const counts: Record<string, number> = {};
    for (const axis of Object.values(tax.axes)) {
      for (const e of axis.entries) {
        const key = e.lifecycle ?? '_none';
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
    return counts;
  }, [tax]);

  const toggleLifecycle = (value: Lifecycle | '_none') => {
    setActiveLifecycles((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  if (!tax) return <div>로딩 중...</div>;

  return (
    <div className="flex gap-2 h-full">
      {/* Tree */}
      <div className="flex-1 overflow-auto p-3 border-r">
        <h2 className="font-bold text-lg mb-2">
          {tax.taxonomy} v{tax.version}
        </h2>
        {tax.description && <p className="text-xs text-gray-600 mb-3">{tax.description}</p>}
        <div className="flex flex-wrap gap-1 mb-3 items-center">
          <span className="text-xs text-gray-500 mr-1">lifecycle:</span>
          {LIFECYCLE_VALUES.map((lc) => {
            const count = lifecycleCounts[lc] ?? 0;
            if (count === 0) return null;
            const on = activeLifecycles.has(lc);
            return (
              <button
                key={lc}
                onClick={() => toggleLifecycle(lc)}
                className={`flex items-center gap-1 ${on ? 'ring-2 ring-blue-400 rounded' : ''}`}
                title={`${lc} ${count}건`}
              >
                <LifecycleBadge value={lc} />
                <span className="text-[10px] text-gray-500">{count}</span>
              </button>
            );
          })}
          {(lifecycleCounts['_none'] ?? 0) > 0 && (
            <button
              onClick={() => toggleLifecycle('_none')}
              className={`flex items-center gap-1 ${activeLifecycles.has('_none') ? 'ring-2 ring-blue-400 rounded' : ''}`}
              title={`(none) ${lifecycleCounts['_none']}건`}
            >
              <LifecycleBadge value={undefined} />
              <span className="text-[10px] text-gray-500">{lifecycleCounts['_none']}</span>
            </button>
          )}
          {activeLifecycles.size > 0 && (
            <button
              onClick={() => setActiveLifecycles(new Set())}
              className="text-[10px] text-blue-600 hover:underline ml-1"
            >
              clear
            </button>
          )}
        </div>
        <TaxonomyTree
          taxonomy={tax}
          onSelectRef={setSelectedRef}
          lifecycleFilter={activeLifecycles.size > 0 ? activeLifecycles : undefined}
        />
      </div>

      {/* Context Panel */}
      <div className="flex-1 overflow-auto p-3 border-r space-y-2">
        <RefBar value={selectedRef} onChange={setSelectedRef} />
        {selectedRef &&
          (() => {
            // Decision 그룹 표시 여부 사전 판단 (그룹 C 헤더 노출 제어)
            let hasDecision = false;
            try {
              const ref = parseRef(selectedRef);
              if (ref.kind === 'entry') {
                const entry = tax.axes[ref.axis]?.entries.find((e) => e.id === ref.entry);
                if (entry?.decisionLink) hasDecision = true;
              }
            } catch {
              hasDecision = false;
            }
            return (
              <>
                {/* 그룹 A — 단위 정보 */}
                <div className="sticky top-0 z-10 bg-white text-xs font-bold uppercase text-gray-500 border-b mb-1 mt-3 pt-3">
                  A. 단위 정보
                </div>
                <Collapsible title="단위 상세" defaultOpen>
                  <UnitDetailPanel selectedRef={selectedRef} taxonomy={tax} />
                </Collapsible>
                <Collapsible title="형제 Entries">
                  <SiblingEntriesView
                    selectedRef={selectedRef}
                    taxonomy={tax}
                    onSelectRef={setSelectedRef}
                  />
                </Collapsible>
                <Collapsible title="Cross-axis 흐름">
                  <CoordinateFlowView
                    selectedRef={selectedRef}
                    taxonomy={tax}
                    onSelectRef={setSelectedRef}
                  />
                </Collapsible>

                {/* 그룹 B — 구조 / 제약 */}
                <div className="sticky top-0 z-10 bg-white text-xs font-bold uppercase text-gray-500 border-b mb-1 mt-3 pt-3">
                  B. 구조 / 제약
                </div>
                <Collapsible title="관련 Relation Rules">
                  <RelatedRulesPanel selectedRef={selectedRef} taxonomy={tax} />
                </Collapsible>
                <Collapsible title="관련 Constraints">
                  <RelatedConstraintsPanel selectedRef={selectedRef} taxonomy={tax} />
                </Collapsible>

                {/* 그룹 C — 변경 / 결정 */}
                <div className="sticky top-0 z-10 bg-white text-xs font-bold uppercase text-gray-500 border-b mb-1 mt-3 pt-3">
                  C. 변경 / 결정
                </div>
                <Collapsible title="main 대비 변경">
                  {yamlFile && <DiffContextPanel file={yamlFile} />}
                </Collapsible>
                {hasDecision &&
                  (() => {
                    const ref = parseRef(selectedRef);
                    if (ref.kind !== 'entry') return null;
                    const entry = tax.axes[ref.axis]?.entries.find((e) => e.id === ref.entry);
                    if (!entry?.decisionLink) return null;
                    return (
                      <Collapsible title="Decision" defaultOpen>
                        <DecisionPanel yamlFile={yamlFile} decisionLink={entry.decisionLink} />
                      </Collapsible>
                    );
                  })()}

                {/* 그룹 D — 역사 */}
                <div className="sticky top-0 z-10 bg-white text-xs font-bold uppercase text-gray-500 border-b mb-1 mt-3 pt-3">
                  D. 역사
                </div>
                <Collapsible title="Git Log (이 yaml)">
                  {yamlFile && <GitLogPanel file={yamlFile} selectedRef={selectedRef} />}
                </Collapsible>
                <Collapsible title="관련 문서 (plans/concepts)">
                  <RelatedDocsPanel selectedRef={selectedRef} />
                </Collapsible>

                {/* 그룹 E — 피드백 */}
                <div className="sticky top-0 z-10 bg-white text-xs font-bold uppercase text-gray-500 border-b mb-1 mt-3 pt-3">
                  E. 피드백
                </div>
                <Collapsible title="이 ref의 모든 피드백" defaultOpen>
                  <FeedbackHistoryPanel selectedRef={selectedRef} feedbacks={feedbacks} />
                </Collapsible>
              </>
            );
          })()}
      </div>

      {/* Feedback Form + Active */}
      <div className="w-1/3 overflow-auto p-3">
        <FeedbackPanel selectedRef={selectedRef} feedbacks={feedbacks} onChanged={refresh} />
      </div>
    </div>
  );
}
