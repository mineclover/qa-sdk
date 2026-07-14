import { useEffect, useState } from 'react';
import { isValidRef, displayRef } from '../lib/refFormat';

export function RefBar({ value, onChange }: { value: string; onChange: (ref: string) => void }) {
  const [input, setInput] = useState(value);
  useEffect(() => {
    setInput(value);
  }, [value]);
  const valid = input === '' || isValidRef(input);

  return (
    <div className="flex gap-2 items-center">
      <input
        className={`flex-1 border px-2 py-1 rounded font-mono text-sm ${
          valid ? '' : 'border-red-500'
        }`}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onBlur={() => valid && onChange(input)}
        placeholder="taxonomy:axis.entry  또는  taxonomy#/axes/<name>/entries/<id>"
      />
      {valid && input && <span className="text-xs text-gray-500">{displayRef(input)}</span>}
    </div>
  );
}
