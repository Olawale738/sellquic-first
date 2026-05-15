'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, MoreHorizontal, AlertCircle, Edit, Trash2, ArchiveRestore, Search, Package } from 'lucide-react';
import Link from 'next/link';
import { collection, query, where, onSnapshot, DocumentData, doc, deleteDoc, updateDoc, orderBy } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  hasCommerceAccess,
  getCommerceAccessMessage,
  canCreateProduct,
  getProductLimitForSubscription,
} from '@/lib/subscription-access';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/use-auth';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getStorage, ref, deleteObject } from 'firebase/storage';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Product } from '@/types/product';
import { getAuth } from 'firebase/auth';
import { Input } from '@/components/ui/input';

interface Category extends DocumentData {
  id: string;
  name: string;
}

const getTotalStock = (product: Product) => {
  if (product.isOutOfStock) return 0;
  if (!product.manageStock) return 999;
  if (product.hasVariants && product.variants && product.variants.length > 0) {
    return product.variants.reduce((total, variant) => total + (variant.stock || 0), 0);
  }
  return product.stock || 0;
};

const getDisplayPrice = (product: Product) => {
  if (product.price === 0 && (!product.variants || product.variants.length === 0)) {
    return <span className="text-amber-600 font-bold text-xs">Set Price</span>;
  }
  if (product.hasVariants && product.variants && product.variants.length > 0) {
    const validPrices = product.variants.map(v => v.price).filter(p => p > 0);
    if (validPrices.length > 0) {
      const minPrice = Math.min(...validPrices);
      return `From GHS ${minPrice.toFixed(2)}`;
    }
  }
  return `GHS ${product.price.toFixed(2)}`;
};

const getStatusBadge = (product: Product) => {
  if (product.status === 'draft') {
    return <Badge className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0 h-4">Draft</Badge>;
  }
  if (product.isArchived) {
    return <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">Archived</Badge>;
  }
  const stock = getTotalStock(product);
  return (
    <Badge
      variant={stock > 0 ? 'default' : 'outline'}
      className="text-[10px] px-1.5 py-0 h-4"
    >
      {stock > 0 ? 'In Stock' : 'Out of Stock'}
    </Badge>
  );
};

