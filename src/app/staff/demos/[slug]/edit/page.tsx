
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Globe, Sparkles, Check, X, UploadCloud, Trash2, ImagePlus, Instagram, Facebook, Megaphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRequireStaff } from '@/hooks/use-auth';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, addDoc, deleteDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';

const TikTokIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.04-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
);

const SocialInput = ({ icon: Icon, id, value, onChange }: { icon: React.ElementType, id: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
    <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input id={id} placeholder={`${id}-username`} className="pl-10" value={value} onChange={onChange}/>
    </div>
);

const initialProductState = {
  name: '',
  price: '',
  compareAtPrice: '',
  description: '',
  images: [],
};

export default function EditDemoPage() {
    useRequireStaff();
    const { slug } = useParams();
    const [demo, setDemo] = useState<any>(null);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
    const [heroImagePreview, setHeroImagePreview] = useState<string | null>(null);

    const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any | null>(null);
    const [productFormData, setProductFormData] = useState<any>(initialProductState);
    const [productImageFiles, setProductImageFiles] = useState<File[]>([]);
    const [isSavingProduct, setIsSavingProduct] = useState(false);


    const firestore = useFirestore();
    const storage = getStorage();
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        if (!firestore || !slug) return;
        
        const demoRef = doc(firestore, 'demo_stores', slug as string);
        const unsubDemo = onSnapshot(demoRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setDemo(data);
                setLogoPreview(data.logoUrl);
                setHeroImagePreview(data.heroImageUrl);
            } else {
                toast({ title: "Demo not found", variant: 'destructive'});
                router.push('/staff/demos');
            }
        });

        const productsRef = collection(firestore, 'demo_stores', slug as string, 'products');
        const q = query(productsRef, orderBy('createdAt', 'desc'));
        const unsubProducts = onSnapshot(q, (snapshot) => {
            setProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });

        return () => {
            unsubDemo();
            unsubProducts();
        };
    }, [firestore, slug, router, toast]);

    const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setDemo((prev: any) => ({ ...prev, [id]: value }));
    };
    
    const handleSwitchChange = (id: string) => (checked: boolean) => {
        setDemo((prev: any) => ({ ...prev, [id]: checked }));
    };
    
    const handleSocialChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setDemo((prev: any) => ({ ...prev, socials: { ...prev.socials, [id]: value }}));
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fileSetter: Function, previewSetter: Function) => {
        if(e.target.files?.[0]) {
            const file = e.target.files[0];
            fileSetter(file);
            previewSetter(URL.createObjectURL(file));
        }
    }
    
    const handleProductFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setProductFormData((prev: any) => ({ ...prev, [e.target.id]: e.target.value }));
    };

    const handleProductImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            if(productImageFiles.length + productFormData.images.length + files.length > 3) {
                toast({ title: "You can upload a maximum of 3 images.", variant: 'destructive'});
                return;
            }
            setProductImageFiles(prev => [...prev, ...files]);
        }
    };
    
    const uploadImage = async (file: File, path: string) => {
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    }
    
    const handleOpenProductDialog = (product: any | null = null) => {
        if (product) {
            setEditingProduct(product);
            setProductFormData(product);
        } else {
            setEditingProduct(null);
            setProductFormData(initialProductState);
        }
        setProductImageFiles([]);
        setIsProductDialogOpen(true);
    };

    const handleSaveProduct = async () => {
        if (!firestore || !slug) return;
        setIsSavingProduct(true);
        try {
            const imageUrls = await Promise.all(
                productImageFiles.map((file) => uploadImage(file, `demo_assets/${slug}/products/${Date.now()}-${file.name}`))
            );

            const dataToSave = {
                ...productFormData,
                price: parseFloat(productFormData.price) || 0,
                compareAtPrice: parseFloat(productFormData.compareAtPrice) || null,
                images: [...productFormData.images, ...imageUrls],
                updatedAt: serverTimestamp(),
            };

            if (editingProduct) {
                const productRef = doc(firestore, 'demo_stores', slug as string, 'products', editingProduct.id);
                await updateDoc(productRef, dataToSave);
                toast({ title: "Product Updated!" });
            } else {
                const productsRef = collection(firestore, 'demo_stores', slug as string, 'products');
                await addDoc(productsRef, { ...dataToSave, createdAt: serverTimestamp() });
                toast({ title: "Product Added!" });
            }
            setIsProductDialogOpen(false);
        } catch (e) {
            console.error(e);
            toast({ title: "Error saving product", variant: "destructive" });
        } finally {
            setIsSavingProduct(false);
        }
    };
    
    const handleDeleteProduct = async (productId: string) => {
        if (!firestore || !slug) return;
        if (!confirm("Are you sure you want to delete this demo product?")) return;
        try {
            await deleteDoc(doc(firestore, 'demo_stores', slug as string, 'products', productId));
            toast({ title: "Product Deleted" });
        } catch (e) {
            toast({ title: "Error deleting product", variant: "destructive" });
        }
    };
    
    const handleSaveChanges = async () => {
        if (!firestore || !slug) return;
        setIsSaving(true);
        try {
            let logoUrl = demo.logoUrl;
            let heroImageUrl = demo.heroImageUrl;

            if (logoFile) logoUrl = await uploadImage(logoFile, `demo_assets/${slug}/logo`);
            if (heroImageFile) heroImageUrl = await uploadImage(heroImageFile, `demo_assets/${slug}/hero`);

            await updateDoc(doc(firestore, 'demo_stores', slug as string), {
                ...demo,
                logoUrl,
                heroImageUrl,
                updatedAt: serverTimestamp(),
            });
            toast({ title: "Demo Store Saved!" });
        } catch (e) {
            toast({ title: "Error saving demo", variant: 'destructive'});
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    }

    if (loading || !demo) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin h-8 w-8" /></div>;
    }
    
    return (
        <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>Editing Demo: {demo.name}</CardTitle>
                                <CardDescription>Slug: /demo/{demo.slug}</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch checked={demo.status === 'published'} onCheckedChange={(checked) => setDemo((prev: any) => ({ ...prev, status: checked ? 'published' : 'draft' }))} />
                                <Label>{demo.status === 'published' ? 'Published' : 'Draft'}</Label>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="grid lg:grid-cols-2 gap-6">
                        {/* Column 1 */}
                        <div className="space-y-6">
                            <Card>
                                <CardHeader><CardTitle>Branding</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Logo</Label>
                                        <div className="w-24 h-24 bg-muted rounded-full border-2 border-dashed flex items-center justify-center relative overflow-hidden">
                                            {logoPreview ? <Image src={logoPreview} alt="logo" fill className="object-cover"/> : <UploadCloud />}
                                            <Label htmlFor="logo-upload" className="absolute inset-0 cursor-pointer" />
                                            <Input id="logo-upload" type="file" className="sr-only" onChange={e => handleFileChange(e, setLogoFile, setLogoPreview)} />
                                        </div>
                                    </div>
                                     <div className="space-y-2">
                                        <Label htmlFor="brandColor">Brand Color</Label>
                                        <div className="relative">
                                            <Input id="brandColor" value={demo.brandColor || ''} onChange={handleFieldChange} className="pr-12" />
                                            <Input type="color" value={demo.brandColor || '#000000'} onChange={handleFieldChange} id="brandColor" className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 p-1 bg-transparent border-none cursor-pointer" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader><CardTitle>Social Links</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <SocialInput icon={Instagram} id="instagram" value={demo.socials?.instagram || ''} onChange={handleSocialChange} />
                                    <SocialInput icon={Facebook} id="facebook" value={demo.socials?.facebook || ''} onChange={handleSocialChange} />
                                    <SocialInput icon={TikTokIcon} id="tiktok" value={demo.socials?.tiktok || ''} onChange={handleSocialChange} />
                                </CardContent>
                            </Card>
                        </div>
                        {/* Column 2 */}
                        <div className="space-y-6">
                             <Card>
                                <CardHeader><CardTitle>Promotions</CardTitle></CardHeader>
                                <CardContent>
                                    <Collapsible open={demo.isPromoBarActive} onOpenChange={handleSwitchChange('isPromoBarActive')}>
                                        <div className="flex items-center space-x-2 mb-4">
                                            <Switch id="promo-active" checked={demo.isPromoBarActive} onCheckedChange={handleSwitchChange('isPromoBarActive')} />
                                            <Label htmlFor="promo-active" className="cursor-pointer">Show Promotional Bar</Label>
                                        </div>
                                        <CollapsibleContent className="space-y-2">
                                            <Label htmlFor="promoText">Promo Text</Label>
                                            <Input id="promoText" placeholder="e.g., Free shipping on all orders!" value={demo.promoText || ''} onChange={handleFieldChange} />
                                        </CollapsibleContent>
                                    </Collapsible>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader><CardTitle>Hero Banner</CardTitle></CardHeader>
                                <CardContent>
                                    <Collapsible open={demo.isHeroBannerActive} onOpenChange={handleSwitchChange('isHeroBannerActive')}>
                                        <div className="flex items-center space-x-2 mb-4">
                                            <Switch id="hero-active" checked={demo.isHeroBannerActive} onCheckedChange={handleSwitchChange('isHeroBannerActive')} />
                                            <Label htmlFor="hero-active" className="cursor-pointer">Show Hero Banner</Label>
                                        </div>
                                        <CollapsibleContent className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="heroHeadline">Headline Text</Label>
                                                <Input id="heroHeadline" placeholder="e.g., New Season Arrivals" value={demo.heroHeadline || ''} onChange={handleFieldChange} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="heroCtaText">Button Text</Label>
                                                <Input id="heroCtaText" placeholder="e.g., Shop Now" value={demo.heroCtaText || ''} onChange={handleFieldChange} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Background Image</Label>
                                                <div className="w-full aspect-video bg-muted rounded-md border-2 border-dashed flex items-center justify-center relative overflow-hidden">
                                                    {heroImagePreview ? <Image src={heroImagePreview} alt="banner" fill className="object-cover"/> : <UploadCloud />}
                                                    <Label htmlFor="hero-image-upload" className="absolute inset-0 cursor-pointer" />
                                                    <Input id="hero-image-upload" type="file" className="sr-only" onChange={e => handleFileChange(e, setHeroImageFile, setHeroImagePreview)} />
                                                </div>
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>
                                </CardContent>
                            </Card>
                        </div>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader className="flex flex-row justify-between items-center">
                        <div>
                            <CardTitle>Products</CardTitle>
                            <CardDescription>Manage the demo products for this store.</CardDescription>
                        </div>
                        <Button onClick={() => handleOpenProductDialog(null)}>Add Product</Button>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-lg">
                             <Table>
                                <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Price</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {products.map(p => (
                                        <TableRow key={p.id}>
                                            <TableCell className="font-medium flex items-center gap-2">
                                                <Image src={p.images?.[0] || 'https://placehold.co/40x40'} alt={p.name} width={40} height={40} className="rounded object-cover" />
                                                {p.name}
                                            </TableCell>
                                            <TableCell>GHS {p.price.toFixed(2)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" onClick={() => handleOpenProductDialog(p)}>Edit</Button>
                                                <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeleteProduct(p.id)}>Delete</Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                     {products.length === 0 && <TableRow><TableCell colSpan={3} className="text-center h-24">No products yet.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end">
                    <Button onClick={handleSaveChanges} disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Save Changes
                    </Button>
                </div>
            </div>

            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader><DialogTitle>{editingProduct ? 'Edit' : 'Add'} Product</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Name</Label>
                        <Input id="name" value={productFormData.name} onChange={handleProductFormChange} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="price" className="text-right">Price</Label>
                        <Input id="price" type="number" value={productFormData.price} onChange={handleProductFormChange} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="compareAtPrice" className="text-right">Compare Price</Label>
                        <Input id="compareAtPrice" type="number" value={productFormData.compareAtPrice} onChange={handleProductFormChange} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="description" className="text-right">Description</Label>
                        <Textarea id="description" value={productFormData.description} onChange={handleProductFormChange} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Images</Label>
                        <div className="col-span-3">
                            <div className="grid grid-cols-3 gap-2">
                                {productFormData.images.map((img: string, i: number) => (
                                    <div key={i} className="relative group">
                                        <Image src={img} alt="product" width={80} height={80} className="rounded object-cover" />
                                        <Button variant="destructive" size="icon" className="h-6 w-6 absolute -top-2 -right-2 hidden group-hover:flex" onClick={() => setProductFormData((p: any) => ({...p, images: p.images.filter((_: any, idx: number) => idx !== i)}))}><Trash2 className="h-3 w-3"/></Button>
                                    </div>
                                ))}
                                {productImageFiles.map((file, i) => (
                                     <div key={i} className="relative group">
                                        <Image src={URL.createObjectURL(file)} alt="product" width={80} height={80} className="rounded object-cover" />
                                        <Button variant="destructive" size="icon" className="h-6 w-6 absolute -top-2 -right-2 hidden group-hover:flex" onClick={() => setProductImageFiles(files => files.filter((_, idx) => idx !== i))}><Trash2 className="h-3 w-3"/></Button>
                                    </div>
                                ))}
                                {(productFormData.images.length + productImageFiles.length) < 3 && (
                                    <Label htmlFor="product-images" className="cursor-pointer w-20 h-20 border-2 border-dashed rounded flex items-center justify-center">
                                        <ImagePlus />
                                        <Input id="product-images" type="file" multiple accept="image/*" className="sr-only" onChange={handleProductImageChange} />
                                    </Label>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsProductDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSaveProduct} disabled={isSavingProduct}>
                         {isSavingProduct && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                         Save Product
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
