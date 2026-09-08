import test from 'node:test';
import assert from 'node:assert/strict';
import {
  contentId,
  POLICY,
  type Assessment,
  type Gate,
  type Pending,
  type ViewSpec,
} from '../lib/protocol.ts';
import { reconcilePending, type FinalizedReader } from '../lib/recovery.ts';

const source = 'Hello';
const translation = 'Bonjour';
const id = await contentId(source, translation, 'fr');
const account = ('0x' + '1'.repeat(40)) as `0x${string}`;
const pending: Pending = {
  source,
  translation,
  target: 'fr',
  id,
  account,
  hash: ('0x' + 'a'.repeat(64)) as `0x${string}`,
  action: 'assess',
};
const assessment: Assessment = {
  found: true,
  id,
  source,
  translation,
  target: 'fr',
  policy: POLICY,
  submitted_by: account,
  created_at: '2026-09-08T00:00:00Z',
  review: {
    verdict: 'PRESERVED',
    reason_code: 'NONE',
    source_quote: source,
    translation_quote: translation,
    explanation: 'The greeting is preserved.',
  },
};
const gate: Gate = {
  satisfied: true,
  failure_reasons: [],
  policy: POLICY,
  assessment_id: id,
};
const reader = (
  fn: (name: keyof ViewSpec, args: unknown[]) => unknown,
): FinalizedReader => (async (name, args) => fn(name, args)) as FinalizedReader;

void test('missing finalized data remains unknown, not failed or approved', async () => {
  assert.deepEqual(
    await reconcilePending(
      pending,
      reader(() => ({ found: false })),
    ),
    { kind: 'unknown' },
  );
});

void test('RPC errors and rate limits remain unknown', async () => {
  for (const message of [
    'Transaction not found',
    'Network unavailable',
    '429 rate limited',
  ]) {
    assert.deepEqual(
      await reconcilePending(
        pending,
        reader(() => {
          throw new Error(message);
        }),
      ),
      { kind: 'unknown' },
    );
  }
});

void test('a hung read is bounded so local tracking can still be stopped', async () => {
  let finishRead: ((value: unknown) => void) | undefined;
  const result = await reconcilePending(
    pending,
    reader(
      () =>
        new Promise((resolve) => {
          finishRead = resolve;
        }),
    ),
    10,
  );
  assert.deepEqual(result, { kind: 'unknown' });
  finishRead?.(assessment);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(
    result,
    { kind: 'unknown' },
    'late RPC data cannot change a completed recovery result',
  );
});

void test('changed assessments are recovered with their blocked policy intact', async () => {
  const changed = {
    ...assessment,
    review: {
      ...assessment.review,
      verdict: 'CHANGED',
      reason_code: 'CONDITION',
    },
  };
  const blocked = {
    ...gate,
    satisfied: false,
    failure_reasons: ['MEANING_CHANGED'],
  };
  const result = await reconcilePending(
    pending,
    reader((name) => (name === 'get_assessment' ? changed : blocked)),
  );
  assert.equal(result.kind, 'found');
  if (result.kind !== 'found') throw new Error('Expected finalized record');
  assert.equal(result.completed, true);
  assert.equal(result.gate.satisfied, false);
  assert.equal(result.publication.found, false);
});

void test('inconsistent saved content never loads an unrelated approval', async () => {
  let calls = 0;
  assert.deepEqual(
    await reconcilePending(
      { ...pending, source: 'Different text' },
      reader(() => {
        calls++;
        return assessment;
      }),
    ),
    { kind: 'unknown' },
  );
  assert.equal(calls, 0);
  assert.deepEqual(
    await reconcilePending(
      pending,
      reader(() => ({ ...assessment, translation: 'Wrong text' })),
    ),
    { kind: 'unknown' },
  );
});

void test('policy results must belong to the exact assessment and policy', async () => {
  assert.deepEqual(
    await reconcilePending(
      pending,
      reader((name) =>
        name === 'get_assessment'
          ? assessment
          : { ...gate, assessment_id: 'b'.repeat(64) },
      ),
    ),
    { kind: 'unknown' },
  );
});

void test('publication recovery uses the saved sender, not a current wallet guess', async () => {
  const calls: [string, unknown[]][] = [];
  const result = await reconcilePending(
    { ...pending, action: 'publish' },
    reader((name, args) => {
      calls.push([name, args]);
      if (name === 'get_assessment') return assessment;
      if (name === 'evaluate_policy_view') return gate;
      return { found: true, publisher: account };
    }),
  );
  assert.deepEqual(calls.at(-1), ['get_publication', [id, account]]);
  assert.equal(result.kind, 'found');
  if (result.kind !== 'found') throw new Error('Expected publication');
  assert.equal(result.completed, true);
  assert.equal(result.publication.found, true);
});

void test('legacy publication entries without a sender cannot claim publication', async () => {
  const result = await reconcilePending(
    { ...pending, action: 'publish', account: undefined },
    reader((name) => {
      assert.notEqual(name, 'get_publication');
      return name === 'get_assessment' ? assessment : gate;
    }),
  );
  assert.equal(result.kind, 'found');
  if (result.kind !== 'found') throw new Error('Expected assessment');
  assert.equal(result.completed, false);
  assert.equal(result.publication.found, false);
});

void test('an existing assessment alone does not prove a pending publication', async () => {
  const result = await reconcilePending(
    { ...pending, action: 'publish' },
    reader((name) =>
      name === 'get_assessment'
        ? assessment
        : name === 'evaluate_policy_view'
          ? gate
          : { found: false },
    ),
  );
  assert.equal(result.kind, 'found');
  if (result.kind !== 'found') throw new Error('Expected assessment');
  assert.equal(result.completed, false);
});

void test('a publication for a different sender is never accepted', async () => {
  assert.deepEqual(
    await reconcilePending(
      { ...pending, action: 'publish' },
      reader((name) =>
        name === 'get_assessment'
          ? assessment
          : name === 'evaluate_policy_view'
            ? gate
            : { found: true, publisher: '0x' + '2'.repeat(40) },
      ),
    ),
    { kind: 'unknown' },
  );
});
