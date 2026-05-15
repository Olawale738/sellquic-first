'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore } from '@/firebase';
import { collection, addDoc, onSnapshot, doc, deleteDoc, DocumentData } from 'firebase/firestore';
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
import { getAuth } from 'firebase/auth';

interface Category extends DocumentData {
    id: string;
    name: string;
}

export default function CategoriesPage() {
    const [newCategoryName, setNewCategoryName] = useState('');
    const [categories, setCategories] = useState<Category[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    const { user, activeStore, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const firestore = useFirestore();

    useEffect(() => {
        if (!user || !activeStore?.id || !firestore) {
            setLoading(false);
            setCategories([]);
            return;
        }

        const q = collection(firestore, 'stores', activeStore.id, 'categories');
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const categoriesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
            setCategories(categoriesData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching categories:", error);
            toast({ title: "Error fetching categories", variant: "destructive" });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, activeStore?.id, firestore]);

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) {
            toast({ title: "Category name cannot be empty", variant: "destructive" });
            return;
        }

        const storeId = activeStore?.id;
        if (!user || !storeId || !firestore) {
            toast({ title: "Store not ready, please try again", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        try {
            await addDoc(collection(firestore, 'stores', storeId, 'categories'), {
                name: newCategoryName,
                createdAt: new Date(),
            });

            const auth = getAuth();
            const token = await auth.currentUser?.getIdToken();
            await fetch('/api/cache/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ storeId })
            });

            toast({ title: "Category Added!", description: `"${newCategoryName}" has been added.` });
            setNewCategoryName('');
        } catch (error: any) {
            console.error("Error adding category:", error?.code, error?.message);
            toast({ title: "Failed to add category", description: error?.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteCategory = async (categoryId: string) => {
        const storeId = activeStore?.id;
        if (!user || !storeId || !firestore) return;
        try {
            await deleteDoc(doc(firestore, 'stores', storeId, 'categories', categoryId));
            
            const auth = getAuth();
            const token = await auth.currentUser?.getIdToken();
            await fetch('/api/cache/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ storeId })
            });

            toast({ title: "Category Deleted" });
        } catch (error: any) {
            console.error("Error deleting category:", error?.code, error?.message);
            toast({ title: "Failed to delete category", description: error?.message, variant: "destructive" });
        }
    };

    if (authLoading) return <p>Loading...</p>;
    if (!activeStore) return <p>Please select a store to manage categories.</p>;

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Add New Category</CardTitle>
                    <CardDescription>Create a new category for your products.</CardDescription>
                </CardHeader>
                <CardContent>
                    <fieldset className="space-y-4" disabled={isSaving}>
                        <div className="space-y-2">
                            <Label htmlFor="category-name">Category Name</Label>
                            <Input
                                id="category-name"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="e.g., Sneakers, T-Shirts"
                            />
                        </div>
                        <Button onClick={handleAddCategory} disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                            {isSaving ? 'Adding...' : 'Add Category'}
                        </Button>
                    </fieldset>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Your Categories</CardTitle>
                    <CardDescription>A list of your current product categories.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p>Loading categories...</p>
                    ) : categories.length > 0 ? (
                        <div className="space-y-2">
                            {categories.map(category => (
                                <div key={category.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                                    <span className="font-medium">{category.name}</span>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This will permanently delete this category.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteCategory(category.id)}>
                                                    Yes, delete
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-muted-foreground py-10 border-2 border-dashed rounded-lg">
                           <p>You haven't created any categories yet.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
