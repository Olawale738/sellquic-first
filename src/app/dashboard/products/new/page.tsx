'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, UploadCloud, X, Loader2, AlertCircle, PlusCircle, Trash2, ImagePlus, Save } from 'lucide-react';
import { generateDescription } from '@/ai/flows/generate-description-flow';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addDoc, collection, query, onSnapshot, DocumentData, where, doc, setDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  moq?: string;
}

interface Category extends DocumentData {
  id: string;
  name: string;
}

const initialState = {
  name: '',
  price: '',
  regularPrice: '',
  stock: '0',
  moq: '1',
  category: '',
  description: '',
  images: [] as File[],
  videoUrl: '',
  sellingStatus: 'none',
  hasVariants: false,
  variants: [{ id: nanoid(), name: '', price: '', stock: '', moq: '1' }],
  manageStock: false,
  isOutOfStock: false,
};

export default function NewProductPage() {
  const { user, activeStore, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const firestore = useFirestore();
  const storage = getStorage();
  const auth = getAuth();

  const [formData, setFormData] = useState(initialState);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [activeProductCount, setActiveProductCount] = useState(0);

  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const [newVariantImages, setNewVariantImages] = useState<Record<string, File>>({});
  const [variantImagePreviews, setVariantImagePreviews] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // ── Subscription / product-limit gate ─────────────────────────────────────
  const subscription = user?.subscription;
  const canManageProducts = hasCommerceAccess(subscription);
  const commerceAccessMessage = getCommerceAccessMessage(subscription);
  const productAccess = canCreateProduct({ subscription, activeProductCount });

  const draftKey = `draft_product_${activeStore?.id}`;

  // ── Draft persistence ─────────────────────────────────────────────────────
  useEffect(() => {
    if (activeStore) {
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        const draftData = JSON.parse(savedDraft);
        setFormData(prev => ({ ...prev, ...draftData, images: [] }));
        toast({ title: 'Draft Restored', description: 'Your unsaved product has been loaded.' });
      }
    }
  }, [activeStore, draftKey, toast]);

  useEffect(() => {
    if (activeStore && isDirty) {
      localStorage.setItem(draftKey, JSON.stringify({ ...formData, images: [] }));
    }
  }, [formData, activeStore, draftKey, isDirty]);

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

  // ── Categories + active product count ─────────────────────────────────────
  useEffect(() => {
    if (!user || !activeStore || !firestore) return;

    const catQuery = query(collection(firestore, 'stores', activeStore.id, 'categories'));
    const unsubCategories = onSnapshot(catQuery, querySnapshot => {
      setCategories(querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    });

    // Count active (non-archived) products to enforce per-plan caps
    const prodQuery = query(
      collection(firestore, 'products'),
      where('storeId', '==', activeStore.id)
    );
    const unsubProducts = onSnapshot(prodQuery, snapshot => {
      const count = snapshot.docs.filter(d => d.data().isArchived !== true).length;
      setActiveProductCount(count);
    });

    return () => {
      unsubCategories();
      unsubProducts();
    };
  }, [user, activeStore, firestore]);

  const handleFormChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const resetForm = () => {
    setFormData(initialState);
    setIsDirty(false);
  };

  const handleGenerateDescription = async () => {
    if (!user) return;
    if (!formData.description.trim()) {
      toast({ title: 'Please provide a draft description.' });
      return;
    }
    setIsGenerating(true);
    try {
      const result = await generateDescription({
        userId: user.uid,
        name: formData.name,
        price: formData.price,
        stock: formData.stock,
        draftDescription: formData.description,
      });
      handleFormChange('description', result.description);
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
    if (!files) return;
    const newFiles = Array.from(files);
    const imageSizeLimit = 5 * 1024 * 1024;
    if (newFiles.some(file => file.size > imageSizeLimit)) {
      toast({ title: 'Image too large', description: 'Please choose files under 5MB.', variant: 'destructive' });
      return;
    }
    if (newFiles.length + formData.images.length > 5) {
      toast({ title: 'Image Limit Exceeded (5 max)', variant: 'destructive' });
      return;
    }
    handleFormChange('images', [...formData.images, ...newFiles]);
    setIsDirty(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFilesSelected(e.target.files);
  };

  const removeImage = (index: number) => {
    handleFormChange('images', formData.images.filter((_, i) => i !== index));
    setIsDirty(true);
  };

  const uploadImage = async (file: File, path: string): Promise<string> => {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    return getDownloadURL(snapshot.ref);
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

  const handleAddProduct = async (
    navigateAway: boolean,
    status: 'draft' | 'published' = 'published'
  ) => {
    if (authLoading || !user || !activeStore || !firestore) return false;

    // ── ACCESS + LIMIT GATE — runs BEFORE any upload or Firestore write ─────
    const check = canCreateProduct({ subscription, activeProductCount });
    if (!check.allowed) {
      const limitHit = 'limitReached' in check && check.limitReached;
      toast({
        title: limitHit ? 'Product limit reached' : 'Subscription required',
        description: check.reason,
        variant: 'destructive',
      });
      if (!limitHit) {
        router.push('/dashboard/subscription');
      }
      return false;
    }

    // Validation
    const priceNumber = formData.price ? parseFloat(formData.price) : NaN;
    const defaultPriceIsValid = !isNaN(priceNumber) && priceNumber > 0;
    if (!formData.hasVariants && !defaultPriceIsValid && status === 'published') {
      toast({
        title: 'Price required',
        description: 'Please enter a valid selling price to publish.',
        variant: 'destructive',
      });
      return false;
    }

    setIsSaving(true);
    setIsDirty(false);

    try {
      const productDocRef = doc(collection(firestore, 'products'));
      const productSlug = `${slugify(formData.name)}-${nanoid(6)}`;

      const imageUrls = await Promise.all(
        formData.images.map((file, index) =>
          uploadImage(file, `products/${activeStore.id}/${productDocRef.id}_${index}_${file.name}`)
        )
      );

      const variantImageUploadPromises = Object.entries(newVariantImages).map(async ([variantId, file]) => {
        const imageUrl = await uploadImage(
          file,
          `products/${activeStore.id}/${productDocRef.id}_variant_${variantId}_${file.name}`
        );
        return { variantId, imageUrl };
      });
      const uploadedVariantImages = await Promise.all(variantImageUploadPromises);
      const variantImageUrlMap = uploadedVariantImages.reduce(
        (acc, { variantId, imageUrl }) => ({ ...acc, [variantId]: imageUrl }),
        {} as Record<string, string>
      );

      const variantsToSave = formData.hasVariants
        ? formData.variants.map((v: ProductVariant) => ({
            ...v,
            id: v.id || nanoid(),
            price: parseFloat(v.price) || priceNumber || 0,
            stock: parseInt(v.stock, 10) || 0,
            image: variantImageUrlMap[v.id] || null,
          }))
        : [];

      await setDoc(productDocRef, {
        sellerId: user.uid,
        storeId: activeStore.id,
        name: formData.name,
        slug: productSlug,
        description: formData.description,
        price: priceNumber || 0,
        regularPrice: formData.regularPrice ? parseFloat(formData.regularPrice) : null,
        stock: !formData.hasVariants
          ? formData.manageStock
            ? parseInt(formData.stock, 10)
            : formData.isOutOfStock
            ? 0
            : 999
          : 0,
        moq: activeStore?.isMoqEnabled ? parseInt(formData.moq || '1', 10) : null,
        manageStock: formData.manageStock,
        isOutOfStock: formData.isOutOfStock,
        category: formData.category,
        images: imageUrls,
        videoUrl: formData.videoUrl || null,
        sellingStatus: formData.sellingStatus,
        createdAt: new Date(),
        hasVariants: formData.hasVariants,
        variants: variantsToSave,
        isArchived: false,
        status: status,
      });

      localStorage.removeItem(draftKey);

      try {
        const token = await auth.currentUser?.getIdToken();
        await fetch('/api/cache/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ storeId: activeStore.id }),
        });
      } catch (e) {
        console.warn('Cache invalidation failed', e);
      }

      toast({
        title: `Product ${status === 'draft' ? 'saved as draft' : 'added'}!`,
        description: `"${formData.name}" has been successfully saved.`,
      });

      if (navigateAway) {
        router.push('/dashboard/products');
      } else {
        resetForm();
      }
      return true;
    } catch (error) {
      setIsDirty(true);
      toast({ title: 'Save Failed', variant: 'destructive' });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleHasVariantsChange = (checked: boolean) => {
    handleFormChange('hasVariants', checked);
    if (checked && formData.variants.length === 0) {
      handleFormChange('variants', [{ id: nanoid(), name: '', price: formData.price, stock: '0' }]);
    }
  };

  const handleAddVariant = () =>
    handleFormChange('variants', [
      ...formData.variants,
      { id: nanoid(), name: '', price: formData.price, stock: '0' },
    ]);
  const handleRemoveVariant = (id: string) =>
    handleFormChange('variants', formData.variants.filter((v: ProductVariant) => v.id !== id));
  const handleVariantChange = (id: string, field: 'name' | 'price' | 'stock', value: string) => {
    handleFormChange(
      'variants',
      formData.variants.map((v: ProductVariant) => (v.id === id ? { ...v, [field]: value } : v))
    );
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !user || !activeStore || !firestore) {
      toast({ title: 'Category name required', variant: 'destructive' });
      return;
    }
    setIsCreatingCategory(true);
    try {
      await addDoc(collection(firestore, 'stores', activeStore.id, 'categories'), {
        name: newCategoryName.trim(),
        createdAt: new Date(),
      });
      toast({ title: 'Category Created!' });
      handleFormChange('category', newCategoryName.trim());
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
      const imageSizeLimit = 5 * 1024 * 1024;
      if (file.size > imageSizeLimit) {
        toast({ title: 'Image too large', variant: 'destructive' });
        return;
      }
      setNewVariantImages(prev => ({ ...prev, [variantId]: file }));
      setVariantImagePreviews(prev => ({ ...prev, [variantId]: URL.createObjectURL(file) }));
      setIsDirty(true);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!activeStore) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground">Please create or select a store.</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/stores">Manage Stores</Link>
        </Button>
      </div>
    );
  }

  // Disable the form when there's no access OR the per-plan limit is reached
  const formDisabled = isSaving || !productAccess.allowed;
  const buttonsDisabled = isSaving || authLoading || !productAccess.allowed;

  return (
    <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
      <div className="grid gap-6">
        <div className="animated-border-card">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Add New Product</CardTitle>
                  <CardDescription>
                    Fill out the details below to add a new product to your store.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* No commerce access at all */}
              {!canManageProducts && (
                <Alert className="mb-6 bg-amber-50 border-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800">Choose a plan to list products</AlertTitle>
                  <AlertDescription className="text-amber-700">
                    {commerceAccessMessage}
                  </AlertDescription>
                  <div className="mt-4">
                    <Button asChild>
                      <Link href="/dashboard/subscription">View Plans</Link>
                    </Button>
                  </div>
                </Alert>
              )}

              {/* Has access but per-plan product cap reached (Starter / legacy free) */}
              {canManageProducts && !productAccess.allowed && (
                <Alert className="mb-6 bg-amber-50 border-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800">Product limit reached</AlertTitle>
                  <AlertDescription className="text-amber-700">
                    {'reason' in productAccess ? productAccess.reason : ''}
                  </AlertDescription>
                  <div className="mt-4">
                    <Button asChild>
                      <Link href="/dashboard/subscription">Upgrade Plan</Link>
                    </Button>
                  </div>
                </Alert>
              )}

              <fieldset disabled={formDisabled} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="product-name">Product Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Classic Leather Sneakers"
                    value={formData.name}
                    onChange={e => handleFormChange('name', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Product Images</Label>
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={cn(
                      'p-4 border-2 rounded-lg transition-colors duration-200',
                      isDragging ? 'border-primary bg-primary/5' : 'border-dashed border-gray-300'
                    )}
                  >
                    <div
                      className={cn(
                        'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4',
                        formData.images.length > 0 && 'mb-4'
                      )}
                    >
                      {formData.images.map((file: File, index: number) => (
                        <div key={index} className="relative group aspect-square">
                          <Image
                            src={URL.createObjectURL(file)}
                            alt={`Product image ${index + 1}`}
                            fill
                            className="object-cover rounded-md"
                          />
                          <button
                            onClick={() => removeImage(index)}
                            className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    {formData.images.length < 5 && (
                      <Label
                        htmlFor="image-upload"
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <UploadCloud className="w-8 h-8 mb-4 text-gray-500" />
                          {isDragging ? (
                            <p className="mb-2 text-sm text-primary font-semibold">Drop to upload</p>
                          ) : (
                            <>
                              <p className="mb-2 text-sm text-gray-500">
                                <span className="font-semibold">Click to upload</span> or drag and drop
                              </p>
                              <p className="text-xs text-gray-500">PNG, JPG, WEBP up to 5MB</p>
                            </>
                          )}
                        </div>
                        <Input
                          id="image-upload"
                          type="file"
                          className="hidden"
                          accept="image/*"
                          multiple
                          onChange={handleImageChange}
                        />
                      </Label>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You can upload up to 5 images. The first is the main image.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Product Video (Optional){' '}
                    <Badge variant="default" className="bg-primary/10 text-primary border border-primary/20">
                      Beta
                    </Badge>
                  </Label>
                  <CloudinaryVideoUpload
                    onUpload={url => handleFormChange('videoUrl', url)}
                    onRemove={() => handleFormChange('videoUrl', '')}
                    currentVideoUrl={formData.videoUrl}
                    disabled={formDisabled}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="product-description">Product Description</Label>
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
                    placeholder="Write a few words about your product..."
                    value={formData.description}
                    onChange={e => handleFormChange('description', e.target.value)}
                    className="min-h-[120px]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="product-category">Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={value => {
                        if (value === '__CREATE_NEW__') setIsCategoryDialogOpen(true);
                        else handleFormChange('category', value);
                      }}
                    >
                      <SelectTrigger id="product-category">
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
                    <Label htmlFor="selling-status">Selling Status</Label>
                    <Select
                      value={formData.sellingStatus}
                      onValueChange={value => handleFormChange('sellingStatus', value)}
                    >
                      <SelectTrigger id="selling-status">
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
                          checked={formData.isOutOfStock}
                          onCheckedChange={checked => handleFormChange('isOutOfStock', checked)}
                        />
                        <Label htmlFor="isOutOfStock">Mark as Out of Stock</Label>
                      </div>
                      <div className={formData.isOutOfStock ? 'opacity-50' : ''}>
                        {!formData.hasVariants ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="price">Selling Price (GHS)</Label>
                                  <Input
                                    id="price"
                                    type="number"
                                    value={formData.price}
                                    onChange={e => handleFormChange('price', e.target.value)}
                                    disabled={formData.isOutOfStock}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="regularPrice" className="text-muted-foreground">
                                    Regular Price
                                  </Label>
                                  <Input
                                    id="regularPrice"
                                    type="number"
                                    value={formData.regularPrice}
                                    onChange={e => handleFormChange('regularPrice', e.target.value)}
                                    disabled={formData.isOutOfStock}
                                  />
                                </div>
                              </div>
                              {activeStore?.isMoqEnabled && (
                                <div className="space-y-2">
                                  <Label htmlFor="product-moq">Minimum Order Quantity (MOQ)</Label>
                                  <Input
                                    id="product-moq"
                                    type="number"
                                    min="1"
                                    value={formData.moq}
                                    onChange={e => handleFormChange('moq', e.target.value)}
                                    disabled={formData.isOutOfStock}
                                    placeholder="1"
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Customers must order at least this many units
                                  </p>
                                </div>
                              )}
                            </div>
                            <div className="space-y-4">
                              <div className="flex items-center space-x-2">
                                <Switch
                                  id="manageStock"
                                  checked={formData.manageStock}
                                  onCheckedChange={checked => handleFormChange('manageStock', checked)}
                                  disabled={formData.isOutOfStock}
                                />
                                <Label htmlFor="manageStock">Manage stock</Label>
                              </div>
                              {formData.manageStock && (
                                <div className="space-y-2">
                                  <Label htmlFor="stock">Stock Quantity</Label>
                                  <Input
                                    id="stock"
                                    type="number"
                                    value={formData.stock}
                                    onChange={e => handleFormChange('stock', e.target.value)}
                                    disabled={formData.isOutOfStock}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="price">Default Selling Price</Label>
                                <Input
                                  id="price"
                                  type="number"
                                  value={formData.price}
                                  onChange={e => handleFormChange('price', e.target.value)}
                                  disabled={formData.isOutOfStock}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="regularPrice" className="text-muted-foreground">
                                  Default Regular Price
                                </Label>
                                <Input
                                  id="regularPrice"
                                  type="number"
                                  value={formData.regularPrice}
                                  onChange={e => handleFormChange('regularPrice', e.target.value)}
                                  disabled={formData.isOutOfStock}
                                />
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              This is used if a variation doesn't have its own price.
                            </p>
                          </div>
                        )}

                        <div className="flex items-center space-x-2 pt-6 border-t">
                          <Switch
                            id="hasVariants"
                            checked={formData.hasVariants}
                            onCheckedChange={handleHasVariantsChange}
                          />
                          <Label htmlFor="hasVariants">
                            This product has variations (e.g. size, color)
                          </Label>
                        </div>
                        {formData.hasVariants && (
                          <div className={formData.isOutOfStock ? 'opacity-50' : ''}>
                            <div className="mt-6">
                              <h3 className="text-md font-medium mb-2">Variations</h3>
                              <p className="text-sm text-muted-foreground mb-4">
                                Price and stock are managed for each variation.
                              </p>
                              <div className="space-y-4">
                                {formData.variants.map((variant: ProductVariant) => (
                                  <div key={variant.id} className="p-4 border rounded-md relative bg-muted/40">
                                    <div className="grid grid-cols-1 sm:grid-cols-[1fr,1fr,1fr,auto] gap-4 items-end">
                                      <div className="space-y-2">
                                        <Label htmlFor={`variant-name-${variant.id}`}>Name</Label>
                                        <Input
                                          id={`variant-name-${variant.id}`}
                                          placeholder="Red, Small"
                                          value={variant.name}
                                          onChange={e => handleVariantChange(variant.id, 'name', e.target.value)}
                                          disabled={formData.isOutOfStock}
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
                                          disabled={formData.isOutOfStock}
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
                                          disabled={formData.isOutOfStock}
                                        />
                                      </div>
                                      <div className="space-y-2 flex flex-col items-center">
                                        <Label className="mb-1">Image</Label>
                                        <Label htmlFor={`variant-image-${variant.id}`} className="cursor-pointer">
                                          <div className="w-16 h-16 border-2 border-dashed rounded-md flex items-center justify-center bg-background hover:bg-accent/20">
                                            {variantImagePreviews[variant.id] ? (
                                              <Image
                                                src={variantImagePreviews[variant.id]}
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
                                          disabled={formData.isOutOfStock}
                                        />
                                      </div>
                                    </div>
                                    <div className="absolute -top-3 -right-3">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemoveVariant(variant.id)}
                                        disabled={formData.variants.length <= 1 || formData.isOutOfStock}
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
                                disabled={formData.isOutOfStock}
                              >
                                <PlusCircle className="mr-2 h-4 w-4" /> Add another variation
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </fieldset>
            </CardContent>
          </Card>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            onClick={() => handleAddProduct(false, 'draft')}
            size="lg"
            variant="secondary"
            disabled={buttonsDisabled}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Save as Draft
          </Button>
          <Button
            onClick={() => handleAddProduct(true, 'published')}
            size="lg"
            disabled={buttonsDisabled}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Publish Product
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