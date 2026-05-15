'use client';

import { useState, useEffect } from 'react';
import { getInstagramPosts, importPostsAsProducts } from '@/app/actions/instagram';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export default function InstagramImporter({ storeId, sellerId }: { storeId: string; sellerId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [posts, setPosts] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPosts() {
      const res = await getInstagramPosts(storeId);
      if (res.success && res.posts) {
        setPosts(res.posts);
      } else {
        setError(res.error || 'Failed to load posts.');
      }
      setIsLoading(false);
    }
    fetchPosts();
  }, [storeId]);

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    newSelection.has(id) ? newSelection.delete(id) : newSelection.add(id);
    setSelectedIds(newSelection);
  };
  
  const handleImport = async () => {
    if (selectedIds.size === 0) return;
    
    setIsImporting(true);
    toast({ title: 'Importing...', description: 'AI is analyzing captions and preparing your products.' });

    const selectedPosts = posts.filter(p => selectedIds.has(p.id));

    const res = await importPostsAsProducts(storeId, sellerId, selectedPosts);

    if (res.success) {
      toast({ title: 'Import Complete!', description: 'Your new draft products are at the top of your product list.'});
      router.push('/dashboard/products');
      router.refresh();
    } else {
      setError(res.error || 'Failed to import products.');
      setIsImporting(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center animate-pulse text-gray-500">Loading your Instagram...</div>;
  if (error) return <div className="p-6 text-red-600 bg-red-50 rounded-xl">{error}</div>;

  return (
    <div className="pb-24">
      <div className="mb-6 px-2">
        <h2 className="text-2xl font-bold text-gray-900">Import from Instagram</h2>
        <p className="text-gray-500 text-sm">Tap the posts you want to sell. They will be saved as drafts in your product list.</p>
      </div>

      <div className="grid grid-cols-3 gap-1 md:gap-3">
        {posts.map((post) => (
          <div 
            key={post.id} onClick={() => toggleSelection(post.id)}
            className={`relative cursor-pointer aspect-square bg-gray-100 ${
              selectedIds.has(post.id) ? 'opacity-80 scale-95 transition-transform' : ''
            }`}
          >
            <Image src={post.imageUrl} alt="IG" fill className="object-cover" unoptimized />
            {post.mediaType === 'VIDEO' && (
              <div className="absolute top-1 right-1 bg-black/50 rounded p-1">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M6 4l10 6-10 6V4z"/></svg>
              </div>
            )}
            {selectedIds.has(post.id) && (
              <div className="absolute inset-0 border-4 border-blue-600 flex items-center justify-center bg-blue-600/20">
                <div className="bg-blue-600 text-white rounded-full p-1.5 shadow-lg">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-50">
          <div className="max-w-xl mx-auto flex gap-3">
            <button
              onClick={handleImport}
              disabled={isImporting}
              className="flex-1 bg-blue-600 text-white font-bold text-lg py-3 rounded-xl hover:bg-blue-700 shadow-md flex items-center justify-center gap-2"
            >
              {isImporting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Importing...</span>
                </>
              ) : (
                `Import ${selectedIds.size} Item${selectedIds.size > 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
