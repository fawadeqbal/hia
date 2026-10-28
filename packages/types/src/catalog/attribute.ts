/** How an attribute's values are picked and displayed. */
export const ATTRIBUTE_TYPES = ['select', 'color'] as const;
export type AttributeType = (typeof ATTRIBUTE_TYPES)[number];

export const ATTRIBUTE_TYPE_LABELS: Record<AttributeType, string> = {
  select: 'Text options (size, storage…)',
  color: 'Colour swatches',
};

export interface AttributeValueDto {
  id: string;
  /** Stable key, e.g. "xl", "space-gray". */
  value: string;
  /** Display text, e.g. "XL", "Space Gray". Falls back to value. */
  label: string | null;
  /** #RRGGBB for colour attributes. */
  swatch: string | null;
  position: number;
  /** Number of product variants using this value (cannot be removed while > 0). */
  usageCount: number;
}

export interface AttributeDto {
  id: string;
  name: string;
  /** Stable key used in filters and URLs, e.g. "color", "size". */
  code: string;
  type: AttributeType;
  isFilterable: boolean;
  position: number;
  values: AttributeValueDto[];
}

export interface AttributeValueInput {
  /** Existing value id when updating; omit for a new value. */
  id?: string;
  value: string;
  label?: string | null;
  swatch?: string | null;
  position?: number;
}

/** Body for POST /admin/catalog/attributes and PATCH /admin/catalog/attributes/:id. */
export interface AttributeInput {
  name: string;
  code?: string;
  type?: AttributeType;
  isFilterable?: boolean;
  position?: number;
  /** On update: the full desired list. Values missing from it are removed. */
  values?: AttributeValueInput[];
}

export const attributeValueLabel = (v: Pick<AttributeValueDto, 'label' | 'value'>) =>
  v.label ?? v.value;
