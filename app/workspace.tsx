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
  WandSparkles,
  PencilLine,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  correctionsAddress,
  correctionsConfigured,
  explorer,
  ExecutionError,
  read,
  readSuggestion,
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
import { RequestFeedback } from '@/lib/feedback';
import { GoldStream } from '@/app/gold-stream';
import { reconcilePending } from '@/lib/recovery';
import {
  checkedSuggestion,
  validateAssessment,
  validateComparison,
  recoverCorrectionPending,
  quoteParts,
  type Suggestion,
} from '@/lib/corrections';

const PENDING_KEY = 'translatecheck:pending:61999:' + DEPLOYMENT.address;
const STOPPED_KEY = PENDING_KEY + ':last-stopped';
function recoverStoppedHash(): string | null {
  try {
    const hash = localStorage.getItem(STOPPED_KEY);
    return hash && /^0x[0-9a-fA-F]{64}$/.test(hash) ? hash : null;
  } catch {
    return null;
  }
}
function recoverPending(): Pending | null {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null');
    if (
      p &&
      /^0x[0-9a-fA-F]{64}$/.test(p.hash) &&
      /^[0-9a-f]{64}$/.test(p.id) &&
      ['assess', 'publish', 'suggest'].includes(p.action) &&
      (p.revisionParentId === undefined ||
        /^[0-9a-f]{64}$/.test(p.revisionParentId))
    ) {
      validateDraft(p.source, p.translation, p.target);
      if (
        p.revisionDraft !== undefined &&
        (typeof p.revisionDraft !== 'string' ||
          Array.from(p.revisionDraft).length > 1200)
      )
        return null;
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
  const [revisionParent, setRevisionParent] = useState<Assessment | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
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
  const [stopOpen, setStopOpen] = useState(false);
  const [lastStoppedHash, setLastStoppedHash] = useState(recoverStoppedHash);
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
    setRevisionParent(null);
    setSuggestion(null);
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
  const openRecord = useCallback(async (id: string, parentId?: string) => {
    if (!/^[0-9a-f]{64}$/.test(id))
      throw new Error('Invalid assessment identifier.');
    const request = ++recordRequest.current;
    const record = await read('get_assessment', [id]);
    if (!record.found)
      throw new Error(
        'That assessment was not found in finalized chain state.',
      );
    await validateAssessment(record, id);
    let parent: Assessment | null = null;
    if (parentId) {
      if (!/^[0-9a-f]{64}$/.test(parentId))
        throw new Error('Invalid comparison identifier.');
      const previous = await read('get_assessment', [parentId]);
      if (!previous.found)
        throw new Error(
          'The original assessment for this comparison was not found.',
        );
      await validateComparison(previous, record);
      parent = previous;
    }
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
    setRevisionParent(parent);
    setSuggestion(null);
    setGate(policy);
    setPublication({ found: false });
    setTab('check');
    setError('');
    window.history.replaceState(
      null,
      '',
      '?assessment=' + id + (parent ? '&compare=' + parent.id : ''),
    );
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
    const compare =
      new URLSearchParams(window.location.search).get('compare') || undefined;
    if (id) void openRecord(id, compare).catch((e) => setError(safeError(e)));
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
    if (p.action === 'suggest') {
      const parent = await read('get_assessment', [p.id]);
      if (!parent.found)
        throw new Error(
          'The original assessment is not visible yet. Resume tracking.',
        );
      const draft = await checkedSuggestion(await readSuggestion(p.id), parent);
      clearResult();
      setSource(parent.source);
      setTarget(parent.target);
      setTranslation(p.revisionDraft ?? parent.translation);
      setRevisionParent(parent);
      setSuggestion(draft);
      setTab('check');
    } else {
      await openRecord(p.id, p.revisionParentId);
    }
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
        : p.action === 'suggest'
          ? 'Correction ready to review. It is a draft, not an assessment or permission to publish.'
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
      setNotice('');
      setError(safeError(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function stopTracking() {
    if (!pending || busyRef.current) return;
    const saved = pending;
    busyRef.current = true;
    setBusy(true);
    setStopOpen(false);
    tracking.current?.abort();
    try {
      clearResult();
      setRevisionParent(null);
      setSuggestion(null);
      setNotice('Checking finalized records before stopping local tracking…');
      // Bounded and read-only: an unavailable network must not trap the user here.
      const correction =
        saved.action === 'suggest'
          ? await recoverCorrectionPending(saved, read, readSuggestion)
          : null;
      const result =
        saved.action === 'suggest'
          ? { kind: 'unknown' as const }
          : await reconcilePending(saved, read);
      setLastStoppedHash(saved.hash);
      try {
        localStorage.setItem(STOPPED_KEY, saved.hash);
      } catch {
        /* The original link remains visible in this session. */
      }
      savePending(null);
      setTxStatus('');
      if (result.kind === 'found') {
        setSource(result.assessment.source);
        setTranslation(result.assessment.translation);
        setTarget(result.assessment.target);
        setAssessment(result.assessment);
        setRevisionParent(result.revisionParent ?? null);
        setGate(result.gate);
        setPublication(result.publication);
        setTab('check');
        window.history.replaceState(
          null,
          '',
          '?assessment=' +
            saved.id +
            (result.revisionParent
              ? '&compare=' + result.revisionParent.id
              : ''),
        );
      }
      if (correction) {
        setSource(correction.parent.source);
        setTranslation(saved.revisionDraft ?? correction.parent.translation);
        setTarget(correction.parent.target);
        setRevisionParent(correction.parent);
        setSuggestion(correction.suggestion);
        setTab('check');
      }
      setNotice(
        correction
          ? 'Tracking stopped. A finalized advisory correction is available below. A separate assessment is still required; no transaction was sent.'
          : result.kind === 'found' && result.completed
            ? saved.action === 'publish'
              ? 'Tracking stopped. The submitting wallet’s publication is already in finalized chain state. No transaction was sent.'
              : 'Tracking stopped. An assessment for the exact saved text is finalized and loaded below. This does not confirm the original transaction’s status.'
            : 'Local tracking stopped. The transaction’s outcome is still unconfirmed and it may finish later. Nothing was canceled or resubmitted. Check its link before retrying the same action.',
      );
    } catch (e) {
      setNotice('');
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
      setNotice('');
      setError(safeError(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function beginRevision(record: Assessment) {
    if (busyRef.current || pending) return;
    setRevisionParent(record);
    setSuggestion(null);
    setSource(record.source);
    setTranslation(record.translation);
    setTarget(record.target);
    clearResult();
    setNotice(
      'Request a correction, or edit the translation yourself. Every revision needs its own meaning check.',
    );
  }
  function useSuggestion() {
    if (
      busyRef.current ||
      pending ||
      !revisionParent ||
      suggestion?.suggestion.status !== 'SUGGESTED'
    )
      return;
    setTranslation(suggestion.suggestion.translation);
    clearResult();
    setNotice(
      'Suggestion copied into your revision. Review it, then choose Recheck revision. It is not approved yet.',
    );
  }
  async function submit(action: Pending['action']) {
    if (busyRef.current || pending) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (action === 'suggest' && revisionParent)
        validateDraft(
          revisionParent.source,
          revisionParent.translation,
          revisionParent.target,
        );
      else validateDraft(source, translation, target);
      if (!configured)
        throw new Error('Live deployment is not yet configured.');
      if (
        action === 'assess' &&
        revisionParent &&
        translation.trim() === revisionParent.translation.trim()
      )
        throw new Error(
          'Change the translation before rechecking a revision. The original assessment is unchanged.',
        );
      const id =
        action === 'suggest' && revisionParent
          ? revisionParent.id
          : await contentId(source, translation, target);
      if (action === 'suggest') {
        if (!revisionParent)
          throw new Error(
            'Open a failed assessment and choose Fix & recheck first.',
          );
        if (!correctionsConfigured)
          throw new Error(
            'Corrections are being configured. You can still edit and recheck manually.',
          );
        const existing = await readSuggestion(id);
        if (existing.found) {
          setSuggestion(await checkedSuggestion(existing, revisionParent));
          setNotice(
            'The existing correction draft is ready to review. No transaction was needed, and it is not a publication approval.',
          );
          return;
        }
      }
      if (action === 'assess') {
        const existing = await read('get_assessment', [id]);
        if (existing.found) {
          await openRecord(id, revisionParent?.id);
          setNotice(
            'This exact translation was already assessed. Reusing its immutable result; no transaction is needed.',
          );
          return;
        }
      } else if (action === 'publish') {
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
      if (action === 'publish') {
        const existing = await read('get_publication', [id, account]);
        if (existing.found) {
          await openRecord(id, revisionParent?.id);
          setPublication(existing);
          setNotice(
            'This wallet’s exact translation is already published. No transaction was sent.',
          );
          return;
        }
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
        action === 'suggest'
          ? [id]
          : action === 'assess'
            ? [source, translation, target]
            : [id, source, translation, target];
      const hash = await client.writeContract({
        address: action === 'suggest' ? correctionsAddress : contractAddress,
        functionName: action,
        args,
        value: 0n,
        leaderOnly: false,
      });
      const p: Pending = {
        hash,
        action,
        id,
        source: action === 'suggest' ? revisionParent!.source : source,
        translation:
          action === 'suggest' ? revisionParent!.translation : translation,
        target: action === 'suggest' ? revisionParent!.target : target,
        account,
        ...(action !== 'suggest' && revisionParent
          ? { revisionParentId: revisionParent.id }
          : {}),
        ...(action === 'suggest' && Array.from(translation).length <= 1200
          ? { revisionDraft: translation }
          : {}),
      };
      savePending(p);
      setTxStatus('SUBMITTED');
      await track(p);
    } catch (e) {
      if (e instanceof ExecutionError) savePending(null);
      setNotice('');
      setError(safeError(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const isExample =
    !assessment &&
    !revisionParent &&
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
            <span className="brand-wordmark">
              Translate<span>Check</span>
            </span>
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
            <h1>
              Good words. <span>Same message?</span>
            </h1>
            <p className="subtle">
              Check your translation before it goes out into the world.
            </p>
          </div>
          <span className="language-scope">EN → FR / ES / 中文</span>
        </div>
        <RequestFeedback error={error} notice={notice} />
        {pending && (
          <div className="notice">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p>
                <strong>
                  {pending.action === 'assess'
                    ? 'Assessment'
                    : pending.action === 'suggest'
                      ? 'Correction'
                      : 'Publication'}{' '}
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
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setStopOpen(true)}
              >
                Stop tracking
              </button>
            </div>
          </div>
        )}
        {lastStoppedHash && (
          <p className="footnote mb-4">
            Last transaction you stopped tracking:{' '}
            <a
              href={explorer + '/tx/' + lastStoppedHash}
              target="_blank"
              rel="noreferrer"
            >
              View transaction ↗
            </a>{' '}
            — stopping tracking does not cancel it.
          </p>
        )}
        <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
          <TabsList className="workspace-nav">
            <TabsTrigger value="check" className="workspace-tab">
              <FileCheck2 />
              Translation check
            </TabsTrigger>
            <TabsTrigger value="history" className="workspace-tab">
              <History />
              Public history
            </TabsTrigger>
          </TabsList>
          <TabsContent value="check">
            <div className="work-grid">
              <section>
                <div className="surface editor-surface">
                  <div className="surface-head">
                    <h2>
                      <span className="step">01</span>
                      {revisionParent
                        ? 'Edit your revision'
                        : 'Your translation'}
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
                        disabled={busy || !!revisionParent}
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
                        <label htmlFor="translation">
                          {revisionParent ? 'Your revision' : 'Translation'}
                        </label>
                        <Select
                          value={target}
                          disabled={busy || !!revisionParent}
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
                      disabled={
                        busy ||
                        !!pending ||
                        (!!revisionParent &&
                          translation.trim() ===
                            revisionParent.translation.trim())
                      }
                      onClick={() => void submit('assess')}
                    >
                      {busy
                        ? 'Working…'
                        : revisionParent
                          ? 'Recheck revision'
                          : 'Check meaning'}
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
                {revisionParent && (
                  <section
                    className="surface revision-panel"
                    aria-labelledby="revision-title"
                  >
                    <div className="surface-head">
                      <h2 id="revision-title">
                        <PencilLine size={19} /> Fix & recheck
                      </h2>
                      <button
                        className="secondary"
                        disabled={busy || !!pending}
                        onClick={() => {
                          setRevisionParent(null);
                          setSuggestion(null);
                          window.history.replaceState(
                            null,
                            '',
                            assessment
                              ? '?assessment=' + assessment.id
                              : window.location.pathname,
                          );
                        }}
                      >
                        Exit comparison
                      </button>
                    </div>
                    <div className="result-body">
                      <p className="subtle">
                        Request a draft correction or edit the translation
                        above. Suggested text is never automatically assessed or
                        published.
                      </p>
                      <div className="revision-actions">
                        <button
                          className="secondary"
                          disabled={busy || !!pending || !correctionsConfigured}
                          onClick={() => void submit('suggest')}
                        >
                          <WandSparkles size={16} />
                          {suggestion
                            ? 'Reload correction'
                            : 'Request correction'}
                        </button>
                        <span className="footnote">
                          A new suggestion needs a wallet approval. Existing
                          drafts can be reused.
                        </span>
                      </div>
                      {suggestion && (
                        <div className="suggestion-box">
                          <span className="badge">
                            {suggestion.suggestion.status === 'SUGGESTED'
                              ? 'Suggested draft · not an approval'
                              : 'Human input needed'}
                          </span>
                          {suggestion.suggestion.status === 'SUGGESTED' && (
                            <p className="revision-text" lang={target}>
                              {suggestion.suggestion.translation}
                            </p>
                          )}
                          <p>{suggestion.suggestion.explanation}</p>
                          {suggestion.suggestion.status === 'SUGGESTED' && (
                            <button
                              className="secondary mt-3"
                              disabled={busy || !!pending}
                              onClick={useSuggestion}
                            >
                              Use suggestion
                            </button>
                          )}
                        </div>
                      )}
                      <div className="comparison-grid">
                        <div>
                          <h3>Before · original check</h3>
                          <span
                            className={
                              'status ' +
                              (revisionParent.review.verdict === 'REVIEW'
                                ? 'review'
                                : '')
                            }
                          >
                            {LABELS[revisionParent.review.verdict]}
                          </span>
                          <p className="revision-text" lang={target}>
                            {quoteParts(
                              revisionParent.translation,
                              revisionParent.review.translation_quote,
                            ).map((part, i) =>
                              part.highlighted ? (
                                <mark key={i}>{part.text}</mark>
                              ) : (
                                <span key={i}>{part.text}</span>
                              ),
                            )}
                          </p>
                          <p className="subtle">
                            {revisionParent.review.explanation}
                          </p>
                          <a
                            className="text-sm"
                            href={'?assessment=' + revisionParent.id}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open original assessment ↗
                          </a>
                        </div>
                        <div>
                          <h3>After · your revision</h3>
                          <span
                            className={
                              'status ' +
                              (assessment?.review.verdict === 'PRESERVED'
                                ? 'preserved'
                                : 'review')
                            }
                          >
                            {assessment
                              ? LABELS[assessment.review.verdict]
                              : 'Not assessed · publication blocked'}
                          </span>
                          <p className="revision-text" lang={target}>
                            {translation || 'Edit the translation above.'}
                          </p>
                          <p className="subtle">
                            {assessment
                              ? assessment.review.explanation
                              : 'A fresh check of this exact text is required. The old result stays unchanged.'}
                          </p>
                          {assessment && (
                            <a
                              className="text-sm"
                              href={
                                '?assessment=' +
                                assessment.id +
                                '&compare=' +
                                revisionParent.id
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open verified comparison ↗
                            </a>
                          )}
                        </div>
                      </div>
                      <p className="footnote mt-4">
                        Highlighted text is the original assessment’s cited
                        phrase. This comparison does not claim authorship or a
                        certified translation.
                      </p>
                    </div>
                  </section>
                )}
              </section>
              <aside className="surface result-surface" aria-live="polite">
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
                      {assessment &&
                        assessment.review.verdict !== 'PRESERVED' &&
                        !revisionParent && (
                          <button
                            className="primary w-full mt-5"
                            disabled={busy || !!pending}
                            onClick={() => beginRevision(assessment)}
                          >
                            <PencilLine size={16} /> Fix & recheck
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
          <GoldStream />
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
      <AlertDialog open={stopOpen} onOpenChange={setStopOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop tracking this transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This clears this browser’s active tracking entry and lets you
              start another check. It does not cancel the transaction: it may
              still finish. We’ll check finalized records first, but you can
              continue even if the network is unavailable. Nothing will be
              automatically resubmitted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pending && (
            <a
              className="mono text-sm break-all"
              href={explorer + '/tx/' + pending.hash}
              target="_blank"
              rel="noreferrer"
            >
              {pending.hash} ↗
            </a>
          )}
          <p className="footnote">
            The last stopped transaction link is saved when browser storage is
            available. Keep a copy before stopping another one.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep tracking</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => void stopTracking()}
            >
              Check and stop tracking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={walletOpen} onOpenChange={setWalletOpen}>
        <DialogContent className="wallet-dialog sm:max-w-md">
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
