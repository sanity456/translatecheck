// Gasless StudioNet only. Fresh ephemeral account; no wallet keys read or written.
import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { TransactionHashVariant } from 'genlayer-js/types';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { executionSucceeded, plain, receiptStatus } from '../lib/protocol.ts';

const account = createAccount();
const client = createClient({ chain: studionet, account });
const source = await readFile(
  new URL('../contracts/translatecheck.py', import.meta.url),
  'utf8',
);
const resume = process.argv.includes('--resume');
const report = resume
  ? JSON.parse(
      await readFile(
        new URL('../deployments/studionet.json', import.meta.url),
        'utf8',
      ),
    )
  : {
      schema: 'translatecheck/live-smoke-v1',
      network: 'studionet',
      chain_id: studionet.id,
      rpc: studionet.rpcUrls.default.http[0],
      source_sha256: createHash('sha256').update(source).digest('hex'),
      account: account.address,
      started_at: new Date().toISOString(),
      checks: [],
      transactions: [],
    };
if (resume) {
  report.harness_notes = [
    'Receipt parser corrected: Studio included an idle fallback validator in leader_receipt. The actual leader succeeded; no contract change was required.',
  ];
  report.test_accounts = [...(report.test_accounts || []), account.address];
  for (const transaction of report.transactions)
    transaction.execution_success = executionSucceeded(transaction.receipt);
  delete report.error;
  delete report.pending;
}
await mkdir(new URL('../deployments/', import.meta.url), { recursive: true });
const save = () =>
  writeFile(
    new URL('../deployments/studionet.json', import.meta.url),
    JSON.stringify(report, null, 2) + '\n',
  );
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function wait(hash, expectSuccess = true) {
  for (let i = 0; i < 150; i++) {
    await delay(6000);
    const r = await client.getTransaction({ hash });
    const status = receiptStatus(r);
    if (i % 10 === 0) console.log(JSON.stringify({ hash, status }));
    if (status === 'FINALIZED') {
      const successful = executionSucceeded(r);
      report.transactions.push({
        hash,
        status,
        execution_success: successful,
        receipt: plain(r),
      });
      await save();
      assert.equal(
        successful,
        expectSuccess,
        'Unexpected contract execution outcome',
      );
      return r;
    }
    if (['CANCELED', 'UNDETERMINED'].includes(status))
      throw new Error('Transaction ' + status);
  }
  throw new Error(
    'Polling timed out. Inspect the saved transaction; do not resubmit blindly.',
  );
}
async function read(functionName, args = []) {
  return plain(
    await client.readContract({
      address: report.address,
      functionName,
      args,
      transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
    }),
  );
}
async function write(functionName, args, expectSuccess = true) {
  const hash = await client.writeContract({
    address: report.address,
    functionName,
    args,
    value: 0n,
    leaderOnly: false,
  });
  report.pending = { functionName, hash };
  await save();
  console.log(JSON.stringify(report.pending));
  await wait(hash, expectSuccess);
  delete report.pending;
  await save();
  return hash;
}

try {
  if (!resume) {
    const deployment = await client.deployContract({
      code: source,
      args: [],
      leaderOnly: false,
    });
    report.pending = { functionName: 'deploy', hash: deployment };
    await save();
    console.log(JSON.stringify(report.pending));
    const receipt = await wait(deployment);
    report.address =
      receipt.recipient ||
      receipt.to_address ||
      receipt.txDataDecoded?.contractAddress;
    assert.match(report.address, /^0x[0-9a-fA-F]{40}$/);
    delete report.pending;
    await save();
    console.log(JSON.stringify({ address: report.address }));
  }
  const deployedCode = await client.getContractCode(report.address);
  const exact = deployedCode.startsWith('0x')
    ? Buffer.from(deployedCode.slice(2), 'hex').toString('utf8')
    : deployedCode;
  assert.equal(
    createHash('sha256').update(exact).digest('hex'),
    report.source_sha256,
    'Deployed source must match',
  );
  report.source_exact = true;
  report.config = await read('get_config');
  await save();
  const examples = [
    {
      target: 'fr',
      source: 'Free delivery on orders over $50.',
      translation: 'Livraison gratuite pour les commandes de plus de 50 $.',
      verdict: 'PRESERVED',
    },
    {
      target: 'es',
      source: 'Free delivery on orders over $50.',
      translation: 'Envío gratis en pedidos de menos de 50 $.',
      verdict: 'CHANGED',
    },
    {
      target: 'zh-CN',
      source: 'Free delivery on orders over $50.',
      translation: '订单金额超过50美元即可免费配送。',
      verdict: 'PRESERVED',
    },
    {
      target: 'zh-CN',
      source: 'The meeting starts at 9 am.',
      translation: 'La reunión empieza a las nueve de la mañana.',
      verdict: 'REVIEW',
    },
  ];
  for (const example of examples) {
    const args = [example.source, example.translation, example.target];
    const id = await read('content_id', args);
    const existing = await read('get_assessment', [id]);
    const hash = existing.found ? null : await write('assess', args);
    const assessment = await read('get_assessment', [id]);
    assert.equal(assessment.found, true);
    assert.equal(assessment.review.verdict, example.verdict);
    const gate = await read('evaluate_policy_view', [id, ...args]);
    assert.equal(gate.satisfied, example.verdict === 'PRESERVED');
    const tampered = await read('evaluate_policy_view', [
      id,
      example.source + ' ',
      example.translation,
      example.target,
    ]);
    assert.equal(tampered.satisfied, false);
    assert.ok(tampered.failure_reasons.includes('CONTENT_MISMATCH'));
    report.checks.push({ example, id, hash, assessment, gate, tampered });
    await save();
    console.log(
      JSON.stringify({
        target: example.target,
        verdict: assessment.review.verdict,
        gate,
      }),
    );
    if (example.target === 'fr') {
      await write('publish', [id, ...args]);
      assert.equal(
        (await read('get_publication', [id, account.address])).found,
        true,
      );
      await write(
        'publish',
        [id, example.source + ' ', example.translation, example.target],
        false,
      );
    }
    if (example.verdict === 'CHANGED') {
      const before = await read('get_config');
      await write('publish', [id, ...args], false);
      assert.equal(
        (await read('get_config')).publication_count,
        before.publication_count,
      );
      assert.deepEqual(await read('get_assessment', [id]), assessment);
    }
  }
  report.completed_at = new Date().toISOString();
  report.passed = true;
  await save();
  console.log('LIVE_SMOKE_PASSED');
} catch (error) {
  report.error = String(error);
  report.passed = false;
  await save();
  console.error(String(error));
  process.exitCode = 1;
}
