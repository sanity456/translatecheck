import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DEPLOYMENT, CORRECTIONS_DEPLOYMENT } from '../lib/deployment.ts';
import {
  checkedSuggestion,
  quoteParts,
  recoverCorrectionPending,
  recoverSuggestion,
  validateComparison,
} from '../lib/corrections.ts';
import { contentId, type Pending } from '../lib/protocol.ts';
import {
  original,
  revised,
  suggestion,
  fixtureReader,
} from './revision-fixtures.ts';

void test('configured deployment hashes match the exact pinned contract sources', () => {
  for (const [path, config] of [
    ['translatecheck.py', DEPLOYMENT],
    ['translatecheck_corrections.py', CORRECTIONS_DEPLOYMENT],
  ] as const) {
    const source = readFileSync(
      new URL('../contracts/' + path, import.meta.url),
      'utf8',
    );
    assert.equal(
      createHash('sha256').update(source).digest('hex'),
      config.sourceSha256,
    );
    assert.equal(source.split('\n')[0].trim(), '# v0.3.0');
    assert.match(source.split('\n')[1], /py-genlayer:[a-z0-9]{40,}/);
    assert.match(config.address, /^0x[0-9a-fA-F]{40}$/);
  }
});

void test('valid advisory suggestion remains separate from the policy gate', async () => {
  const result = await checkedSuggestion(suggestion, original);
  assert.equal(result.advisory_only, true);
  assert.equal('satisfied' in result, false);
});
for (const [field, value] of Object.entries({
  parent_id: 'b'.repeat(64),
  checker: '0x' + 'a'.repeat(40),
  policy: 'unknown',
  source: 'Different source',
  original_translation: 'Different text',
  target: 'es',
  advisory_only: false,
  requires_separate_assessment: false,
})) {
  void test('reject suggestion with mismatched ' + field, async () => {
    await assert.rejects(
      checkedSuggestion({ ...suggestion, [field]: value }, original),
    );
  });
}
void test('unavailable, unchanged, overlong and malformed suggestions cannot become drafts', async () => {
  await assert.rejects(
    checkedSuggestion(
      {
        ...suggestion,
        suggestion: {
          ...suggestion.suggestion,
          translation: original.translation,
        },
      },
      original,
    ),
  );
  await assert.rejects(
    checkedSuggestion(
      {
        ...suggestion,
        suggestion: { ...suggestion.suggestion, translation: 'x'.repeat(1201) },
      },
      original,
    ),
  );
  await assert.rejects(
    checkedSuggestion(
      {
        ...suggestion,
        suggestion: { ...suggestion.suggestion, status: 'UNAVAILABLE' },
      },
      original,
    ),
  );
  assert.equal(
    (
      await checkedSuggestion(
        {
          ...suggestion,
          suggestion: {
            status: 'UNAVAILABLE',
            translation: '',
            explanation: 'Needs context.',
          },
        },
        original,
      )
    ).suggestion.status,
    'UNAVAILABLE',
  );
});
void test('comparison validates exact commitments and rejects unrelated or unchanged inputs', async () => {
  await validateComparison(original, revised);
  await assert.rejects(validateComparison(original, original));
  await assert.rejects(
    validateComparison(original, { ...revised, source: 'Other' }),
  );
  const foreign = {
    ...revised,
    source: 'Other',
    id: await contentId('Other', revised.translation, 'fr'),
  };
  await assert.rejects(validateComparison(original, foreign));
  const whitespace = {
    ...original,
    translation: original.translation + ' ',
    id: await contentId(original.source, original.translation + ' ', 'fr'),
  };
  await assert.rejects(validateComparison(original, whitespace));
});
void test('quote highlighting is literal, preserves Unicode, and never interprets markup', () => {
  for (const [text, quote] of [
    ['你好，世界🌍', '世界🌍'],
    ['<script>alert(1)</script>', '<script>'],
    ['hello', 'missing'],
  ]) {
    const parts = quoteParts(text, quote);
    assert.equal(parts.map((p) => p.text).join(''), text);
    assert.equal(
      parts.some((p) => p.highlighted),
      text.includes(quote),
    );
  }
});
void test('correction recovery is bounded even when the first chain read hangs', async () => {
  const pending: Pending = {
    action: 'suggest',
    hash: '0x123',
    id: original.id,
    source: original.source,
    translation: original.translation,
    target: original.target,
  };
  const hung = (() => new Promise(() => {})) as ReturnType<
    typeof fixtureReader
  >;
  assert.equal(
    await recoverCorrectionPending(pending, hung, async () => suggestion, 10),
    null,
  );
  assert.equal(
    await recoverSuggestion(
      original,
      async () => {
        throw new Error('429');
      },
      10,
    ),
    null,
  );
  const recovered = await recoverCorrectionPending(
    pending,
    fixtureReader(),
    async () => suggestion,
  );
  assert.equal(recovered?.suggestion.parent_id, original.id);
  assert.equal(
    await recoverCorrectionPending(
      { ...pending, source: 'tampered' },
      fixtureReader(),
      async () => suggestion,
    ),
    null,
  );
});
