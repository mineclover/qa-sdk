import type { StaticTaxonomy, TaxonomyIndex } from '../types/taxonomy';

export async function loadTaxonomyIndex(): Promise<TaxonomyIndex> {
  const res = await fetch('/data/index.json');
  if (!res.ok) throw new Error(`index.json 로드 실패: ${res.status}`);
  return res.json();
}

export async function loadTaxonomy(file: string): Promise<StaticTaxonomy> {
  const res = await fetch(`/data/${file}`);
  if (!res.ok) throw new Error(`${file} 로드 실패: ${res.status}`);
  return res.json();
}
