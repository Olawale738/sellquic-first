'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { 
  collection, query, orderBy, limit, startAfter, 
  getDocs, DocumentData, Timestamp, QueryDocumentSnapshot 
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { getAuth } from 'firebase/auth';
import { useRequireSuperAdmin } from '@/hooks/use-auth';
import { 
  Search, AlertCircle, Loader2, MoreHorizontal, Trash2, 
  ArrowDownRight, CheckCircle2, XCircle, Clock, RefreshCcw, CreditCard, 
  ArrowUpRight
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────

interface Transaction extends DocumentData {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  email?: string; 
  planId?: 'starter' | 'standard' | 'growth';
  domain?: string;
  amount: number;
  type: 'subscription' | 'domain_purchase' | 'renewal' | 'manual_upgrade' | string;
  createdAt: Timestamp | string | Date;
  status: 'completed' | 'pending' | 'failed' | 'success' | string;
}

interface UserMap {
  [key: string]: { name: string; email: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────

const fmtGHS = (amount: number) => 
  `GHS ${amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getAmountInGHS = (tx: Transaction) => {
  if (!tx || !tx.amount) return 0;
  // Domains are usually saved in exact GHS. Subscriptions (Paystack) are in pesewas.
  if (tx.type === 'domain_purchase' || tx.domain) return tx.amount;
  return tx.amount / 100;
};

const formatDate = (dateVal: any) => {
  if (!dateVal) return '—';
  try {
    const d = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
    return new Intl.DateTimeFormat('en-US', { 
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
    }).format(d);
  } catch (e) {
    return 'Invalid Date';
  }
};

const StatusBadge = ({ status }: { status: string }) => {
  const s = status?.toLowerCase() || 'pending';
  if (s === 'completed' || s === 'success') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
        <CheckCircle2 className="h-3 w-3" /> Succeeded
      </span>
    );
  }
  if (s === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700 border border-red-100">
        <XCircle className="h-3 w-3" /> Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200">
      <Clock className="h-3 w-3" /> Pending
    </span>
  );
};

// ── Actions Component ─────────────────────────────────────────────────────

const TransactionActions = ({ transaction, onDeleted }: { transaction: Transaction, onDeleted: (id: string) => void }) => {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const auth = getAuth();
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/superadmin/transactions/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ transactionId: transaction.id }),
      });

      if (!response.ok) throw new Error('Failed to delete transaction.');
      
      toast({ title: "Transaction Deleted", description: `Record has been removed.` });
      onDeleted(transaction.id);
    } catch (error: any) {
      toast({ title: "Deletion Failed", description: error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-900">
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin"/> : <MoreHorizontal className="h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem className="text-xs">View Details</DropdownMenuItem>
          <AlertDialogTrigger asChild>
            <DropdownMenuItem className="text-xs text-red-600 focus:bg-red-50 focus:text-red-700">
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Record
            </DropdownMenuItem>
          </AlertDialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the record. It will not refund the user in Paystack.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  useRequireSuperAdmin();
  
  const firestore = useFirestore();
  const PAGE_SIZE = 100; // Increased to give better aggregate metrics on first load

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [usersMap, setUsersMap] = useState<UserMap>({});
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { toast } = useToast();

  const fetchUsers = async () => {
    if (!firestore) return;
    try {
      const snap = await getDocs(collection(firestore, 'users'));
      const map: UserMap = {};
      snap.docs.forEach(d => {
        const data = d.data();
        map[d.id] = { 
          name: data.displayName || data.name || 'Unknown User', 
          email: data.email || 'No Email' 
        };
      });
      setUsersMap(map);
    } catch (err) {
      console.error("Failed to fetch users map:", err);
    }
  };

  const fetchTransactions = async (isNextPage = false) => {
    if (!firestore) return;
    setLoading(isNextPage ? false : true);
    setLoadingMore(isNextPage);
    setErrorMsg(null);

    try {
      if (!Object.keys(usersMap).length) await fetchUsers();

      let q = query(collection(firestore, 'transactions'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
      if (isNextPage && lastVisible) q = query(q, startAfter(lastVisible));

      const snapshot = await getDocs(q);
      const newTxs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));

      if (snapshot.docs.length > 0) {
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      } else if (isNextPage) {
        toast({ title: "End of records", description: "No more transactions to load." });
      }

      setTransactions(prev => isNextPage ? [...prev, ...newTxs] : newTxs);
    } catch (err: any) {
      if (err.code === 'failed-precondition') setErrorMsg("Missing Index in Firestore.");
      else if (err.code === 'permission-denied') setErrorMsg("Permission Denied.");
      else setErrorMsg("Failed to load transactions.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => { fetchTransactions(); }, [firestore]);

  // Filters & Metrics
  const filteredTxs = useMemo(() => {
    return transactions.filter(tx => {
      // Resolve name/email using standard fields OR our users map
      const name = (tx.userName || usersMap[tx.userId]?.name || '').toLowerCase();
      const email = (tx.userEmail || tx.email || usersMap[tx.userId]?.email || '').toLowerCase();
      
      const matchesSearch = !search || name.includes(search.toLowerCase()) || email.includes(search.toLowerCase()) || tx.id.toLowerCase().includes(search.toLowerCase());
      const s = tx.status?.toLowerCase() || 'pending';
      const matchesStatus = statusFilter === 'all' 
        || (statusFilter === 'succeeded' && (s === 'completed' || s === 'success'))
        || (statusFilter === 'pending' && s === 'pending')
        || (statusFilter === 'failed' && s === 'failed');

      return matchesSearch && matchesStatus;
    });
  }, [transactions, search, statusFilter, usersMap]);

  const metrics = useMemo(() => {
    let volume = 0, success = 0, failed = 0;
    transactions.forEach(tx => {
      const s = tx.status?.toLowerCase();
      if (s === 'completed' || s === 'success') {
        volume += getAmountInGHS(tx);
        success++;
      } else if (s === 'failed') {
        failed++;
      }
    });
    return { volume, success, failed };
  }, [transactions]);

  return (
    <div className="max-w-[1200px] mx-auto space-y-8 p-4 md:p-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Payments</h1>
          <p className="text-sm text-gray-500 mt-1">Manage and track your platform's transactions.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchTransactions(false)} disabled={loading} className="bg-white shadow-sm">
          <RefreshCcw className={`mr-2 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>

      {errorMsg && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* Stripe-like Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
              <CreditCard className="h-4 w-4" /> Gross Volume
            </div>
            <div className="text-3xl font-bold text-gray-900 tracking-tight">
              {fmtGHS(metrics.volume)}
            </div>
            <p className="text-xs text-gray-400 mt-1">Based on loaded records</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Successful
            </div>
            <div className="text-3xl font-bold text-gray-900 tracking-tight">
              {metrics.success}
            </div>
            <p className="text-xs text-gray-400 mt-1">Completed payments</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
              <XCircle className="h-4 w-4 text-red-500" /> Failed
            </div>
            <div className="text-3xl font-bold text-gray-900 tracking-tight">
              {metrics.failed}
            </div>
            <p className="text-xs text-gray-400 mt-1">Declined or failed payments</p>
          </CardContent>
        </Card>
      </div>

      {/* Data Section */}
      <Card className="border shadow-sm overflow-hidden bg-white">
        
        {/* Filters Toolbar */}
        <div className="border-b p-4 flex flex-col sm:flex-row gap-4 justify-between bg-gray-50/50">
          <div className="flex gap-2">
            {['all', 'succeeded', 'pending', 'failed'].map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                  statusFilter === f 
                    ? 'bg-gray-900 text-white shadow-sm' 
                    : 'bg-white text-gray-600 border hover:bg-gray-50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search email, name, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm bg-white"
            />
          </div>
        </div>

        {/* Stripe-like Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-white text-xs text-gray-400 uppercase tracking-wider">
                <th className="font-medium py-3 px-5">Amount</th>
                <th className="font-medium py-3 px-5">Status</th>
                <th className="font-medium py-3 px-5">Description</th>
                <th className="font-medium py-3 px-5">Customer</th>
                <th className="font-medium py-3 px-5">Date</th>
                <th className="font-medium py-3 px-5 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-gray-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-gray-300" />
                    Loading payments...
                  </td>
                </tr>
              ) : filteredTxs.map(tx => {
                const amount = getAmountInGHS(tx);
                const customerName = tx.userName || usersMap[tx.userId]?.name || 'Unknown User';
                const customerEmail = tx.userEmail || tx.email || usersMap[tx.userId]?.email || 'No email attached';
                const typeLabel = tx.type?.replace(/_/g, ' ') || 'Subscription';

                return (
                  <tr key={tx.id} className="bg-white hover:bg-gray-50/50 transition-colors group">
                    <td className="py-3 px-5 whitespace-nowrap">
                      <span className="text-sm font-semibold text-gray-900">{fmtGHS(amount)}</span>
                    </td>
                    <td className="py-3 px-5 whitespace-nowrap">
                      <StatusBadge status={tx.status} />
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2">
                        {tx.type === 'domain_purchase' ? <ArrowDownRight className="h-3.5 w-3.5 text-blue-500" /> : <ArrowUpRight className="h-3.5 w-3.5 text-indigo-500" />}
                        <span className="text-sm text-gray-700 capitalize font-medium">{typeLabel}</span>
                      </div>
                      {tx.planId && <div className="text-[11px] text-gray-400 mt-0.5 capitalize">{tx.planId} Plan</div>}
                      {tx.domain && <div className="text-[11px] text-gray-400 mt-0.5">{tx.domain}</div>}
                    </td>
                    <td className="py-3 px-5">
                      <div className="text-sm text-gray-900 font-medium truncate max-w-[180px]">{customerEmail}</div>
                      <div className="text-[11px] text-gray-500 truncate max-w-[180px]">{customerName}</div>
                    </td>
                    <td className="py-3 px-5 whitespace-nowrap">
                      <span className="text-xs text-gray-500">{formatDate(tx.createdAt)}</span>
                    </td>
                    <td className="py-3 px-5 text-right whitespace-nowrap">
                      <TransactionActions transaction={tx} onDeleted={id => setTransactions(p => p.filter(t => t.id !== id))} />
                    </td>
                  </tr>
                );
              })}
              
              {!loading && filteredTxs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-gray-500 bg-gray-50/30">
                    No payments found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {transactions.length >= PAGE_SIZE && lastVisible && (
          <div className="border-t p-4 flex justify-center bg-gray-50/50">
            <Button 
              variant="outline" 
              onClick={() => fetchTransactions(true)} 
              disabled={loadingMore}
              className="bg-white text-xs font-medium h-8"
            >
              {loadingMore ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              Load older transactions
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}