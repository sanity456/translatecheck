import test from 'node:test';
import assert from 'node:assert/strict';
import { contentId, POLICY, type Pending } from '../lib/protocol.ts';
import type { FinalizedReader } from '../lib/recovery.ts';
import {
  pendingKey,
  stoppedKey,
  workspaceHarness,
  label,
} from './workspace-harness.ts';

const source = 'Hello';
const translation = 'Bonjour';
const id = await contentId(source, translation, 'fr');
const pending: Pending = {
  id,
  source,
  translation,
  target: 'fr',
  action: 'assess',
  hash: ('0x' + 'a'.repeat(64)) as `0x${string}`,
};
const storageFor = (value = pending) =>
  new Map([[pendingKey, JSON.stringify(value)]]);
const unavailable: FinalizedReader = async () => {
  throw new Error('Network unavailable');
};

void test('missing transaction can be explicitly stopped without a write, including after reload', async () => {
  const storage = storageFor();
  const app = workspaceHarness({ storage, read: unavailable });
  await app.click('Resume transaction');
  assert.equal(app.feedback().error, 'Transaction not found');
  assert.equal(app.control('Check meaning').props.disabled, true);
  await app.click('Stop tracking');
  assert.ok(
    app
      .all()
      .some((node) => label(node).includes('does not cancel the transaction')),
  );
  await app.click('Check and stop tracking');
  assert.equal(storage.has(pendingKey), false);
  assert.equal(storage.get(stoppedKey), pending.hash);
  assert.equal(app.control('Check meaning').props.disabled, false);
  assert.match(String(app.feedback().notice), /outcome is still unconfirmed/);
  assert.equal(app.writes(), 0);
  const reload = workspaceHarness({ storage, read: unavailable });
  assert.equal(reload.control('Check meaning').props.disabled, false);
  assert.ok(
    reload.all().some((node) => String(node.props.href).endsWith(pending.hash)),
  );
});

void test('canceling the stop confirmation keeps the pending transaction', async () => {
  const storage = storageFor();
  const app = workspaceHarness({ storage, read: unavailable });
  await app.click('Stop tracking');
  assert.ok(app.control('Keep tracking'));
  app.closeConfirmation();
  assert.equal(storage.get(pendingKey), JSON.stringify(pending));
  assert.equal(app.control('Check meaning').props.disabled, true);
  assert.equal(app.writes(), 0);
});

void test('recovering a finalized changed assessment never enables publication', async () => {
  const record = {
    ...pending,
    found: true,
    policy: POLICY,
    submitted_by: '0x' + '1'.repeat(40),
    created_at: '2026-09-08T00:00:00Z',
    review: {
      verdict: 'CHANGED',
      reason_code: 'CONDITION',
      source_quote: source,
      translation_quote: translation,
      explanation: 'Mocked changed meaning.',
    },
  };
  const read = (async (name: string) =>
    name === 'get_assessment'
      ? record
      : {
          policy: POLICY,
          assessment_id: id,
          satisfied: false,
          failure_reasons: ['MEANING_CHANGED'],
        }) as FinalizedReader;
  const app = workspaceHarness({ storage: storageFor(), read });
  await app.click('Stop tracking');
  await app.click('Check and stop tracking');
  assert.match(label(app.render()), /Publication blocked/);
  assert.ok(
    !app
      .all()
      .some(
        (node) =>
          node.type === 'button' &&
          /Publish exact translation/.test(label(node)),
      ),
  );
  assert.equal(app.storage.has(pendingKey), false);
  assert.equal(app.writes(), 0);
});

void test('an already-finalized publication is reused before another wallet submission', async () => {
  const account = ('0x' + '1'.repeat(40)) as `0x${string}`;
  const record = {
    ...pending,
    found: true,
    policy: POLICY,
    submitted_by: account,
    created_at: '2026-09-08T00:00:00Z',
    review: {
      verdict: 'PRESERVED',
      reason_code: 'NONE',
      source_quote: source,
      translation_quote: translation,
      explanation: 'Mocked preserved greeting.',
    },
  };
  const read = (async (name: string) =>
    name === 'get_assessment'
      ? record
      : name === 'evaluate_policy_view'
        ? {
            policy: POLICY,
            assessment_id: id,
            satisfied: true,
            failure_reasons: [],
          }
        : { found: true, publisher: account }) as FinalizedReader;
  // A legacy entry has no sender; stopping it may load the assessment but not
  // claim that its publication succeeded. Reconnecting then checks that wallet.
  const app = workspaceHarness({
    storage: storageFor({ ...pending, action: 'publish' }),
    read,
  });
  await app.click('Stop tracking');
  await app.click('Check and stop tracking');
  assert.match(String(app.feedback().notice), /unconfirmed/);
  await app.click('Connect wallet');
  await app.click('Test wallet');
  await app.click('Publish exact translation');
  assert.match(String(app.feedback().notice), /already published/);
  assert.equal(app.writes(), 0);
});
