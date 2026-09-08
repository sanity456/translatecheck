export const POLICY = 'translatecheck/meaning-v1';
export const LANGUAGES = {
  fr: 'French',
  es: 'Spanish',
  'zh-CN': 'Mandarin Chinese (Simplified)',
} as const;
export type Language = keyof typeof LANGUAGES;
export type Verdict = 'PRESERVED' | 'CHANGED' | 'REVIEW';
export type Review = {
  verdict: Verdict;
  reason_code: string;
  source_quote: string;
  translation_quote: string;
  explanation: string;
};
export type Assessment = {
  found: true;
  id: string;
  policy: string;
  source: string;
  translation: string;
  target: Language;
  review: Review;
  created_at: string;
  submitted_by: string;
};
export type Gate = {
  satisfied: boolean;
  failure_reasons: string[];
  policy: string;
  assessment_id: string;
};
export type Summary = {
  id: string;
  target: Language;
  source: string;
  verdict: Verdict;
  created_at: string;
};
export type Publication = {
  found: boolean;
  created_at?: string;
  publisher?: string;
};
export type ViewSpec = {
  get_config: {
    args: [];
    result: {
      policy: string;
      assessment_count: number;
      publication_count: number;
    };
  };
  list_assessments: {
    args: [number, number];
    result: { items: Summary[]; total: number; next_offset: number };
  };
  get_assessment: { args: [string]; result: Assessment | { found: false } };
  evaluate_policy_view: {
    args: [string, string, string, Language];
    result: Gate;
  };
  get_publication: { args: [string, string]; result: Publication };
};
export type Pending = {
  hash: `0x${string}`;
  action: 'assess' | 'publish';
  id: string;
  source: string;
  translation: string;
  target: Language;
};
export const LABELS: Record<Verdict, string> = {
  PRESERVED: 'Meaning preserved',
  CHANGED: 'Meaning changed',
  REVIEW: 'Needs review',
};

export function validateDraft(
  source: string,
  translation: string,
  target: string,
) {
  if (!Object.hasOwn(LANGUAGES, target))
    throw new Error('Choose French, Spanish, or Mandarin Chinese.');
  for (const text of [source, translation])
    if (!text.trim() || Array.from(text).length > 1200)
      throw new Error('Enter 1–1,200 characters in both text boxes.');
}

export async function contentId(
  source: string,
  translation: string,
  target: Language,
) {
  validateDraft(source, translation, target);
  const bytes = new TextEncoder().encode(
    JSON.stringify([POLICY, source, translation, target]),
  );
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Calldata decoders may return maps; normalize before displaying chain data.
export function plain(value: unknown): unknown {
  if (value instanceof Map)
    return Object.fromEntries(
      [...value.entries()].map(([k, v]) => [String(k), plain(v)]),
    );
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, plain(v)]),
    );
  return value;
}

export function executionSucceeded(value: unknown): boolean {
  const receipt = plain(value);
  if (!isRecord(receipt)) return false;
  const result = receipt.txExecutionResultName ?? receipt.txExecutionResult;
  if (result !== undefined && result !== null)
    return (
      result === 1 || result === 'FINISHED_WITH_RETURN' || result === 'SUCCESS'
    );
  const leaders = isRecord(receipt.consensus_data)
    ? receipt.consensus_data.leader_receipt
    : null;
  // Studio may mix a quorum-cancelled fallback validator into leader_receipt.
  // Only the actual leader's execution is authoritative here, not idle validators.
  const rows = (
    Array.isArray(leaders) ? leaders : leaders ? [leaders] : []
  ).filter(
    (row): row is Record<string, unknown> =>
      isRecord(row) && (!row.mode || row.mode === 'leader'),
  );
  return (
    rows.length > 0 &&
    rows.every(
      (row) =>
        row.execution_result === 'SUCCESS' ||
        row.execution_result === 'FINISHED_WITH_RETURN',
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function receiptStatus(value: unknown): string {
  const receipt = plain(value);
  const status = isRecord(receipt)
    ? (receipt.statusName ?? receipt.status)
    : undefined;
  return typeof status === 'string' || typeof status === 'number'
    ? String(status).toUpperCase()
    : 'UNKNOWN';
}

export function shortAddress(value: string) {
  return value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}
export function safeError(value: unknown): string {
  const e = value as { code?: number; message?: string; shortMessage?: string };
  if (e?.code === 4001)
    return 'You declined the wallet request. Nothing was submitted.';
  if (e?.code === -32002)
    return 'A request is already open in your wallet. Open the extension to finish it.';
  const message =
    e?.shortMessage ||
    e?.message ||
    'The request could not be completed. Please try again.';
  if (/429|32429|rate.limit/i.test(message))
    return 'GenLayer is rate-limiting requests. Wait a minute, then use Refresh or Resume transaction.';
  return message.slice(0, 350);
}
