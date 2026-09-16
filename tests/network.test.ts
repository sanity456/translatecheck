import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { formatUnits } from 'viem';
import * as protocol from '../lib/protocol.ts';
import {
  ACTIVE_CHAIN,
  NETWORK,
  WALLET_NETWORK,
  pendingStorageKey,
} from '../lib/network.ts';
import { CHAIN_ID, CHAIN_HEX, ensureStudioNet } from '../lib/wallet.ts';
import { DEPLOYMENT, CORRECTIONS_DEPLOYMENT } from '../lib/deployment.ts';

void test('active preset, wallet and both deployment chains are Studio Next 61997', () => {
  assert.equal(NETWORK.id, 61997);
  assert.equal(CHAIN_ID, 61997);
  assert.equal(CHAIN_HEX, '0xf22d');
  assert.equal(ACTIVE_CHAIN.id, 61997);
  assert.equal(NETWORK.rpc, 'https://studio-dev.genlayer.com/api');
  assert.equal(NETWORK.explorer, 'https://explorer-studio-dev.genlayer.com');
  assert.equal(DEPLOYMENT.chainId, 61997);
  assert.equal(CORRECTIONS_DEPLOYMENT.chainId, 61997);
});
void test('a wallet on stable Studio is switched to Next, not accepted as current', async () => {
  let chain = '0xf22f';
  const calls: unknown[] = [];
  await ensureStudioNet({
    request: async ({ method, params }) => {
      if (method === 'eth_chainId') return chain;
      calls.push({ method, params });
      chain = '0xf22d';
      return null;
    },
  });
  assert.deepEqual(calls, [
    { method: 'wallet_switchEthereumChain', params: [{ chainId: '0xf22d' }] },
  ]);
});
void test('unknown Next chain is added with its exact RPC and explorer metadata', async () => {
  let chain = '0xf22f';
  let added = false;
  await ensureStudioNet({
    request: async ({ method, params }) => {
      if (method === 'eth_chainId') return chain;
      if (method === 'wallet_addEthereumChain') {
        assert.deepEqual(params, [WALLET_NETWORK]);
        added = true;
        return null;
      }
      if (!added) throw { code: 4902 };
      chain = '0xf22d';
      return null;
    },
  });
  assert.equal(added, true);
});
void test('a wallet that stays on stable Studio fails closed', async () => {
  await assert.rejects(
    ensureStudioNet({
      request: async ({ method }) =>
        method === 'eth_chainId' ? '0xf22f' : null,
    }),
    /61997/,
  );
});
void test('pending stable transactions are never read from the Next namespace', () => {
  const address = '0x' + '1'.repeat(40);
  assert.equal(
    pendingStorageKey(address),
    `translatecheck:pending:61997:${address}`,
  );
  assert.notEqual(
    pendingStorageKey(address),
    `translatecheck:pending:61999:${address}`,
  );
});
void test('active reader and writer share the real preset, fee quote and Next verification links', () => {
  const read = (path: string) =>
    readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const chain = read('lib/chain.ts');
  assert.equal((chain.match(/chain: ACTIVE_CHAIN/g) || []).length, 2);
  assert.doesNotMatch(chain, /chain: studionet|explorer-studio\.genlayer/);
  assert.match(chain, /estimateTransactionFeesForWrite/);
  assert.match(chain, /feeValue: quote.feeValue/);
  const app = read('app/workspace.tsx');
  assert.match(app, /pendingStorageKey\(DEPLOYMENT.address\)/);
  assert.match(app, /explorer \+ '\/address\/' \+ correctionsAddress/);
  assert.doesNotMatch(app, /gasless|No tokens are transferred/);
});

