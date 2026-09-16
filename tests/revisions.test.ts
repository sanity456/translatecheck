import test from 'node:test';
import assert from 'node:assert/strict';
import { CORRECTIONS_DEPLOYMENT } from '../lib/deployment.ts';
import { pendingKey, workspaceHarness, label } from './workspace-harness.ts';
import {
  original,
  revised,
  suggestion,
  fixtureReader,
  newText,
} from './revision-fixtures.ts';
import type { Pending } from '../lib/protocol.ts';

async function loaded(
  app: ReturnType<typeof workspaceHarness>,
  text = 'Fix & recheck',
) {
  for (let i = 0; i < 150; i++) {
    await new Promise((r) => setTimeout(r, 2));
    if (label(app.render()).includes(text)) return;
  }
  throw new Error('Assessment did not load: ' + String(app.feedback().error));
}
function publishVisible(app: ReturnType<typeof workspaceHarness>) {
  return app
    .all()
    .some(
      (n) =>
        n.type === 'button' && label(n).includes('Publish exact translation'),
    );
}

void test('new correction request only writes suggest to the companion and never auto-adopts', async () => {
  let present = false;
  const sent: string[] = [];
  const app = workspaceHarness({
    search: '?assessment=' + original.id,
    read: fixtureReader(),
    suggestions: async () => (present ? suggestion : { found: false }),
    write: async (request) => {
      assert.equal(request.address, CORRECTIONS_DEPLOYMENT.address);
      assert.deepEqual(Array.from(request.args), [original.id]);
      sent.push(request.functionName);
      present = true;
      return '0x' + 'b'.repeat(64);
    },
    wait: async () => ({}),
  });
  await loaded(app);
  await app.click('Fix & recheck');
  await app.click('Connect wallet');
  await app.click('Test wallet');
  await app.click('Request correction');
  assert.deepEqual(sent, ['suggest']);
  assert.equal(
    app.all().find((n) => n.props.id === 'translation')?.props.value,
    original.translation,
  );
  assert.equal(publishVisible(app), false);
  assert.equal(app.storage.has(pendingKey), false);
});

void test('a revision that fails its separate assessment remains blocked', async () => {
  const failed = {
    ...revised,
    review: { ...original.review, translation_quote: revised.translation },
  };
  const app = workspaceHarness({
    search: '?assessment=' + original.id,
    read: fixtureReader(
      new Map([
        [original.id, original],
        [revised.id, failed],
      ]),
    ),
  });
  await loaded(app);
  await app.click('Fix & recheck');
  app.edit('translation', newText);
  await app.click('Recheck revision');
  assert.equal(publishVisible(app), false);
  assert.match(label(app.render()), /Publication blocked/);
  assert.equal(app.writes(), 0);
});

void test('accepting a suggestion clears approval and never automatically sends a transaction', async () => {
  const app = workspaceHarness({
    search: '?assessment=' + original.id,
    read: fixtureReader(),
    suggestions: async () => suggestion,
  });
  await loaded(app);
  await app.click('Fix & recheck');
  assert.equal(app.control('Recheck revision').props.disabled, true);
  await app.click('Request correction');
  assert.equal(app.writes(), 0);
  assert.equal(publishVisible(app), false);
  await app.click('Use suggestion');
  assert.equal(
    app.all().find((n) => n.props.id === 'translation')?.props.value,
    newText,
  );
  assert.equal(app.control('Recheck revision').props.disabled, false);
  assert.equal(publishVisible(app), false);
  assert.match(label(app.render()), /Not assessed · publication blocked/);
  assert.equal(app.writes(), 0);
});

void test('revision requires a separate checker write and preserves links to both results', async () => {
  const records = new Map([[original.id, original]]);
  const sent: string[] = [];
  const app = workspaceHarness({
    search: '?assessment=' + original.id,
    read: fixtureReader(records),
    suggestions: async () => suggestion,
    write: async (request) => {
      sent.push(request.functionName);
      assert.deepEqual(Array.from(request.args), [
        original.source,
        revised.translation,
        'fr',
      ]);
      records.set(revised.id, revised);
      return '0x' + 'a'.repeat(64);
    },
    wait: async () => ({}),
  });
  await loaded(app);
  await app.click('Fix & recheck');
  await app.click('Request correction');
  await app.click('Use suggestion');
  await app.click('Connect wallet');
  await app.click('Test wallet');
  await app.click('Recheck revision');
  assert.deepEqual(sent, ['assess']);
  assert.equal(publishVisible(app), true);
  assert.equal(records.get(original.id)?.review.verdict, 'CHANGED');
  assert.ok(
    app.all().some((n) => n.props.href === '?assessment=' + original.id),
  );
  assert.ok(
    app
      .all()
      .some(
        (n) =>
          n.props.href ===
          '?assessment=' + revised.id + '&compare=' + original.id,
      ),
  );
  app.edit('translation', revised.translation + '!');
  assert.equal(publishVisible(app), false);
  assert.match(label(app.render()), /Not assessed · publication blocked/);
});

