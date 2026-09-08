import test from 'node:test';
import assert from 'node:assert/strict';
import {
  contentId,
  executionSucceeded,
  plain,
  validateDraft,
} from '../lib/protocol.ts';
import {
  CHAIN_HEX,
  CHAIN_ID,
  connectWallet,
  ensureStudioNet,
  walletName,
} from '../lib/wallet.ts';

void test('language scope excludes Hindi and supports Mandarin', () => {
  validateDraft('Hello', '你好', 'zh-CN');
  assert.throws(() => validateDraft('Hello', 'नमस्ते', 'hi'));
  assert.throws(() => validateDraft('', 'Hola', 'es'));
  assert.throws(() => validateDraft('x'.repeat(1201), 'Bonjour', 'fr'));
});
void test('commitment changes for any exact-text or language edit', async () => {
  const original = await contentId('Hello', 'Bonjour', 'fr');
  assert.equal(original.length, 64);
  assert.notEqual(original, await contentId('Hello ', 'Bonjour', 'fr'));
  assert.notEqual(original, await contentId('Hello', 'Bonjour!', 'fr'));
  assert.notEqual(original, await contentId('Hello', 'Bonjour', 'es'));
});
void test('finalized is not proof of execution success', () => {
  assert.equal(executionSucceeded({ status: 'FINALIZED' }), false);
  assert.equal(
    executionSucceeded({ status: 'FINALIZED', txExecutionResult: 2 }),
    false,
  );
  assert.equal(
    executionSucceeded({ txExecutionResultName: 'FINISHED_WITH_RETURN' }),
    true,
  );
  assert.equal(
    executionSucceeded({
      consensus_data: { leader_receipt: [{ execution_result: 'SUCCESS' }] },
    }),
    true,
  );
  assert.equal(
    executionSucceeded({ consensus_data: { leader_receipt: [] } }),
    false,
  );
  assert.equal(
    executionSucceeded({
      txExecutionResult: 2,
      consensus_data: { leader_receipt: [{ execution_result: 'SUCCESS' }] },
    }),
    false,
  );
  assert.equal(
    executionSucceeded({
      consensus_data: {
        leader_receipt: [
          { mode: 'leader', execution_result: 'SUCCESS' },
          { mode: 'validator', vote: 'idle', execution_result: 'ERROR' },
        ],
      },
    }),
    true,
  );
  assert.equal(
    executionSucceeded({
      consensus_data: {
        leader_receipt: [{ mode: 'validator', execution_result: 'SUCCESS' }],
      },
    }),
    false,
  );
});
void test('calldata maps normalize recursively', () => {
  assert.deepEqual(
    plain(
      new Map<string, unknown>([
        ['satisfied', false],
        ['reasons', ['CONTENT_MISMATCH']],
      ]),
    ),
    { satisfied: false, reasons: ['CONTENT_MISMATCH'] },
  );
});
void test('provider labels do not mislabel Phantom or OKX as MetaMask', () => {
  assert.equal(
    walletName({ request: async () => [], isPhantom: true, isMetaMask: true }),
    'Phantom',
  );
  assert.equal(
    walletName({
      request: async () => [],
      isOkxWallet: true,
      isMetaMask: true,
    }),
    'OKX Wallet',
  );
});
void test('connection uses the selected provider and propagates rejection', async () => {
  const methods: string[] = [];
  const address = '0x' + '1'.repeat(40);
  assert.equal(
    await connectWallet({
      request: async ({ method }) => {
        methods.push(method);
        return [address];
      },
    }),
    address,
  );
  assert.deepEqual(methods, ['eth_requestAccounts']);
  await assert.rejects(
    connectWallet({
      request: async () => {
        throw Object.assign(new Error('Rejected'), { code: 4001 });
      },
    }),
  );
  await assert.rejects(connectWallet({ request: async () => [] }));
});
void test('correct chain does not prompt to switch', async () => {
  assert.equal(Number(CHAIN_HEX), CHAIN_ID);
  const methods: string[] = [];
  await ensureStudioNet({
    request: async ({ method }) => {
      methods.push(method);
      return CHAIN_HEX;
    },
  });
  assert.deepEqual(methods, ['eth_chainId']);
});
void test('unknown chain is added then explicitly rechecked', async () => {
  let chain = '0x1';
  let known = false;
  const methods: string[] = [];
  await ensureStudioNet({
    request: async ({ method }) => {
      methods.push(method);
      if (method === 'eth_chainId') return chain;
      if (method === 'wallet_addEthereumChain') {
        known = true;
        return null;
      }
      if (!known) throw Object.assign(new Error('Unknown'), { code: 4902 });
      chain = CHAIN_HEX;
      return null;
    },
  });
  assert.deepEqual(methods, [
    'eth_chainId',
    'wallet_switchEthereumChain',
    'wallet_addEthereumChain',
    'wallet_switchEthereumChain',
    'eth_chainId',
  ]);
});
void test('declined network switch is not retried as add-chain', async () => {
  const methods: string[] = [];
  await assert.rejects(
    ensureStudioNet({
      request: async ({ method }) => {
        methods.push(method);
        if (method === 'eth_chainId') return '0x1';
        throw Object.assign(new Error('Rejected'), { code: 4001 });
      },
    }),
  );
  assert.deepEqual(methods, ['eth_chainId', 'wallet_switchEthereumChain']);
});
