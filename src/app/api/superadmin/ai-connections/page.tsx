'use client';

import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { useFirestore } from '@/firebase'; // Use the client-side hook!
import { 
  Bot, 
  MessageCircle, 
  Instagram, 
  Globe, 
  TrendingUp, 
  Calendar, 
  Clock, 
  Search,
  Loader2,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { format, subDays, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

// Types based on your store structure
interface StoreWithAI {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  aiEnabledAt: Date;
  channels: {
    web: boolean;
    whatsapp: boolean;
    instagram: boolean;
  };
  status: boolean;
}

export default function ConnectedAccountsPage() {
  const firestore = useFirestore();
  const [stores, setStores] = useState<StoreWithAI[]>([]);
  const [filteredStores, setFilteredStores] = useState<StoreWithAI[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Metrics
  const [metrics, setMetrics] = useState({
    totalConnected: 0,
    connectedThisWeek: 0,
    connectedThisMonth: 0,
    whatsappCount: 0,
    instagramCount: 0,
    webCount: 0,
  });

  useEffect(() => {
    async function fetchAiStores() {
      if (!firestore) return;

      try {
        const storesRef = collection(firestore, 'stores');
        const snapshot = await getDocs(storesRef);
        
        const now = new Date();
        const sevenDaysAgo = subDays(now, 7);
        const thirtyDaysAgo = subDays(now, 30);

        let total = 0;
        let thisWeek = 0;
        let thisMonth = 0;
        let wa = 0;
        let ig = 0;
        let web = 0;

        const aiStoresData: StoreWithAI[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          const aiEnabled = data.aiAssistant?.enabled === true;
          
          if (aiEnabled) {
            total++;
            
            // Determine when AI was enabled (fallback to store creation date)
            const enabledAt = data.aiAssistant?.enabledAt?.toDate() || data.createdAt?.toDate() || new Date();
            
            if (isAfter(enabledAt, sevenDaysAgo)) thisWeek++;
            if (isAfter(enabledAt, thirtyDaysAgo)) thisMonth++;

            const hasWa = !!(data.whatsapp?.phoneId && data.whatsapp?.accessToken);
            const hasIg = !!(data.instagram?.accountId && data.instagram?.accessToken);
            const hasWeb = true; // Defaulting to true as web widget is built-in

            if (hasWa) wa++;
            if (hasIg) ig++;
            if (hasWeb) web++;

            aiStoresData.push({
              id: doc.id,
              name: data.name || 'Unnamed Store',
              email: data.email || 'No email',
              createdAt: data.createdAt?.toDate() || new Date(),
              aiEnabledAt: enabledAt,
              channels: {
                web: hasWeb,
                whatsapp: hasWa,
                instagram: hasIg,
              },
              status: aiEnabled,
            });
          }
        });

        // Sort newest first
        aiStoresData.sort((a, b) => b.aiEnabledAt.getTime() - a.aiEnabledAt.getTime());

        setStores(aiStoresData);
        setFilteredStores(aiStoresData);
        setMetrics({
          totalConnected: total,
          connectedThisWeek: thisWeek,
          connectedThisMonth: thisMonth,
          whatsappCount: wa,
          instagramCount: ig,
          webCount: web,
        });

      } catch (error) {
        console.error('Error fetching AI stores:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAiStores();
  }, [firestore]);

  // Handle Search
  useEffect(() => {
    const q = searchQuery.toLowerCase();
    const filtered = stores.filter(store => 
      store.name.toLowerCase().includes(q) || 
      store.email.toLowerCase().includes(q)
    );
    setFilteredStores(filtered);
  }, [searchQuery, stores]);

  if (loading) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-medium">Loading AI Connections...</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
            <Bot className="h-8 w-8 text-primary" />
            AI Connections
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor vendor adoption and channel integrations for SellQuic AI.
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="Total Active AI Stores" value={metrics.totalConnected} icon={Bot} color="text-blue-600" bg="bg-blue-100" />
        <Card title="New This Week" value={`+${metrics.connectedThisWeek}`} icon={TrendingUp} color="text-green-600" bg="bg-green-100" />
        <Card title="New This Month" value={`+${metrics.connectedThisMonth}`} icon={Calendar} color="text-purple-600" bg="bg-purple-100" />
        
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-center">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Channel Breakdown</h3>
          <div className="flex items-center gap-4 text-sm font-medium">
            <div className="flex items-center gap-1.5 text-gray-700">
              <Globe className="h-4 w-4 text-blue-500" /> {metrics.webCount}
            </div>
            <div className="flex items-center gap-1.5 text-gray-700">
              <MessageCircle className="h-4 w-4 text-green-500" /> {metrics.whatsappCount}
            </div>
            <div className="flex items-center gap-1.5 text-gray-700">
              <Instagram className="h-4 w-4 text-pink-500" /> {metrics.instagramCount}
            </div>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Connected Vendors</h2>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search stores or emails..." 
              className="pl-9 bg-gray-50 border-gray-200"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Store Details</th>
                <th className="px-6 py-4">Active Channels</th>
                <th className="px-6 py-4">AI Status</th>
                <th className="px-6 py-4">Connected Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStores.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    No vendors found matching your search.
                  </td>
                </tr>
              ) : (
                filteredStores.map((store) => (
                  <tr key={store.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{store.name}</div>
                      <div className="text-gray-500 text-xs mt-0.5">{store.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {store.channels.web && (
                          <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                            <Globe className="h-3 w-3" /> Web
                          </span>
                        )}
                        {store.channels.whatsapp && (
                          <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-green-50 text-green-700 text-xs font-medium border border-green-100">
                            <MessageCircle className="h-3 w-3" /> WA
                          </span>
                        )}
                        {store.channels.instagram && (
                          <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-pink-50 text-pink-700 text-xs font-medium border border-pink-100">
                            <Instagram className="h-3 w-3" /> IG
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {store.status ? (
                        <span className="flex items-center gap-1.5 text-green-600 font-medium">
                          <CheckCircle2 className="h-4 w-4" /> Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-gray-400 font-medium">
                          <XCircle className="h-4 w-4" /> Disabled
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-gray-400" />
                        {format(store.aiEnabledAt, 'MMM d, yyyy')}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Helper component for the metric cards
function Card({ title, value, icon: Icon, color, bg }: { title: string, value: string | number, icon: any, color: string, bg: string }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-start gap-4">
      <div className={cn("p-3 rounded-xl", bg)}>
        <Icon className={cn("h-6 w-6", color)} />
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      </div>
    </div>
  );
}