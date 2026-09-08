import { contentId, POLICY, type Assessment } from '../lib/protocol.ts';
import { CORRECTION_POLICY, type Suggestion } from '../lib/corrections.ts';
import { DEPLOYMENT } from '../lib/deployment.ts';
import type { FinalizedReader } from '../lib/recovery.ts';

export const source = 'Free delivery on orders over $50.';
export const oldText =
  'Livraison gratuite pour les commandes de moins de 50 $.';
export const newText = 'Livraison gratuite pour les commandes de plus de 50 $.';
export const original: Assessment = {
  found: true,
  id: await contentId(source, oldText, 'fr'),
  policy: POLICY,
  source,
  translation: oldText,
  target: 'fr',
  created_at: '2026-09-08T09:00:00Z',
  submitted_by: '0x' + '1'.repeat(40),
  review: {
    verdict: 'CHANGED',
    reason_code: 'CONDITION',
    source_quote: 'over $50',
    translation_quote: 'moins de 50 $',
    explanation: 'Under reverses the threshold.',
  },
};
export const revised: Assessment = {
  ...original,
  id: await contentId(source, newText, 'fr'),
  translation: newText,
  review: {
    verdict: 'PRESERVED',
    reason_code: 'NONE',
    source_quote: 'over $50',
    translation_quote: 'plus de 50 $',
    explanation: 'The threshold is preserved.',
  },
};
export const suggestion: Suggestion = {
  found: true,
  parent_id: original.id,
  checker: DEPLOYMENT.address,
  policy: CORRECTION_POLICY,
  source,
  original_translation: oldText,
  target: 'fr',
  advisory_only: true,
  requires_separate_assessment: true,
  created_at: original.created_at,
  requested_by: original.submitted_by,
  suggestion: {
    status: 'SUGGESTED',
    translation: newText,
    explanation: 'Replace under with over.',
  },
};
export function fixtureReader(
  records = new Map([[original.id, original]]),
): FinalizedReader {
  return (async (name: string, args: string[]) => {
    if (name === 'get_assessment')
      return records.get(args[0]) ?? { found: false };
    if (name === 'get_publication') return { found: false };
    if (name === 'evaluate_policy_view') {
      const record = records.get(args[0]);
      const satisfied =
        record?.review.verdict === 'PRESERVED' &&
        record.source === args[1] &&
        record.translation === args[2] &&
        record.target === args[3];
      return {
        policy: POLICY,
        assessment_id: args[0],
        satisfied,
        failure_reasons: satisfied ? [] : ['MEANING_CHANGED'],
      };
    }
    throw new Error('Unexpected read: ' + name);
  }) as FinalizedReader;
}
