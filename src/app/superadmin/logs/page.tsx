'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  collection, onSnapshot, query, orderBy, Timestamp, DocumentData
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useRequireSuperAdmin } from '@/hooks/use-auth';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, ChevronDown, Shield, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LogEntry extends DocumentData {
  id: string;
  action: string;
  adminId: string;
  adminEmail: string;
  adminName: string;
  targetId?: string;
  targetName?: string;
  targetEmail?: string;
  details?: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  createdAt: Timestamp;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACTION_META: Record<string, { label: string; color: string; bg: string }> = {
  'vendor.suspend':          { label: 'Suspended Vendor',      color: 'text-orange-700', bg: 'bg-orange-50' },
  'vendor.activate':         { label: 'Activated Vendor',      color: 'text-emerald-700', bg: 'bg-emerald-50' },
  'vendor.delete':           { label: 'Deleted Vendor',        color: 'text-red-700',    bg: 'bg-red-50' },
  'vendor.plan_change':      { label: 'Changed Plan',          color: 'text-blue-700',   bg: 'bg-blue-50' },
  'vendor.impersonate':      { label: 'Impersonated Vendor',   color: 'text-violet-700', bg: 'bg-violet-50' },
  'vendor.subdomain_change': { label: 'Changed Subdomain',     color: 'text-cyan-700',   bg: 'bg-cyan-50' },
  'domain.approve':          { label: 'Approved Domain',       color: 'text-emerald-700', bg: 'bg-emerald-50' },
  'domain.reject':           { label: 'Rejected Domain',       color: 'text-red-700',    bg: 'bg-red-50' },
  'coupon.create':           { label: 'Created Coupon',        color: 'text-blue-700',   bg: 'bg-blue-50' },
  'coupon.delete':           { label: 'Deleted Coupon',        color: 'text-red-700',    bg: 'bg-red-50' },
  'announcement.create':     { label: 'Created Announcement',  color: 'text-blue-700',   bg: 'bg-blue-50' },
  'announcement.delete':     { label: 'Deleted Announcement',  color: 'text-red-700',    bg: 'bg-red-50' },
  'subscription.manual_upgrade': { label: 'Manual Upgrade',   color: 'text-emerald-700', bg: 'bg-emerald-50' },
  'subscription.downgrade':  { label: 'Downgraded Plan',       color: 'text-orange-700', bg: 'bg-orange-50' },
};

const getActionMeta = (action: string) =>
  ACTION_META[action] || { label: action, color: 'text-gray-700', bg: 'bg-gray-100' };

const getInitials = (name: string) => name?.charAt(0)?.toUpperCase() || 'A';

const ADMIN_COLORS: Record<string, string> = {};
const PALETTE = [
  'bg-violet-100 text-violet-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
];
let colorIdx = 0;
function adminColor(adminId: string) {
  if (!ADMIN_COLORS[adminId]) {
    ADMIN_COLORS[adminId] = PALETTE[colorIdx++ % PALETTE.length];
  }
  return ADMIN_COLORS[adminId];
}

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return date.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GH', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

const PAGE_SIZE = 40;

type ActionFilter = 'all' | string;

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all whitespace-nowrap ${
        active
          ? 'bg-gray-900 text-white border-gray-900'
          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-800'
      }`}
    >
      {children}
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminLogsPage() {
  useRequireSuperAdmin();

  const firestore = useFirestore();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [adminFilter, setAdminFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, 'admin_logs'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as LogEntry)));
      setLoading(false);
    });
    return () => unsub();
  }, [firestore]);

  // Unique admins for filter
  const admins = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach(l => { if (l.adminId) map.set(l.adminId, l.adminName || l.adminEmail); });
    return Array.from(map.entries());
  }, [logs]);

  // Unique action categories
  const actionCategories = useMemo(() => {
    const cats = new Set<string>();
    logs.forEach(l => {
      const cat = l.action?.split('.')[0];
      if (cat) cats.add(cat);
    });
    return Array.from(cats);
  }, [logs]);

  const filtered = useMemo(() => {
    let data = [...logs];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(l =>
        l.adminName?.toLowerCase().includes(q) ||
        l.adminEmail?.toLowerCase().includes(q) ||
        l.targetName?.toLowerCase().includes(q) ||
        l.targetEmail?.toLowerCase().includes(q) ||
        l.action?.toLowerCase().includes(q) ||
        l.details?.toLowerCase().includes(q)
      );
    }
    if (actionFilter !== 'all') {
      data = data.filter(l => l.action?.startsWith(actionFilter));
    }
    if (adminFilter !== 'all') {
      data = data.filter(l => l.adminId === adminFilter);
    }
    return data;
  }, [logs, search, actionFilter, adminFilter]);

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < filtered.length;

  // Stats
  const stats = useMemo(() => {
    const today = logs.filter(l => {
      const d = l.createdAt?.toDate?.();
      return d && (Date.now() - d.getTime()) < 86400000;
    });
    const byAdmin = new Map<string, number>();
    logs.forEach(l => byAdmin.set(l.adminId, (byAdmin.get(l.adminId) || 0) + 1));
    const topAdmin = Array.from(byAdmin.entries()).sort((a, b) => b[1] - a[1])[0];
    return { total: logs.length, today: today.length, topAdmin };
  }, [logs]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-gray-400">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-800 border-t-transparent" />
        <span className="text-sm">Loading activity logs...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-[1200px] mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Shield className="h-5 w-5 text-gray-500" />
            Activity Log
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Every admin action — who did what and when.</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-2xl font-bold text-gray-900">{stats.total.toLocaleString()}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Total actions logged</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-2xl font-bold text-gray-900">{stats.today}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Actions in last 24 hours</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-2xl font-bold text-gray-900">{admins.length}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Admins with activity</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border shadow-sm">
        <CardContent className="px-4 py-3 space-y-3">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Search actions, vendors, admins..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-gray-400 font-medium">Category</span>
              <Pill active={actionFilter === 'all'} onClick={() => { setActionFilter('all'); setPage(1); }}>All</Pill>
              {actionCategories.map(cat => (
                <Pill key={cat} active={actionFilter === cat} onClick={() => { setActionFilter(cat); setPage(1); }}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Pill>
              ))}
            </div>
            {admins.length > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-gray-400 font-medium">Admin</span>
                <Pill active={adminFilter === 'all'} onClick={() => { setAdminFilter('all'); setPage(1); }}>All</Pill>
                {admins.map(([uid, name]) => (
                  <Pill key={uid} active={adminFilter === uid} onClick={() => { setAdminFilter(uid); setPage(1); }}>
                    {name}
                  </Pill>
                ))}
              </div>
            )}
            {(search || actionFilter !== 'all' || adminFilter !== 'all') && (
              <button
                onClick={() => { setSearch(''); setActionFilter('all'); setAdminFilter('all'); setPage(1); }}
                className="text-[11px] text-gray-400 hover:text-gray-700 underline underline-offset-2"
              >
                Clear filters
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400">{filtered.length} entries</p>
        </CardContent>
      </Card>

      {/* Log feed */}
      <Card className="border shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">
            No activity matches your filters.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {paginated.map(log => {
              const meta = getActionMeta(log.action);
              const date = log.createdAt?.toDate?.();
              const color = adminColor(log.adminId);

              return (
                <div key={log.id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors">
                  {/* Admin avatar */}
                  <Avatar className="h-8 w-8 flex-shrink-0 mt-0.5">
                    <AvatarFallback className={`text-xs font-semibold ${color}`}>
                      {getInitials(log.adminName)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        {/* Who */}
                        <p className="text-sm font-medium text-gray-900 leading-tight">
                          {log.adminName}
                          <span className="text-gray-400 font-normal text-xs ml-1">
                            {log.adminEmail}
                          </span>
                        </p>

                        {/* Action badge + target */}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${meta.bg} ${meta.color}`}>
                            {meta.label}
                          </span>
                          {log.targetName && (
                            <span className="text-xs text-gray-600 font-medium">{log.targetName}</span>
                          )}
                          {log.targetEmail && (
                            <span className="text-[11px] text-gray-400">{log.targetEmail}</span>
                          )}
                        </div>

                        {/* Before → After */}
                        {log.before && log.after && (
                          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                            {Object.keys(log.after).map(key => {
                              const prev = log.before?.[key];
                              const next = log.after?.[key];
                              if (prev === next) return null;
                              return (
                                <span key={key} className="inline-flex items-center gap-1 text-[11px] bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">
                                  <span className="line-through text-gray-400">{String(prev ?? '—')}</span>
                                  <ArrowRight className="h-3 w-3 text-gray-400" />
                                  <span className="font-medium text-gray-800">{String(next ?? '—')}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* Details note */}
                        {log.details && (
                          <p className="mt-1 text-[11px] text-gray-400 italic">{log.details}</p>
                        )}
                      </div>

                      {/* Timestamp */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-[11px] text-gray-400 tabular-nums whitespace-nowrap">
                          {date ? timeAgo(date) : '—'}
                        </p>
                        {date && (
                          <p className="text-[10px] text-gray-300 mt-0.5 whitespace-nowrap">
                            {formatDate(date)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load more */}
        {hasMore && (
          <div className="border-t px-5 py-4 flex items-center justify-between bg-gray-50/50">
            <p className="text-xs text-gray-400">Showing {paginated.length} of {filtered.length}</p>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} className="text-xs h-8 gap-1.5">
              Load more <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        {!hasMore && filtered.length > PAGE_SIZE && (
          <div className="border-t px-5 py-3 bg-gray-50/50">
            <p className="text-xs text-gray-400 text-center">All {filtered.length} entries loaded</p>
          </div>
        )}
      </Card>
    </div>
  );
}
