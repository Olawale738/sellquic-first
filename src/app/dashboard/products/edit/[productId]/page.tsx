'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, UploadCloud, X, Loader2, PlusCircle, Trash2, ImagePlus, AlertCircle, Lock } from 'lucide-react';
import { generateDescription } from '@/ai/index';
import Image from 'next/image';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { doc, getDoc, updateDoc, collection, query, onSnapshot, DocumentData, addDoc, where } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { nanoid } from 'nanoid';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { slugify } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import CloudinaryVideoUpload from '@/components/dashboard/products/CloudinaryVideoUpload';
import { Badge } from '@/components/ui/badge';
import { getAuth } from 'firebase/auth';
import { cn } from '@/lib/utils';
import {
  hasCommerceAccess,
  getCommerceAccessMessage,
  canCreateProduct,
} from '@/lib/subscription-access';

interface ProductVariant {
  id: string;
  name: string;
  price: string;
  stock: string;
  image?: string;
  regularPrice?: string;
  moq?: string;
}

interface ProductData {
  name: string;
  price: string;
  regularPrice?: string;
  stock?: string;
  moq?: string;
  description: string;
  category: string;
  images: string[];
  videoUrl?: string;
  sellerId: string;
  sellingStatus: string;
  hasVariants: boolean;
  variants: ProductVariant[];
  manageStock: boolean;
  slug?: string;
  isOutOfStock?: boolean;
  isArchived?: boolean;
  status?: 'draft' | 'published';
}

interface Category extends DocumentData {
  id: string;
  name: string;
}