const ProductActions = ({
  product,
  storeId,
  onRestore,
  canRestore,
}: {
  product: Product;
  storeId: string;
  onRestore: () => void;
  canRestore: boolean;
}) => {
  const { toast } = useToast();
  const firestore = useFirestore();
  const storage = getStorage();
  const auth = getAuth();

  const handleDelete = async () => {
    try {
      if (product.images && product.images.length > 0) {
        const deletePromises = product.images.map(imageUrl => {
          if (!imageUrl.includes('firebasestorage.googleapis.com')) return Promise.resolve();
          const imageRef = ref(storage, imageUrl);
          return deleteObject(imageRef).catch(err => {
            if (err.code !== 'storage/object-not-found') throw err;
          });
        });
        await Promise.all(deletePromises);
      }
      if (firestore) {
        await deleteDoc(doc(firestore, 'products', product.id));
        try {
          const token = await auth.currentUser?.getIdToken();
          await fetch('/api/cache/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ storeId }),
          });
        } catch (e) {
          console.warn('Failed to clear AI cache', e);
        }
      }
      toast({ title: 'Product Deleted', description: `"${product.name}" has been deleted.` });
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({ title: 'Deletion Failed', variant: 'destructive' });
    }
  };

  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/products/edit/${product.id}`} className="flex items-center">
              <Edit className="mr-2 h-4 w-4" />
              {product.status === 'draft' ? 'Review & Publish' : 'Edit'}
            </Link>
          </DropdownMenuItem>
          {product.isArchived && (
            <DropdownMenuItem onClick={onRestore} disabled={!canRestore} className="flex items-center">
              <ArchiveRestore className="mr-2 h-4 w-4" /> Restore
            </DropdownMenuItem>
          )}
          <AlertDialogTrigger asChild>
            <DropdownMenuItem className="text-red-600 flex items-center">
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </AlertDialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent className="max-w-[90vw] sm:max-w-lg rounded-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete "{product.name}". This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>Yes, Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const { user, activeStore, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const firestore = useFirestore();
  const auth = getAuth();

  // ── Subscription / product-limit state ───────────────────────────────────
  const subscription = user?.subscription;
  const canManageProducts = hasCommerceAccess(subscription);
  const commerceAccessMessage = getCommerceAccessMessage(subscription);

  const activeProductCount = useMemo(
    () => products.filter(p => p.isArchived !== true).length,
    [products]
  );

  // Evaluate whether an additional product can be created right now
  const productAccess = useMemo(
    () => canCreateProduct({ subscription, activeProductCount }),
    [subscription, activeProductCount]
  );

  // null = unlimited; number = per-plan cap
  const productLimit = getProductLimitForSubscription(subscription);

  // ── Data fetching ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !activeStore || !firestore) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(firestore, 'products'),
      where('storeId', '==', activeStore.id),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeProducts = onSnapshot(
      q,
      querySnapshot => {
        setProducts(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
        setLoading(false);
      },
      error => {
        console.error('Error fetching products: ', error);
        toast({ title: 'Error', description: 'Could not fetch products.', variant: 'destructive' });
        setLoading(false);
      }
    );
    const catQuery = query(collection(firestore, 'stores', activeStore.id, 'categories'));
    const unsubscribeCategories = onSnapshot(catQuery, snapshot => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    });
    return () => {
      unsubscribeProducts();
      unsubscribeCategories();
    };
  }, [user, activeStore, toast, firestore]);

  const filteredProducts = useMemo(() => {
    return products
      .filter(p => {
        if (searchTerm === '') return true;
        const productName = (p.name || '').toLowerCase().replace(/\s+/g, ' ').trim();
        const searchInput = searchTerm.toLowerCase().replace(/\s+/g, ' ').trim();
        return productName.includes(searchInput);
      })
      .filter(p => categoryFilter === 'all' || p.category === categoryFilter)
      .filter(p => {
        if (stockFilter === 'all') return true;
        if (p.isArchived) return false;
        const stock = getTotalStock(p);
        if (stockFilter === 'in_stock') return stock > 0;
        if (stockFilter === 'out_of_stock') return stock === 0;
        return true;
      });
  }, [products, categoryFilter, stockFilter, searchTerm]);

  // ── Restore handler ───────────────────────────────────────────────────────
  const handleRestoreProduct = async (product: Product) => {
    if (!canManageProducts) {
      toast({
        title: 'Subscription required',
        description: commerceAccessMessage,
        variant: 'destructive',
      });
      return;
    }
    if (!productAccess.allowed) {
      toast({
        title: 'Product limit reached',
        description: 'reason' in productAccess ? productAccess.reason : 'Upgrade to restore more products.',
        variant: 'destructive',
      });
      return;
    }
    if (!firestore || !activeStore) return;
    try {
      await updateDoc(doc(firestore, 'products', product.id), {
        isArchived: false,
        archivedAt: null,
        archivedReason: null,
      });
      try {
        const token = await auth.currentUser?.getIdToken();
        await fetch('/api/cache/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ storeId: activeStore.id }),
        });
      } catch (e) {
        console.warn('Failed to clear AI cache', e);
      }
      toast({ title: 'Product Restored', description: `"${product.name}" is now visible.` });
    } catch (error) {
      console.error('Error restoring product:', error);
      toast({ title: 'Failed to restore', variant: 'destructive' });
    }
  };

  if (authLoading) return <p className="p-4 text-sm text-muted-foreground">Loading...</p>;

  // ── Header: Add Product button (3 states) ─────────────────────────────────
  const AddProductButton = () => {
    if (!activeStore) return null;
    if (!canManageProducts) {
      return (
        <Button asChild variant="secondary" size="sm" className="flex-shrink-0 text-xs h-8 px-3">
          <Link href="/dashboard/subscription">Choose Plan</Link>
        </Button>
      );
    }
    if (!productAccess.allowed) {
      return (
        <Button size="sm" disabled className="flex-shrink-0 text-xs h-8 px-3 opacity-60 cursor-not-allowed">
          <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Limit Reached
        </Button>
      );
    }
    return (
      <Button asChild size="sm" className="flex-shrink-0 text-xs h-8 px-3">
        <Link href="/dashboard/products/new">
          <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Add Product
        </Link>
      </Button>
    );
  };

  // ── Card description with optional count/limit ────────────────────────────
  const cardDescription = canManageProducts
    ? productLimit !== null
      ? `${activeProductCount} / ${productLimit} active products`
      : `${activeProductCount} active products`
    : 'Choose a plan or start a trial to list products';

  return (
    <div className="animated-border-card">
      <Card className="border-0 shadow-none sm:border sm:shadow-sm">
        {/* ── HEADER ── */}
        <CardHeader className="px-4 pt-4 pb-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-lg sm:text-xl">Products</CardTitle>
              <CardDescription className="text-xs mt-0.5">{cardDescription}</CardDescription>
            </div>
            <AddProductButton />
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-4 sm:px-6">
          {!activeStore ? (
            <div className="text-center py-12">
              <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">Please select a store to view products.</p>
              <Button asChild size="sm">
                <Link href="/dashboard/stores">Manage Stores</Link>
              </Button>
            </div>
          ) : (
            <>
              {/* ── ACCESS / LIMIT ALERTS ── */}
              {!canManageProducts && (
                <Alert className="mb-3 bg-amber-50 border-amber-200 py-2.5 px-3">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                  <AlertTitle className="text-amber-800 text-xs font-semibold ml-1">
                    Subscription required
                  </AlertTitle>
                  <AlertDescription className="text-amber-700 text-xs ml-1">
                    {commerceAccessMessage}
                  </AlertDescription>
                </Alert>
              )}

              {canManageProducts && !productAccess.allowed && (
                <Alert className="mb-3 bg-amber-50 border-amber-200 py-2.5 px-3">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                  <AlertTitle className="text-amber-800 text-xs font-semibold ml-1">
                    Product limit reached
                  </AlertTitle>
                  <AlertDescription className="text-amber-700 text-xs ml-1">
                    {'reason' in productAccess ? productAccess.reason : ''}
                  </AlertDescription>
                </Alert>
              )}

              {/* ── FILTERS ── */}
              <div className="flex flex-col gap-2 mb-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={stockFilter} onValueChange={setStockFilter}>
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="Stock Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stock</SelectItem>
                      <SelectItem value="in_stock">In Stock</SelectItem>
                      <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ── MOBILE LIST ── */}
              <div className="block sm:hidden">
                {loading ? (
                  <div className="space-y-2">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl border bg-muted/30 animate-pulse">
                        <div className="w-12 h-12 rounded-lg bg-muted flex-shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 bg-muted rounded w-2/3" />
                          <div className="h-3 bg-muted rounded w-1/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredProducts.length > 0 ? (
                  <div className="space-y-2">
                    {filteredProducts.map(product => (
                      <div
                        key={product.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                          product.isArchived ? 'bg-muted/30 opacity-70' : 'bg-white'
                        }`}
                      >
                        <div className="flex-shrink-0">
                          <Image
                            src={product.images?.[0] ?? 'https://placehold.co/600x400'}
                            alt={product.name}
                            width={48}
                            height={48}
                            className="rounded-lg object-cover w-12 h-12"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate leading-tight">{product.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{getDisplayPrice(product)}</p>
                          <div className="mt-1 flex items-center gap-1.5">
                            {getStatusBadge(product)}
                            {product.manageStock && !product.isArchived && getTotalStock(product) !== 999 && (
                              <span className="text-[10px] text-muted-foreground">
                                {getTotalStock(product)} left
                              </span>
                            )}
                          </div>
                        </div>
                        <ProductActions
                          product={product}
                          storeId={activeStore.id}
                          onRestore={() => handleRestoreProduct(product)}
                          canRestore={productAccess.allowed}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-14">
                    <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No products found.</p>
                    {!canManageProducts ? (
                      <Button asChild size="sm" className="mt-4">
                        <Link href="/dashboard/subscription">Choose a plan</Link>
                      </Button>
                    ) : productAccess.allowed ? (
                      <Button asChild size="sm" className="mt-4">
                        <Link href="/dashboard/products/new">Add your first product</Link>
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-2">
                        {'reason' in productAccess ? productAccess.reason : 'Product limit reached.'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* ── DESKTOP TABLE ── */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">Image</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                          Loading products...
                        </TableCell>
                      </TableRow>
                    ) : filteredProducts.length > 0 ? (
                      filteredProducts.map(product => (
                        <TableRow
                          key={product.id}
                          className={product.isArchived ? 'bg-muted/50 text-muted-foreground' : ''}
                        >
                          <TableCell>
                            <Image
                              src={product.images?.[0] ?? 'https://placehold.co/600x400'}
                              alt={product.name}
                              width={40}
                              height={40}
                              className="rounded-md object-cover aspect-square"
                            />
                          </TableCell>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>{getStatusBadge(product)}</TableCell>
                          <TableCell>{getDisplayPrice(product)}</TableCell>
                          <TableCell>
                            {getTotalStock(product) === 999 ? '∞' : getTotalStock(product)}
                          </TableCell>
                          <TableCell className="text-right">
                            <ProductActions
                              product={product}
                              storeId={activeStore.id}
                              onRestore={() => handleRestoreProduct(product)}
                              canRestore={productAccess.allowed}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-14">
                          <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                          <p className="text-sm text-muted-foreground">No products found.</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}