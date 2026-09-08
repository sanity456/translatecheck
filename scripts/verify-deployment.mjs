// Read-only: verify finalized state and exact source. Never signs transactions.
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { TransactionHashVariant } from 'genlayer-js/types';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { plain, executionSucceeded } from '../lib/protocol.ts';
import { DEPLOYMENT } from '../lib/deployment.ts';
const original = JSON.parse(
  await readFile(
    new URL('../deployments/studionet.json', import.meta.url),
    'utf8',
  ),
);
const client = createClient({ chain: studionet });
const local = await readFile(
  new URL('../contracts/translatecheck.py', import.meta.url),
  'utf8',
);
const deployed = await client.getContractCode(DEPLOYMENT.address);
const hash = (s) => createHash('sha256').update(s).digest('hex');
assert.equal(hash(deployed), hash(local));
assert.equal(hash(local), DEPLOYMENT.sourceSha256);
const read = async (functionName, args = []) =>
  plain(
    await client.readContract({
      address: DEPLOYMENT.address,
      functionName,
      args,
      transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
    }),
  );
const checks = [];
for (const check of original.checks) {
  const { id, example } = check;
  const assessment = await read('get_assessment', [id]);
  assert.equal(assessment.found, true);
  assert.equal(assessment.review.verdict, example.verdict);
  assert.equal(assessment.source, example.source);
  assert.equal(assessment.translation, example.translation);
  const gate = await read('evaluate_policy_view', [
    id,
    example.source,
    example.translation,
    example.target,
  ]);
  assert.equal(gate.satisfied, example.verdict === 'PRESERVED');
  const tampered = await read('evaluate_policy_view', [
    id,
    example.source + ' ',
    example.translation,
    example.target,
  ]);
  assert.equal(tampered.satisfied, false);
  assert.ok(tampered.failure_reasons.includes('CONTENT_MISMATCH'));
  checks.push({ id, example, assessment, gate, tampered });
}
const config = await read('get_config');
assert.ok(config.publication_count >= 1);
const publication = await read('get_publication', [
  checks[0].id,
  original.test_accounts[0],
]);
assert.equal(publication.found, true);
const compactReceipt = (r) => ({
  statusName: r.statusName || r.status,
  from_address: r.from_address,
  to_address: r.to_address,
  txExecutionResult: r.txExecutionResult,
  txExecutionResultName: r.txExecutionResultName,
  consensus_data: {
    leader_receipt: (r.consensus_data?.leader_receipt || []).map((x) => ({
      mode: x.mode,
      vote: x.vote,
      execution_result: x.execution_result,
      genvm_result: {
        stderr: x.genvm_result?.stderr,
        error_code: x.genvm_result?.error_code,
      },
    })),
    votes: r.consensus_data?.votes,
  },
});
await mkdir(new URL('../.live-cache/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../.live-cache/original-smoke.json', import.meta.url),
  JSON.stringify(original, null, 2) + '\n',
);
const transactions = original.transactions.map((t) => ({
  ...t,
  execution_success: executionSucceeded(t.receipt),
  receipt: compactReceipt(t.receipt),
}));
const report = {
  ...original,
  transactions,
  checks,
  config,
  publication,
  source_exact: true,
  read_variant: TransactionHashVariant.LATEST_FINAL,
  finalized_read_verification_passed: true,
  verified_at: new Date().toISOString(),
};
await writeFile(
  new URL('../deployments/studionet.json', import.meta.url),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  JSON.stringify(
    {
      address: DEPLOYMENT.address,
      source_sha256: DEPLOYMENT.sourceSha256,
      read_variant: report.read_variant,
      checks: checks.map((x) => ({
        target: x.example.target,
        verdict: x.assessment.review.verdict,
        satisfied: x.gate.satisfied,
      })),
      publication_verified: publication.found,
      passed: true,
    },
    null,
    2,
  ),
);
