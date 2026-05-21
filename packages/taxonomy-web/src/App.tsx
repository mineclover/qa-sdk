import { useState } from "react";
import { TaxonomyListPage } from "./routes/TaxonomyListPage";
import { TaxonomyViewPage } from "./routes/TaxonomyViewPage";
import { FeedbacksPage } from "./routes/FeedbacksPage";
import { SearchBar } from "./components/SearchBar";
import { loadTaxonomyIndex } from "./data/loadStaticTaxonomies";

type View = { kind: "list" } | { kind: "taxonomy"; file: string } | { kind: "feedbacks" };

export function App() {
  const [view, setView] = useState<View>({ kind: "list" });

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b px-4 py-2 flex items-center gap-4">
        <h1
          className="font-bold cursor-pointer"
          onClick={() => setView({ kind: "list" })}
        >
          Taxonomy Review
        </h1>
        <nav className="flex gap-3 text-sm">
          <button onClick={() => setView({ kind: "list" })}>Taxonomies</button>
          <button onClick={() => setView({ kind: "feedbacks" })}>전체 피드백</button>
        </nav>
        <div className="ml-auto">
          <SearchBar
            onNavigate={(target) => {
              if (target.file) setView({ kind: "taxonomy", file: target.file });
              if (target.ref) {
                // ref에서 taxonomy slug 추출 후 file 찾기
                const taxSlug = target.ref.split(/[:#@]/)[0];
                loadTaxonomyIndex().then((idx) => {
                  const t = idx.taxonomies.find((x) => x.name === taxSlug);
                  if (t) setView({ kind: "taxonomy", file: t.file });
                });
              }
            }}
          />
        </div>
      </header>
      <main className="flex-1 overflow-auto">
        {view.kind === "list" && (
          <div className="p-4 max-w-2xl">
            <TaxonomyListPage onSelect={(file) => setView({ kind: "taxonomy", file })} />
          </div>
        )}
        {view.kind === "taxonomy" && <TaxonomyViewPage file={view.file} />}
        {view.kind === "feedbacks" && <FeedbacksPage />}
      </main>
    </div>
  );
}
