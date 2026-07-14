export type BillingId = string & { readonly __brand: 'BillingId' };

export function toBillingId(value: string): BillingId {
  if (value.trim().length === 0) {
    throw new Error('BillingId must not be empty.');
  }
  return value as BillingId;
}
