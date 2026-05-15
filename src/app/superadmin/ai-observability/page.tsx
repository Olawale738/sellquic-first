'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  collectionGroup,
  query,
  where,
  orderBy,
  getDocs,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { format, subDays, startOfDay } from 'date-fns';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  Clock,
  GitFork,
  Zap,
} from 'lucide-react';

import { useFirestore } from '@/firebase';
import { useRequireSuperAdmin } from '@/hooks/use-auth';

// Subcollection name written by logAiTurn (stores/{storeId}/ai_v2_turn_logs).
// We use collectionGroup to query across all stores for the super admin view.
const TELEMETRY_COLLECTION = 'ai_v2_turn_logs';

type TurnLog = {
  id: string;
  createdAt?: Timestamp;
  conversationId?: string;
  storeId?: string;
  sellerId?: string;
  handler?: string;
  classificationSource?: 'deterministic' | 'gemini';
  shadowConfidence?: 'high' | 'medium' | 'low';
  geminiConfidence?: 'high' | 'medium' | 'low';
  intentDivergence?: boolean | null;
  validationOk?: boolean;
  validationReason?: string | null;
  latencyMs?: number;
  geminiLatencyMs?: number | null;
  geminiError?: string | null;
  geminiInvalidJson?: boolean;
  messagePreview?: string;
  reason?: string;
  shadowDivergence?: { agreed: boolean; expectedHandler?: string | null; note?: string };
};

