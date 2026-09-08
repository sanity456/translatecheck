// Isolated component-handler tests, not browser or real-wallet E2E tests.
// Execute the actual Workspace source with in-memory hooks/storage and mocked RPC.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as React from 'react';
import * as protocol from '../lib/protocol.ts';
import * as recovery from '../lib/recovery.ts';
import * as corrections from '../lib/corrections.ts';
import * as wallet from '../lib/wallet.ts';
import { DEPLOYMENT } from '../lib/deployment.ts';
import type { FinalizedReader } from '../lib/recovery.ts';

const require = createRequire(import.meta.url);
export const pendingKey = 'translatecheck:pending:61999:' + DEPLOYMENT.address;
export const stoppedKey = pendingKey + ':last-stopped';
type Node = {
  type: unknown;
  props: Record<string, unknown> & { children?: unknown };
};
export function label(value: unknown): string {
  if (value == null || typeof value === 'boolean') return '';
  if (Array.isArray(value)) return value.map(label).join('');
  if (typeof value === 'object') return label((value as Node).props?.children);
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint'
    ? String(value)
    : '';
}
function nodes(value: unknown, output: Node[] = []): Node[] {
  if (Array.isArray(value)) {
    for (const item of value) nodes(item, output);
  } else if (value && typeof value === 'object' && 'props' in value) {
    const node = value as Node;
    output.push(node);
    if (
      !(
        ['Dialog', 'AlertDialog'].includes(String(node.type)) &&
        !node.props.open
      )
    )
      nodes(node.props.children, output);
  }
  return output;
}

