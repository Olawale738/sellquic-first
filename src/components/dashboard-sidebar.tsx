
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import {
  BarChart,
  ShoppingCart,
  Package,
  PlusCircle,
  Grid3x3,
  Truck,
  CreditCard,
  Settings,
  Store,
  Share2,
  DollarSign,
  Users,
  ChevronDown,
  Globe,
  Megaphone,
  LineChart,
  Percent,
  History,
  Bot,
  Mail,
  Sparkles,
  Instagram,
  Rocket,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from './ui/badge';
import { useAuth } from '@/hooks/use-auth';


const iconMap: { [key: string]: React.ElementType } = {
  BarChart,
  ShoppingCart,
  Package,
  PlusCircle,
  Grid3x3,
  Truck,
  CreditCard,
  Settings,
  Store,
  Share2,
  DollarSign,
  Users,
  Globe,
  Megaphone,
  LineChart,
  Percent,
  History,
  Bot,
  Mail,
  Sparkles,
  Instagram,
  Rocket,
};

const NavLink = ({ href, children, icon: iconName, active, isSubmenu = false, onClick, badgeCount }: { href: string; children: React.ReactNode; icon: string; active?: boolean; isSubmenu?: boolean, onClick?: () => void, badgeCount?: number }) => {
  const pathname = usePathname();
  const isActive = active !== undefined ? active : pathname === href;
  const Icon = iconMap[iconName];

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
        isActive && "bg-muted text-primary",
        isSubmenu && "ml-4",
      )}
    >
      {Icon && <Icon className="h-4 w-4" />}
      <span className="truncate flex-1">{children}</span>
      {badgeCount && badgeCount > 0 && (
        <Badge variant="destructive" className="h-5 w-5 justify-center p-0">{badgeCount}</Badge>
      )}
    </Link>
  );
};


interface DashboardSidebarProps {
  isSheetOpen: boolean;
  closeSheet: () => void;
}

