import type {
  DiscountAppliesTo,
  DiscountType,
  DiscountValueType,
} from '../types';

const TYPE: Record<DiscountType, string> = {
  family_discount: 'Familiar',
  scholarship: 'Beca',
  other: 'Otro',
};

const VALUE_TYPE: Record<DiscountValueType, string> = {
  percentage: 'Porcentual',
  fixed: 'Fijo',
};

const APPLIES_TO: Record<DiscountAppliesTo, string> = {
  tuition: 'Mensualidad',
  enrollment_fee: 'Inscripción',
  both: 'Ambos',
};

export function labelDiscountType(v: DiscountType): string {
  return TYPE[v];
}

export function labelDiscountValueType(v: DiscountValueType): string {
  return VALUE_TYPE[v];
}

export function labelDiscountAppliesTo(v: DiscountAppliesTo): string {
  return APPLIES_TO[v];
}

export const DISCOUNT_TYPES: DiscountType[] = [
  'family_discount',
  'scholarship',
  'other',
];

export const DISCOUNT_VALUE_TYPES: DiscountValueType[] = [
  'fixed',
  'percentage',
];

export const DISCOUNT_APPLIES_TO: DiscountAppliesTo[] = [
  'tuition',
  'enrollment_fee',
  'both',
];
