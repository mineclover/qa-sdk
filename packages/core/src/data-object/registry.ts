// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import type { DataObjectBinding } from "./types.js";

export class BindingRegistry {
  private readonly bindingsBySchema = new Map<string, DataObjectBinding>();
  private readonly schemaIdsByPrefix = new Map<string, Set<string>>();

  register(binding: DataObjectBinding): void {
    if (this.bindingsBySchema.has(binding.schemaId)) {
      throw new Error(`Binding already registered for schemaId: "${binding.schemaId}"`);
    }

    const storedBinding = cloneBinding(binding);
    this.bindingsBySchema.set(storedBinding.schemaId, storedBinding);

    const schemaIds = this.schemaIdsByPrefix.get(storedBinding.prefixId) ?? new Set<string>();
    schemaIds.add(storedBinding.schemaId);
    this.schemaIdsByPrefix.set(storedBinding.prefixId, schemaIds);
  }

  getBySchema(schemaId: string): DataObjectBinding | null {
    const binding = this.bindingsBySchema.get(schemaId);
    return binding ? cloneBinding(binding) : null;
  }

  getByPrefix(prefixId: string): DataObjectBinding[] {
    const schemaIds = this.schemaIdsByPrefix.get(prefixId);
    if (!schemaIds) {
      return [];
    }

    return [...schemaIds]
      .map((schemaId) => this.bindingsBySchema.get(schemaId))
      .filter((binding): binding is DataObjectBinding => binding !== undefined)
      .map((binding) => cloneBinding(binding));
  }

  listAll(): DataObjectBinding[] {
    return [...this.bindingsBySchema.values()].map((binding) => cloneBinding(binding));
  }

  remove(schemaId: string): boolean {
    const binding = this.bindingsBySchema.get(schemaId);
    if (!binding) {
      return false;
    }

    this.bindingsBySchema.delete(schemaId);

    const schemaIds = this.schemaIdsByPrefix.get(binding.prefixId);
    if (schemaIds) {
      schemaIds.delete(schemaId);
      if (schemaIds.size === 0) {
        this.schemaIdsByPrefix.delete(binding.prefixId);
      }
    }

    return true;
  }
}

function cloneBinding(binding: DataObjectBinding): DataObjectBinding {
  return {
    ...binding,
    columnToAxis: Object.fromEntries(
      Object.entries(binding.columnToAxis).map(([columnId, mapping]) => [
        columnId,
        { ...mapping },
      ]),
    ),
  };
}
