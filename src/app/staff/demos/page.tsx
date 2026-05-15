
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, MoreHorizontal, Edit, Trash2, Copy, Eye } from 'lucide-react';
import Link from 'next/link';
import { collection, onSnapshot, doc, deleteDoc, DocumentData, Timestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useRequireStaff } from '@/hooks/use-auth';
import { formatDistanceToNow } from 'date-fns';
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
import { Badge } from '@/components/ui/badge';

interface DemoStore extends DocumentData {
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'published';
  createdAt: Timestamp;
}

export default function DemosPage() {
  useRequireStaff();
  const [demos, setDemos] = useState<DemoStore[]>([]);
  const [loading, setLoading] = useState(true);
  const firestore = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    if (!firestore) return;
    const unsub = onSnapshot(collection(firestore, 'demo_stores'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DemoStore));
      data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setDemos(data);
      setLoading(false);
    });
    return () => unsub();
  }, [firestore]);

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/demo/${slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link Copied!", description: "The public demo link has been copied." });
  };

  const handleDelete = async (slug: string) => {
    if (!firestore) return;
    try {
        // TODO: Also delete subcollections (products)
        await deleteDoc(doc(firestore, 'demo_stores', slug));
        toast({ title: "Demo Deleted" });
    } catch (e) {
        toast({ title: "Error deleting demo", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Demo Stores</CardTitle>
            <CardDescription>Create and manage demo stores to show to potential clients.</CardDescription>
          </div>
          <Button asChild>
            <Link href="/staff/demos/new"><PlusCircle className="h-4 w-4 mr-2" />Create Demo</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <p>Loading...</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demos.length > 0 ? demos.map(demo => (
                <TableRow key={demo.id}>
                  <TableCell className="font-medium">{demo.name}</TableCell>
                  <TableCell>
                    <Badge variant={demo.status === 'published' ? 'default' : 'secondary'}>
                        {demo.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{demo.createdAt ? formatDistanceToNow(demo.createdAt.toDate(), { addSuffix: true }) : 'N/A'}</TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild><Link href={`/demo/${demo.slug}`} target="_blank"><Eye className="h-4 w-4 mr-2" /> Preview</Link></DropdownMenuItem>
                            <DropdownMenuItem asChild><Link href={`/staff/demos/${demo.slug}/edit`}><Edit className="h-4 w-4 mr-2" /> Edit</Link></DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyLink(demo.slug)}><Copy className="h-4 w-4 mr-2" /> Copy Link</DropdownMenuItem>
                            <AlertDialogTrigger asChild><DropdownMenuItem className="text-red-500"><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem></AlertDialogTrigger>
                          </DropdownMenuContent>
                        </DropdownMenu>
                         <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete "{demo.name}"?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(demo.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              )) : (
                 <TableRow><TableCell colSpan={4} className="text-center h-24">No demo stores created yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
