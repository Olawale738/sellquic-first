'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  getDocs,
  limit as fbLimit,
  Timestamp,
} from 'firebase/firestore';
import { format, subDays, startOfDay } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, ChevronDown, Copy } from 'lucide-react';

import { useFirestore } from '@/firebase';
import { useRequireSuperAdmin } from '@/hooks/use-auth';

const TELEMETRY_COLLECTION = 'ai_v2_turn_logs';
const TURNS_LIMIT = 50;
const MESSAGES_LIMIT = 100;

const MARKER_PATTERNS = [
  'composer_override_skipped',
  'non_product_fallback',
  'deterministic_safe',
  'view_request_override',
  'state_safe_reply',
  'verified_exact_match_from_fact_packet',
  'verified_exact_matches_from_fact_packet',
  'in_domain_alternatives_from_fact_packet',
  'selection_state_provide_product_query',
  'selection_state_provide_ordinal_selection',
];

const DAY_RANGES = [
  { label: 'Last 24 hours', days: 1 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
];

const CHANNEL_OPTIONS = [
  { label: 'Any channel', value: '' },
  { label: 'WhatsApp', value: 'whatsapp' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'Webchat', value: 'webchat' },
];

type TurnLog = {
  id: string;
  createdAt?: Timestamp;
  storeId?: string;
  conversationId?: string;
  channel?: string;
  messagePreview?: string;
  replyPreview?: string;
  replyType?: string;
  handler?: string;
  reason?: string;
  stateBefore?: string;
  stateAfter?: string;
  cartItemCount?: number;
  deliveryId?: string | null;
  classificationSource?: string;
  geminiIntent?: string | null;
  failedValidator?: string | null;
  validationReason?: string | null;
  latencyMs?: number;
  turnPlanSummary?: {
    primaryIntent?: string | null;
    [k: string]: unknown;
  } | null;
  factPacketSummary?: {
    primaryHandler?: string;
    routingReason?: string;
    discoveryReason?: string | null;
    exactMatchCount?: number;
    alternativeCount?: number;
    contextFocusId?: string | null;
    [k: string]: unknown;
  } | null;
  composerSummary?: {
    ok?: boolean;
    error?: string | null;
    violationKind?: string | null;
    replyPreview?: string | null;
    [k: string]: unknown;
  } | null;
  [k: string]: unknown;
};

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

function extractMarkers(reason: string | undefined): string[] {
  if (!reason) return [];
  return MARKER_PATTERNS.filter((m) => reason.includes(m));
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function formatTime(ts?: Timestamp): string {
  if (!ts) return '-';
  try {
    return format(ts.toDate(), 'MMM d HH:mm:ss');
  } catch {
    return '-';
  }
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="font-medium text-muted-foreground w-32 shrink-0">{label}:</span>
      <span className="font-mono break-all">{value}</span>
    </div>
  );
}

function TurnCard({ log }: { log: TurnLog }) {
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);

  const reason = log.reason || '';
  const markers = extractMarkers(reason);
  const composer = log.composerSummary;
  const composerFailed = !!(composer && (composer.error || composer.violationKind));
  const validatorFailed = !!log.failedValidator;
  const hasFailure = composerFailed || validatorFailed;

  const time = formatTime(log.createdAt);
  const channel = log.channel || '?';
  const stateTransition =
    log.stateBefore && log.stateAfter
      ? `${log.stateBefore} → ${log.stateAfter}`
      : log.stateBefore || log.stateAfter || '-';

  return (
    <div
      className={`rounded-md border bg-card p-3 space-y-2 ${
        hasFailure ? 'border-l-4 border-l-red-500' : ''
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">{time}</span>
        <span>·</span>
        <span>{channel}</span>
        <span>·</span>
        <span className="font-mono">{stateTransition}</span>
        <span>·</span>
        <span>cart: {log.cartItemCount ?? 0}</span>
        {typeof log.latencyMs === 'number' && (
          <>
            <span>·</span>
            <span>{log.latencyMs}ms</span>
          </>
        )}
      </div>

      <div className="space-y-1 text-sm">
        <div className="flex gap-2">
          <span className="font-medium text-muted-foreground w-20 shrink-0">Customer:</span>
          <span className="break-words">&ldquo;{log.messagePreview || ''}&rdquo;</span>
        </div>
        <div className="flex gap-2">
          <span className="font-medium text-muted-foreground w-20 shrink-0">Bot:</span>
          <span className="break-words">&ldquo;{log.replyPreview || ''}&rdquo;</span>
        </div>
      </div>

      <div className="space-y-1 pt-1">
        <FieldRow label="handler" value={log.handler || '-'} />
        <FieldRow
          label="primaryHandler"
          value={
            log.factPacketSummary?.primaryHandler
              ? `${log.factPacketSummary.primaryHandler}  (${log.factPacketSummary.routingReason || '-'})`
              : '-'
          }
        />
        <FieldRow
          label="classification"
          value={`${log.classificationSource || '-'}    gemini: ${log.geminiIntent || '-'}`}
        />
        <FieldRow label="turnPlan" value={log.turnPlanSummary?.primaryIntent || '-'} />
        <FieldRow
          label="discovery"
          value={
            log.factPacketSummary
              ? `${log.factPacketSummary.discoveryReason || '-'} · exact:${
                  log.factPacketSummary.exactMatchCount ?? 0
                } · alts:${log.factPacketSummary.alternativeCount ?? 0}`
              : '-'
          }
        />
        <FieldRow label="contextFocusId" value={log.factPacketSummary?.contextFocusId || '-'} />
        <FieldRow label="deliveryId" value={log.deliveryId || '-'} />
      </div>

      <div className="text-xs">
        <span className="font-medium text-muted-foreground">reason:</span>{' '}
        <span className="font-mono break-all">{reason || '-'}</span>
      </div>

      {markers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {markers.map((m) => (
            <Badge key={m} variant="outline" className="text-[10px] font-mono">
              {m}
            </Badge>
          ))}
        </div>
      )}

      {composer && (
        <div
          className={`text-xs rounded p-2 ${
            composerFailed ? 'bg-red-50 text-red-900' : 'bg-muted'
          }`}
        >
          <div className="font-medium mb-1">
            Composer attempt: {composer.ok ? '✓' : '✗'}{' '}
            {composer.error || composer.violationKind || ''}
          </div>
          {composer.replyPreview && (
            <div className="italic break-words">&ldquo;{composer.replyPreview}&rdquo;</div>
          )}
        </div>
      )}

      {validatorFailed && (
        <div className="text-xs rounded p-2 bg-red-50 text-red-900">
          <div className="font-medium">Final validator failed: {log.failedValidator}</div>
          {log.validationReason && (
            <div className="italic break-words">{log.validationReason}</div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowJson((v) => !v)}
          className="h-7 text-xs"
        >
          <ChevronDown
            className={`h-3 w-3 mr-1 transition-transform ${showJson ? 'rotate-180' : ''}`}
          />
          {showJson ? 'Hide' : 'Show'} raw JSON
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            const ok = await copyToClipboard(JSON.stringify(log, null, 2));
            if (ok) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }
          }}
          className="h-7 text-xs"
        >
          <Copy className="h-3 w-3 mr-1" />
          {copied ? 'Copied' : 'Copy JSON'}
        </Button>
      </div>

      {showJson && (
        <pre className="text-[10px] bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap break-words">
          {JSON.stringify(log, null, 2)}
        </pre>
      )}
    </div>
  );
}

function Transcript({
  messages,
  error,
  loading,
}: {
  messages: ChatMessage[] | null;
  error: string | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Loading transcript...
        </CardContent>
      </Card>
    );
  }
  if (error) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Transcript not available. {error}
        </CardContent>
      </Card>
    );
  }
  if (!messages || messages.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          No messages yet.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Conversation transcript ({messages.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 font-mono text-sm max-h-[400px] overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className="flex gap-2">
              <span
                className={`font-medium w-20 shrink-0 ${
                  m.role === 'user' ? 'text-blue-700' : 'text-muted-foreground'
                }`}
              >
                {m.role === 'user' ? 'Customer:' : 'Bot:'}
              </span>
              <span className="break-words whitespace-pre-wrap">{m.content}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TurnInspectorInner() {
  const { user } = useRequireSuperAdmin();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialDays = parseInt(searchParams.get('days') || '7', 10) || 7;

  const [pendingStoreId, setPendingStoreId] = useState(searchParams.get('storeId') || '');
  const [pendingConversationId, setPendingConversationId] = useState(
    searchParams.get('conversationId') || '',
  );
  const [pendingChannel, setPendingChannel] = useState(searchParams.get('channel') || '');
  const [pendingDays, setPendingDays] = useState(initialDays);

  const [applied, setApplied] = useState({
    storeId: searchParams.get('storeId') || '',
    conversationId: searchParams.get('conversationId') || '',
    channel: searchParams.get('channel') || '',
    days: initialDays,
  });

  const [logs, setLogs] = useState<TurnLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const [allCopied, setAllCopied] = useState(false);

  useEffect(() => {
    if (!user || !firestore) return;
    setLogsLoading(true);
    setLogsError(null);
    (async () => {
      try {
        const since = subDays(startOfDay(new Date()), Math.max(0, applied.days - 1));
        let q;
        if (applied.storeId && applied.conversationId) {
          q = query(
            collection(firestore, 'stores', applied.storeId, TELEMETRY_COLLECTION),
            where('conversationId', '==', applied.conversationId),
            orderBy('createdAt', 'desc'),
            fbLimit(TURNS_LIMIT),
          );
        } else if (applied.storeId) {
          q = query(
            collection(firestore, 'stores', applied.storeId, TELEMETRY_COLLECTION),
            where('createdAt', '>=', since),
            orderBy('createdAt', 'desc'),
            fbLimit(TURNS_LIMIT),
          );
        } else if (applied.conversationId) {
          q = query(
            collectionGroup(firestore, TELEMETRY_COLLECTION),
            where('conversationId', '==', applied.conversationId),
            where('createdAt', '>=', since),
            orderBy('createdAt', 'desc'),
            fbLimit(TURNS_LIMIT),
          );
        } else {
          q = query(
            collectionGroup(firestore, TELEMETRY_COLLECTION),
            where('createdAt', '>=', since),
            orderBy('createdAt', 'desc'),
            fbLimit(TURNS_LIMIT),
          );
        }
        const snap = await getDocs(q);
        let data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as TurnLog[];
        if (applied.channel) {
          data = data.filter((l) => l.channel === applied.channel);
        }
        setLogs(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[Turn Inspector] Failed to fetch logs:', err);
        setLogsError(
          msg.includes('index')
            ? 'Firestore needs a composite index for this filter combination. Check the Next.js console for the auto-create link.'
            : msg.includes('permission')
            ? 'Firestore security rules are blocking this read.'
            : `Failed to load logs: ${msg}`,
        );
      } finally {
        setLogsLoading(false);
      }
    })();
  }, [user, firestore, applied]);

  useEffect(() => {
    if (!user || !firestore || !applied.storeId || !applied.conversationId) {
      setMessages(null);
      setMessagesError(null);
      return;
    }
    setMessagesLoading(true);
    setMessagesError(null);
    (async () => {
      try {
        const q = query(
          collection(
            firestore,
            'stores',
            applied.storeId,
            'ai_conversations',
            applied.conversationId,
            'messages',
          ),
          orderBy('createdAt', 'asc'),
          fbLimit(MESSAGES_LIMIT),
        );
        const snap = await getDocs(q);
        const data: ChatMessage[] = snap.docs
          .map((d) => {
            const raw = d.data() as Record<string, unknown>;
            const isUser =
              raw.role === 'user' ||
              raw.from === 'customer' ||
              raw.from === 'user' ||
              raw.sender === 'user';
            const role: 'user' | 'assistant' = isUser ? 'user' : 'assistant';
            const content =
              (typeof raw.content === 'string' && raw.content) ||
              (typeof raw.text === 'string' && raw.text) ||
              (typeof raw.message === 'string' && raw.message) ||
              '';
            if (!content) return null;
            return { role, content: content.slice(0, 2000) };
          })
          .filter((m): m is ChatMessage => m !== null);
        setMessages(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[Turn Inspector] Failed to load transcript:', err);
        setMessagesError(msg);
      } finally {
        setMessagesLoading(false);
      }
    })();
  }, [user, firestore, applied.storeId, applied.conversationId]);

  function applyFilters() {
    const next = {
      storeId: pendingStoreId.trim(),
      conversationId: pendingConversationId.trim(),
      channel: pendingChannel,
      days: pendingDays,
    };
    setApplied(next);
    const params = new URLSearchParams();
    if (next.storeId) params.set('storeId', next.storeId);
    if (next.conversationId) params.set('conversationId', next.conversationId);
    if (next.channel) params.set('channel', next.channel);
    params.set('days', String(next.days));
    router.replace(`${pathname}?${params.toString()}`);
  }

  function resetFilters() {
    setPendingStoreId('');
    setPendingConversationId('');
    setPendingChannel('');
    setPendingDays(7);
    setApplied({ storeId: '', conversationId: '', channel: '', days: 7 });
    router.replace(pathname);
  }

  async function copyAll() {
    const ok = await copyToClipboard(JSON.stringify(logs, null, 2));
    if (ok) {
      setAllCopied(true);
      setTimeout(() => setAllCopied(false), 1500);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">AI v2 Turn Inspector</h2>
        <p className="text-muted-foreground text-sm">
          Per-turn debug view. Pick a store + conversation to drill in.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Input
              placeholder="storeId"
              value={pendingStoreId}
              onChange={(e) => setPendingStoreId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyFilters();
              }}
              className="font-mono text-xs"
            />
            <Input
              placeholder="conversationId"
              value={pendingConversationId}
              onChange={(e) => setPendingConversationId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyFilters();
              }}
              className="font-mono text-xs"
            />
            <Select
              value={pendingChannel || 'any'}
              onValueChange={(v) => setPendingChannel(v === 'any' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                {CHANNEL_OPTIONS.map((c) => (
                  <SelectItem key={c.value || 'any'} value={c.value || 'any'}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(pendingDays)}
              onValueChange={(v) => setPendingDays(parseInt(v, 10) || 7)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAY_RANGES.map((r) => (
                  <SelectItem key={r.days} value={String(r.days)}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button onClick={applyFilters} className="flex-1">
                Apply
              </Button>
              <Button onClick={resetFilters} variant="outline">
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {applied.storeId && applied.conversationId && (
        <Transcript messages={messages} error={messagesError} loading={messagesLoading} />
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">
            Turns ({logs.length}
            {logs.length === TURNS_LIMIT ? '+' : ''})
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={copyAll}
            disabled={logs.length === 0}
            className="h-7 text-xs"
          >
            <Copy className="h-3 w-3 mr-1" />
            {allCopied ? 'Copied' : 'Copy all visible JSON'}
          </Button>
        </CardHeader>
        <CardContent>
          {logsError && (
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded p-3 mb-3">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{logsError}</span>
            </div>
          )}
          {logsLoading ? (
            <div className="text-sm text-muted-foreground">Loading turns...</div>
          ) : logs.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No turns match the current filters.
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <TurnCard key={log.id} log={log} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function TurnInspectorPage() {
  return (
    <Suspense
      fallback={<div className="p-6 text-sm text-muted-foreground">Loading...</div>}
    >
      <TurnInspectorInner />
    </Suspense>
  );
}