export function workspaceHarness(options: {
  storage?: Map<string, string>;
  read: FinalizedReader;
  wait?: () => Promise<unknown>;
  suggestions?: corrections.SuggestionReader;
  search?: string;
  write?: (request: {
    functionName: string;
    address: string;
    args: unknown[];
  }) => Promise<string>;
}) {
  const storage = options.storage ?? new Map<string, string>();
  const slots: unknown[] = [];
  const effects: (() => unknown)[] = [];
  let cursor = 0;
  let mounted = false;
  let writes = 0;
  const account = ('0x' + '1'.repeat(40)) as `0x${string}`;
  const provider: wallet.Provider = {
    request: async ({ method }) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts')
        return [account];
      if (method === 'eth_chainId') return wallet.CHAIN_HEX;
      throw new Error('Unexpected wallet request: ' + method);
    },
  };
  const hooks = {
    ...React,
    useState<T>(initial: T | (() => T)) {
      const i = cursor++;
      if (!(i in slots))
        slots[i] =
          typeof initial === 'function' ? (initial as () => T)() : initial;
      return [
        slots[i] as T,
        (next: T | ((old: T) => T)) => {
          slots[i] =
            typeof next === 'function'
              ? (next as (old: T) => T)(slots[i] as T)
              : next;
        },
      ];
    },
    useRef<T>(initial: T) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { current: initial };
      return slots[i];
    },
    useEffect(callback: () => unknown) {
      if (!mounted) effects.push(callback);
    },
    useLayoutEffect() {},
    useCallback<T>(callback: T) {
      return callback;
    },
  };
  const ui = new Proxy({}, { get: (_, key) => String(key) });
  const overrides: Record<string, unknown> = {
    react: hooks,
    'react-dom': { flushSync: (fn: () => void) => fn() },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'lucide-react': ui,
    '@/lib/protocol': protocol,
    '@/lib/recovery': recovery,
    '@/lib/corrections': corrections,
    '@/lib/deployment': { DEPLOYMENT },
    '@/lib/feedback': { RequestFeedback: 'RequestFeedback' },
    '@/app/gold-stream': { GoldStream: 'GoldStream' },
    '@/lib/webmcp': { registerTranslationTools: () => () => {} },
    '@/lib/wallet': {
      ...wallet,
      watchWallets: (update: (rows: wallet.WalletOption[]) => void) => {
        const refresh = () =>
          update([{ id: 'test-wallet', name: 'Test wallet', provider }]);
        refresh();
        return { refresh, stop() {} };
      },
    },
    '@/lib/chain': {
      configured: true,
      contractAddress: DEPLOYMENT.address,
      correctionsConfigured: true,
      correctionsAddress: '0xCE0e2EbF9CdB30145EE4badcacAecFCCc6bc593e',
      readSuggestion: options.suggestions ?? (async () => ({ found: false })),
      explorer: 'https://explorer-studio.genlayer.com',
      ExecutionError: class extends Error {},
      read: (name: keyof protocol.ViewSpec, args: unknown[]) =>
        name === 'list_assessments'
          ? Promise.resolve({ items: [], total: 0, next_offset: 0 })
          : options.read(name, args as never),
      waitForFinalized:
        options.wait ??
        (async () => {
          throw new Error('Transaction not found');
        }),
      writer: () => ({
        writeContract: async (request: {
          functionName: string;
          address: string;
          args: unknown[];
        }) => {
          writes++;
          if (options.write) return options.write(request);
          throw new Error('No transaction should be sent in recovery tests');
        },
      }),
    },
  };
  function load(file: string): Record<string, unknown> {
    const loaded = { exports: {} };
    const source = fs.readFileSync(
      new URL('../' + file, import.meta.url),
      'utf8',
    );
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    vm.runInNewContext(
      compiled,
      {
        module: loaded,
        exports: loaded.exports,
        require: (name: string) => {
          if (name in overrides) return overrides[name];
          if (name.startsWith('@/components/ui/')) return ui;
          throw new Error(
            'Unexpected import in isolated component test: ' + name,
          );
        },
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
          removeItem: (key: string) => storage.delete(key),
        },
        AbortController,
        URLSearchParams,
        console,
        window: {
          history: { replaceState() {} },
          location: { pathname: '/', search: options.search ?? '' },
        },
      },
      { filename: file },
    );
    return loaded.exports;
  }
  overrides['@/lib/examples'] = load('lib/examples.ts');
  const Workspace = load('app/workspace.tsx').default as () => unknown;
  function render() {
    cursor = 0;
    const tree = Workspace();
    if (!mounted) {
      mounted = true;
      for (const effect of effects) effect();
    }
    return tree;
  }
  function all() {
    return nodes(render());
  }
  function control(text: string) {
    const found = all().find(
      (node) =>
        ['button', 'AlertDialogAction', 'AlertDialogCancel'].includes(
          String(node.type),
        ) && label(node).replace(/\s+/g, ' ').trim() === text,
    );
    if (!found) throw new Error('Control not found: ' + text);
    return found;
  }
  async function click(text: string) {
    const node = control(text);
    if (node.props.disabled) throw new Error('Control is disabled: ' + text);
    (node.props.onClick as () => unknown)();
    await settle();
  }
  async function settle() {
    // Wait on the actual busy indicator, not an assumed WebCrypto/RPC latency.
    for (let i = 0; i < 250; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1));
      const connect = all().find(
        (node) =>
          node.type === 'button' &&
          ['Connect wallet', protocol.shortAddress(account)].includes(
            label(node).trim(),
          ),
      );
      if (connect && !connect.props.disabled) return;
    }
    throw new Error('Component handler did not settle');
  }
  return {
    storage,
    account,
    control,
    click,
    all,
    settle,
    render,
    writes: () => writes,
    feedback: () =>
      all().find((node) => node.type === 'RequestFeedback')!.props,
    edit: (id: string, value: string) => {
      const node = all().find(
        (node) => node.props.id === id && node.type === 'textarea',
      );
      if (!node || node.props.disabled)
        throw new Error('Editor is unavailable: ' + id);
      (node.props.onChange as (e: { target: { value: string } }) => void)({
        target: { value },
      });
    },
    closeConfirmation: () =>
      (
        all().find((node) => node.type === 'AlertDialog')!.props
          .onOpenChange as (open: boolean) => void
      )(false),
  };
}
