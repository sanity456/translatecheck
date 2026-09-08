import { DEPLOYMENT } from './deployment.ts';
import {
  contentId,
  POLICY,
  validateDraft,
  type Assessment,
  type Language,
  type Pending,
} from './protocol.ts';
import type { FinalizedReader } from './recovery.ts';

export const CORRECTION_POLICY = 'translatecheck/correction-v1';
export type Suggestion = {
  found: true;
  parent_id: string;
  checker: string;
  policy: string;
  source: string;
  original_translation: string;
  target: Language;
  advisory_only: true;
  requires_separate_assessment: true;
  created_at: string;
  requested_by: string;
  suggestion: {
    status: 'SUGGESTED' | 'UNAVAILABLE';
    translation: string;
    explanation: string;
  };
};
export type SuggestionReader = (
  id: string,
) => Promise<Suggestion | { found: false }>;

export async function validateAssessment(
  record: Assessment,
  id: string,
): Promise<void> {
  if (
    !record.found ||
    record.id !== id ||
    record.policy !== POLICY ||
    (await contentId(record.source, record.translation, record.target)) !== id
  )
    throw new Error('The assessment does not match its exact-text identifier.');
}

export async function validateComparison(
  before: Assessment,
  after: Assessment,
): Promise<void> {
  await validateAssessment(before, before.id);
  await validateAssessment(after, after.id);
  if (
    before.id === after.id ||
    before.source !== after.source ||
    before.target !== after.target ||
    before.translation.trim() === after.translation.trim()
  )
    throw new Error(
      'A comparison needs different translations of the same source in the same language.',
    );
}

export async function checkedSuggestion(
  record: Suggestion | { found: false },
  parent: Assessment,
): Promise<Suggestion> {
  await validateAssessment(parent, parent.id);
  if (
    !record.found ||
    record.parent_id !== parent.id ||
    record.policy !== CORRECTION_POLICY ||
    typeof record.checker !== 'string' ||
    record.checker.toLowerCase() !== DEPLOYMENT.address.toLowerCase() ||
    record.source !== parent.source ||
    record.original_translation !== parent.translation ||
    record.target !== parent.target ||
    record.advisory_only !== true ||
    record.requires_separate_assessment !== true
  )
    throw new Error(
      'A matching finalized correction is not available yet. Resume tracking or try again later.',
    );
  const draft = record.suggestion;
  if (
    !draft ||
    typeof draft.translation !== 'string' ||
    typeof draft.explanation !== 'string' ||
    !draft.explanation.trim() ||
    Array.from(draft.explanation).length > 700
  )
    throw new Error(
      'The correction response is invalid. Edit the revision yourself.',
    );
  if (draft.status === 'SUGGESTED') {
    validateDraft(parent.source, draft.translation, parent.target);
    if (draft.translation.trim() === parent.translation.trim())
      throw new Error('The suggestion did not change the translation.');
  } else if (draft.status !== 'UNAVAILABLE' || draft.translation !== '') {
    throw new Error('The correction response is invalid.');
  }
  return record;
}

// Useful for a missing transaction: reconcile records within a bounded period.
// This does not infer transaction success and never submits another transaction.
export async function recoverSuggestion(
  parent: Assessment,
  read: SuggestionReader,
  timeoutMs = 10000,
): Promise<Suggestion | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      read(parent.id)
        .then((r) => checkedSuggestion(r, parent))
        .catch(() => null),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function recoverCorrectionPending(
  pending: Pending,
  read: FinalizedReader,
  suggestions: SuggestionReader,
  timeoutMs = 10000,
): Promise<{ parent: Assessment; suggestion: Suggestion } | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function inspect() {
    if (
      pending.action !== 'suggest' ||
      (await contentId(pending.source, pending.translation, pending.target)) !==
        pending.id
    )
      return null;
    const parent = await read('get_assessment', [pending.id]);
    if (!parent.found) return null;
    await validateAssessment(parent, pending.id);
    return {
      parent,
      suggestion: await checkedSuggestion(
        await suggestions(pending.id),
        parent,
      ),
    };
  }
  try {
    return await Promise.race([
      inspect().catch(() => null),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// Literal quote highlighting, never HTML interpretation. Handles CJK and emoji.
export function quoteParts(
  text: string,
  quote: string,
): { text: string; highlighted: boolean }[] {
  const start = quote ? text.indexOf(quote) : -1;
  if (start < 0) return [{ text, highlighted: false }];
  return [
    { text: text.slice(0, start), highlighted: false },
    { text: quote, highlighted: true },
    { text: text.slice(start + quote.length), highlighted: false },
  ].filter((part) => part.text);
}
