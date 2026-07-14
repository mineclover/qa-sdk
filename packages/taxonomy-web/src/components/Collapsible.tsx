import { useState } from 'react';

export function Collapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border rounded">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 font-bold text-sm flex justify-between"
      >
        <span>{title}</span>
        <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="p-3">{children}</div>}
    </section>
  );
}
