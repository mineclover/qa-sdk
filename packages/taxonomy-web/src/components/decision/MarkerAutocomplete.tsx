import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { MARKER_CHEATSHEET, type MarkerSpec } from '../../lib/decisionDemo';

export type MarkerAutocompleteHandle = {
  focus: () => void;
};

/**
 * markdown textarea + ^ 입력 시 마커 후보 popover.
 *
 * 동작:
 *   1. 사용자 입력 → caret 직전이 `^<영문자*>` 패턴이면 popover 표시.
 *   2. 영문자 추가 입력 → 후보 prefix 필터.
 *   3. 후보 클릭 또는 Enter → `^<partial>`을 선택한 marker syntax로 치환.
 *   4. Escape / blur(blur는 click 우선) / 매칭 0건 → popover 닫힘.
 *
 * 좌표 계측은 비싸므로 popover는 textarea 우상단에 고정 표시. 데모 용도엔 충분.
 */
export const MarkerAutocomplete = forwardRef<
  MarkerAutocompleteHandle,
  {
    value: string;
    onChange: (v: string) => void;
    className?: string;
  }
>(function MarkerAutocomplete({ value, onChange, className }, handleRef) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [popover, setPopover] = useState<{ start: number; query: string } | null>(null);

  useImperativeHandle(handleRef, () => ({
    focus: () => ref.current?.focus(),
  }));

  function refreshPopover(text: string, caret: number) {
    const before = text.slice(0, caret);
    const match = before.match(/\^([a-zA-Z_]*)$/);
    if (match) {
      setPopover({ start: caret - match[0].length, query: match[1] });
    } else {
      setPopover(null);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value);
    refreshPopover(e.target.value, e.target.selectionStart);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!popover) return;
    if (e.key === 'Escape') {
      setPopover(null);
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter' && filteredCandidates(popover.query).length > 0) {
      e.preventDefault();
      handleSelect(filteredCandidates(popover.query)[0]);
    }
  }

  function handleSelect(spec: MarkerSpec) {
    if (!popover) return;
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart;
    const before = value.slice(0, popover.start);
    const after = value.slice(caret);
    const snippet = markerSnippet(spec);
    const next = before + snippet + after;
    onChange(next);
    setPopover(null);
    const newCaret = (before + snippet).length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(newCaret, newCaret);
    });
  }

  const candidates = popover ? filteredCandidates(popover.query) : [];

  return (
    <div className="relative flex-1 min-h-0 flex">
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onSelect={(e) =>
          refreshPopover(
            (e.target as HTMLTextAreaElement).value,
            (e.target as HTMLTextAreaElement).selectionStart,
          )
        }
        className={className}
        spellCheck={false}
      />
      {popover && candidates.length > 0 && (
        <div className="absolute right-2 top-2 z-10 bg-white border rounded shadow-lg max-h-64 overflow-auto w-64">
          <div className="px-2 py-1 text-[10px] text-gray-500 border-b bg-gray-50">
            마커 후보 ({candidates.length}) — Enter로 첫 항목 선택
          </div>
          {candidates.map((c) => (
            <button
              key={c.syntax}
              onClick={() => handleSelect(c)}
              onMouseDown={(e) => e.preventDefault()}
              className="block w-full text-left px-2 py-1 hover:bg-blue-50 text-xs border-b last:border-b-0"
            >
              <div className="font-mono text-blue-700">{c.syntax}</div>
              <div className="text-gray-600 text-[11px]">{c.desc}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

function filteredCandidates(query: string): MarkerSpec[] {
  const q = query.toLowerCase();
  return MARKER_CHEATSHEET.filter((m) => nameFromSyntax(m.syntax).startsWith(q));
}

function nameFromSyntax(syntax: string): string {
  // `^purpose` → "purpose", `^option:<id>` → "option"
  const after = syntax.startsWith('^') ? syntax.slice(1) : syntax;
  return after.split(':')[0].toLowerCase();
}

/**
 * 마커 선택 시 본문에 삽입할 텍스트.
 * `<id>` `<kind>` 등 placeholder는 그대로 두어 사용자가 채우게 함.
 * 단, weight=N은 weight=1로 기본값 부여.
 */
function markerSnippet(spec: MarkerSpec): string {
  return spec.syntax.replace(/weight=N/g, 'weight=1');
}
