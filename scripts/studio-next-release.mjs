// Studio Next only. Uses a fresh disposable sandbox account, never a user's key.
// Resume from the checkpoint; never blindly resubmit a pending transaction.
// --verify performs reads only. --deploy stops after verifying the two contracts.
import { createClient, createAccount } from 'genlayer-js';
import { TransactionHashVariant } from 'genlayer-js/types';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { ACTIVE_CHAIN, NETWORK } from '../lib/network.ts';
import { DEPLOYMENT, CORRECTIONS_DEPLOYMENT } from '../lib/deployment.ts';
import {
  plain,
  executionSucceeded,
  receiptStatus,
  contentId,
} from '../lib/protocol.ts';

const readonly = process.argv.includes('--verify');
const account = readonly ? undefined : createAccount();
const client = createClient({
  chain: ACTIVE_CHAIN,
  ...(account ? { account } : {}),
});
const path = new URL('../deployments/studio-next.json', import.meta.url);
const json = (value) =>
  JSON.stringify(
    value,
    (_, v) => (typeof v === 'bigint' ? v.toString() : v),
    2,
  ) + '\n';
const sha = (value) => createHash('sha256').update(value).digest('hex');
let report;
try {
  report = JSON.parse(await readFile(path, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT' || readonly) throw error;
  report = {
    chain_id: NETWORK.id,
    rpc: NETWORK.rpc,
    explorer: NETWORK.explorer,
    sdk_version: '2.0.0-rc.1',
    started_at: new Date().toISOString(),
    contracts: {},
    transactions: [],
  };
}
const save = () => writeFile(path, json(report));
// Keep execution evidence, without copying unrelated validator configuration.
for (const tx of report.transactions) {
  if (tx.leader_receipt)
    tx.leader_receipt = tx.leader_receipt.map(
      ({ mode, vote, result, execution_result }) => ({
        mode,
        vote,
        result,
        execution_result,
      }),
    );
}
assert.equal(report.chain_id, 61997);
assert.equal(Number(await client.request({ method: 'eth_chainId' })), 61997);
const read = async (address, functionName, args = []) =>
  plain(
    await client.readContract({
      address,
      functionName,
      args,
      transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
    }),
  );

async function finishPending() {
  const pending = report.pending;
  for (let i = 0; i < 100; i++) {
    let receipt;
    try {
      receipt = await client.getTransaction({ hash: pending.hash });
    } catch (error) {
      if (i > 5) throw error;
      await new Promise((r) => setTimeout(r, 6000));
      continue;
    }
    const status = receiptStatus(receipt);
    if (i % 5 === 0)
      console.log(json({ action: pending.action, hash: pending.hash, status }));
    if (['FINALIZED', 'CANCELED', 'UNDETERMINED'].includes(status)) {
      const success = status === 'FINALIZED' && executionSucceeded(receipt);
      const tx = {
        ...pending,
        status,
        execution_success: success,
        execution_result:
          receipt.txExecutionResultName ?? receipt.txExecutionResult,
        leader_receipt: receipt.consensus_data?.leader_receipt?.map(
          ({ mode, vote, result, execution_result }) => ({
            mode,
            vote,
            result,
            execution_result,
          }),
        ),
        completed_at: new Date().toISOString(),
      };
      report.transactions.push(tx);
      if (success && pending.action.startsWith('deploy_')) {
        report.contracts[pending.role] = {
          address:
            receipt.recipient ||
            receipt.to_address ||
            receipt.txDataDecoded?.contractAddress,
          deployment_tx: pending.hash,
          source_sha256: pending.source_sha256,
        };
      }
      delete report.pending;
      await save();
      assert.equal(
        success,
        true,
        'Execution failed; inspect recorded transaction before retrying',
      );
      return;
    }
    await new Promise((r) => setTimeout(r, 6000));
  }
  throw new Error(
    'Still pending. Re-run to resume the SAME hash, not redeploy.',
  );
}

async function quote(write) {
  assert.equal(
    await client.request({ method: 'eth_gasPrice' }),
    '0x0',
    'Sandbox gas policy changed; manual review required',
  );
  const estimate = write
    ? await client.estimateTransactionFeesForWrite(write)
    : await client.estimateTransactionFees();
  assert.ok(
    estimate.feeValue <= 1000000000000000000n,
    'Sandbox quote exceeds 1 test GEN; stop for review',
  );
  return {
    distribution: estimate.distribution,
    feeValue: estimate.feeValue,
    messageAllocations: estimate.messageAllocations,
  };
}

async function deploy(role, file, args = []) {
  const code = await readFile(
    new URL('../contracts/' + file, import.meta.url),
    'utf8',
  );
  if (!report.contracts[role]) {
    assert.equal(readonly, false, 'Contract is not deployed');
    // Check the live VM can load this pinned runner before any new deployment.
    await client.getContractSchemaForCode(code);
    const fees = await quote();
    const hash = await client.deployContract({
      code,
      args,
      leaderOnly: false,
      fees,
    });
    report.pending = {
      action: 'deploy_' + role,
      role,
      hash,
      source_sha256: sha(code),
      account: account.address,
      fees,
    };
    await save();
    await finishPending();
  }
  const deployed = report.contracts[role];
  assert.match(deployed.address, /^0x[0-9a-fA-F]{40}$/);
  assert.equal(
    sha(code),
    deployed.source_sha256,
    'Local source changed since deployment',
  );
  const raw = await client.getContractCode(deployed.address);
  const exact = raw.startsWith('0x')
    ? Buffer.from(raw.slice(2), 'hex')
    : Buffer.from(raw);
  assert.equal(sha(exact), sha(code), 'Deployed source mismatch');
  const config = await read(deployed.address, 'get_config');
  if (role === 'corrections') {
    assert.equal(
      config.checker.toLowerCase(),
      report.contracts.checker.address.toLowerCase(),
    );
    assert.equal(config.advisory_only, true);
  }
  if (!readonly) {
    deployed.source_exact = true;
    deployed.config = config;
    await save();
  }
  if (readonly) {
    const active = role === 'checker' ? DEPLOYMENT : CORRECTIONS_DEPLOYMENT;
    assert.equal(
      deployed.address,
      active.address,
      'Frontend address differs from evidence',
    );
    assert.equal(deployed.source_sha256, active.sourceSha256);
    assert.equal(deployed.deployment_tx, active.deploymentTx);
  }
  console.log(json({ role, ...deployed, config }));
  return deployed.address;
}

async function write(action, address, functionName, args) {
  assert.equal(
    readonly,
    false,
    'Read-only verification found missing evidence',
  );
  const request = { address, functionName, args, value: 0n, leaderOnly: false };
  const fees = await quote(request);
  const hash = await client.writeContract({ ...request, fees });
  report.pending = {
    action,
    hash,
    account: account.address,
    address,
    functionName,
    args,
    fees,
  };
  await save();
  await finishPending();
}

try {
  if (process.argv.includes('--replace-unreleased')) {
    assert.equal(readonly, false);
    assert.equal(report.pending, undefined, 'Finish the pending hash first');
    assert.equal(
      report.workflow,
      undefined,
      'Do not replace a verified release',
    );
    const config = await read(report.contracts.checker.address, 'get_config');
    const correctionConfig = await read(
      report.contracts.corrections.address,
      'get_config',
    );
    assert.equal(config.assessment_count, 0);
    assert.equal(config.publication_count, 0);
    assert.equal(correctionConfig.suggestion_count, 0);
    report.superseded_candidates ??= [];
    report.superseded_candidates.push({
      contracts: report.contracts,
      reason:
        'Simulation found the renamed v0.3 run_nondet API. No application records were created; candidate never published.',
      archived_at: new Date().toISOString(),
    });
    report.contracts = {};
    await save();
  }
  if (report.pending) {
    assert.equal(readonly, false, 'Pending transaction must be resolved first');
    await finishPending();
  }
  const checker = await deploy('checker', 'translatecheck.py');
  const corrections = await deploy(
    'corrections',
    'translatecheck_corrections.py',
    [checker],
  );
  if (process.argv.includes('--deploy')) process.exit(0);
  const source = 'You do not need a ticket to enter the exhibition.';
  const translation = 'Necesitas una entrada para entrar a la exposición.';
  const target = 'es';
  const id = await contentId(source, translation, target);
  let original = await read(checker, 'get_assessment', [id]);
  if (!original.found) {
    await write('assess_original', checker, 'assess', [
      source,
      translation,
      target,
    ]);
    original = await read(checker, 'get_assessment', [id]);
  }
  const originalGate = await read(checker, 'evaluate_policy_view', [
    id,
    source,
    translation,
    target,
  ]);
  assert.equal(original.found, true);
  assert.equal(originalGate.satisfied, false);
  let suggestion = await read(corrections, 'get_suggestion', [id]);
  if (!suggestion.found) {
    await write('suggest', corrections, 'suggest', [id]);
    suggestion = await read(corrections, 'get_suggestion', [id]);
  }
  assert.equal(suggestion.advisory_only, true);
  assert.equal(suggestion.requires_separate_assessment, true);
  assert.equal(suggestion.suggestion.status, 'SUGGESTED');
  const revisionText = suggestion.suggestion.translation;
  const revisionId = await contentId(source, revisionText, target);
  let revision = await read(checker, 'get_assessment', [revisionId]);
  if (!revision.found) {
    const before = await read(checker, 'evaluate_policy_view', [
      revisionId,
      source,
      revisionText,
      target,
    ]);
    assert.equal(before.satisfied, false);
    report.unassessed_correction_gate = before;
    await save();
    await write('recheck', checker, 'assess', [source, revisionText, target]);
    revision = await read(checker, 'get_assessment', [revisionId]);
  }
  const revisionGate = await read(checker, 'evaluate_policy_view', [
    revisionId,
    source,
    revisionText,
    target,
  ]);
  assert.equal(revisionGate.satisfied, true);
  const tamperGate = await read(checker, 'evaluate_policy_view', [
    revisionId,
    source + ' Changed.',
    revisionText,
    target,
  ]);
  assert.equal(tamperGate.satisfied, false);
  assert.deepEqual(await read(checker, 'get_assessment', [id]), original);
  const priorPublish = report.transactions.find(
    (tx) => tx.action === 'publish' && tx.execution_success,
  );
  if (!priorPublish)
    await write('publish', checker, 'publish', [
      revisionId,
      source,
      revisionText,
      target,
    ]);
  const publisher = report.transactions.find(
    (tx) => tx.action === 'publish' && tx.execution_success,
  ).account;
  const publication = await read(checker, 'get_publication', [
    revisionId,
    publisher,
  ]);
  assert.equal(publication.found, true);
  const result = {
    original,
    original_gate: originalGate,
    suggestion,
    revision,
    revision_gate: revisionGate,
    tampered_gate: tamperGate,
    original_unchanged: true,
    publication,
    comparison_url: `https://translatecheck-studionet.vercel.app/?assessment=${revisionId}&compare=${id}`,
  };
  if (!readonly) {
    report.workflow = result;
    report.completed_at = new Date().toISOString();
    delete report.error;
    await save();
  }
  console.log(
    json({ verified: true, chain_id: NETWORK.id, readonly, ...result }),
  );
} catch (error) {
  if (!readonly) {
    report.error = String(error).slice(0, 1500);
    await save();
  }
  console.error(String(error).slice(0, 1500));
  process.exitCode = 1;
}
