import type { TaxonomyIR } from "../schema/ir.js";

export class TaxonomyRegistry {
  private map = new Map<string, TaxonomyIR>();

  add(ir: TaxonomyIR): void {
    this.map.set(ir.taxonomy, ir);
  }

  get(taxonomy: string): TaxonomyIR | undefined {
    return this.map.get(taxonomy);
  }

  list(): string[] {
    return [...this.map.keys()];
  }
}
