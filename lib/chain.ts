import { createClient } from 'genlayer-js';
import { ACTIVE_CHAIN, NETWORK } from './network.ts';
import { formatUnits } from 'viem';
import {
  TransactionHashVariant,
  type TransactionHash,
} from 'genlayer-js/types';
import { DEPLOYMENT, CORRECTIONS_DEPLOYMENT } from './deployment';
import type { SuggestionReader } from './corrections';
import {
  executionSucceeded,
  plain,
  receiptStatus,
  type ViewSpec,
} from './protocol';
import { ensureStudioNet, type Provider } from './wallet';

export const configured =
  DEPLOYMENT.chainId === NETWORK.id &&
  /^0x[0-9a-fA-F]{40}$/.test(DEPLOYMENT.address);
export const reader = createClient({ chain: ACTIVE_CHAIN });
export const explorer = NETWORK.explorer;
export const contractAddress = DEPLOYMENT.address as `0x${string}`;
export const correctionsAddress =
  CORRECTIONS_DEPLOYMENT.address as `0x${string}`;
export const correctionsConfigured =
  CORRECTIONS_DEPLOYMENT.chainId === NETWORK.id &&
  /^0x[0-9a-fA-F]{40}$/.test(correctionsAddress);
export const readSuggestion: SuggestionReader = async (id) => {
  if (!correctionsConfigured)
    throw new Error(
      'Corrections are being configured. You can still edit and recheck manually.',
    );
  return plain(
    await reader.readContract({
      address: correctionsAddress,
      functionName: 'get_suggestion',
      args: [id],
      transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
    }),
  ) as Awaited<ReturnType<SuggestionReader>>;
};
export async function read<K extends keyof ViewSpec>(
  functionName: K,
  args: ViewSpec[K]['args'],
): Promise<ViewSpec[K]['result']> {
  if (!configured)
    throw new Error(
      'The live contract is not configured yet. Examples are available while deployment is being verified.',
    );
  return plain(
    await reader.readContract({
      address: contractAddress,
      functionName,
      args,
      transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
    }),
  ) as ViewSpec[K]['result'];
}
export function writer(
  account: `0x${string}`,
  provider: Provider,
  onQuote?: (notice: string) => void,
) {
  const client = createClient({
    chain: ACTIVE_CHAIN,
    account,
    provider: provider as NonNullable<
      NonNullable<Parameters<typeof createClient>[0]>['provider']
    >,
  });
  return {
    async writeContract(request: Parameters<typeof client.writeContract>[0]) {
      if (
        Number(await reader.request({ method: 'eth_chainId' })) !== NETWORK.id
      )
        throw new Error(
          'Studio Next RPC chain mismatch. Nothing was submitted.',
        );
      const quote = await client.estimateTransactionFeesForWrite(request);
      // Bound sandbox deposits; never silently accept an unexpectedly large quote.
      if (quote.feeValue > 1000000000000000000n)
        throw new Error(
          'The quote exceeds 1 test GEN. Nothing was submitted; retry after checking Studio Next.',
        );
      await ensureStudioNet(provider);
      const accounts = await provider.request({ method: 'eth_accounts' });
      if (
        !Array.isArray(accounts) ||
        String(accounts[0]).toLowerCase() !== account.toLowerCase()
      )
        throw new Error(
          'Your wallet account changed. Reconnect before submitting.',
        );
      onQuote?.(
        `Review the Studio Next (61997) transaction in your wallet. Protocol fee deposit: ${formatUnits(quote.feeValue, 18)} test GEN. Unused fees are settled by the network.`,
      );
      return client.writeContract({
        ...request,
        fees: {
          distribution: quote.distribution,
          feeValue: quote.feeValue,
          messageAllocations: quote.messageAllocations,
        },
      });
    },
  };
}
export class ExecutionError extends Error {}
export async function waitForFinalized(
  hash: `0x${string}`,
  onStatus: (status: string) => void,
  signal: AbortSignal,
) {
  for (let i = 0; i < 100; i++) {
    if (signal.aborted)
      throw new Error('Tracking paused. Resume the existing transaction.');
    await new Promise((resolve) => setTimeout(resolve, 6000));
    if (signal.aborted)
      throw new Error('Tracking paused. Resume the existing transaction.');
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash))
      throw new Error('Invalid transaction hash.');
    const receipt = await reader.getTransaction({
      hash: hash as TransactionHash,
    });
    const status = receiptStatus(receipt);
    onStatus(status);
    if (status === 'FINALIZED') {
      if (!executionSucceeded(receipt))
        throw new ExecutionError(
          'The transaction finalized with a contract execution error. No new record was created.',
        );
      return receipt;
    }
    if (['CANCELED', 'UNDETERMINED'].includes(status))
      throw new ExecutionError(
        `The transaction ended as ${status.toLowerCase()}. No approval is available.`,
      );
  }
  throw new Error(
    'This transaction is taking longer than expected. Resume tracking it below; do not submit it again.',
  );
}
