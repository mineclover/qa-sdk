import { useEffect, useState } from "react";
import type { StaticTaxonomy } from "../types/taxonomy";
import type { Feedback } from "../types/feedback";
import { loadTaxonomy } from "../data/loadStaticTaxonomies";
import { fetchFeedbacks } from "../data/feedbacksApi";
import { TaxonomyTree } from "../components/TaxonomyTree";
import { RefBar } from "../components/RefBar";
import { FeedbackPanel } from "../components/FeedbackPanel";

export function TaxonomyViewPage({ file }: { file: string }) {
  const [tax, setTax] = useState<StaticTaxonomy | null>(null);
  const [selectedRef, setSelectedRef] = useState("");
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);

  useEffect(() => {
    loadTaxonomy(file).then(setTax);
  }, [file]);

  const refresh = () => fetchFeedbacks().then(setFeedbacks);
  useEffect(() => { refresh(); }, []);

  if (!tax) return <div>로딩 중...</div>;

  return (
    <div className="flex gap-4 h-full">
      <div className="flex-1 overflow-auto p-4">
        <div className="mb-4">
          <h2 className="font-bold text-lg">{tax.taxonomy} v{tax.version}</h2>
          {tax.description && <p className="text-sm text-gray-600">{tax.description}</p>}
        </div>
        <TaxonomyTree taxonomy={tax} onSelectRef={setSelectedRef} />
      </div>

      <div className="w-1/2 overflow-auto p-4 border-l">
        <RefBar value={selectedRef} onChange={setSelectedRef} />
        <div className="mt-4">
          <FeedbackPanel selectedRef={selectedRef} feedbacks={feedbacks} onChanged={refresh} />
        </div>
      </div>
    </div>
  );
}
