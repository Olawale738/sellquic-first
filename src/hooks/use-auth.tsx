'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { useFirestore } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { doc, getDoc, collection, query, where, onSnapshot, Timestamp, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface StoreData {
  bankAccountNumber: any;
  logoUrl: any;
  id: string;
  name: string; 
  subdomain: string;
  customDomain?: string;
  products?: any[];
  paymentInfo?: any;
  momoNumber?: string;
  deliveries?: any[];
  aiAssistant?: any;
  theme?: string;
  themeConfig?: any;
  isMomoActive?: boolean;
  isBankPaymentActive?: boolean;
  isCodActive?: boolean;
  bankName?: string;
  bankAccountName?: string;
  bankBranch?: string;
  sellerId?: string;
  status?: string;
  createdAt?: Timestamp;
  aboutUs?: string;
  shippingPolicy?: string;
  faqs?: any[];
  tagline?: string;
  [key: string]: any;
}

interface SubscriptionData {
  planId: 'starter' | 'standard' | 'growth' | 'free' | null;   // ← 'free' for legacy users
  status: 'active' | 'cancelled' | 'past_due' | 'expired' | 'trial' | 'pending_plan';
  billingCycle?: 'monthly' | 'quarterly' | 'trial' | null;
  startDate?: Date | Timestamp | null;
  endDate?: Date | Timestamp | null;
  trialEndsAt?: Date | Timestamp | null;
  hasUsedTrial?: boolean;
}

export interface AppUser extends User {
    isSuperAdmin?: boolean;
    subscription?: SubscriptionData;
    storeId?: string; 
    phone?: string;
    referralCode?: string;
    referredBy?: string;
    referredByVendor?: string;
    referralPoints?: number;
    unclaimedFreeMonths?: number;
    used20PercentDiscount?: boolean;
    role?: string;
    isBetaTester?: boolean;
    status?: 'active' | 'pending_verification' | 'suspended';
    payoutInfo?: {
      network: string;
      momoNumber: string;
      accountName: string;
    };
    affiliateWallet?: {
      pending: number;
      available: number;
      paid: number;
      pendingPayout?: number;
    };
    isLegacySubscriber?: boolean;
    aiCredits?: number;
    hasEverPaid?: boolean; 
    hasUsedTrial?: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  isUserLoading: boolean;
  isSubscriptionExpired: boolean;
  stores: StoreData[];
  activeStore: StoreData | null;
  setActiveStore: (store: StoreData | null) => void;
  refreshUser: () => Promise<void>;
  proReferralCount: number;
  referralPoints: number;
  abandonedCartsCount: number;
  inboxCount: number;
}

