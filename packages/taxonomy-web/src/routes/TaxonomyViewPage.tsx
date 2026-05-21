import { useEffect, useState } from "react";
import type { StaticTaxonomy } from "../types/taxonomy";
import type { Feedback } from "../types/feedback";
import type { TaxonomyIndex } from "../types/taxonomy";
import { loadTaxonomy, loadTaxonomyIndex } from "../data/loadStaticTaxonomies";
import { fetchFeedbacks } from "../data/feedbacksApi";
import { TaxonomyTree } from "../components/TaxonomyTree";
import { RefBar } from "../components/RefBar";
import { FeedbackPanel } from "../components/FeedbackPanel";
import { UnitDetailPanel } from "../components/UnitDetailPanel";
import { RelatedRulesPanel } from "../components/RelatedRulesPanel";
import { RelatedConstraintsPanel } from "../components/RelatedConstraintsPanel";
import { SiblingEntriesView } from "../components/SiblingEntriesView";
import { GitLogPanel } from "../components/GitLogPanel";
import { RelatedDocsPanel } from "../components/RelatedDocsPanel";
import { DiffContextPanel } from "../components/DiffContextPanel";
import { FeedbackHistoryPanel } from "../components/FeedbackHistoryPanel";
import { Collapsible } from "../components/Collapsible";
import { CoordinateFlowView } from "../components/CoordinateFlowView";

export function TaxonomyViewPage({ file }: { file: string }) {
  const [tax, setTax] = useState<StaticTaxonomy | null>(null);
  const [yamlFile, setYamlFile] = useState<string>("");
  const [selectedRef, setSelectedRef] = useState("");
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
  useEffect(() => { refresh(); }, []);

  if (!tax) return <div>로딩 중...</div>;

  return (
    <div className="flex gap-2 h-full">
      {/* Tree */}
      <div className="flex-1 overflow-auto p-3 border-r">
        <h2 className="font-bold text-lg mb-2">{tax.taxonomy} v{tax.version}</h2>
        {tax.description && <p className="text-xs text-gray-600 mb-3">{tax.description}</p>}
        <TaxonomyTree taxonomy={tax} onSelectRef={setSelectedRef} />
      </div>

      {/* Context Panel */}
      <div className="flex-1 overflow-auto p-3 border-r space-y-2">
        <RefBar value={selectedRef} onChange={setSelectedRef} />
        {selectedRef && (
          <>
            <Collapsible title="단위 상세" defaultOpen>
              <UnitDetailPanel selectedRef={selectedRef} taxonomy={tax} />
            </Collapsible>
            <Collapsible title="관련 Relation Rules">
              <RelatedRulesPanel selectedRef={selectedRef} taxonomy={tax} />
            </Collapsible>
            <Collapsible title="관련 Constraints">
              <RelatedConstraintsPanel selectedRef={selectedRef} taxonomy={tax} />
            </Collapsible>
            <Collapsible title="형제 Entries">
              <SiblingEntriesView selectedRef={selectedRef} taxonomy={tax} onSelectRef={setSelectedRef} />
            </Collapsible>
            <Collapsible title="Git Log (이 yaml)">
              {yamlFile && <GitLogPanel file={yamlFile} selectedRef={selectedRef} />}
            </Collapsible>
            <Collapsible title="관련 문서 (plans/concepts)">
              <RelatedDocsPanel selectedRef={selectedRef} />
            </Collapsible>
            <Collapsible title="main 대비 변경">
              {yamlFile && <DiffContextPanel file={yamlFile} />}
            </Collapsible>
            <Collapsible title="Cross-axis 흐름">
              <CoordinateFlowView selectedRef={selectedRef} taxonomy={tax} onSelectRef={setSelectedRef} />
            </Collapsible>
            <Collapsible title="이 ref의 모든 피드백" defaultOpen>
              <FeedbackHistoryPanel selectedRef={selectedRef} feedbacks={feedbacks} />
            </Collapsible>
          </>
        )}
      </div>

      {/* Feedback Form + Active */}
      <div className="w-1/3 overflow-auto p-3">
        <FeedbackPanel selectedRef={selectedRef} feedbacks={feedbacks} onChanged={refresh} />
      </div>
    </div>
  );
}
