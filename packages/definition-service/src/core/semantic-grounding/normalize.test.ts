import { describe, expect, it } from 'vitest';
import { normalizeSemanticText, tokenizeSemanticText } from './normalize.js';

describe('semantic grounding normalization', () => {
  it('normalizes whitespace, case, and punctuation without dropping Korean text', () => {
    expect(normalizeSemanticText('  상품   담기!! ')).toBe('상품 담기');
    expect(normalizeSemanticText('Cart_Add')).toBe('cart add');
    expect(normalizeSemanticText('cart:add-to cart')).toBe('cart add to cart');
  });

  it('tokenizes normalized text into stable unique tokens', () => {
    expect(tokenizeSemanticText('Cart cart 상품 담기')).toEqual(['cart', '상품', '담기']);
  });
});