export default function DashboardSidebar({ isSheetOpen, closeSheet }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { abandonedCartsCount, inboxCount, activeStore } = useAuth();
  const [isProductsOpen, setIsProductsOpen] = useState(pathname.startsWith('/dashboard/products'));
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(pathname.startsWith('/dashboard/analytics') || pathname === '/dashboard');
  const [isMarketingOpen, setIsMarketingOpen] = useState(pathname.startsWith('/dashboard/marketing'));
  const [isSettingsOpen, setIsSettingsOpen] = useState(pathname.startsWith('/dashboard/settings') || pathname.startsWith('/dashboard/payments') || pathname.startsWith('/dashboard/deliveries') || pathname.startsWith('/dashboard/domain') || pathname.startsWith('/dashboard/ai-assistant'));

  return (
    <div className="flex h-full max-h-screen flex-col">
      <div className="flex h-16 items-center border-b px-4 shrink-0 lg:px-6">
        <Link href="/dashboard" className="flex items-center gap-3 font-semibold">
           <Image src="/logo.png" alt="SellQuic Logo" width={150} height={35} />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto">
        <nav className="grid items-start px-2 py-4 text-sm font-medium lg:px-4">
            <p className="px-3 pb-2 text-xs text-gray-500 uppercase tracking-wider">Menu</p>
            
            <NavLink href="/dashboard" icon="BarChart" active={pathname === '/dashboard'} onClick={closeSheet}>Dashboard</NavLink>
            
            <Collapsible open={isAnalyticsOpen} onOpenChange={setIsAnalyticsOpen}>
               <CollapsibleTrigger className="w-full">
                 <div className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                    (pathname.startsWith('/dashboard/analytics')) && "bg-muted text-primary"
                  )}>
                    <BarChart className="h-4 w-4" />
                    <span className="truncate">Analytics</span>
                    <ChevronDown className={cn("h-4 w-4 ml-auto transition-transform", isAnalyticsOpen && "rotate-180")} />
                 </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pt-1">
                <NavLink href="/dashboard/analytics/sales" icon="DollarSign" isSubmenu onClick={closeSheet}>Sales</NavLink>
                <NavLink href="/dashboard/analytics/product" icon="Package" isSubmenu onClick={closeSheet}>Products</NavLink>
                <NavLink href="/dashboard/analytics/customer" icon="Users" isSubmenu onClick={closeSheet}>Customers</NavLink>
              </CollapsibleContent>
            </Collapsible>
            
            <NavLink href="/dashboard/insights" icon="Sparkles" onClick={closeSheet}>Ai Insights</NavLink>
            <NavLink href="/dashboard/orders" icon="ShoppingCart" onClick={closeSheet}>Orders</NavLink>
            <NavLink href="/dashboard/inbox" icon="Mail" onClick={closeSheet} badgeCount={inboxCount}>Inbox</NavLink>
            
            <Collapsible open={isProductsOpen} onOpenChange={setIsProductsOpen}>
              <CollapsibleTrigger className="w-full">
                 <div className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                    pathname.startsWith('/dashboard/products') && "bg-muted text-primary"
                  )}>
                    <Package className="h-4 w-4" />
                    <span className="truncate">Products</span>
                    <ChevronDown className={cn("h-4 w-4 ml-auto transition-transform", isProductsOpen && "rotate-180")} />
                 </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pt-1">
                <NavLink href="/dashboard/products" icon="Package" active={pathname === '/dashboard/products'} isSubmenu onClick={closeSheet}>All Products</NavLink>
                <NavLink href="/dashboard/products/new" icon="PlusCircle" isSubmenu onClick={closeSheet}>New Product</NavLink>
                <NavLink href="/dashboard/products/categories" icon="Grid3x3" isSubmenu onClick={closeSheet}>Categories</NavLink>
                <NavLink href="/dashboard/products/import" icon="Instagram" isSubmenu onClick={closeSheet}>Import</NavLink>
              </CollapsibleContent>
            </Collapsible>
            
            <Collapsible open={isMarketingOpen} onOpenChange={setIsMarketingOpen}>
               <CollapsibleTrigger className="w-full">
                 <div className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                    pathname.startsWith('/dashboard/marketing') && "bg-muted text-primary"
                  )}>
                    <Megaphone className="h-4 w-4" />
                    <span className="truncate">Marketing</span>
                    <ChevronDown className={cn("h-4 w-4 ml-auto transition-transform", isMarketingOpen && "rotate-180")} />
                 </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pt-1">
                <NavLink href="/dashboard/marketing/discounts" icon="Percent" isSubmenu onClick={closeSheet}>Discounts & Promos</NavLink>
                <NavLink href="/dashboard/marketing/abandoned-carts" icon="History" isSubmenu onClick={closeSheet} badgeCount={abandonedCartsCount}>Abandoned Carts</NavLink>
                <NavLink href="/dashboard/marketing/tracking" icon="LineChart" isSubmenu onClick={closeSheet}>Tracking & SEO</NavLink>
                {activeStore?.id && (
                  <NavLink
                    href={`/dashboard/stores/${activeStore.id}/launch-kit`}
                    icon="Rocket"
                    isSubmenu
                    onClick={closeSheet}
                  >
                    Launch Kit
                  </NavLink>
                )}
              </CollapsibleContent>
            </Collapsible>

            <p className="px-3 pt-4 pb-2 text-xs text-gray-500 uppercase tracking-wider">Configuration</p>
             <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <CollapsibleTrigger className="w-full">
                    <div className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                        isSettingsOpen && "bg-muted text-primary"
                    )}>
                        <Settings className="h-4 w-4" />
                        <span className="truncate">Store Setup</span>
                        <ChevronDown className={cn("h-4 w-4 ml-auto transition-transform", isSettingsOpen && "rotate-180")} />
                    </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 pt-1">
                    <NavLink href="/dashboard/payments" icon="CreditCard" isSubmenu onClick={closeSheet}>Payments</NavLink>
                    <NavLink href="/dashboard/deliveries" icon="Truck" isSubmenu onClick={closeSheet}>Deliveries</NavLink>
                    <NavLink href="/dashboard/domain" icon="Globe" isSubmenu onClick={closeSheet}>Domain</NavLink>
                    <NavLink href="/dashboard/settings" icon="Settings" isSubmenu onClick={closeSheet}>Appearance</NavLink>
                    <NavLink href="/dashboard/ai-assistant" icon="Bot" isSubmenu onClick={closeSheet}>AI Assistant</NavLink>
                </CollapsibleContent>
            </Collapsible>

            <p className="px-3 pt-4 pb-2 text-xs text-gray-500 uppercase tracking-wider">Account</p>
             <NavLink href="/dashboard/stores" icon="Store" onClick={closeSheet}>My Stores</NavLink>
             <NavLink href="/dashboard/referrals" icon="Share2" onClick={closeSheet}>Referrals</NavLink>
             <NavLink href="/dashboard/subscription" icon="DollarSign" onClick={closeSheet}>Subscription</NavLink>
             <NavLink href="/dashboard/profile" icon="Users" onClick={closeSheet}>My Profile</NavLink>
        </nav>
      </div>
    </div>
  );
}