// Gasless StudioNet release verification. Ephemeral test key stays in memory.
// Run normally once; --resume reads the saved deployment instead of redeploying.
import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { TransactionHashVariant } from 'genlayer-js/types';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { DEPLOYMENT } from '../lib/deployment.ts';
import {
  plain,
  receiptStatus,
  executionSucceeded,
  contentId,
} from '../lib/protocol.ts';

const account = createAccount();
const client = createClient({ chain: studionet, account });
const code = await readFile(
  new URL('../contracts/translatecheck_corrections.py', import.meta.url),
  'utf8',
);
const path = new URL(
  '../deployments/corrections-studionet.json',
  import.meta.url,
);
const resume = process.argv.includes('--resume');
const report = resume
  ? JSON.parse(await readFile(path, 'utf8'))
  : {
      network: 'studionet',
      chain_id: studionet.id,
      checker: DEPLOYMENT.address,
      source_sha256: createHash('sha256').update(code).digest('hex'),
      started_at: new Date().toISOString(),
      transactions: [],
      checks: [],
    };
assert.equal(
  report.source_sha256,
  createHash('sha256').update(code).digest('hex'),
);
const save = () => writeFile(path, JSON.stringify(report, null, 2) + '\n');
const pause = () => new Promise((r) => setTimeout(r, 6500));
async function wait(hash, expected = true) {
  for (let i = 0; i < 100; i++) {
    await pause();
    const receipt = await client.getTransaction({ hash });
    const status = receiptStatus(receipt);
    if (i % 5 === 0) console.log(JSON.stringify({ hash, status }));
    if (status === 'FINALIZED') {
      const success = executionSucceeded(receipt);
      report.transactions.push({ hash, status, execution_success: success });
      await save();
      assert.equal(
        success,
        expected,
        'Unexpected execution result: ' + JSON.stringify(plain(receipt)),
      );
      return receipt;
    }
    if (['CANCELED', 'UNDETERMINED'].includes(status))
      throw new Error('Transaction ' + status);
  }
  throw new Error('Transaction remains pending. Resume; do not resubmit.');
}
async function read(address, functionName, args = []) {
  return plain(
    await client.readContract({
      address,
      functionName,
      args,
      transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
    }),
  );
}
async function write(address, functionName, args) {
  const hash = await client.writeContract({
    address,
    functionName,
    args,
    value: 0n,
    leaderOnly: false,
  });
  report.pending = { hash, address, functionName, args };
  await save();
  console.log(JSON.stringify(report.pending));
  await wait(hash);
  delete report.pending;
  await save();
  return hash;
}
try {
  if (!resume) {
    const hash = await client.deployContract({
      code,
      args: [DEPLOYMENT.address],
      leaderOnly: false,
    });
    report.pending = { hash, functionName: 'deploy' };
    await save();
    console.log(JSON.stringify(report.pending));
    const receipt = await wait(hash);
    report.address =
      receipt.recipient ||
      receipt.to_address ||
      receipt.txDataDecoded?.contractAddress;
    report.deployment_tx = hash;
    delete report.pending;
    await save();
  } else if (report.pending) {
    const receipt = await wait(report.pending.hash);
    if (report.pending.functionName === 'deploy') {
      report.address =
        receipt.recipient ||
        receipt.to_address ||
        receipt.txDataDecoded?.contractAddress;
      report.deployment_tx = report.pending.hash;
    }
    delete report.pending;
    await save();
  }
  assert.match(report.address, /^0x[0-9a-fA-F]{40}$/);
  const deployed = await client.getContractCode(report.address);
  const exact = deployed.startsWith('0x')
    ? Buffer.from(deployed.slice(2), 'hex').toString('utf8')
    : deployed;
  assert.equal(
    createHash('sha256').update(exact).digest('hex'),
    report.source_sha256,
  );
  report.source_exact = true;
  const config = await read(report.address, 'get_config');
  assert.equal(config.checker.toLowerCase(), DEPLOYMENT.address.toLowerCase());
  assert.equal(config.advisory_only, true);
  for (const parentId of [
    'f64e733324d5cb45920857ec4ff369c4efcfe7ba5adc8cc3cbf62a221c7d31b0',
    'f8cf91162e7a6b1bce253a9178bc9efa4ceb83c5721b8d60cf7fcbe692718e81',
    '8d8e4bd37ba2c59962ef66cb55212e6d5b6d7de1d190291b1330d550e3eea6f2',
  ]) {
    const original = await read(DEPLOYMENT.address, 'get_assessment', [
      parentId,
    ]);
    assert.equal(original.found, true);
    let suggestion = await read(report.address, 'get_suggestion', [parentId]);
    if (!suggestion.found) {
      await write(report.address, 'suggest', [parentId]);
      suggestion = await read(report.address, 'get_suggestion', [parentId]);
    }
    assert.equal(suggestion.found, true);
    assert.equal(suggestion.advisory_only, true);
    assert.equal(suggestion.requires_separate_assessment, true);
    assert.equal(suggestion.source, original.source);
    assert.equal(suggestion.original_translation, original.translation);
    assert.equal(suggestion.suggestion.status, 'SUGGESTED');
    assert.notEqual(suggestion.suggestion.translation, original.translation);
    assert.deepEqual(
      await read(DEPLOYMENT.address, 'get_assessment', [parentId]),
      original,
    );
    const revisionId = await contentId(
      original.source,
      suggestion.suggestion.translation,
      original.target,
    );
    const before = await read(DEPLOYMENT.address, 'get_assessment', [
      revisionId,
    ]);
    const beforeGate = await read(DEPLOYMENT.address, 'evaluate_policy_view', [
      revisionId,
      original.source,
      suggestion.suggestion.translation,
      original.target,
    ]);
    if (!before.found) {
      assert.equal(
        beforeGate.satisfied,
        false,
        'Unassessed correction must remain blocked',
      );
      await write(DEPLOYMENT.address, 'assess', [
        original.source,
        suggestion.suggestion.translation,
        original.target,
      ]);
    }
    const afterGate = await read(DEPLOYMENT.address, 'evaluate_policy_view', [
      revisionId,
      original.source,
      suggestion.suggestion.translation,
      original.target,
    ]);
    assert.equal(
      afterGate.satisfied,
      true,
      'Separate assessment of correction must preserve meaning for this fixture',
    );
    const originalGate = await read(
      DEPLOYMENT.address,
      'evaluate_policy_view',
      [parentId, original.source, original.translation, original.target],
    );
    assert.equal(originalGate.satisfied, false, 'Original remains blocked');
    const result = {
      parent_id: parentId,
      target: original.target,
      revision_id: revisionId,
      original_unchanged: true,
      original_blocked: true,
      suggestion_advisory_only: true,
      prior_revision_found: before.found,
      gate_before: beforeGate,
      gate_after_separate_assessment: afterGate,
      suggestion,
    };
    report.checks = report.checks
      .filter((x) => x.parent_id !== parentId)
      .concat(result);
    await save();
    console.log(
      JSON.stringify({ target: original.target, revisionId, verified: true }),
    );
  }
  report.completed_at = new Date().toISOString();
  delete report.error;
  await save();
  console.log(
    JSON.stringify({
      address: report.address,
      source_sha256: report.source_sha256,
      checks: report.checks.length,
      complete: true,
    }),
  );
} catch (error) {
  report.error = String(error);
  await save();
  console.error(String(error));
  process.exitCode = 1;
}
