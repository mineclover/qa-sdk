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

export type ScreenIdentifierKind = "componentId" | "qaAddress" | "cssSelector" | "nodeId";

export interface ScreenIdentifier {
  readonly kind: ScreenIdentifierKind;
  readonly value: string;
  readonly componentId?: string;
  readonly qaAddress?: string;
  readonly cssSelector?: string;
  readonly nodeId?: string;
}

export interface ScreenIdentifierSource {
  readonly nodeId?: string;
  readonly id?: string;
  readonly tag?: string;
  readonly classes?: readonly string[];
  readonly componentId?: string;
  readonly qaAddress?: string;
  readonly address?: string;
  readonly cssSelector?: string;
  readonly attributes?: Readonly<Record<string, string | undefined>>;
}

export interface ScreenIdentifierElement {
  readonly tagName: string;
  readonly id?: string;
  readonly classList?: { readonly length: number; item(index: number): string | null } | readonly string[];
  readonly parentElement?: ScreenIdentifierElement | null;
  readonly children?: ArrayLike<ScreenIdentifierElement>;
  getAttribute(name: string): string | null;
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

export function createScreenIdentifier(source: ScreenIdentifierSource): ScreenIdentifier {
  const componentId = nonEmpty(
    source.componentId ?? source.attributes?.[COMPONENT_ID_ATTRIBUTE],
  );
  const qaAddress = nonEmpty(
    source.qaAddress ?? source.address ?? source.attributes?.[QA_ADDRESS_ATTRIBUTE],
  );
  const cssSelector = nonEmpty(source.cssSelector);
  const nodeId = nonEmpty(source.nodeId ?? source.id);

  return pickScreenIdentifier({
    componentId,
    qaAddress,
    cssSelector,
    nodeId,
  });
}

export function identifyElement(
  element: ScreenIdentifierElement,
  options: { readonly nodeId?: string } = {},
): ScreenIdentifier {
  return pickScreenIdentifier({
    componentId: nonEmpty(element.getAttribute(COMPONENT_ID_ATTRIBUTE)),
    qaAddress: nonEmpty(element.getAttribute(QA_ADDRESS_ATTRIBUTE)),
    cssSelector: createCssSelector(element),
    nodeId: nonEmpty(options.nodeId),
  });
}

export function createCssSelector(element: ScreenIdentifierElement): string {
  const segments: string[] = [];
  let current: ScreenIdentifierElement | null | undefined = element;

  while (current) {
    const segment = createSelectorSegment(current);
    segments.unshift(segment);

    if (nonEmpty(current.id)) break;
    current = current.parentElement;
  }

  return segments.join(" > ");
}

function pickScreenIdentifier(values: {
  readonly componentId?: string;
  readonly qaAddress?: string;
  readonly cssSelector?: string;
  readonly nodeId?: string;
}): ScreenIdentifier {
  if (values.componentId) {
    return { kind: "componentId", value: values.componentId, ...values };
  }
  if (values.qaAddress) {
    return { kind: "qaAddress", value: values.qaAddress, ...values };
  }
  if (values.cssSelector) {
    return { kind: "cssSelector", value: values.cssSelector, ...values };
  }
  if (values.nodeId) {
    return { kind: "nodeId", value: values.nodeId, ...values };
  }

  return { kind: "nodeId", value: "" };
}

function createSelectorSegment(element: ScreenIdentifierElement): string {
  const tag = element.tagName.toLowerCase();
  const id = nonEmpty(element.id);
  if (id) {
    return isCssIdentifier(id)
      ? `${tag}#${id}`
      : `${tag}[id="${escapeCssString(id)}"]`;
  }

  const classes = classNames(element)
    .slice(0, 2)
    .map((className) =>
      isCssIdentifier(className)
        ? `.${className}`
        : `[class~="${escapeCssString(className)}"]`,
    )
    .join("");
  const nthOfType = nthOfTypeSelector(element);

  return `${tag}${classes}${nthOfType}`;
}

function classNames(element: ScreenIdentifierElement): string[] {
  const { classList } = element;
  if (!classList) return [];
  if (!("item" in classList)) return classList.filter(Boolean);

  const names: string[] = [];
  for (let i = 0; i < classList.length; i += 1) {
    const name = classList.item(i);
    if (name) names.push(name);
  }
  return names;
}

function nthOfTypeSelector(element: ScreenIdentifierElement): string {
  const parent = element.parentElement;
  const siblings = parent?.children;
  if (!siblings) return "";

  const tag = element.tagName.toLowerCase();
  let sameTagCount = 0;
  let index = 0;
  for (let i = 0; i < siblings.length; i += 1) {
    const sibling = siblings[i];
    if (!sibling || sibling.tagName.toLowerCase() !== tag) continue;
    sameTagCount += 1;
    if (sibling === element) index = sameTagCount;
  }

  return sameTagCount > 1 && index > 0 ? `:nth-of-type(${index})` : "";
}

function nonEmpty(value: string | null | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isCssIdentifier(value: string): boolean {
  return /^-?[_A-Za-z][-_A-Za-z0-9]*$/.test(value);
}

function escapeCssString(value: string): string {
  return value.replace(/["\\]/g, (char) => `\\${char}`);
}