export default function EditProductPage() {
  const [product, setProduct] = useState<ProductData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [imagesToRemove, setImagesToRemove] = useState<string[]>([]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);

  const [activeProductCount, setActiveProductCount] = useState(0);

  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const [newVariantImages, setNewVariantImages] = useState<Record<string, File>>({});
  const [variantImagePreviews, setVariantImagePreviews] = useState<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);

  const { toast } = useToast();
  const { user, activeStore, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const productId = params.productId as string;
  const firestore = useFirestore();
  const storage = getStorage();
  const auth = getAuth();

  const redirectUrl = searchParams.get('redirect');

  // ── Subscription / product-limit gates ────────────────────────────────────
  // (Replaces the old broken `isFreePlan`, `hasProductLimit`, `productLimit`, `limitReached`)
  const subscription = user?.subscription;
  const canManageProducts = hasCommerceAccess(subscription);
  const productAccess = canCreateProduct({ subscription, activeProductCount });

  // Editing this product at all is blocked if the user has no commerce access
  // (pending plan, expired trial, expired paid, no subscription).
  const isEditLocked = !canManageProducts;

  // If the product is archived, restoring it counts as creating a slot — must
  // pass the product limit check too.
  const isRestoreLocked = product?.isArchived === true && !productAccess.allowed;

  const isLocked = isEditLocked || isRestoreLocked;

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!user || !activeStore || !firestore) return;

    const q = query(collection(firestore, 'stores', activeStore.id, 'categories'));
    const unsubscribeCategories = onSnapshot(q, querySnapshot => {
      const categoriesData = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category));
      setCategories(categoriesData);
    });

    const prodQuery = query(collection(firestore, 'products'), where('storeId', '==', activeStore.id));
    const unsubscribeProducts = onSnapshot(prodQuery, snapshot => {
      const activeCount = snapshot.docs.filter(d => d.data().isArchived !== true).length;
      setActiveProductCount(activeCount);
    });

    return () => {
      unsubscribeCategories();
      unsubscribeProducts();
    };
  }, [user, activeStore, firestore]);

  const fetchProductCallback = useCallback(async () => {
    if (!productId || !firestore || !user) return;

    try {
      const productRef = doc(firestore, 'products', productId);
      const docSnap = await getDoc(productRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.sellerId !== user.uid) {
          toast({
            title: 'Unauthorized',
            description: "You don't have permission to edit this product.",
            variant: 'destructive',
          });
          router.push('/dashboard/products');
          return;
        }
        const stock = data.stock?.toString() || '0';
        setProduct({
          name: data.name || '',
          price: data.price?.toString() || '0',
          regularPrice: data.regularPrice?.toString() || '',
          stock: stock,
          moq: data.moq?.toString() || '1',
          description: data.description || '',
          category: data.category || '',
          images: data.images || [],
          videoUrl: data.videoUrl || '',
          sellerId: data.sellerId || '',
          sellingStatus: data.sellingStatus || 'none',
          hasVariants: data.hasVariants || false,
          variants:
            data.variants?.map((v: any) => ({
              ...v,
              id: v.id || nanoid(),
              price: v.price.toString(),
              stock: v.stock.toString(),
              moq: v.moq?.toString() || '',
            })) || [],
          manageStock: data.manageStock ?? false,
          slug: data.slug || '',
          isOutOfStock: data.isOutOfStock || false,
          isArchived: data.isArchived || false,
          status: data.status || 'published',
        });
      } else {
        toast({ title: 'Product not found', variant: 'destructive' });
        router.push('/dashboard/products');
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      toast({ title: 'Error fetching product', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [productId, firestore, user, toast, router]);

  useEffect(() => {
    fetchProductCallback();
  }, [fetchProductCallback]);

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!product) return;
    const { id, value } = e.target;
    setProduct({ ...product, [id]: value });
    setIsDirty(true);
  };

  const handleCategoryChange = (value: string) => {
    if (!product) return;
    if (value === '__CREATE_NEW__') {
      setIsCategoryDialogOpen(true);
    } else {
      setProduct({ ...product, category: value });
      setIsDirty(true);
    }
  };

  const handleStatusChange = (value: string) => {
    if (!product) return;
    setProduct({ ...product, sellingStatus: value });
    setIsDirty(true);
  };

  const handleGenerateDescription = async () => {
    if (!user) return;
    if (!product || !product.description.trim()) {
      toast({
        title: 'Please provide a draft',
        description: 'Write a few words about your product and let the AI polish it for you.',
      });
      return;
    }
    setIsGenerating(true);
    try {
      const result = await generateDescription({
        userId: user.uid,
        name: product.name,
        price: product.price,
        stock: product.stock || '0',
        draftDescription: product.description,
      });
      setProduct({ ...product, description: result.description });
      setIsDirty(true);
    } catch (error: any) {
      const msg = String(error?.message || '');
      const isOverloaded = msg.includes('503') || msg.includes('high demand') || msg.includes('overloaded');
      toast({
        title: isOverloaded ? 'AI is a little busy right now' : 'Could not generate description',
        description: isOverloaded
          ? 'Our AI is handling a lot of requests at the moment. Give it a few seconds and try again please.'
          : msg || 'Something went wrong. Please try again.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || !product) return;

    const fileArray = Array.from(files);
    const imageSizeLimit = 5 * 1024 * 1024;

    const oversizedFiles = fileArray.filter(file => file.size > imageSizeLimit);
    if (oversizedFiles.length > 0) {
      toast({
        title: 'Image too large',
        description: 'Please choose files under 5MB.',
        variant: 'destructive',
      });
      return;
    }

    if (fileArray.length + product.images.length + newImages.length - imagesToRemove.length > 5) {
      toast({
        title: 'Image Limit Exceeded (5 max)',
        description: 'You can upload a maximum of 5 images.',
        variant: 'destructive',
      });
      return;
    }

    setNewImages(prevImages => [...prevImages, ...fileArray]);
    setIsDirty(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFilesSelected(e.target.files);
  };

  const removeExistingImage = (imageUrl: string) => {
    if (!product) return;
    setProduct({ ...product, images: product.images.filter(url => url !== imageUrl) });
    setImagesToRemove(prev => [...prev, imageUrl]);
    setIsDirty(true);
  };

  const removeNewImage = (index: number) => {
    setNewImages(prevImages => prevImages.filter((_, i) => i !== index));
    setIsDirty(true);
  };

  const uploadImage = async (file: File, path: string): Promise<string> => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  };

  const deleteImage = async (imageUrl: string) => {
    if (!imageUrl.includes('firebasestorage.googleapis.com')) return;
    try {
      await deleteObject(ref(storage, imageUrl));
    } catch (error: any) {
      if (error.code !== 'storage/object-not-found') throw error;
    }
  };

  const handleUpdateProduct = async () => {
    if (!user || !product || !activeStore || product.sellerId !== user.uid || !firestore) return;

    // ── ACCESS GATE — block edits when subscription is invalid ───────────────
    if (!canManageProducts) {
      toast({
        title: 'Subscription required',
        description: getCommerceAccessMessage(subscription),
        variant: 'destructive',
      });
      return;
    }

    // ── RESTORE GATE — restoring archived ⇒ counts toward product limit ──────
    if (product.isArchived && !productAccess.allowed) {
      toast({
        title: 'Product limit reached',
        description: 'reason' in productAccess ? productAccess.reason : 'Upgrade to restore this product.',
        variant: 'destructive',
      });
      return;
    }

    const priceNumber = product.price ? parseFloat(product.price) : NaN;
    const defaultPriceIsValid = !isNaN(priceNumber) && priceNumber > 0;
    if (!product.hasVariants && !defaultPriceIsValid) {
      toast({
        title: 'Price required',
        description: 'Please enter a valid selling price > 0.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    setIsDirty(false);

    try {
      const variantImageUploadPromises = Object.entries(newVariantImages).map(async ([variantId, file]) => {
        const imageUrl = await uploadImage(
          file,
          `products/${activeStore.id}/${productId}_variant_${variantId}_${file.name}`
        );
        return { variantId, imageUrl };
      });
      const uploadedVariantImages = await Promise.all(variantImageUploadPromises);

      const variantImageUrlMap = uploadedVariantImages.reduce(
        (acc, { variantId, imageUrl }) => {
          acc[variantId] = imageUrl;
          return acc;
        },
        {} as Record<string, string>
      );

      const basePriceNumber = defaultPriceIsValid ? priceNumber : 0;
      const updatedVariants = product.variants.map(v => {
        const parsedVariantPrice = v.price ? parseFloat(v.price) : NaN;
        const hasVariantPrice = !isNaN(parsedVariantPrice) && parsedVariantPrice > 0;
        const variantPriceNumber = hasVariantPrice ? parsedVariantPrice : basePriceNumber;

        const updatedVariant: ProductVariant = {
          ...v,
          id: v.id || nanoid(),
          price: variantPriceNumber.toString(),
          stock: (parseInt(v.stock, 10) || 0).toString(),
          moq: v.moq || '1',
        };

        if (variantImageUrlMap[v.id]) {
          updatedVariant.image = variantImageUrlMap[v.id];
        }
        return updatedVariant;
      });

      await Promise.all(imagesToRemove.map(url => deleteImage(url)));

      const newImageUrls = await Promise.all(
        newImages.map((file, index) =>
          uploadImage(file, `products/${activeStore.id}/${productId}_${Date.now()}_${index}_${file.name}`)
        )
      );

      const productRef = doc(firestore, 'products', productId);

      let stockValue;
      if (!product.hasVariants) {
        if (product.manageStock) stockValue = parseInt(product.stock || '0', 10);
        else stockValue = product.isOutOfStock ? 0 : 999;
      } else {
        stockValue = 0;
      }

      const finalProductData = {
        ...product,
        status: 'published',
        price: basePriceNumber,
        regularPrice: product.regularPrice ? parseFloat(product.regularPrice) : null,
        stock: stockValue,
        moq: activeStore?.isMoqEnabled ? parseInt(product.moq || '1', 10) : null,
        images: [...product.images, ...newImageUrls],
        variants: product.hasVariants
          ? updatedVariants.map(v => ({
              ...v,
              price: parseFloat(v.price),
              stock: parseInt(v.stock),
              moq: activeStore?.isMoqEnabled && v.moq ? parseInt(v.moq, 10) : null,
            }))
          : [],
        slug: slugify(product.name),
        updatedAt: new Date(),
      };

      await updateDoc(productRef, finalProductData);

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

      toast({
        title: 'Product Updated!',
        description: `The product "${product.name}" has been successfully updated.`,
      });

      if (redirectUrl) router.push(redirectUrl);
      else router.push('/dashboard/products');
    } catch (error) {
      setIsDirty(true);
      toast({
        title: 'Update Failed',
        description: 'There was an error updating your product.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleHasVariantsChange = (checked: boolean) => {
    if (!product) return;
    setProduct({
      ...product,
      hasVariants: checked,
      variants:
        checked && product.variants.length === 0
          ? [{ id: nanoid(), name: '', price: product.price, stock: product.stock || '0', moq: '1' }]
          : product.variants,
    });
    setIsDirty(true);
  };

  const handleAddVariant = () => {
    if (!product) return;
    setProduct({
      ...product,
      variants: [
        ...product.variants,
        { id: nanoid(), name: '', price: product.price, stock: '0', moq: '1' },
      ],
    });
    setIsDirty(true);
  };

  const handleRemoveVariant = (id: string) => {
    if (!product) return;
    setProduct({
      ...product,
      variants: product.variants.filter(v => v.id !== id),
    });
    setNewVariantImages(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setVariantImagePreviews(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setIsDirty(true);
  };

  const handleVariantChange = (
    id: string,
    field: 'name' | 'price' | 'stock' | 'moq',
    value: string
  ) => {
    if (!product) return;
    setProduct({
      ...product,
      variants: product.variants.map(v => (v.id === id ? { ...v, [field]: value } : v)),
    });
    setIsDirty(true);
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !user || !activeStore || !firestore || !product) {
      toast({ title: 'Category name cannot be empty', variant: 'destructive' });
      return;
    }
    setIsCreatingCategory(true);
    try {
      await addDoc(collection(firestore, 'stores', activeStore.id, 'categories'), {
        name: newCategoryName.trim(),
        createdAt: new Date(),
      });
      toast({ title: 'Category Created!' });
      setProduct({ ...product, category: newCategoryName.trim() });
      setIsDirty(true);
      setNewCategoryName('');
      setIsCategoryDialogOpen(false);
    } catch (error) {
      toast({ title: 'Error creating category', variant: 'destructive' });
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleVariantImageChange = (
    variantId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewVariantImages(prev => ({ ...prev, [variantId]: file }));
      setVariantImagePreviews(prev => ({ ...prev, [variantId]: URL.createObjectURL(file) }));
      setIsDirty(true);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesSelected(e.dataTransfer.files);
  };

  if (isLoading || authLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!product) {
    return <div className="flex h-full items-center justify-center">Product not found.</div>;
  }

  const displayImages = product.images || [];
  const totalImageCount = displayImages.length + newImages.length;

  return (
    <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
      <div className="grid gap-6">
        <div className="animated-border-card">
          <Card>
            <CardHeader>
              <CardTitle>Edit Product</CardTitle>
              <CardDescription>Update the details for your product below.</CardDescription>
            </CardHeader>
            <CardContent>
              {/* No commerce access (pending / expired / no plan) — blocks all edits */}
              {isEditLocked && (
                <Alert variant="destructive" className="mb-6">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Subscription Required</AlertTitle>
                  <AlertDescription>{getCommerceAccessMessage(subscription)}</AlertDescription>
                </Alert>
              )}

              {/* Has access but archived product can't be restored due to product cap */}
              {!isEditLocked && isRestoreLocked && (
                <Alert variant="destructive" className="mb-6">
                  <Lock className="h-4 w-4" />
                  <AlertTitle>Product Limit Reached</AlertTitle>
                  <AlertDescription>
                    {'reason' in productAccess ? productAccess.reason : 'Upgrade to restore this product.'}
                  </AlertDescription>
                </Alert>
              )}

              <fieldset className="space-y-6" disabled={isSaving || isLocked}>
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name</Label>
                  <Input id="name" value={product.name} onChange={handleFieldChange} />
                </div>

                <div className="space-y-2">
                  <Label>Product Images</Label>
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={cn(
                      'p-4 border-2 rounded-lg transition-colors duration-200 min-h-[150px]',
                      isDragging ? 'border-primary bg-primary/5' : 'border-dashed border-gray-300'
                    )}
                  >
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                      {displayImages.map(url => (
                        <div key={url} className="relative group aspect-square">
                          <Image src={url} alt="Product image" fill className="object-cover rounded-md" />
                          <button
                            onClick={() => removeExistingImage(url)}
                            className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {newImages.map((file, index) => (
                        <div key={index} className="relative group aspect-square">
                          <Image
                            src={URL.createObjectURL(file)}
                            alt={`New image ${index + 1}`}
                            fill
                            className="object-cover rounded-md"
                          />
                          <button
                            onClick={() => removeNewImage(index)}
                            className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {totalImageCount < 5 && (
                        <Label
                          htmlFor="image-upload"
                          className="cursor-pointer text-center p-4 aspect-square flex items-center justify-center flex-col gap-1 border-2 border-dashed border-gray-300 rounded-md bg-gray-50 hover:bg-gray-100"
                        >
                          <UploadCloud className="h-8 w-8 text-gray-400" />
                          <span
                            className={cn(
                              'text-xs text-muted-foreground',
                              isDragging && 'text-primary font-semibold'
                            )}
                          >
                            {isDragging ? 'Drop to upload' : 'Click or drag'}
                          </span>
                        </Label>
                      )}
                    </div>
                  </div>
                  <Input
                    id="image-upload"
                    type="file"
                    className="sr-only"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                  />
                  <p className="text-xs text-muted-foreground">You can upload up to 5 images.</p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Product Video (Optional)
                    <Badge variant="default" className="bg-primary/10 text-primary border border-primary/20">
                      Beta
                    </Badge>
                  </Label>
                  <CloudinaryVideoUpload
                    onUpload={url => setProduct({ ...product, videoUrl: url })}
                    onRemove={() => setProduct({ ...product, videoUrl: '' })}
                    currentVideoUrl={product.videoUrl}
                    disabled={isSaving || isLocked}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Product Description</Label>
                  <div className="flex justify-between items-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span tabIndex={0}>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleGenerateDescription}
                              disabled={isGenerating}
                            >
                              <Sparkles className="mr-2 h-4 w-4" />
                              {isGenerating ? 'Generating...' : 'Generate with AI'}
                            </Button>
                          </span>
                        </TooltipTrigger>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Textarea
                    id="description"
                    value={product.description}
                    onChange={handleFieldChange}
                    className="min-h-[120px]"
                    placeholder="Write a few words about your product and let the AI polish it..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={product.category} onValueChange={handleCategoryChange}>
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.name}>
                            {cat.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="__CREATE_NEW__" className="font-bold text-primary">
                          Create new category...
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sellingStatus">Selling Status</Label>
                    <Select value={product.sellingStatus} onValueChange={handleStatusChange}>
                      <SelectTrigger id="sellingStatus">
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="best-seller">Best Seller</SelectItem>
                        <SelectItem value="new-arrival">New Arrival</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="animated-border-card">
                  <Card>
                    <CardHeader>
                      <CardTitle>Pricing & Inventory</CardTitle>
                      <CardDescription>Manage price and stock for your product.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="isOutOfStock"
                          checked={product.isOutOfStock}
                          onCheckedChange={checked => setProduct({ ...product, isOutOfStock: checked })}
                        />
                        <Label htmlFor="isOutOfStock">Mark as Out of Stock</Label>
                      </div>
                      <div className={product.isOutOfStock ? 'opacity-50' : ''}>
                        {!product.hasVariants ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="price">Selling Price (GHS)</Label>
                                  <Input
                                    id="price"
                                    type="number"
                                    value={product.price}
                                    onChange={handleFieldChange}
                                    disabled={product.isOutOfStock}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="regularPrice" className="text-muted-foreground">
                                    Regular Price
                                  </Label>
                                  <Input
                                    id="regularPrice"
                                    type="number"
                                    value={product.regularPrice || ''}
                                    onChange={handleFieldChange}
                                    disabled={product.isOutOfStock}
                                  />
                                </div>
                              </div>
                              {activeStore?.isMoqEnabled && (
                                <div className="space-y-2">
                                  <Label htmlFor="product-moq">Minimum Order Quantity (MOQ)</Label>
                                  <Input
                                    id="moq"
                                    type="number"
                                    min="1"
                                    value={product.moq || ''}
                                    onChange={handleFieldChange}
                                    disabled={product.isOutOfStock}
                                    placeholder="1"
                                  />
                                </div>
                              )}
                            </div>
                            <div className="space-y-4">
                              <div className="flex items-center space-x-2">
                                <Switch
                                  id="manage-stock"
                                  checked={product.manageStock}
                                  onCheckedChange={checked => setProduct({ ...product, manageStock: checked })}
                                />
                                <Label htmlFor="manage-stock">Manage stock</Label>
                              </div>

                              {product.manageStock && (
                                <div className="space-y-2">
                                  <Label htmlFor="stock">Stock Quantity</Label>
                                  <Input
                                    id="stock"
                                    type="number"
                                    value={product.stock}
                                    onChange={handleFieldChange}
                                    disabled={product.isOutOfStock}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="price">Default Selling Price (GHS)</Label>
                                <Input
                                  id="price"
                                  type="number"
                                  value={product.price}
                                  onChange={handleFieldChange}
                                  placeholder="e.g., 250.00"
                                  disabled={product.isOutOfStock}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="regularPrice" className="text-muted-foreground">
                                  Default Regular Price
                                </Label>
                                <Input
                                  id="regularPrice"
                                  type="number"
                                  value={product.regularPrice || ''}
                                  onChange={handleFieldChange}
                                  placeholder="Optional"
                                  disabled={product.isOutOfStock}
                                />
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              This is used if a variation doesn't have its own price.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 pt-6 border-t">
                        <Switch
                          id="has-variants"
                          checked={product.hasVariants}
                          onCheckedChange={handleHasVariantsChange}
                        />
                        <Label htmlFor="has-variants">
                          This product has variations (e.g. size, color)
                        </Label>
                      </div>

                      {product.hasVariants && (
                        <div className={product.isOutOfStock ? 'opacity-50' : ''}>
                          <div className="mt-6">
                            <h3 className="text-md font-medium mb-2">Variations</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                              Price and stock are managed for each variation individually.
                            </p>
                            <div className="space-y-4">
                              {product.variants.map(variant => (
                                <div key={variant.id} className="p-4 border rounded-md relative bg-muted/40">
                                  <div className="grid grid-cols-1 sm:grid-cols-[1fr,1fr,1fr,auto] gap-4 items-end">
                                    <div className="space-y-2">
                                      <Label htmlFor={`variant-name-${variant.id}`}>Name</Label>
                                      <Input
                                        id={`variant-name-${variant.id}`}
                                        placeholder="Red, Small"
                                        value={variant.name}
                                        onChange={e => handleVariantChange(variant.id, 'name', e.target.value)}
                                        disabled={product.isOutOfStock}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor={`variant-price-${variant.id}`}>Price</Label>
                                      <Input
                                        id={`variant-price-${variant.id}`}
                                        type="number"
                                        placeholder="Price"
                                        value={variant.price}
                                        onChange={e => handleVariantChange(variant.id, 'price', e.target.value)}
                                        disabled={product.isOutOfStock}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor={`variant-stock-${variant.id}`}>Stock</Label>
                                      <Input
                                        id={`variant-stock-${variant.id}`}
                                        type="number"
                                        placeholder="Stock"
                                        value={variant.stock}
                                        onChange={e => handleVariantChange(variant.id, 'stock', e.target.value)}
                                        disabled={product.isOutOfStock}
                                      />
                                    </div>
                                    {activeStore?.isMoqEnabled && (
                                      <div className="space-y-2">
                                        <Label htmlFor={`variant-moq-${variant.id}`}>MOQ</Label>
                                        <Input
                                          id={`variant-moq-${variant.id}`}
                                          type="number"
                                          min="1"
                                          placeholder="1"
                                          value={variant.moq || ''}
                                          onChange={e => handleVariantChange(variant.id, 'moq', e.target.value)}
                                          disabled={product.isOutOfStock}
                                        />
                                      </div>
                                    )}
                                    <div className="space-y-2 flex flex-col items-center">
                                      <Label className="mb-1">Image</Label>
                                      <Label
                                        htmlFor={`variant-image-${variant.id}`}
                                        className="cursor-pointer"
                                      >
                                        <div className="w-16 h-16 border-2 border-dashed rounded-md flex items-center justify-center bg-background hover:bg-accent/20">
                                          {variantImagePreviews[variant.id] || variant.image ? (
                                            <Image
                                              src={variantImagePreviews[variant.id] || variant.image!}
                                              alt={variant.name}
                                              width={64}
                                              height={64}
                                              className="object-cover rounded-md"
                                            />
                                          ) : (
                                            <ImagePlus className="h-6 w-6 text-muted-foreground" />
                                          )}
                                        </div>
                                      </Label>
                                      <Input
                                        id={`variant-image-${variant.id}`}
                                        type="file"
                                        accept="image/*"
                                        className="sr-only"
                                        onChange={e => handleVariantImageChange(variant.id, e)}
                                        disabled={product.isOutOfStock}
                                      />
                                    </div>
                                  </div>
                                  <div className="absolute -top-3 -right-3">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleRemoveVariant(variant.id)}
                                      disabled={product.variants.length <= 1 || product.isOutOfStock}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-4"
                              onClick={handleAddVariant}
                              disabled={product.isOutOfStock}
                            >
                              <PlusCircle className="mr-2 h-4 w-4" /> Add another variation
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </fieldset>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleUpdateProduct}
            size="lg"
            disabled={isSaving || authLoading || isLocked || !isDirty}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? 'Saving...' : product.status === 'draft' ? 'Publish Product' : 'Save Changes'}
          </Button>
        </div>
      </div>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Category</DialogTitle>
          <DialogDescription>Enter a name for your new product category.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="new-category-name" className="text-right">
              Name
            </Label>
            <Input
              id="new-category-name"
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              className="col-span-3"
              placeholder="e.g., T-Shirts"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateCategory} disabled={isCreatingCategory}>
            {isCreatingCategory && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}