void test('existing revised assessment is independently read and reused without another transaction', async () => {
  const app = workspaceHarness({
    search: '?assessment=' + original.id,
    read: fixtureReader(
      new Map([
        [original.id, original],
        [revised.id, revised],
      ]),
    ),
  });
  await loaded(app);
  await app.click('Fix & recheck');
  app.edit('translation', newText);
  await app.click('Recheck revision');
  assert.equal(publishVisible(app), true);
  assert.equal(app.writes(), 0);
  assert.match(String(app.feedback().notice), /Reusing its immutable result/);
});

void test('comparison reload fetches both real assessments and rejects an unrelated comparison', async () => {
  const records = new Map([
    [original.id, original],
    [revised.id, revised],
  ]);
  const app = workspaceHarness({
    search: '?assessment=' + revised.id + '&compare=' + original.id,
    read: fixtureReader(records),
  });
  await loaded(app, 'Before · original check');
  assert.equal(publishVisible(app), true);
  assert.equal(app.writes(), 0);
  const bad = workspaceHarness({
    search: '?assessment=' + revised.id + '&compare=' + revised.id,
    read: fixtureReader(records),
  });
  bad.render();
  for (let i = 0; i < 150 && !bad.feedback().error; i++)
    await new Promise((r) => setTimeout(r, 2));
  assert.match(String(bad.feedback().error), /different translations/);
  assert.equal(publishVisible(bad), false);
});

void test('malicious or stale correction cannot be adopted', async () => {
  const app = workspaceHarness({
    search: '?assessment=' + original.id,
    read: fixtureReader(),
    suggestions: async () => ({ ...suggestion, source: 'tampered' }),
  });
  await loaded(app);
  await app.click('Fix & recheck');
  await app.click('Request correction');
  assert.match(String(app.feedback().error), /matching finalized correction/);
  assert.throws(() => app.control('Use suggestion'));
  assert.equal(publishVisible(app), false);
  assert.equal(app.writes(), 0);
});

void test('declining a correction request leaves manual editing available and no pending transaction', async () => {
  const app = workspaceHarness({
    search: '?assessment=' + original.id,
    read: fixtureReader(),
    write: async () => {
      throw { code: 4001 };
    },
  });
  await loaded(app);
  await app.click('Fix & recheck');
  await app.click('Connect wallet');
  await app.click('Test wallet');
  await app.click('Request correction');
  assert.match(String(app.feedback().error), /declined/);
  assert.equal(app.storage.has(pendingKey), false);
  app.edit('translation', newText);
  assert.equal(app.control('Recheck revision').props.disabled, false);
  assert.equal(publishVisible(app), false);
});

void test('a missing correction transaction can be stopped and never masquerades as a completed assessment', async () => {
  const pending: Pending = {
    action: 'suggest',
    hash: ('0x' + 'a'.repeat(64)) as `0x${string}`,
    id: original.id,
    source: original.source,
    translation: original.translation,
    target: original.target,
  };
  const app = workspaceHarness({
    storage: new Map([[pendingKey, JSON.stringify(pending)]]),
    read: fixtureReader(),
  });
  await app.click('Stop tracking');
  await app.click('Check and stop tracking');
  assert.equal(app.storage.has(pendingKey), false);
  assert.match(String(app.feedback().notice), /unconfirmed/);
  assert.equal(publishVisible(app), false);
  assert.equal(app.control('Check meaning').props.disabled, false);
});

void test('resuming correction restores the draft without losing the user’s manual edits or re-submitting', async () => {
  const edited = newText + ' Merci.';
  const pending: Pending = {
    action: 'suggest',
    hash: ('0x' + 'a'.repeat(64)) as `0x${string}`,
    id: original.id,
    source: original.source,
    translation: original.translation,
    target: original.target,
    revisionDraft: edited,
  };
  const app = workspaceHarness({
    storage: new Map([[pendingKey, JSON.stringify(pending)]]),
    read: fixtureReader(),
    suggestions: async () => suggestion,
    wait: async () => ({}),
  });
  await app.click('Resume transaction');
  assert.equal(
    app.all().find((n) => n.props.id === 'translation')?.props.value,
    edited,
  );
  assert.equal(app.storage.has(pendingKey), false);
  assert.equal(publishVisible(app), false);
  assert.equal(app.writes(), 0);
});
