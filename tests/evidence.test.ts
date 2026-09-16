import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentId, type Language } from '../lib/protocol.ts';
import {
  LEGACY_DEPLOYMENT as DEPLOYMENT,
  LEGACY_CORRECTIONS_DEPLOYMENT as CORRECTIONS_DEPLOYMENT,
} from '../lib/deployment.ts';

type Draft = {
  id: string;
  source: string;
  translation: string;
  target: Language;
};
const read = (path: string) =>
  readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const evidence = JSON.parse(
  read('deployments/fix-recheck-browser-test.json'),
) as {
  sourceSha: string;
  completed: boolean;
  fixture: Draft;
  revision: Draft & {
    initiallyFound: boolean;
    initialPolicySatisfied: boolean;
    policySatisfied: boolean;
  };
  originalUnchanged: boolean;
  originalPolicySatisfied: boolean;
  comparisonUrl: string;
  baselineCounts: { assessments: number; publications: number };
  finalCounts: { assessments: number; publications: number };
  transactions: Array<{
    action: string;
    hash: string;
    status: string;
    verified: boolean;
    executionSuccess: boolean;
  }>;
  contracts: {
    checker: string;
    checkerSourceSha256: string;
    corrections: string;
    correctionsSourceSha256: string;
  };
};

void test('historical browser evidence binds both exact texts to the legacy 61999 contracts', async () => {
  assert.equal(evidence.completed, true);
  assert.match(evidence.sourceSha, /^[0-9a-f]{40}$/);
  for (const draft of [evidence.fixture, evidence.revision]) {
    assert.equal(
      await contentId(draft.source, draft.translation, draft.target),
      draft.id,
    );
  }
  assert.equal(evidence.contracts.checker, DEPLOYMENT.address);
  assert.equal(evidence.contracts.checkerSourceSha256, DEPLOYMENT.sourceSha256);
  assert.equal(evidence.contracts.corrections, CORRECTIONS_DEPLOYMENT.address);
  assert.equal(
    evidence.contracts.correctionsSourceSha256,
    CORRECTIONS_DEPLOYMENT.sourceSha256,
  );
  const url = new URL(evidence.comparisonUrl);
  assert.equal(url.searchParams.get('assessment'), evidence.revision.id);
  assert.equal(url.searchParams.get('compare'), evidence.fixture.id);
});

void test('recorded browser journey has three successful transactions and no automatic publication', () => {
  assert.deepEqual(
    evidence.transactions.map((tx) => tx.action),
    ['assess', 'suggest', 'recheck'],
  );
  assert.equal(new Set(evidence.transactions.map((tx) => tx.hash)).size, 3);
  for (const tx of evidence.transactions) {
    assert.match(tx.hash, /^0x[0-9a-f]{64}$/);
    assert.equal(tx.status, 'FINALIZED');
    assert.equal(tx.verified, true);
    assert.equal(tx.executionSuccess, true);
    assert.ok(read('docs/fix-recheck-browser-test.md').includes(tx.hash));
  }
  assert.equal(evidence.revision.initiallyFound, false);
  assert.equal(evidence.revision.initialPolicySatisfied, false);
  assert.equal(evidence.revision.policySatisfied, true);
  assert.equal(evidence.originalUnchanged, true);
  assert.equal(evidence.originalPolicySatisfied, false);
  assert.equal(
    evidence.finalCounts.assessments - evidence.baselineCounts.assessments,
    2,
  );
  assert.equal(
    evidence.finalCounts.publications,
    evidence.baselineCounts.publications,
  );
});

void test('CI enforces the full lint command and current docs link the separate browser evidence', () => {
  const pkg = JSON.parse(read('package.json')) as { scripts: { lint: string } };
  assert.equal(pkg.scripts.lint, 'oxlint --deny-warnings');
  assert.match(read('.github/workflows/ci.yml'), /run: npm run lint/);
  for (const path of ['README.md', 'VALIDATION.md', 'BROWSER_TEST_REPORT.md']) {
    assert.ok(read(path).includes('docs/fix-recheck-browser-test.md'));
    assert.ok(read(path).includes('deployments/fix-recheck-browser-test.json'));
  }
});
