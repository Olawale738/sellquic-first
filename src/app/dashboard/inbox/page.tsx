'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Timestamp } from 'firebase/firestore';
import {
  Loader2,
  Users,
  Wifi,
  Instagram,
  AlertCircle,
  Bot,
  User,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { getAuth } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

interface Conversation {
  id: string;
  lastMessagePreview: string;
  lastMessageAt: Timestamp | string | any;
  status?: string;
  unreadForVendor?: boolean;
  customerName?: string;
  customerPhone?: string;
  channel?: 'whatsapp' | 'instagram' | 'webchat';
  handoverMode?: boolean;
  awaitingStep?: string | null;
  orderSessionStatus?: string | null;
  pendingAiComeback?: boolean;
}

type TabKey = 'all' | 'unread' | 'review' | 'ai';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'review', label: 'Review' },
  { key: 'ai', label: 'AI Active' },
];

function parseDate(date: any): Date {
  if (!date) return new Date(0);
  if (typeof date === 'string') return new Date(date);
  if (date._seconds) return new Date(date._seconds * 1000);
  if (date.toDate) return (date as Timestamp).toDate();
  return new Date(0);
}

function ChannelIcon({ channel }: { channel?: string }) {
  if (channel === 'whatsapp') {
    return (
      <div className="flex-shrink-0 w-4 h-4 rounded-full bg-[#25D366] flex items-center justify-center">
        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </div>
    );
  }

  if (channel === 'instagram') {
    return (
      <div className="flex-shrink-0 w-4 h-4 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
        <Instagram className="w-2 h-2 text-white" />
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 w-4 h-4 rounded-full bg-muted flex items-center justify-center">
      <Wifi className="w-2 h-2 text-muted-foreground" />
    </div>
  );
}

function StatusPill({ convo }: { convo: Conversation }) {
  if (convo.status === 'needs_review' || convo.pendingAiComeback) {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
        <AlertCircle className="w-2.5 h-2.5" /> Review
      </span>
    );
  }

  if (convo.handoverMode) {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
        <User className="w-2.5 h-2.5" /> Human
      </span>
    );
  }

  if (convo.awaitingStep) {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
        <Clock className="w-2.5 h-2.5" /> Awaiting
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-primary/5 text-primary border border-primary/20">
      <Bot className="w-2.5 h-2.5" /> AI
    </span>
  );
}

function getDisplayName(convo: Conversation): string {
  if (convo.customerName) return convo.customerName;
  if (convo.customerPhone) {
    const p = String(convo.customerPhone);
    return p.length > 8 ? `${p.slice(0, 4)}••••${p.slice(-3)}` : p;
  }
  return 'Customer';
}

function getCompactPreview(preview?: string): string {
  const text = String(preview || '').trim();
  if (!text) return 'No messages yet';

  // keep WhatsApp refs/long numbers from stretching the row visually
  return text.replace(/\s+/g, ' ');
}

export default function InboxPage() {
  const { activeStore } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const { toast } = useToast();

  const fetchInbox = useCallback(async () => {
    if (!activeStore?.id) {
      setConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`/api/inbox/list?storeId=${activeStore.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch inbox');
      }

      setConversations(await res.json());
    } catch (error) {
      toast({
        title: 'Could not load inbox',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [activeStore?.id, toast]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  const counts = useMemo(
    () => ({
      all: conversations.length,
      unread: conversations.filter((c) => c.unreadForVendor).length,
      review: conversations.filter((c) => c.status === 'needs_review' || c.pendingAiComeback).length,
      ai: conversations.filter((c) => !c.handoverMode && c.status !== 'needs_review').length,
    }),
    [conversations]
  );

  const filtered = useMemo(() => {
    switch (activeTab) {
      case 'unread':
        return conversations.filter((c) => c.unreadForVendor);
      case 'review':
        return conversations.filter((c) => c.status === 'needs_review' || c.pendingAiComeback);
      case 'ai':
        return conversations.filter((c) => !c.handoverMode && c.status !== 'needs_review');
      default:
        return conversations;
    }
  }, [conversations, activeTab]);

  return (
    <div className="flex flex-col h-full max-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 md:px-4 pt-3 pb-2">
        <div>
          <h1 className="text-base md:text-lg font-semibold">Inbox</h1>
          <p className="text-[11px] md:text-xs text-muted-foreground">
            {counts.all} conversations
          </p>
        </div>

        <button
          onClick={fetchInbox}
          className="p-2 rounded-full hover:bg-muted transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw
            className={cn('h-4 w-4 text-muted-foreground', loading && 'animate-spin')}
          />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-3 md:px-4 pb-2 overflow-x-auto no-scrollbar">
        {TABS.map((tab) => {
          const count = counts[tab.key];
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] md:text-xs font-medium transition-all',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={cn(
                    'inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[9px] font-bold',
                    isActive ? 'bg-white/20 text-white' : 'bg-background text-foreground'
                  )}
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 md:px-3 pb-4 space-y-1">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="animate-spin h-5 w-5 text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground gap-2">
            <Users className="h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">Nothing here</p>
            <p className="text-xs">
              {activeTab === 'all'
                ? 'Conversations will appear when customers chat.'
                : 'No conversations in this category.'}
            </p>
          </div>
        ) : (
          filtered.map((convo) => {
            const name = getDisplayName(convo);
            const date = parseDate(convo.lastMessageAt);

            const timeAgo =
              date.getTime() > 0
                ? formatDistanceToNow(date, { addSuffix: false })
                    .replace('about ', '')
                    .replace(' minutes', 'm')
                    .replace(' minute', 'm')
                    .replace(' hours', 'h')
                    .replace(' hour', 'h')
                    .replace(' days', 'd')
                    .replace(' day', 'd')
                : '';

            return (
              <Link key={convo.id} href={`/dashboard/inbox/${convo.id}`}>
                <div
                  className={cn(
                    'flex items-start gap-2.5 px-2.5 py-2.5 rounded-xl transition-colors active:scale-[0.99]',
                    convo.unreadForVendor
                      ? 'bg-primary/5 border border-primary/15'
                      : 'hover:bg-muted/60 border border-transparent'
                  )}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div
                      className={cn(
                        'w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center text-xs md:text-sm font-semibold',
                        convo.status === 'needs_review'
                          ? 'bg-red-100 text-red-700'
                          : convo.handoverMode
                          ? 'bg-green-100 text-green-700'
                          : 'bg-primary/10 text-primary'
                      )}
                    >
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5">
                      <ChannelIcon channel={convo.channel} />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <span
                        className={cn(
                          'text-[13px] md:text-sm truncate pr-1',
                          convo.unreadForVendor ? 'font-semibold' : 'font-medium'
                        )}
                      >
                        {name}
                      </span>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {convo.unreadForVendor && (
                          <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {timeAgo}
                        </span>
                      </div>
                    </div>

                    <p
                      className={cn(
                        'text-[11px] md:text-xs leading-[1.35] line-clamp-2 mb-1.5 break-words',
                        convo.unreadForVendor ? 'text-foreground' : 'text-muted-foreground'
                      )}
                      style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                    >
                      {getCompactPreview(convo.lastMessagePreview)}
                    </p>

                    <StatusPill convo={convo} />
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}