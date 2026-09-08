import {
  contentId,
  POLICY,
  type Assessment,
  type Gate,
  type Pending,
  type Publication,
  type ViewSpec,
} from './protocol.ts';
import { validateComparison } from './corrections.ts';

export type FinalizedReader = <K extends keyof ViewSpec>(
  name: K,
  args: ViewSpec[K]['args'],
) => Promise<ViewSpec[K]['result']>;

export type RecoveryResult =
  | {
      kind: 'found';
      assessment: Assessment;
      gate: Gate;
      publication: Publication;
      completed: boolean;
      revisionParent?: Assessment;
    }
  | { kind: 'unknown' };

// This checks finalized records, not whether the original transaction succeeded.
// Missing data, RPC errors, and timeouts must never manufacture a failed receipt.
export async function reconcilePending(
  pending: Pending,
  read: FinalizedReader,
  timeoutMs = 10000,
): Promise<RecoveryResult> {
  const unknown: RecoveryResult = { kind: 'unknown' };
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function inspect(): Promise<RecoveryResult> {
    if (pending.action === 'suggest') return unknown;
    if (
      (await contentId(pending.source, pending.translation, pending.target)) !==
      pending.id
    )
      return unknown;
    const assessment = await read('get_assessment', [pending.id]);
    if (
      !assessment.found ||
      assessment.id !== pending.id ||
      assessment.policy !== POLICY ||
      assessment.source !== pending.source ||
      assessment.translation !== pending.translation ||
      assessment.target !== pending.target
    )
      return unknown;
    const gate = await read('evaluate_policy_view', [
      pending.id,
      pending.source,
      pending.translation,
      pending.target,
    ]);
    if (gate.assessment_id !== pending.id || gate.policy !== POLICY)
      return unknown;
    let revisionParent: Assessment | undefined;
    if (
      pending.revisionParentId &&
      /^[0-9a-f]{64}$/.test(pending.revisionParentId)
    ) {
      const previous = await read('get_assessment', [pending.revisionParentId]);
      if (previous.found) {
        await validateComparison(previous, assessment);
        revisionParent = previous;
      }
    }
    let publication: Publication = { found: false };
    if (
      pending.action === 'publish' &&
      /^0x[0-9a-fA-F]{40}$/.test(pending.account || '')
    ) {
      publication = await read('get_publication', [
        pending.id,
        pending.account!,
      ]);
      if (
        publication.found &&
        publication.publisher?.toLowerCase() !== pending.account!.toLowerCase()
      )
        return unknown;
    }
    return {
      kind: 'found',
      assessment,
      gate,
      publication,
      completed: pending.action === 'assess' || publication.found,
      ...(revisionParent ? { revisionParent } : {}),
    };
  }
  try {
    return await Promise.race([
      inspect().catch(() => unknown),
      new Promise<RecoveryResult>((resolve) => {
        timer = setTimeout(() => resolve(unknown), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