const DAY_RANGES = [
  { label: 'Last 24 hours', days: 1 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
];

function StatCard({
  title,
  value,
  icon: Icon,
  sub,
  tone,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  tone?: 'normal' | 'warn';
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon
          className={`h-4 w-4 ${tone === 'warn' ? 'text-amber-500' : 'text-muted-foreground'}`}
        />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${tone === 'warn' ? 'text-amber-600' : ''}`}>
          {value}
        </div>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function percentile(arr: number[], pct: number): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length * pct) / 100));
  return sorted[idx] || 0;
}

export default function AiObservabilityDashboard() {
  const { user } = useRequireSuperAdmin();
  const firestore = useFirestore();

  const [logs, setLogs] = useState<TurnLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !firestore) return;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const since = subDays(startOfDay(new Date()), days - 1);
        const q = query(
          collectionGroup(firestore, TELEMETRY_COLLECTION),
          where('createdAt', '>=', since),
          orderBy('createdAt', 'desc'),
          limit(2000),
        );
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as TurnLog[];
        setLogs(data);
      } catch (err: any) {
        console.error('[AI Observability] Failed to fetch telemetry:', err);
        setError(
          err?.message?.includes('index')
            ? 'Firestore needs a composite index on this collection group. Check your Next.js console — there should be a clickable link to auto-create it.'
            : err?.message?.includes('permission')
            ? 'Firestore security rules are blocking the collection group read. See deployment notes for the rule to add.'
            : `Failed to load telemetry: ${err?.message || 'unknown error'}`,
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [user, firestore, days]);

  const aggregates = useMemo(() => {
    if (!logs.length) return null;
    const total = logs.length;
    const gemini = logs.filter((l) => l.classificationSource === 'gemini').length;
    const determ = logs.filter((l) => l.classificationSource === 'deterministic').length;
    const divergent = logs.filter((l) => l.intentDivergence === true).length;
    const validationFailed = logs.filter((l) => l.validationOk === false).length;
    const geminiErrors = logs.filter((l) => l.geminiError != null).length;
    const geminiBadJson = logs.filter((l) => l.geminiInvalidJson === true).length;
    const handlerMismatch = logs.filter(
      (l) => l.shadowDivergence && l.shadowDivergence.agreed === false,
    ).length;

    const latencies = logs
      .map((l) => l.latencyMs)
      .filter((x): x is number => typeof x === 'number');
    const geminiLatencies = logs
      .map((l) => l.geminiLatencyMs)
      .filter((x): x is number => typeof x === 'number');

    return {
      total,
      gemini,
      determ,
      geminiUseRate: total ? (gemini / total) * 100 : 0,
      divergent,
      divergenceRate: total ? (divergent / total) * 100 : 0,
      validationFailed,
      validationFailRate: total ? (validationFailed / total) * 100 : 0,
      geminiErrors,
      geminiErrorRate: gemini ? (geminiErrors / gemini) * 100 : 0,
      geminiBadJson,
      handlerMismatch,
      handlerMismatchRate: total ? (handlerMismatch / total) * 100 : 0,
      latencyP50: percentile(latencies, 50),
      latencyP95: percentile(latencies, 95),
      geminiLatencyP50: percentile(geminiLatencies, 50),
      geminiLatencyP95: percentile(geminiLatencies, 95),
    };
  }, [logs]);

  const timeSeries = useMemo(() => {
    if (!logs.length) return [];
    const bucketByHour = days <= 1;
    const buckets: Record<string, { key: string; total: number; gemini: number; divergent: number; errors: number; latencySum: number }> = {};

    for (const log of logs) {
      if (!log.createdAt) continue;
      const d = log.createdAt.toDate();
      const key = bucketByHour
        ? format(d, 'MMM d HH:00')
        : format(startOfDay(d), 'MMM d');

      if (!buckets[key]) {
        buckets[key] = { key, total: 0, gemini: 0, divergent: 0, errors: 0, latencySum: 0 };
      }
      buckets[key].total++;
      if (log.classificationSource === 'gemini') buckets[key].gemini++;
      if (log.intentDivergence === true) buckets[key].divergent++;
      if (log.validationOk === false || log.geminiError) buckets[key].errors++;
      if (typeof log.latencyMs === 'number') buckets[key].latencySum += log.latencyMs;
    }

    return Object.values(buckets)
      .map((b) => ({
        ...b,
        avgLatency: b.total ? Math.round(b.latencySum / b.total) : 0,
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [logs, days]);

  const handlerDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of logs) {
      const h = l.handler || 'unknown';
      counts[h] = (counts[h] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([handler, count]) => ({ handler, count }))
      .sort((a, b) => b.count - a.count);
  }, [logs]);

  const sourcePie = useMemo(() => {
    if (!aggregates) return [];
    return [
      { name: 'Deterministic', value: aggregates.determ, color: '#10b981' },
      { name: 'Gemini', value: aggregates.gemini, color: '#6366f1' },
    ];
  }, [aggregates]);

  const recentFailures = useMemo(() => {
    return logs
      .filter(
        (l) =>
          l.validationOk === false ||
          l.geminiError != null ||
          l.geminiInvalidJson === true ||
          (l.shadowDivergence && l.shadowDivergence.agreed === false),
      )
      .slice(0, 25);
  }, [logs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI v2 Pipeline Observability</h2>
          <p className="text-muted-foreground text-sm">
            Cascade fire rate, classification source mix, intent divergence, errors, latency
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/superadmin/ai-observability/turns">
            <Button variant="outline">Open Turn Inspector</Button>
          </Link>
          <Select value={String(days)} onValueChange={(v) => setDays(parseInt(v, 10))}>
            <SelectTrigger className="w-[180px]">
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
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="pt-6 text-muted-foreground text-sm">
            Loading telemetry...
          </CardContent>
        </Card>
      ) : !aggregates ? (
        <Card>
          <CardContent className="pt-6 text-muted-foreground text-sm">
            No telemetry in this window. Either no traffic, or {TELEMETRY_COLLECTION} hasn't been written to yet.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Turns"
              value={aggregates.total}
              icon={Activity}
              sub={`Last ${days} day${days > 1 ? 's' : ''}`}
            />
            <StatCard
              title="Gemini Override Rate"
              value={`${aggregates.geminiUseRate.toFixed(1)}%`}
              icon={BrainCircuit}
              sub={`${aggregates.gemini} of ${aggregates.total} turns`}
            />
            <StatCard
              title="Intent Divergence"
              value={`${aggregates.divergenceRate.toFixed(1)}%`}
              icon={GitFork}
              sub={`${aggregates.divergent} disagreements`}
              tone={aggregates.divergenceRate > 15 ? 'warn' : 'normal'}
            />
            <StatCard
              title="Handler Mismatch"
              value={`${aggregates.handlerMismatchRate.toFixed(1)}%`}
              icon={GitFork}
              sub={`${aggregates.handlerMismatch} routed wrong`}
              tone={aggregates.handlerMismatchRate > 15 ? 'warn' : 'normal'}
            />
            <StatCard
              title="Validation Fail Rate"
              value={`${aggregates.validationFailRate.toFixed(1)}%`}
              icon={AlertTriangle}
              sub={`${aggregates.validationFailed} rejected`}
              tone={aggregates.validationFailRate > 5 ? 'warn' : 'normal'}
            />
            <StatCard
              title="Latency p50"
              value={`${aggregates.latencyP50}ms`}
              icon={Clock}
              sub={`p95: ${aggregates.latencyP95}ms`}
            />
            <StatCard
              title="Gemini Latency p50"
              value={`${aggregates.geminiLatencyP50}ms`}
              icon={Zap}
              sub={`p95: ${aggregates.geminiLatencyP95}ms`}
            />
            <StatCard
              title="Gemini Errors"
              value={`${aggregates.geminiErrorRate.toFixed(1)}%`}
              icon={AlertTriangle}
              sub={`${aggregates.geminiErrors} of ${aggregates.gemini} calls (+ ${aggregates.geminiBadJson} bad JSON)`}
              tone={aggregates.geminiErrorRate > 10 ? 'warn' : 'normal'}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Volume & Source Mix</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeSeries}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="key" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis allowDecimals={false} fontSize={11} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="Total turns"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="gemini"
                      name="Gemini-classified"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Divergence & Errors Over Time</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeSeries}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="key" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis allowDecimals={false} fontSize={11} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="divergent"
                      name="Divergence"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="errors"
                      name="Errors"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Classification Source</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourcePie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                    >
                      {sourcePie.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Handlers</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={handlerDistribution.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} fontSize={11} />
                    <YAxis dataKey="handler" type="category" width={170} fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366f1" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Failures ({recentFailures.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {recentFailures.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No failures in this window. Everything is healthy.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Handler</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Conv</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentFailures.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {f.createdAt ? format(f.createdAt.toDate(), 'MMM d HH:mm') : '-'}
                        </TableCell>
                        <TableCell className="text-xs">{f.handler || '-'}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate" title={f.messagePreview || ''}>
                          {f.messagePreview || '-'}
                        </TableCell>
                        <TableCell
                          className="text-xs max-w-[220px] truncate"
                          title={
                            f.validationReason ||
                            f.geminiError ||
                            f.shadowDivergence?.note ||
                            ''
                          }
                        >
                          {f.validationReason ||
                            f.geminiError ||
                            (f.geminiInvalidJson ? 'Bad JSON' : null) ||
                            f.shadowDivergence?.note ||
                            '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {f.classificationSource || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className="text-xs font-mono max-w-[100px] truncate"
                          title={f.storeId || ''}
                        >
                          {f.storeId?.slice(0, 8) || '-'}
                        </TableCell>
                        <TableCell
                          className="text-xs font-mono max-w-[100px] truncate"
                          title={f.conversationId || ''}
                        >
                          {f.conversationId?.slice(0, 8) || '-'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {f.storeId && f.conversationId ? (
                            <Link
                              href={`/superadmin/ai-observability/turns?storeId=${encodeURIComponent(
                                f.storeId,
                              )}&conversationId=${encodeURIComponent(f.conversationId)}`}
                              className="text-primary underline-offset-2 hover:underline"
                            >
                              Inspect
                            </Link>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
