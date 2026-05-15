
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { canCreateMultipleStores } from '@/lib/subscription-access';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { PlusCircle, Building, Loader2, MoreHorizontal, Trash2 } from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { doc, deleteDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

export default function ManageStoresPage() {
    const { user, stores, loading, activeStore, setActiveStore } = useAuth();
    // Anyone can create their first store; only Growth can add a second+.
const canAddAnotherStore =
stores.length === 0 || canCreateMultipleStores(user?.subscription);
    const [isSwitching, setIsSwitching] = useState(false);
    const { toast } = useToast();
    const firestore = useFirestore();

    const handleSwitchStore = (store: any) => {
        setIsSwitching(true);
        setActiveStore(store);
        setTimeout(() => setIsSwitching(false), 500);
    }
    
    const handleDeleteStore = async (storeId: string) => {
        if (activeStore?.id === storeId) {
            setActiveStore(null);
        }
        
        try {
            if (!firestore) return;
            const batch = writeBatch(firestore);

            // 1. Delete Products associated with the store
            const productsQuery = query(collection(firestore, "products"), where("storeId", "==", storeId));
            const productsSnapshot = await getDocs(productsQuery);
            productsSnapshot.forEach(doc => batch.delete(doc.ref));

            // 2. Delete Orders associated with the store
            const ordersQuery = query(collection(firestore, "orders"), where("storeId", "==", storeId));
            const ordersSnapshot = await getDocs(ordersQuery);
            ordersSnapshot.forEach(doc => batch.delete(doc.ref));
            
            // 3. Delete Deliveries subcollection
            const deliveriesQuery = query(collection(firestore, "stores", storeId, "deliveries"));
            const deliveriesSnapshot = await getDocs(deliveriesQuery);
            deliveriesSnapshot.forEach(doc => batch.delete(doc.ref));

            // 4. Delete Categories subcollection
            const categoriesQuery = query(collection(firestore, "stores", storeId, "categories"));
            const categoriesSnapshot = await getDocs(categoriesQuery);
            categoriesSnapshot.forEach(doc => batch.delete(doc.ref));

            // 5. Delete the Store document itself
            const storeRef = doc(firestore, 'stores', storeId);
            batch.delete(storeRef);
            
            await batch.commit();

            toast({
                title: "Store Deleted",
                description: "The store and all its data have been permanently removed.",
            });
        } catch (error) {
            console.error("Error deleting store and its data:", error);
            toast({
                title: "Deletion Failed",
                description: "There was a problem deleting the store.",
                variant: "destructive",
            });
        }
    };


    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Manage Your Stores</h1>
                    <p className="text-muted-foreground">Switch between your stores or create a new one.</p>
                </div>
                {canAddAnotherStore ? (
  <Button asChild>
    <Link href="/dashboard/stores/new">
      <PlusCircle className="mr-2 h-4 w-4" />
      Create New Store
    </Link>
  </Button>
) : (
  <Button asChild variant="secondary">
    <Link href="/dashboard/subscription">
      <PlusCircle className="mr-2 h-4 w-4" />
      Upgrade for Multi-Store
    </Link>
  </Button>
)}
            </div>
            {loading ? (
                <div className="flex items-center justify-center p-10">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : stores.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {stores.map(store => (
                       <AlertDialog key={store.id}>
                         <Card className="flex flex-col">
                            <CardHeader>
                               <div className="flex justify-between items-start">
                                 <CardTitle className="flex items-center gap-2">
                                    <Building className="h-5 w-5" />
                                    {store.name}
                                </CardTitle>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem className="text-red-600">
                                                <Trash2 className="mr-2 h-4 w-4" /> Delete Store
                                            </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                               </div>
                                <CardDescription>@{store.subdomain}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow" />
                            <CardFooter>
                                {activeStore?.id === store.id ? (
                                    <Button disabled className="w-full">
                                        Currently Active
                                    </Button>
                                ) : (
                                    <Button 
                                        variant="outline" 
                                        className="w-full" 
                                        onClick={() => handleSwitchStore(store)}
                                        disabled={isSwitching}
                                    >
                                        {isSwitching ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Switch to this Store'}
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                         <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the store "{store.name}", along with all of its products, orders, and settings.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteStore(store.id)}>
                                    Yes, Delete Store
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                       </AlertDialog>
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 border-2 border-dashed rounded-lg">
                    <Building className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">No stores created yet</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Get started by creating your first store.</p>
                    <Button asChild className="mt-6">
                        <Link href="/dashboard/stores/new">Create New Store</Link>
                    </Button>
                </div>
            )}
        </div>
    );
}
