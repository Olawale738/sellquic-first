'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, onSnapshot, Timestamp, DocumentData } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { DollarSign, Users, Clock } from 'lucide-react';

/* ─────────────────────────── types ─────────────────────────── */
interface CustomerInfo {
  name: string;
  phone: string;
}

interface Order extends DocumentData {
  customerInfo: CustomerInfo;
  totalAmount: number;
  status: 'confirmed' | 'fulfilled';
  createdAt: Timestamp;
}

interface CustomerAnalytics {
  name: string;
  phone: string;
  totalSpent: number;
  orderCount: number;
  lastOrder: Date;
}

/* ─────────────────────────── helpers ─────────────────────────── */
const getInitials = (name: string) => {
  if (!name) return '';
  const names = name.trim().split(/\s+/);
  if (names.length > 1) return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const formatCurrency = (value: number) => `GH₵${value.toFixed(2)}`;

/* Deterministic avatar gradient per name */
const avatarPalettes = [
  ['#D4A853', '#A0522D'],
  ['#6B9E78', '#2D6A4F'],
  ['#6B8CAE', '#1B4F72'],
  ['#B87EAD', '#6C3483'],
  ['#E07B6A', '#922B21'],
  ['#5DADE2', '#1A5276'],
];
const getAvatarGradient = (name: string) => {
  const idx = (name.charCodeAt(0) || 0) % avatarPalettes.length;
  return avatarPalettes[idx];
};

/* Rank medal config */
const rankConfig = [
  { label: '🥇', bg: 'linear-gradient(135deg,#BF9B30 0%,#F5D060 50%,#BF9B30 100%)', border: '#F5D060', shadow: 'rgba(245,208,96,0.35)' },
  { label: '🥈', bg: 'linear-gradient(135deg,#8A8A8A 0%,#D0D0D0 50%,#8A8A8A 100%)', border: '#C8C8C8', shadow: 'rgba(200,200,200,0.3)' },
  { label: '🥉', bg: 'linear-gradient(135deg,#A05A2C 0%,#D4845A 50%,#A05A2C 100%)', border: '#D4845A', shadow: 'rgba(212,132,90,0.3)' },
];

/* ═══════════════════════════════════════════════════════════════ */
export default function CustomerAnalyticsPage() {
  const { user, activeStore, loading: authLoading } = useAuth();
  const firestore = useFirestore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── query (unchanged) ── */
  const ordersQuery = useMemo(() => {
    if (!user || !activeStore || !firestore) return null;
    return query(
      collection(firestore, 'orders'),
      where('storeId', '==', activeStore.id),
      where('status', 'in', ['confirmed', 'fulfilled'])
    );
  }, [user, activeStore, firestore]);

  useEffect(() => {
    if (!ordersQuery) { setOrders([]); setLoading(false); return; }
    setLoading(true);
    const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
      setOrders(snapshot.docs.map((doc) => doc.data() as Order));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [ordersQuery]);

  /* ── analytics (unchanged) ── */
  const customerAnalytics = useMemo(() => {
    const analyticsMap = new Map<string, CustomerAnalytics>();
    orders.forEach((order) => {
      const phone = order.customerInfo?.phone;
      if (!phone) return;
      const current = analyticsMap.get(phone) || {
        name: order.customerInfo?.name || 'Unknown',
        phone,
        totalSpent: 0,
        orderCount: 0,
        lastOrder: order.createdAt?.toDate() || new Date(),
      };
      current.totalSpent += Number(order.totalAmount || 0);
      current.orderCount += 1;
      current.name = order.customerInfo?.name || current.name;
      const orderDate = order.createdAt?.toDate?.() || new Date();
      if (orderDate > current.lastOrder) current.lastOrder = orderDate;
      analyticsMap.set(phone, current);
    });
    return Array.from(analyticsMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [orders]);

  const topCustomers = customerAnalytics.slice(0, 3);

  /* ─────────────────── loading skeleton ─────────────────── */
  if (loading || authLoading) {
    return (
      <>
        <style>{fonts}</style>
        <div style={styles.loadingWrapper}>
          <div style={styles.loadingInner}>
            <div style={styles.loadingSpinner} />
            <p style={styles.loadingText}>Loading customer analytics…</p>
          </div>
        </div>
      </>
    );
  }

  /* ─────────────────────────── render ─────────────────────────── */
  return (
    <>
      <style>{fonts + keyframes}</style>

      <div style={styles.page}>

        {/* ══ HERO BANNER ══ */}
        <div style={styles.hero}>
          {/* Background image layer */}
          <div style={styles.heroBgLayer}>
            <Image
              src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1400&q=80"
              alt="Customers hero"
              fill
              className="object-cover"
              priority
              style={{ opacity: 0.12, filter: 'saturate(0.6)' }}
            />
          </div>

          {/* Decorative grid overlay */}
          <div style={styles.heroGrid} />

          {/* Accent bar */}
          <div style={styles.heroAccentBar} />

          <div style={styles.heroContent}>
            {/* Left — title block */}
            <div style={styles.heroLeft}>
              <span style={styles.heroEyebrow}>ANALYTICS DASHBOARD</span>
              <h1 style={styles.heroTitle}>
                Customer<br />
                <span style={styles.heroTitleAccent}>Intelligence</span>
              </h1>
              <p style={styles.heroSubtitle}>
                Real-time spending insights, ranked by lifetime value.
              </p>
            </div>

            {/* Right — KPI pills */}
            <div style={styles.kpiRow}>
              <div style={styles.kpiCard}>
                <div style={styles.kpiIconWrap}>
                  <Users size={18} color="#D4A853" />
                </div>
                <div>
                  <div style={styles.kpiLabel}>Total customers</div>
                  <div style={styles.kpiValue}>{customerAnalytics.length}</div>
                </div>
              </div>

              <div style={styles.kpiCard}>
                <div style={{ ...styles.kpiIconWrap, background: 'rgba(107,156,117,0.15)' }}>
                  <DollarSign size={18} color="#6B9E78" />
                </div>
                <div>
                  <div style={styles.kpiLabel}>Orders tracked</div>
                  <div style={styles.kpiValue}>{orders.length}</div>
                </div>
              </div>

              <div style={styles.kpiCard}>
                <div style={{ ...styles.kpiIconWrap, background: 'rgba(107,140,174,0.15)' }}>
                  <Clock size={18} color="#6B8CAE" />
                </div>
                <div>
                  <div style={styles.kpiLabel}>Top spend</div>
                  <div style={styles.kpiValue}>
                    {topCustomers[0] ? formatCurrency(topCustomers[0].totalSpent) : '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══ TOP 3 PODIUM CARDS ══ */}
        <div style={styles.sectionLabel}>TOP SPENDERS</div>
        <div style={styles.podiumGrid}>
          {topCustomers.length > 0 ? (
            topCustomers.map((c, i) => {
              const rank = rankConfig[i];
              const [g1, g2] = getAvatarGradient(c.name);
              return (
                <div
                  key={c.phone}
                  style={{
                    ...styles.podiumCard,
                    animationDelay: `${i * 0.1}s`,
                    boxShadow: `0 8px 40px ${rank.shadow}, 0 2px 8px rgba(0,0,0,0.35)`,
                  }}
                >
                  {/* Rank medal */}
                  <div style={{ ...styles.rankBadge, background: rank.bg, borderColor: rank.border }}>
                    {rank.label}
                  </div>

                  {/* Shimmer bar */}
                  <div style={{ ...styles.podiumTopBar, background: rank.bg }} />

                  {/* Avatar */}
                  <div style={{
                    ...styles.podiumAvatar,
                    background: `linear-gradient(135deg,${g1},${g2})`,
                    boxShadow: `0 4px 20px ${rank.shadow}`,
                  }}>
                    {getInitials(c.name)}
                  </div>

                  {/* Name & phone */}
                  <div style={styles.podiumName}>{c.name}</div>
                  <div style={styles.podiumPhone}>{c.phone}</div>

                  {/* Divider */}
                  <div style={{ ...styles.podiumDivider, background: rank.border }} />

                  {/* Stats */}
                  <div style={styles.podiumStatsRow}>
                    <div style={styles.podiumStat}>
                      <div style={styles.podiumStatLabel}>Spent</div>
                      <div style={{ ...styles.podiumStatValue, color: rank.border }}>
                        {formatCurrency(c.totalSpent)}
                      </div>
                    </div>
                    <div style={styles.podiumStatDivider} />
                    <div style={styles.podiumStat}>
                      <div style={styles.podiumStatLabel}>Orders</div>
                      <div style={styles.podiumStatValue}>{c.orderCount}</div>
                    </div>
                  </div>

                  {/* Last order */}
                  <div style={styles.podiumLast}>
                    <Clock size={11} color="#888" style={{ marginRight: 4 }} />
                    {formatDistanceToNow(c.lastOrder, { addSuffix: true })}
                  </div>
                </div>
              );
            })
          ) : (
            [1, 2, 3].map((i) => (
              <div key={i} style={styles.podiumCardEmpty}>
                <div style={styles.emptyCardIcon}>👤</div>
                <p style={styles.emptyCardTitle}>No customers yet</p>
                <p style={styles.emptyCardSub}>Make your first sale to populate analytics</p>
              </div>
            ))
          )}
        </div>

        {/* ══ FULL TABLE ══ */}
        <div style={styles.tableSection}>
          <div style={styles.tableTitleRow}>
            <div>
              <div style={styles.sectionLabel}>ALL CUSTOMERS</div>
              <h2 style={styles.tableTitle}>Customer Directory</h2>
              <p style={styles.tableSubtitle}>
                Confirmed & fulfilled orders — sorted by lifetime spend
              </p>
            </div>
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Customer', 'Orders', 'Last Order', 'Total Spent'].map((h, i) => (
                    <th key={h} style={{ ...styles.th, textAlign: i === 3 ? 'right' : 'left' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customerAnalytics.map((customer, idx) => {
                  const [g1, g2] = getAvatarGradient(customer.name);
                  return (
                    <tr
                      key={customer.phone}
                      style={{
                        ...styles.tr,
                        animationDelay: `${idx * 0.03}s`,
                      }}
                      className="table-row-hover"
                    >
                      <td style={styles.td}>
                        <div style={styles.customerCell}>
                          <div style={{
                            ...styles.tableAvatar,
                            background: `linear-gradient(135deg,${g1},${g2})`,
                          }}>
                            {getInitials(customer.name)}
                          </div>
                          <div>
                            <div style={styles.customerName}>{customer.name}</div>
                            <div style={styles.customerPhone}>{customer.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.orderBadge}>{customer.orderCount}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.lastOrderText}>
                          {formatDistanceToNow(customer.lastOrder, { addSuffix: true })}
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <span style={styles.spendValue}>{formatCurrency(customer.totalSpent)}</span>
                      </td>
                    </tr>
                  );
                })}

                {customerAnalytics.length === 0 && (
                  <tr>
                    <td colSpan={4} style={styles.emptyTd}>
                      <div style={styles.emptyState}>
                        <div style={styles.emptyIllustration}>
                          <Image
                            src="https://images.unsplash.com/photo-1586769852836-bc069f19e1b6?w=300&q=70"
                            alt="No customers"
                            width={160}
                            height={110}
                            style={{ borderRadius: 12, opacity: 0.6, objectFit: 'cover' }}
                          />
                        </div>
                        <p style={styles.emptyTitle}>No customer data yet</p>
                        <p style={styles.emptySub}>
                          Once you receive confirmed orders, your customers will appear here.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Row hover style injected globally */}
      <style>{`
        .table-row-hover { transition: background 0.18s ease, transform 0.18s ease; }
        .table-row-hover:hover { background: rgba(212,168,83,0.06) !important; }
      `}</style>
    </>
  );
}

/* ═══════════════════════════ STYLES ═══════════════════════════ */

const fonts = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600&display=swap');
`;

const keyframes = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const BASE = {
  bg: '#0F0F0F',
  surface: '#161616',
  elevated: '#1E1E1E',
  border: '#2A2A2A',
  borderAccent: '#3A3A3A',
  gold: '#D4A853',
  goldLight: '#F0CC77',
  text: '#F0EDE8',
  textMuted: '#888880',
  textDim: '#555550',
  fontDisplay: "'Playfair Display', Georgia, serif",
  fontBody: "'DM Sans', system-ui, sans-serif",
};

const styles: Record<string, React.CSSProperties> = {
  /* Loading */
  loadingWrapper: {
    minHeight: 320,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: BASE.bg,
    borderRadius: 16,
  },
  loadingInner: { textAlign: 'center' },
  loadingSpinner: {
    width: 36,
    height: 36,
    border: `3px solid ${BASE.border}`,
    borderTop: `3px solid ${BASE.gold}`,
    borderRadius: '50%',
    margin: '0 auto 14px',
    animation: 'spin 0.9s linear infinite',
  },
  loadingText: {
    fontFamily: BASE.fontBody,
    color: BASE.textMuted,
    fontSize: 14,
  },

  /* Page shell */
  page: {
    background: BASE.bg,
    minHeight: '100vh',
    padding: '0 0 48px',
    fontFamily: BASE.fontBody,
    color: BASE.text,
  },

  /* ─── Hero ─── */
  hero: {
    position: 'relative',
    overflow: 'hidden',
    background: `linear-gradient(160deg, #1A1508 0%, #0F0F0F 60%, #0A0E14 100%)`,
    borderBottom: `1px solid ${BASE.border}`,
    marginBottom: 40,
  },
  heroBgLayer: {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
  },
  heroGrid: {
    position: 'absolute',
    inset: 0,
    zIndex: 1,
    backgroundImage: `
      linear-gradient(rgba(212,168,83,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(212,168,83,0.04) 1px, transparent 1px)
    `,
    backgroundSize: '48px 48px',
  },
  heroAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    background: `linear-gradient(90deg, transparent, ${BASE.gold}, transparent)`,
    zIndex: 3,
  },
  heroContent: {
    position: 'relative',
    zIndex: 4,
    padding: '52px 40px 48px',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 32,
  },
  heroLeft: {
    flex: '1 1 320px',
    animation: 'fadeUp 0.6s ease both',
  },
  heroEyebrow: {
    fontFamily: BASE.fontBody,
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.22em',
    color: BASE.gold,
    display: 'block',
    marginBottom: 12,
  },
  heroTitle: {
    fontFamily: BASE.fontDisplay,
    fontSize: 'clamp(36px, 5vw, 60px)',
    fontWeight: 900,
    lineHeight: 1.05,
    color: BASE.text,
    margin: '0 0 16px',
  },
  heroTitleAccent: {
    background: `linear-gradient(90deg, ${BASE.gold}, ${BASE.goldLight})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  heroSubtitle: {
    fontFamily: BASE.fontBody,
    fontSize: 14,
    color: BASE.textMuted,
    fontWeight: 300,
    margin: 0,
  },

  /* KPI row */
  kpiRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    animation: 'fadeUp 0.6s 0.15s ease both',
    opacity: 0,
    animationFillMode: 'forwards',
  },
  kpiCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${BASE.border}`,
    borderRadius: 12,
    padding: '14px 20px',
    backdropFilter: 'blur(8px)',
    minWidth: 150,
  },
  kpiIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: 'rgba(212,168,83,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  kpiLabel: {
    fontFamily: BASE.fontBody,
    fontSize: 10,
    fontWeight: 500,
    color: BASE.textMuted,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  kpiValue: {
    fontFamily: BASE.fontDisplay,
    fontSize: 20,
    fontWeight: 700,
    color: BASE.text,
    lineHeight: 1,
  },

  /* ─── Section labels ─── */
  sectionLabel: {
    fontFamily: BASE.fontBody,
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.22em',
    color: BASE.gold,
    padding: '0 40px',
    marginBottom: 18,
  },

  /* ─── Podium cards ─── */
  podiumGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 20,
    padding: '0 40px',
    marginBottom: 48,
  },
  podiumCard: {
    position: 'relative',
    background: BASE.elevated,
    border: `1px solid ${BASE.border}`,
    borderRadius: 20,
    padding: '44px 28px 28px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    overflow: 'hidden',
    animation: 'fadeUp 0.5s ease both',
    transition: 'transform 0.25s ease, box-shadow 0.25s ease',
    cursor: 'default',
  },
  rankBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    border: '1px solid',
    zIndex: 2,
  },
  podiumTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    opacity: 0.8,
  },
  podiumAvatar: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: BASE.fontDisplay,
    fontSize: 24,
    fontWeight: 700,
    color: '#fff',
    marginBottom: 16,
    flexShrink: 0,
  },
  podiumName: {
    fontFamily: BASE.fontDisplay,
    fontSize: 18,
    fontWeight: 700,
    color: BASE.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  podiumPhone: {
    fontFamily: BASE.fontBody,
    fontSize: 12,
    color: BASE.textMuted,
    marginBottom: 20,
  },
  podiumDivider: {
    height: 1,
    width: '100%',
    opacity: 0.25,
    marginBottom: 20,
  },
  podiumStatsRow: {
    display: 'flex',
    width: '100%',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  podiumStat: { textAlign: 'center' },
  podiumStatLabel: {
    fontFamily: BASE.fontBody,
    fontSize: 10,
    color: BASE.textMuted,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  podiumStatValue: {
    fontFamily: BASE.fontDisplay,
    fontSize: 18,
    fontWeight: 700,
    color: BASE.text,
  },
  podiumStatDivider: {
    width: 1,
    background: BASE.border,
    alignSelf: 'stretch',
  },
  podiumLast: {
    display: 'flex',
    alignItems: 'center',
    fontFamily: BASE.fontBody,
    fontSize: 11,
    color: BASE.textDim,
  },
  podiumCardEmpty: {
    background: BASE.elevated,
    border: `1px dashed ${BASE.border}`,
    borderRadius: 20,
    padding: '48px 28px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 260,
  },
  emptyCardIcon: { fontSize: 36, opacity: 0.3, marginBottom: 8 },
  emptyCardTitle: {
    fontFamily: BASE.fontBody,
    fontSize: 14,
    fontWeight: 500,
    color: BASE.textMuted,
    margin: 0,
  },
  emptyCardSub: {
    fontFamily: BASE.fontBody,
    fontSize: 12,
    color: BASE.textDim,
    textAlign: 'center',
    margin: 0,
  },

  /* ─── Table section ─── */
  tableSection: {
    padding: '0 40px',
  },
  tableTitleRow: {
    marginBottom: 24,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
  },
  tableTitle: {
    fontFamily: BASE.fontDisplay,
    fontSize: 28,
    fontWeight: 700,
    color: BASE.text,
    margin: '4px 0 6px',
  },
  tableSubtitle: {
    fontFamily: BASE.fontBody,
    fontSize: 13,
    color: BASE.textMuted,
    margin: 0,
    fontWeight: 300,
  },
  tableWrapper: {
    background: BASE.elevated,
    border: `1px solid ${BASE.border}`,
    borderRadius: 16,
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    fontFamily: BASE.fontBody,
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: BASE.textMuted,
    padding: '16px 24px',
    background: BASE.surface,
    borderBottom: `1px solid ${BASE.border}`,
  },
  tr: {
    borderBottom: `1px solid rgba(42,42,42,0.6)`,
    animation: 'fadeUp 0.4s ease both',
  },
  td: {
    fontFamily: BASE.fontBody,
    fontSize: 14,
    color: BASE.text,
    padding: '16px 24px',
    verticalAlign: 'middle',
  },
  customerCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  tableAvatar: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: BASE.fontDisplay,
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
    flexShrink: 0,
  },
  customerName: {
    fontFamily: BASE.fontBody,
    fontSize: 14,
    fontWeight: 500,
    color: BASE.text,
    lineHeight: 1.3,
  },
  customerPhone: {
    fontFamily: BASE.fontBody,
    fontSize: 11,
    color: BASE.textMuted,
    marginTop: 2,
  },
  orderBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(212,168,83,0.1)',
    color: BASE.gold,
    border: `1px solid rgba(212,168,83,0.25)`,
    borderRadius: 6,
    fontFamily: BASE.fontBody,
    fontWeight: 600,
    fontSize: 13,
    padding: '3px 10px',
    minWidth: 32,
  },
  lastOrderText: {
    fontFamily: BASE.fontBody,
    fontSize: 12,
    color: BASE.textMuted,
    fontStyle: 'italic',
  },
  spendValue: {
    fontFamily: BASE.fontDisplay,
    fontSize: 16,
    fontWeight: 700,
    color: BASE.goldLight,
  },

  /* ─── Empty table state ─── */
  emptyTd: {
    padding: '64px 24px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  emptyIllustration: {
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyTitle: {
    fontFamily: BASE.fontDisplay,
    fontSize: 18,
    fontWeight: 700,
    color: BASE.text,
    margin: 0,
  },
  emptySub: {
    fontFamily: BASE.fontBody,
    fontSize: 13,
    color: BASE.textMuted,
    textAlign: 'center',
    margin: 0,
    maxWidth: 320,
  },
};
