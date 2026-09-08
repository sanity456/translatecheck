import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import {
  TransactionHashVariant,
  type TransactionHash,
} from 'genlayer-js/types';
import { DEPLOYMENT } from './deployment';
import {
  executionSucceeded,
  plain,
  receiptStatus,
  type ViewSpec,
} from './protocol';
import type { Provider } from './wallet';

export const configured = /^0x[0-9a-fA-F]{40}$/.test(DEPLOYMENT.address);
export const reader = createClient({ chain: studionet });
export const explorer = 'https://explorer-studio.genlayer.com';
export const contractAddress = DEPLOYMENT.address as `0x${string}`;
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
export function writer(account: `0x${string}`, provider: Provider) {
  return createClient({
    chain: studionet,
    account,
    provider: provider as NonNullable<
      NonNullable<Parameters<typeof createClient>[0]>['provider']
    >,
  });
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
