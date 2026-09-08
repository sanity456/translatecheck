'use client';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import {
  ArrowRight,
  Languages,
  ShieldCheck,
  Wallet,
  LockKeyhole,
  Check,
  FileCheck2,
  History,
  ExternalLink,
  RefreshCw,
  CircleHelp,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LANGUAGES,
  LABELS,
  contentId,
  safeError,
  shortAddress,
  validateDraft,
  type Assessment,
  type Gate,
  type Language,
  type Pending,
  type Summary,
} from '@/lib/protocol';
import { EXAMPLES, SOURCE } from '@/lib/examples';
import {
  configured,
  contractAddress,
  explorer,
  ExecutionError,
  read,
  waitForFinalized,
  writer,
} from '@/lib/chain';
import {
  connectWallet,
  ensureStudioNet,
  watchWallets,
  type WalletOption,
} from '@/lib/wallet';
import { registerTranslationTools } from '@/lib/webmcp';
import { DEPLOYMENT } from '@/lib/deployment';

const PENDING_KEY = 'translatecheck:pending:61999:' + DEPLOYMENT.address;
function recoverPending(): Pending | null {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null');
    if (
      p &&
      /^0x[0-9a-fA-F]{64}$/.test(p.hash) &&
      /^[0-9a-f]{64}$/.test(p.id) &&
      ['assess', 'publish'].includes(p.action)
    ) {
      validateDraft(p.source, p.translation, p.target);
      return p;
    }
  } catch {
    /* Unavailable storage or invalid recovery data is not chain truth. */
  }
  return null;
}
function date(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

export default function Workspace() {
  const [source, setSource] = useState(SOURCE);
  const [translation, setTranslation] = useState(EXAMPLES.fr.translation);
  const [target, setTarget] = useState<Language>('fr');
  const [tab, setTab] = useState('check');
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [gate, setGate] = useState<Gate | null>(null);
  const [publication, setPublication] = useState<{
    found: boolean;
    created_at?: string;
    publisher?: string;
  }>({ found: false });
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<WalletOption | null>(
    null,
  );
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(recoverPending);
  const [notice, setNotice] = useState(
    pending
      ? 'A submitted transaction was found. Resume tracking below; no new approval is needed.'
      : '',
  );
  const [error, setError] = useState('');
  const [txStatus, setTxStatus] = useState('');
  const [rows, setRows] = useState<Summary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(configured);
  const [historyError, setHistoryError] = useState('');
  const busyRef = useRef(false);
  const tracking = useRef<AbortController | null>(null);
  const discovery = useRef<ReturnType<typeof watchWallets> | null>(null);
  const stateRef = useRef({
    source,
    translation,
    target,
    assessment,
    gate,
    pending,
    busy,
  });
  const recordRequest = useRef(0);
  useLayoutEffect(() => {
    stateRef.current = {
      source,
      translation,
      target,
      assessment,
      gate,
      pending,
      busy,
    };
  });

  function clearResult() {
    recordRequest.current++;
    setAssessment(null);
    setGate(null);
    setPublication({ found: false });
    setNotice('');
    setError('');
    window.history.replaceState(null, '', window.location.pathname);
  }
  function stage(d: { source: string; translation: string; target: Language }) {
    if (busyRef.current)
      throw new Error(
        'Wait for the current wallet request or transaction tracking to finish.',
      );
    validateDraft(d.source, d.translation, d.target);
    setSource(d.source);
    setTranslation(d.translation);
    setTarget(d.target);
    clearResult();
    setTab('check');
    setError('');
    setNotice('');
    window.history.replaceState(null, '', window.location.pathname);
  }
  async function loadHistory(append = false) {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const page = await read('list_assessments', [append ? offset : 0, 10]);
      setRows((old) =>
        append
          ? [
              ...old,
              ...page.items.filter(
                (r: Summary) => !old.some((x) => x.id === r.id),
              ),
            ]
          : page.items,
      );
      setTotal(page.total);
      setOffset(page.next_offset);
    } catch (e) {
      setHistoryError(safeError(e));
    } finally {
      setHistoryLoading(false);
    }
  }
  const openRecord = useCallback(async (id: string) => {
    if (!/^[0-9a-f]{64}$/.test(id))
      throw new Error('Invalid assessment identifier.');
    const request = ++recordRequest.current;
    const record = await read('get_assessment', [id]);
    if (!record.found)
      throw new Error(
        'That assessment was not found in finalized chain state.',
      );
    const policy = await read('evaluate_policy_view', [
      id,
      record.source,
      record.translation,
      record.target,
    ]);
    if (request !== recordRequest.current) return;
    setSource(record.source);
    setTranslation(record.translation);
    setTarget(record.target);
    setAssessment(record);
    setGate(policy);
    setPublication({ found: false });
    setTab('check');
    setError('');
    window.history.replaceState(null, '', '?assessment=' + id);
  }, []);

  useEffect(() => {
    let active = true;
    discovery.current = watchWallets(setWallets);
    if (configured)
      void read('list_assessments', [0, 10])
        .then((page) => {
          if (active) {
            setRows(page.items);
            setTotal(page.total);
            setOffset(page.next_offset);
          }
        })
        .catch((e) => {
          if (active) setHistoryError(safeError(e));
        })
        .finally(() => {
          if (active) setHistoryLoading(false);
        });
    const id = new URLSearchParams(window.location.search).get('assessment');
    if (id) void openRecord(id).catch((e) => setError(safeError(e)));
    return () => {
      active = false;
      discovery.current?.stop();
      tracking.current?.abort();
    };
  }, [openRecord]);

  const stageRef = useRef(stage);
  useLayoutEffect(() => {
    stageRef.current = stage;
  });
  useEffect(
    () =>
      registerTranslationTools(
        (d) => flushSync(() => stageRef.current(d)),
        () => stateRef.current,
      ),
    [],
  );

  useEffect(() => {
    const p = selectedWallet?.provider;
    if (!p) return;
    const changed = (accounts: unknown) => {
      const next =
        Array.isArray(accounts) && /^0x[0-9a-fA-F]{40}$/.test(accounts[0] || '')
          ? accounts[0]
          : null;
      setAccount(next);
      setPublication({ found: false });
    };
    const disconnected = () => {
      setAccount(null);
      setSelectedWallet(null);
    };
    p.on?.('accountsChanged', changed);
    p.on?.('disconnect', disconnected);
    return () => {
      p.removeListener?.('accountsChanged', changed);
      p.removeListener?.('disconnect', disconnected);
    };
  }, [selectedWallet]);

  useEffect(() => {
    let active = true;
    if (account && assessment)
      void read('get_publication', [assessment.id, account])
        .then((p) => {
          if (active) setPublication(p);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [account, assessment]);

  function savePending(p: Pending | null) {
    setPending(p);
    try {
      if (p) localStorage.setItem(PENDING_KEY, JSON.stringify(p));
      else localStorage.removeItem(PENDING_KEY);
    } catch {
      /* Hash also remains visible in this session. */
    }
  }
  async function track(p: Pending) {
    const controller = new AbortController();
    tracking.current = controller;
    setNotice(
      'Waiting for GenLayer finalization. This can take a few minutes.',
    );
    const receipt = await waitForFinalized(
      p.hash,
      setTxStatus,
      controller.signal,
    );
    // Completion requires successful execution AND a finalized state read.
    await openRecord(p.id);
    if (p.action === 'publish') {
      const publisher = receipt.sender || receipt.from_address;
      if (!publisher)
        throw new Error(
          'Publisher is not yet visible. Resume transaction tracking.',
        );
      const pub = await read('get_publication', [p.id, publisher]);
      if (!pub.found)
        throw new Error(
          'The finalized publication is not yet visible. Resume tracking this transaction.',
        );
      setPublication(pub);
    }
    savePending(null);
    setNotice(
      p.action === 'publish'
        ? 'Exact translation published in the on-chain registry.'
        : 'Assessment finalized. The result below is read from GenLayer.',
    );
    void loadHistory();
  }
  async function resume() {
    if (!pending || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await track(pending);
    } catch (e) {
      if (e instanceof ExecutionError) savePending(null);
      setError(safeError(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function connect(option: WalletOption) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const address = await connectWallet(option.provider);
      setAccount(address);
      setSelectedWallet(option);
      setPublication({ found: false });
      setWalletOpen(false);
      setNotice(
        'Wallet connected. Click Check meaning to submit when you are ready.',
      );
    } catch (e) {
      setError(safeError(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function submit(action: 'assess' | 'publish') {
    if (busyRef.current || pending) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      validateDraft(source, translation, target);
      if (!configured)
        throw new Error('Live deployment is not yet configured.');
      const id = await contentId(source, translation, target);
      if (action === 'assess') {
        const existing = await read('get_assessment', [id]);
        if (existing.found) {
          await openRecord(id);
          setNotice(
            'This exact translation was already assessed. Reusing its immutable result; no transaction is needed.',
          );
          return;
        }
      } else {
        if (!assessment || assessment.id !== id)
          throw new Error('Check this exact text before publishing.');
        const current = await read('evaluate_policy_view', [
          id,
          source,
          translation,
          target,
        ]);
        setGate(current);
        if (!current.satisfied)
          throw new Error(
            'Publication blocked: ' + current.failure_reasons.join(', '),
          );
      }
      if (!account || !selectedWallet) {
        setWalletOpen(true);
        setNotice(
          'Connect an Ethereum-compatible wallet to submit a new check. Viewing existing results is free of wallet prompts.',
        );
        return;
      }
      setNotice(
        'Confirm the network and transaction in your selected wallet. No tokens are transferred.',
      );
      await ensureStudioNet(selectedWallet.provider);
      const accounts = await selectedWallet.provider.request({
        method: 'eth_accounts',
      });
      if (
        !Array.isArray(accounts) ||
        typeof accounts[0] !== 'string' ||
        accounts[0].toLowerCase() !== account.toLowerCase()
      )
        throw new Error(
          'The wallet account changed. Reconnect before submitting.',
        );
      const client = writer(account, selectedWallet.provider);
      const args =
        action === 'assess'
          ? [source, translation, target]
          : [id, source, translation, target];
      const hash = await client.writeContract({
        address: contractAddress,
        functionName: action,
        args,
        value: 0n,
        leaderOnly: false,
      });
      const p: Pending = { hash, action, id, source, translation, target };
      savePending(p);
      setTxStatus('SUBMITTED');
      await track(p);
    } catch (e) {
      if (e instanceof ExecutionError) savePending(null);
      setError(safeError(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const isExample =
    !assessment &&
    source === SOURCE &&
    translation === EXAMPLES[target].translation;
  const review =
    assessment?.review || (isExample ? EXAMPLES[target].review : null);
  const verdictClass =
    review?.verdict === 'PRESERVED'
      ? 'preserved'
      : review?.verdict === 'REVIEW'
        ? 'review'
        : '';
  const canPublish =
    !!assessment && gate?.satisfied === true && !publication.found && !pending;
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <div className="brand">
            <span className="brand-icon">
              <Languages size={22} />
            </span>
            TranslateCheck
          </div>
          <div className="header-actions">
            <span className="network">StudioNet · test network</span>
            <button
              className="secondary"
              onClick={() => {
                discovery.current?.refresh();
                setWalletOpen(true);
              }}
              disabled={busy}
            >
              <Wallet size={16} />
              {account ? shortAddress(account) : 'Connect wallet'}
            </button>
          </div>
        </div>
      </header>
      <main className="shell">
        <div className="topline">
          <div>
            <div className="eyebrow">A second look at the meaning</div>
            <h1>Good words. Same message?</h1>
            <p className="subtle">
              Check your translation before it goes out into the world.
            </p>
          </div>
          <span className="badge">EN → FR / ES / 中文</span>
        </div>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        {notice && <output className="notice block">{notice}</output>}
        {pending && (
          <div className="notice">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p>
                <strong>
                  {pending.action === 'assess' ? 'Assessment' : 'Publication'}{' '}
                  transaction
                </strong>{' '}
                · {txStatus || 'Tracking paused'}
                <br />
                <a
                  className="mono"
                  href={explorer + '/tx/' + pending.hash}
                  target="_blank"
                  rel="noreferrer"
                >
                  {pending.hash} ↗
                </a>
              </p>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => void resume()}
              >
                <RefreshCw size={15} />
                {busy ? 'Tracking…' : 'Resume transaction'}
              </button>
            </div>
          </div>
        )}
        <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
          <TabsList variant="line" className="mb-6 h-11 gap-6">
            <TabsTrigger value="check" className="px-1 text-[15px]">
              <FileCheck2 />
              Translation check
            </TabsTrigger>
            <TabsTrigger value="history" className="px-1 text-[15px]">
              <History />
              Public history
            </TabsTrigger>
          </TabsList>
          <TabsContent value="check">
            <div className="work-grid">
              <section>
                <div className="surface">
                  <div className="surface-head">
                    <h2>
                      <span className="step">01</span>Your translation
                    </h2>
                    <FileCheck2 size={20} className="subtle" />
                  </div>
                  <div className="editor-grid">
                    <div className="editor-cell">
                      <div className="editor-label">
                        <label htmlFor="source">Original text</label>
                        <span className="badge">English</span>
                      </div>
                      <textarea
                        id="source"
                        value={source}
                        maxLength={2400}
                        disabled={busy}
                        placeholder="Paste your original English text…"
                        onChange={(e) => {
                          setSource(e.target.value);
                          clearResult();
                        }}
                        aria-describedby="source-count"
                      />
                      <p id="source-count" className="count">
                        {Array.from(source).length} / 1,200 characters
                      </p>
                    </div>
                    <div className="editor-cell">
                      <div className="editor-label">
                        <label htmlFor="translation">Translation</label>
                        <Select
                          value={target}
                          disabled={busy}
                          onValueChange={(v) => {
                            if (v) {
                              setTarget(v as Language);
                              clearResult();
                            }
                          }}
                        >
                          <SelectTrigger
                            aria-label="Target language"
                            className="max-w-[190px]"
                          >
                            <SelectValue>
                              {target === 'zh-CN'
                                ? 'Mandarin · 简体'
                                : LANGUAGES[target]}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(LANGUAGES).map(([code, name]) => (
                              <SelectItem key={code} value={code}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <textarea
                        id="translation"
                        lang={target}
                        value={translation}
                        maxLength={2400}
                        disabled={busy}
                        placeholder="Paste the translation to check…"
                        onChange={(e) => {
                          setTranslation(e.target.value);
                          clearResult();
                        }}
                        aria-describedby="translation-count"
                      />
                      <p id="translation-count" className="count">
                        {Array.from(translation).length} / 1,200 characters
                      </p>
                    </div>
                  </div>
                  <div className="editor-footer">
                    <p className="footnote">
                      Submitted text is public on-chain. Don’t include private
                      or sensitive information.
                    </p>
                    <button
                      className="primary"
                      disabled={busy || !!pending}
                      onClick={() => void submit('assess')}
                    >
                      {busy ? 'Working…' : 'Check meaning'}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
                <div className="example-row">
                  <span>Try an example</span>
                  {Object.entries(LANGUAGES).map(([code, name]) => (
                    <button
                      key={code}
                      disabled={busy}
                      onClick={() =>
                        stage({
                          source: SOURCE,
                          translation: EXAMPLES[code as Language].translation,
                          target: code as Language,
                        })
                      }
                    >
                      {code === 'zh-CN' ? 'Mandarin Chinese' : name}
                    </button>
                  ))}
                </div>
                <div className="scope">
                  <span>
                    <Check size={15} />
                    Numbers & conditions
                  </span>
                  <span>
                    <Check size={15} />
                    Negations & omissions
                  </span>
                  <span>
                    <Check size={15} />
                    No style or fluency score
                  </span>
                </div>
              </section>
              <aside className="surface" aria-live="polite">
                <div className="surface-head">
                  <h2>
                    <span className="step">02</span>The meaning check
                  </h2>
                  {isExample && <span className="badge">Example only</span>}
                  {assessment && <span className="badge">Finalized</span>}
                </div>
                <div className="result-body">
                  {review ? (
                    <>
                      <span className={'status ' + verdictClass}>
                        {LABELS[review.verdict]}
                      </span>
                      <div className="quote-pair">
                        <div className="quote">
                          <span>Original phrase</span>
                          <strong>“{review.source_quote}”</strong>
                        </div>
                        <div
                          className={
                            'quote ' +
                            (review.verdict === 'CHANGED' ? 'flagged' : '')
                          }
                        >
                          <span>Translated phrase</span>
                          <strong lang={target}>
                            “{review.translation_quote}”
                          </strong>
                        </div>
                      </div>
                      <p className="result-note">{review.explanation}</p>
                      <p className="mono mt-4 subtle">{review.reason_code}</p>
                      <div className="gate">
                        {gate?.satisfied ? (
                          <ShieldCheck size={20} className="shrink-0" />
                        ) : (
                          <LockKeyhole size={20} className="shrink-0" />
                        )}
                        <div>
                          <p className="font-semibold">
                            {isExample
                              ? 'Illustrative result — not an approval'
                              : publication.found
                                ? 'Published in the registry'
                                : gate?.satisfied
                                  ? 'Exact text cleared for publication'
                                  : 'Publication blocked'}
                          </p>
                          <p className="subtle mt-1">
                            {isExample
                              ? 'Run a live check to obtain a GenLayer assessment.'
                              : gate?.satisfied
                                ? 'Approval applies only to these exact texts and this target language.'
                                : 'Changed or uncertain meaning cannot pass the contract’s publication gate.'}
                          </p>
                        </div>
                      </div>
                      {canPublish && (
                        <button
                          className="primary w-full mt-5"
                          disabled={busy}
                          onClick={() => void submit('publish')}
                        >
                          Publish exact translation <ArrowRight size={16} />
                        </button>
                      )}
                      {assessment && (
                        <div className="mt-5 space-y-2">
                          <p className="footnote">
                            {date(assessment.created_at)} ·{' '}
                            {shortAddress(assessment.submitted_by)}
                          </p>
                          <p className="mono subtle">
                            Assessment {assessment.id}
                          </p>
                          <a
                            className="text-sm inline-flex items-center gap-1"
                            href={explorer + '/address/' + contractAddress}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View contract <ExternalLink size={13} />
                          </a>
                          <p className="footnote">
                            Validators agree on the verdict and reason category.
                            Explanation wording may differ.
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <Empty className="border-0 px-0 py-10">
                      <EmptyHeader>
                        <CircleHelp
                          className="mx-auto text-primary"
                          size={30}
                        />
                        <EmptyTitle>No assessment yet</EmptyTitle>
                        <EmptyDescription>
                          Submit this exact text, or open a finalized result
                          from public history.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </div>
              </aside>
            </div>
          </TabsContent>
          <TabsContent value="history">
            <div className="surface">
              <div className="surface-head">
                <div>
                  <h2>Public assessment history</h2>
                  <p className="subtle text-sm mt-1">
                    {total} finalized record{total === 1 ? '' : 's'} · no wallet
                    needed
                  </p>
                </div>
                <button
                  className="secondary"
                  disabled={historyLoading}
                  onClick={() => void loadHistory()}
                >
                  <RefreshCw size={16} />
                  Refresh
                </button>
              </div>
              <div className="result-body">
                {historyError && (
                  <p className="notice error" role="alert">
                    {historyError}
                  </p>
                )}
                {historyLoading && !rows.length ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : !rows.length ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>
                        {historyError
                          ? 'History is temporarily unavailable'
                          : 'No finalized assessments yet'}
                      </EmptyTitle>
                      <EmptyDescription>
                        {historyError
                          ? 'Use Refresh to try the public network again.'
                          : 'The first completed check will appear here.'}
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <button
                        className="secondary"
                        onClick={() => setTab('check')}
                      >
                        Open translation check
                      </button>
                    </EmptyContent>
                  </Empty>
                ) : (
                  <div className="history-list">
                    {rows.map((row) => (
                      <button
                        key={row.id}
                        className="surface history-item"
                        disabled={busy}
                        onClick={() =>
                          void openRecord(row.id).catch((e) =>
                            setError(safeError(e)),
                          )
                        }
                      >
                        <div>
                          <p className="text-base font-medium">{row.source}</p>
                          <p className="subtle text-sm mt-1">
                            English → {LANGUAGES[row.target]} ·{' '}
                            {date(row.created_at)}
                          </p>
                        </div>
                        <span
                          className={
                            'status shrink-0 ' +
                            (row.verdict === 'PRESERVED'
                              ? 'preserved'
                              : row.verdict === 'REVIEW'
                                ? 'review'
                                : '')
                          }
                        >
                          {LABELS[row.verdict]}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {offset < total && (
                  <button
                    className="secondary mt-5"
                    disabled={historyLoading}
                    onClick={() => void loadHistory(true)}
                  >
                    Load older records
                  </button>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
        <footer className="footer">
          <span className="flex items-center gap-2">
            <ShieldCheck size={15} />
            {configured ? (
              <a
                href={explorer + '/address/' + contractAddress}
                target="_blank"
                rel="noreferrer"
              >
                GenLayer contract ↗
              </a>
            ) : (
              'Deployment being verified'
            )}{' '}
            · exact-text records
          </span>
          <span>
            Not certified translation. Use qualified human review for
            high-stakes content.
          </span>
        </footer>
      </main>
      <Dialog open={walletOpen} onOpenChange={setWalletOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect your wallet</DialogTitle>
            <DialogDescription>
              Choose an Ethereum-compatible wallet. Only writing to GenLayer
              needs a connection. StudioNet is a gasless development network.
            </DialogDescription>
          </DialogHeader>
          {account && (
            <div className="notice">
              <p>{selectedWallet?.name}</p>
              <p className="mono">{account}</p>
              <button
                className="secondary mt-3"
                disabled={busy}
                onClick={() => {
                  setAccount(null);
                  setSelectedWallet(null);
                  setWalletOpen(false);
                  setPublication({ found: false });
                }}
              >
                Disconnect app
              </button>
            </div>
          )}
          {wallets.map((option) => (
            <button
              key={option.id}
              className="wallet-option"
              disabled={busy}
              onClick={() => void connect(option)}
            >
              <span>{option.name}</span>
              <ArrowRight size={16} />
            </button>
          ))}
          {!wallets.length && (
            <p className="notice">
              No wallet was detected. Open this app in Chrome or another
              wallet-enabled browser, then unlock your wallet and refresh. An
              embedded browser may not expose extensions.
            </p>
          )}
          <button
            className="secondary"
            disabled={busy}
            onClick={() => discovery.current?.refresh()}
          >
            <RefreshCw size={15} />
            Refresh wallets
          </button>
          <p className="footnote">
            MetaMask, OKX, Phantom, and other injected Ethereum wallets can be
            detected. Your wallet must support GenLayer’s custom network; some
            do not. We never request a seed phrase or private key.
          </p>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