// Execute the real writer with isolated RPC/provider doubles. No network writes.
function writerHarness(
  options: {
    rpcChain?: number;
    walletChain?: string;
    feeValue?: bigint;
    changedAccount?: boolean;
    estimateFailure?: boolean;
  } = {},
) {
  const account = ('0x' + '1'.repeat(40)) as `0x${string}`;
  const calls: string[] = [];
  const fee = {
    feeValue: options.feeValue ?? 123n,
    distribution: { marker: 'exact quote' },
    messageAllocations: [{ marker: 'exact allocations' }],
  };
  let submitted: unknown;
  const source = readFileSync(
    new URL('../lib/chain.ts', import.meta.url),
    'utf8',
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exported: Record<string, unknown> = {};
  const provider = {
    request: async ({ method }: { method: string }) => {
      calls.push(method);
      if (method === 'eth_chainId') return options.walletChain ?? '0xf22d';
      if (method === 'eth_accounts')
        return [options.changedAccount ? '0x' + '2'.repeat(40) : account];
      return null;
    },
  };
  const dependencies: Record<string, unknown> = {
    './network.ts': { ACTIVE_CHAIN, NETWORK },
    './deployment': { DEPLOYMENT, CORRECTIONS_DEPLOYMENT },
    './protocol': protocol,
    './wallet': { ensureStudioNet },
    viem: { formatUnits },
    'genlayer-js/types': {
      TransactionHashVariant: { LATEST_FINAL: 'latest-final' },
    },
    'genlayer-js': {
      createClient: (config: { chain: unknown; account?: string }) => {
        assert.equal(config.chain, ACTIVE_CHAIN);
        return config.account
          ? {
              estimateTransactionFeesForWrite: async () => {
                calls.push('quote');
                if (options.estimateFailure)
                  throw new Error('Simulation failed');
                return fee;
              },
              writeContract: async (request: unknown) => {
                calls.push('send');
                submitted = request;
                return '0x' + 'a'.repeat(64);
              },
            }
          : {
              request: async () =>
                '0x' + (options.rpcChain ?? 61997).toString(16),
            };
      },
    },
  };
  runInNewContext(compiled, {
    exports: exported,
    require: (name: string) => {
      assert.ok(name in dependencies, 'Unexpected dependency: ' + name);
      return dependencies[name];
    },
  });
  const makeWriter = exported.writer as (
    account: string,
    selectedProvider: typeof provider,
  ) => {
    writeContract: (request: unknown) => Promise<unknown>;
  };
  return {
    writer: makeWriter(account, provider),
    calls,
    fee,
    submitted: () => submitted,
  };
}

const nextEvidence = JSON.parse(
  readFileSync(
    new URL('../deployments/studio-next.json', import.meta.url),
    'utf8',
  ),
);
void test('Next evidence matches both active contracts and their successful deployment transactions', () => {
  assert.equal(nextEvidence.chain_id, NETWORK.id);
  assert.equal(nextEvidence.rpc, NETWORK.rpc);
  assert.equal(nextEvidence.pending, undefined);
  assert.equal(nextEvidence.error, undefined);
  assert.ok(nextEvidence.completed_at);
  for (const [role, config] of [
    ['checker', DEPLOYMENT],
    ['corrections', CORRECTIONS_DEPLOYMENT],
  ] as const) {
    const evidence = nextEvidence.contracts[role];
    assert.equal(evidence.address, config.address);
    assert.equal(evidence.source_sha256, config.sourceSha256);
    assert.equal(evidence.deployment_tx, config.deploymentTx);
    assert.equal(evidence.source_exact, true);
    const tx = nextEvidence.transactions.find(
      (item: { hash: string }) => item.hash === config.deploymentTx,
    );
    assert.equal(tx.status, 'FINALIZED');
    assert.equal(tx.execution_success, true);
  }
  assert.equal(
    nextEvidence.contracts.corrections.config.checker,
    DEPLOYMENT.address,
  );
});
void test('Next workflow binds exact texts and preserves advisory, independent-recheck and publication boundaries', async () => {
  const w = nextEvidence.workflow;
  for (const draft of [w.original, w.revision]) {
    assert.equal(
      await protocol.contentId(draft.source, draft.translation, draft.target),
      draft.id,
    );
  }
  assert.equal(w.original_gate.satisfied, false);
  assert.deepEqual(w.original_gate.failure_reasons, ['MEANING_CHANGED']);
  assert.equal(w.suggestion.advisory_only, true);
  assert.equal(w.suggestion.requires_separate_assessment, true);
  assert.equal(w.suggestion.checker, DEPLOYMENT.address);
  assert.equal(w.suggestion.parent_id, w.original.id);
  assert.equal(w.suggestion.suggestion.translation, w.revision.translation);
  assert.equal(nextEvidence.unassessed_correction_gate.satisfied, false);
  assert.equal(w.revision_gate.satisfied, true);
  assert.deepEqual(w.revision_gate.failure_reasons, []);
  assert.equal(w.tampered_gate.satisfied, false);
  assert.deepEqual(w.tampered_gate.failure_reasons, ['CONTENT_MISMATCH']);
  assert.equal(w.original_unchanged, true);
  assert.equal(w.publication.found, true);
  assert.equal(w.publication.assessment_id, w.revision.id);
  for (const action of ['assess_original', 'suggest', 'recheck', 'publish']) {
    const tx = nextEvidence.transactions.find(
      (item: { action: string }) => item.action === action,
    );
    assert.equal(tx.status, 'FINALIZED');
    assert.equal(tx.execution_success, true);
  }
});

void test('writer forwards the exact fee quote only after rechecking wallet and account', async () => {
  const app = writerHarness();
  const request = {
    address: DEPLOYMENT.address,
    functionName: 'assess',
    args: ['English', 'French', 'fr'],
  };
  await app.writer.writeContract(request);
  assert.deepEqual(app.calls, ['quote', 'eth_chainId', 'eth_accounts', 'send']);
  const sent = app.submitted() as typeof request & { fees: typeof app.fee };
  assert.equal(sent.address, request.address);
  assert.equal(sent.fees.distribution, app.fee.distribution);
  assert.equal(sent.fees.messageAllocations, app.fee.messageAllocations);
  assert.equal(sent.fees.feeValue, app.fee.feeValue);
});
for (const [name, options, error] of [
  ['stable RPC', { rpcChain: 61999 }, /chain mismatch/],
  ['failed simulation', { estimateFailure: true }, /Simulation failed/],
  ['excessive fee', { feeValue: 1000000000000000001n }, /exceeds 1 test GEN/],
  ['account changed during quote', { changedAccount: true }, /account changed/],
  ['wallet stays on stable', { walletChain: '0xf22f' }, /61997/],
] as const) {
  void test('writer refuses to send: ' + name, async () => {
    const app = writerHarness(options);
    await assert.rejects(app.writer.writeContract({}), error);
    assert.equal(app.submitted(), undefined);
    assert.equal(app.calls.includes('send'), false);
  });
}
