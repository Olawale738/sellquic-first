'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useStore } from '@/context/store-context';
import { getStoreBasePath } from '@/lib/url';

interface SearchFormProps {
  className?: string;
  inputClassName?: string;
}

export function SearchForm({ className, inputClassName }: SearchFormProps) {
    const { store, isDemo } = useStore();
    const [searchTerm, setSearchTerm] = useState('');
    const router = useRouter();
    
    if (!store) return null;

    let basePath;
    if (isDemo) {
        basePath = `/demo/${store.slug}`;
    } else {
        basePath = getStoreBasePath(store.subdomain);
    }
    
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchTerm.trim()) return;
        router.push(`${basePath}/search?q=${encodeURIComponent(searchTerm.trim())}`);
    };
    
    return (
        <form onSubmit={handleSearch} className={className}>
            <div className="relative">
            <Input
                placeholder="Find Products"
                
                className={`pl-10 pr-4 bg-white text-black border-none ${inputClassName || ''}`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Search className="h-5 w-5" />
              </button>
            </div>
        </form>
    );
};