const fetchStaticData = async (firebaseUser: User, firestore: Firestore | null): Promise<Partial<AppUser>> => {
    if (firebaseUser.isAnonymous) {
      return { isSuperAdmin: false };
    }
    
    if (!firestore) return { isSuperAdmin: false };
    
    try {
      const userDocRef = doc(firestore, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
          const userData = userDoc.data();
          return { 
            ...userData, 
            isSuperAdmin: userData.role === 'superadmin'
          } as Partial<AppUser>;
      }

    } catch (e) {
        console.warn("Could not fetch user data", e);
    }
    return { isSuperAdmin: false };
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isUserLoading: true,
  isSubscriptionExpired: false,
  stores: [],
  activeStore: null,
  setActiveStore: () => {},
  refreshUser: async () => {},
  proReferralCount: 0,
  referralPoints: 0,
  abandonedCartsCount: 0,
  inboxCount: 0,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [stores, setStores] = useState<StoreData[]>([]);
  const [storesLoaded, setStoresLoaded] = useState(false);
  const [activeStore, setActiveStoreState] = useState<StoreData | null>(null);
  const [isSubscriptionExpired, setIsSubscriptionExpired] = useState(false);
  const [proReferralCount, setProReferralCount] = useState(0);
  const [abandonedCartsCount, setAbandonedCartsCount] = useState(0);
  const [inboxCount, setInboxCount] = useState(0);

  const auth = getAuth();
  const firestore = useFirestore();
  
  const refreshUser = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
        setIsUserLoading(true);
        await currentUser.reload();
        const userData = await fetchStaticData(currentUser, firestore);
        const appUser: AppUser = { ...currentUser, ...userData };
        setUser(appUser);
        setIsUserLoading(false);
    }
  }, [auth, firestore]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsUserLoading(true);
      if (firebaseUser) {
        const userData = await fetchStaticData(firebaseUser, firestore);
        const appUser: AppUser = { ...firebaseUser, ...userData };
        setUser(appUser);
      } else {
        setUser(null);
      }
      setIsUserLoading(false);
    });

    return () => unsubscribeAuth();
  }, [auth, firestore]);
  
  useEffect(() => {
    if (user && firestore && !user.isAnonymous) {
      const userDocRef = doc(firestore, 'users', user.uid);
      updateDoc(userDocRef, { lastSeen: serverTimestamp() })
        .catch(console.error);
    }
  }, [user, firestore]);

  const loading = Boolean(isUserLoading || (user && !user.isSuperAdmin && !storesLoaded));

  const setActiveStore = (store: StoreData | null) => {
    setActiveStoreState(store);
    if (typeof window !== 'undefined') {
      if (store) {
        localStorage.setItem('activeStoreId', store.id);
      } else {
        localStorage.removeItem('activeStoreId');
      }
    }
  };

  useEffect(() => {
    if (!user || !firestore || user.isSuperAdmin || user.isAnonymous) {
      setStores([]);
      setActiveStoreState(null);
      setIsSubscriptionExpired(false);
      setProReferralCount(0);
      setAbandonedCartsCount(0);
      setInboxCount(0);
      setStoresLoaded(true);
      return;
    };

    const sub = user.subscription;
    let expired = false;

    if (sub) {
      if (sub.status === 'pending_plan') {
        expired = false;
      } else if (sub.status === 'expired') {
        expired = true;
      } else if (sub.status === 'trial' && sub.trialEndsAt) {
        const trialEndDate =
          sub.trialEndsAt instanceof Timestamp
            ? sub.trialEndsAt.toDate()
            : new Date(sub.trialEndsAt as any);
    
        if (new Date() > trialEndDate) {
          expired = true;
        }
      } else if (sub.status === 'active' && sub.endDate) {
        const endDate =
          sub.endDate instanceof Timestamp
            ? sub.endDate.toDate()
            : new Date(sub.endDate as any);
    
        if (new Date() > endDate) {
          expired = true;
        }
      }
    }
    setIsSubscriptionExpired(expired);

    const storesQuery = query(collection(firestore, 'stores'), where('sellerId', '==', user.uid));
    const unsubscribeStores = onSnapshot(storesQuery, (snapshot) => {
      const fetchedStores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoreData));
      setStores(fetchedStores);
      setStoresLoaded(true);

      const lastActiveStoreId = typeof window !== 'undefined' ? localStorage.getItem('activeStoreId') : null;
      const currentActiveStore = fetchedStores.find(s => s.id === lastActiveStoreId);
      
      if (currentActiveStore) {
        setActiveStoreState(currentActiveStore);
      } else if (fetchedStores.length > 0) {
        setActiveStoreState(fetchedStores[0]);
        if (typeof window !== 'undefined') localStorage.setItem('activeStoreId', fetchedStores[0].id);
      } else {
         setActiveStoreState(null);
         if (typeof window !== 'undefined') localStorage.removeItem('activeStoreId');
      }
    });

    const allUsersQuery = query(collection(firestore, 'users'), where('referredByVendor', '==', user.uid));
    const unsubscribeAllUsers = onSnapshot(allUsersQuery, (snapshot) => {
      const proReferrals = snapshot.docs.filter((doc) => {
        const sub = doc.data().subscription;
        return ['starter', 'standard', 'growth'].includes(sub?.planId) &&
          ['active', 'trial'].includes(sub?.status);
      }).length;
        setProReferralCount(proReferrals);
    });

    let unsubscribeCarts: () => void = () => {};
    let unsubscribeInbox: () => void = () => {};

    if (activeStore?.id) {
        const cartsQuery = query(collection(firestore, 'abandoned_checkouts'), where('storeId', '==', activeStore.id));
        unsubscribeCarts = onSnapshot(cartsQuery, (snapshot) => {
            setAbandonedCartsCount(snapshot.size);
        });

        const inboxQuery = query(
          collection(firestore, 'stores', activeStore.id, 'inboxThreads'),
          where('unreadForVendor', '==', true)
        );
        unsubscribeInbox = onSnapshot(inboxQuery, (snapshot) => {
            setInboxCount(snapshot.size);
        });

    } else {
        setAbandonedCartsCount(0);
        setInboxCount(0);
    }
    
    return () => {
        unsubscribeStores();
        unsubscribeAllUsers();
        unsubscribeCarts();
        unsubscribeInbox();
    };
  }, [user, firestore, activeStore?.id]);

  
  
  const referralPoints = useMemo(() => {
    if (!user) return 0;
    return user.referralPoints || (proReferralCount * 10);
  }, [user, proReferralCount]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'firebase:authUser' && !e.newValue && user) {
        setUser(null);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && auth.currentUser) {
        try {
          await auth.currentUser.getIdToken(true);
        } catch (error) {
          console.warn('Token refresh on visibility failed:', error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [auth]);

  const value = { 
    user, 
    loading, 
    isUserLoading, 
    stores, 
    activeStore, 
    setActiveStore, 
    refreshUser, 
    isSubscriptionExpired, 
    proReferralCount, 
    referralPoints, 
    abandonedCartsCount, 
    inboxCount 
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};

export const useRequireAuth = () => {
    const { user, isUserLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login');
        }
    }, [user, isUserLoading, router]);

    return { user, loading: isUserLoading };
};

export const useRequireSuperAdmin = () => {
    const { user, isUserLoading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!isUserLoading) {
            if (!user) {
                router.push('/login');
            } else if (!user.isSuperAdmin && !pathname.startsWith('/superadmin')) {
                router.push('/dashboard');
            }
        }
    }, [user, isUserLoading, router, pathname]);

    return { user, loading: isUserLoading };
};

export const useRequireStaff = () => {
    const { user, isUserLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isUserLoading) {
            if (!user) {
                router.push('/staff/login');
            } else if (user.role !== 'staff' && user.role !== 'superadmin') {
                router.push('/login');
            }
        }
    }, [user, isUserLoading, router]);

    return { user, loading: isUserLoading };
};
