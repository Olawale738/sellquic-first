'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useStore } from '@/context/store-context';
import { getStoreBasePath } from '@/lib/url';
import { cn } from '@/lib/utils';

const CATEGORY_PLACEHOLDERS: Record<string, string> = {
  fashion:     'Search dresses, shoes, bags…',
  clothing:    'Search tops, bottoms, accessories…',
  food:        'Search meals, drinks, snacks…',
  restaurant:  'Search dishes, drinks, combos…',
  beauty:      'Search skincare, makeup, hair…',
  electronics: 'Search phones, gadgets, accessories…',
  furniture:   'Search sofas, beds, decor…',
  groceries:   'Search fresh food, pantry items…',
  services:    'Search packages, bookings…',
};

function getPlaceholder(category?: string): string {
  if (!category) return 'Search products…';
  const cat = category.toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_PLACEHOLDERS)) {
    if (cat.includes(key)) return val;
  }
  return 'Search products…';
}

interface SearchFormProps {
  className?: string;
  inputClassName?: string;
}

export function SearchForm({ className, inputClassName }: SearchFormProps) {
  const { store, isDemo } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  if (!store) return null;

  const basePath = isDemo ? `/demo/${store.slug}` : getStoreBasePath(store.subdomain);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    router.push(`${basePath}/search?q=${encodeURIComponent(searchTerm.trim())}`);
  };

  return (
    <form onSubmit={handleSearch} className={className}>
      <div className="relative">
        <Input
          placeholder={getPlaceholder(store.category)}
          className={cn('pl-10 pr-4', inputClassName)}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button
          type="submit"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
