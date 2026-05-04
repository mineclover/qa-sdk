// @def.boundary shared-utility-group

export const QA_ADDRESS_ATTRIBUTE = "data-qa-address";
export const COMPONENT_ID_ATTRIBUTE = "data-component-id";
export const DEBUG_LABEL_ATTRIBUTE = "data-debug-label";
export const BOUNDARY_ATTRIBUTE = "data-boundary";

export const DATA_QA_ADDRESS_ATTRIBUTE = QA_ADDRESS_ATTRIBUTE;
export const DATA_COMPONENT_ID_ATTRIBUTE = COMPONENT_ID_ATTRIBUTE;
export const DATA_DEBUG_LABEL_ATTRIBUTE = DEBUG_LABEL_ATTRIBUTE;
export const DATA_BOUNDARY_ATTRIBUTE = BOUNDARY_ATTRIBUTE;

export interface ScreenMetadata {
  readonly address?: string;
  readonly componentId?: string;
  readonly debugLabel?: string;
  readonly boundary?: string;
}

export type MetadataAttributes = Partial<
  Record<
    | typeof QA_ADDRESS_ATTRIBUTE
    | typeof COMPONENT_ID_ATTRIBUTE
    | typeof DEBUG_LABEL_ATTRIBUTE
    | typeof BOUNDARY_ATTRIBUTE,
    string
  >
>;

export interface MetadataAttributeTarget {
  setAttribute(name: string, value: string): void;
}

export function createMetadataAttributes(metadata: ScreenMetadata): MetadataAttributes {
  const attributes: MetadataAttributes = {};

  if (metadata.address !== undefined) {
    attributes[QA_ADDRESS_ATTRIBUTE] = metadata.address;
  }
  if (metadata.componentId !== undefined) {
    attributes[COMPONENT_ID_ATTRIBUTE] = metadata.componentId;
  }
  if (metadata.debugLabel !== undefined) {
    attributes[DEBUG_LABEL_ATTRIBUTE] = metadata.debugLabel;
  }
  if (metadata.boundary !== undefined) {
    attributes[BOUNDARY_ATTRIBUTE] = metadata.boundary;
  }

  return attributes;
}

export function annotateElement<TElement extends MetadataAttributeTarget>(
  element: TElement,
  metadata: ScreenMetadata,
): TElement {
  const attributes = createMetadataAttributes(metadata);

  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }

  return element;
}
