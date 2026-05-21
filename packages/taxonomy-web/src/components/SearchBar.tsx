import { useState } from "react";
import { SearchResults } from "./SearchResults";

export function SearchBar({ onNavigate }: { onNavigate: (target: { file?: string; ref?: string }) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <input
        className="border px-2 py-1 rounded text-sm w-64"
        placeholder="검색 (taxonomy/axis/entry/feedback)"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(e.target.value.length > 0);
        }}
        onFocus={() => query && setOpen(true)}
      />
      {open && (
        <SearchResults
          query={query}
          onClose={() => setOpen(false)}
          onNavigate={(t) => {
            onNavigate(t);
            setOpen(false);
            setQuery("");
          }}
        />
      )}
    </div>
  );
}
