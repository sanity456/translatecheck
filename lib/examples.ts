import type { Language, Review } from './protocol';
export const SOURCE = 'Free delivery on orders over $50.';
export const EXAMPLES: Record<
  Language,
  { translation: string; review: Review }
> = {
  fr: {
    translation: 'Livraison gratuite pour les commandes de moins de 50 $.',
    review: {
      verdict: 'CHANGED',
      reason_code: 'CONDITION',
      source_quote: 'over $50',
      translation_quote: 'moins de 50 $',
      explanation:
        'The translation says under $50. It reverses who qualifies for free delivery.',
    },
  },
  es: {
    translation: 'Envío gratis en pedidos de más de 50 $.',
    review: {
      verdict: 'PRESERVED',
      reason_code: 'NONE',
      source_quote: 'over $50',
      translation_quote: 'más de 50 $',
      explanation:
        'Both versions offer free delivery only when the order exceeds $50.',
    },
  },
  'zh-CN': {
    translation: '订单金额低于50美元即可免费配送。',
    review: {
      verdict: 'CHANGED',
      reason_code: 'CONDITION',
      source_quote: 'over $50',
      translation_quote: '低于50美元',
      explanation:
        'The Chinese translation means below $50, reversing the original eligibility condition.',
    },
  },
};
