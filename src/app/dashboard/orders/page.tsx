
'use client';

import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  collection,
  query,
  where,
  onSnapshot,
  DocumentData,
  Timestamp,
  doc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { format } from 'date-fns';
import { ChevronDown, Trash2, Copy, CreditCard, Download } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { cn } from '@/lib/utils';
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

type OrderStatus = 'awaiting-payment' | 'pending' | 'confirmed' | 'fulfilled';

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  image: string | null;
}

interface CustomerInfo {
  name: string;
  phone: string;
  address: string;
}

interface Order extends DocumentData {
  id: string;
  items: OrderItem[];
  customerInfo: CustomerInfo;
  totalAmount: number;
  status: OrderStatus;
  createdAt: Timestamp;
  paymentReference: string;
  selectedPaymentMethod?: 'paystack' | 'momo' | 'cod';
  orderNote?: string;
}

function toDateSafe(timestamp: any): Date | null {
  if (!timestamp) return null;
  // Firestore Timestamp (from server or client)
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  // ISO String (from JSON serialization)
  if (typeof timestamp === 'string') {
    const d = new Date(timestamp);
    return isNaN(d.getTime()) ? null : d;
  }
  // { seconds, nanoseconds } map (from older Firestore Admin SDK serialization)
  if (typeof timestamp.seconds === 'number') {
    return new Date(timestamp.seconds * 1000);
  }
  return null;
}

// FIX: Handle undefined status
const getStatusVariant = (
    status?: string
  ): 'destructive' | 'secondary' | 'default' | 'outline' => {
    if (!status) return 'outline';
    switch (status) {
      case 'awaiting-payment':
        return 'destructive';
      case 'pending':
        return 'secondary';
      case 'confirmed':
        return 'default';
      case 'fulfilled':
        return 'default';
      default:
        return 'outline';
    }
};
  
// FIX: Handle undefined status
const getStatusLabel = (status?: string) => {
    if (!status) return 'Unknown Status';
    return status.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

const OrderRowActions = ({ order }: { order: Order }) => {
    const { toast } = useToast();
    const firestore = useFirestore();

    const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
        if (!firestore) return;
        const orderRef = doc(firestore, 'orders', orderId);
        try {
        await updateDoc(orderRef, { status: newStatus });
        toast({
            title: 'Order Updated',
            description: `Order status changed to ${newStatus}.`,
        });
        } catch (error) {
        console.error('Error updating order status: ', error);
        toast({
            title: 'Update Failed',
            description: 'Could not update the order status.',
            variant: 'destructive',
        });
        }
    };
    
    const handleDeleteOrder = async (orderId: string) => {
        if (!firestore) return;
        const orderRef = doc(firestore, 'orders', orderId);
        try {
        await deleteDoc(orderRef);
        toast({
            title: 'Order Deleted',
            description: 'The order has been permanently deleted.',
        });
        } catch (error) {
        console.error('Error deleting order: ', error);
        toast({
            title: 'Delete Failed',
            description: 'Could not delete the order.',
            variant: 'destructive',
        });
        }
    };

    const orderDate = toDateSafe(order.createdAt);

    return (
        <div className="grid gap-6 py-4 px-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                <h3 className="font-semibold mb-2">Customer & Order Details</h3>
                <div className="text-sm space-y-1">
                    <p><span className="font-medium">Name:</span> {order.customerInfo?.name || 'N/A'}</p>
                    <p><span className="font-medium">Phone:</span> {order.customerInfo?.phone || 'N/A'}</p>
                    <p><span className="font-medium">Date:</span> {orderDate ? format(orderDate, 'PPp') : 'N/A'}</p>
                    <p><span className="font-medium">Address:</span> {order.customerInfo?.address || 'N/A'}</p>
                    {order.orderNote && (
                        <div className="pt-2 mt-2 border-t">
                            <p className="font-medium">Customer Note:</p>
                            <p className="text-muted-foreground whitespace-pre-wrap">{order.orderNote}</p>
                        </div>
                    )}
                </div>
                </div>
                <div>
                <h3 className="font-semibold mb-2">Payment & Actions</h3>
                <div className="text-sm space-y-2 bg-background p-3 rounded-md border">
                    <div className='flex justify-between items-center'>
                        <span className="font-medium">Total:</span> 
                        <span className="font-bold text-lg">GH₵{typeof order.totalAmount === 'number' ? order.totalAmount.toFixed(2) : '0.00'}</span>
                    </div>
                    <div className='flex justify-between items-center'>
                        <span className="font-medium">Status:</span>{' '}
                        <Badge variant={getStatusVariant(order.status)} className="capitalize">{getStatusLabel(order.status)}</Badge>
                    </div>
                     <div className='flex justify-between items-center'>
                        <span className="font-medium">Payment Method:</span>
                        <Badge variant="outline" className="capitalize flex items-center gap-1">
                            <CreditCard className="h-3 w-3" />
                            {order.selectedPaymentMethod === 'cod' ? 'Cash on Delivery' : (order.selectedPaymentMethod === 'paystack' ? 'Paystack' : 'Manual MoMo')}
                        </Badge>
                    </div>
                    <div className='flex justify-between items-center'>
                    <span className="font-medium">Ref:</span>
                    <span className="font-mono font-bold tracking-wider bg-primary/10 text-primary-foreground p-1 rounded-sm text-black text-xs truncate max-w-[150px]">
                        {order.paymentReference || 'N/A'}
                    </span>
                    </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" disabled={order.status === 'confirmed' || order.status === 'fulfilled'} onClick={() => handleStatusChange(order.id, 'confirmed')}>
                        Mark Paid
                    </Button>
                    <Button size="sm" variant="outline" disabled={order.status === 'fulfilled' || order.status !== 'confirmed'} onClick={() => handleStatusChange(order.id, 'fulfilled')}>
                        Mark Delivered
                    </Button>
                    <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" className="ml-auto">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteOrder(order.id)}>
                            Delete
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                    </AlertDialog>
                </div>
                </div>
            </div>

            <div>
                <h3 className="font-semibold mb-2">Items Ordered</h3>
                <div className="space-y-2">
                {order.items && order.items.length > 0 ? (
                    order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-2 border rounded-md bg-background">
                        <Image src={item.image || 'https://placehold.co/100x100'} alt={item.productName} width={50} height={50} className="rounded-md object-cover"/>
                        <div className="flex-1">
                        <p className="font-medium text-sm">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                        </div>
                        <p className="font-semibold text-sm">GH₵{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                    ))
                ) : <p className="text-sm text-muted-foreground">No item details available.</p>}
                </div>
            </div>
        </div>
    )
};


const OrderRow = ({ order }: { order: Order }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const getItemSummary = (items: OrderItem[]): string => {
    if (!items || items.length === 0) return 'No items';
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    if (items.length === 1) return `${items[0].productName} (x${items[0].quantity})`;
    return `${items.length} products, ${totalItems} total`;
  };

  return (
    <Collapsible asChild key={order.id} open={isOpen} onOpenChange={setIsOpen}>
      <>
        <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setIsOpen(!isOpen)}>
          <TableCell className="font-medium">{order.customerInfo?.name || 'Guest'}</TableCell>
          <TableCell className="max-w-[200px] truncate">{getItemSummary(order.items)}</TableCell>
          <TableCell><Badge variant={getStatusVariant(order.status)} className="capitalize">{getStatusLabel(order.status)}</Badge></TableCell>
          <TableCell className="text-right">GH₵{typeof order.totalAmount === 'number' ? order.totalAmount.toFixed(2) : '0.00'}</TableCell>
          <TableCell className="text-right w-[50px]">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
              </Button>
            </CollapsibleTrigger>
          </TableCell>
        </TableRow>
        <CollapsibleContent asChild>
            <tr className="bg-muted/30">
                <TableCell colSpan={6} className="p-0 border-b">
                    <OrderRowActions order={order} />
                </TableCell>
            </tr>
        </CollapsibleContent>
      </>
    </Collapsible>
  );
};


const OrderCard = ({ order }: { order: Order }) => {
    const [isOpen, setIsOpen] = React.useState(false);

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="animated-border-card bg-white">
            <div className="p-4 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                <div className="flex justify-between items-center mb-2">
                    <p className="font-semibold truncate pr-2">{order.customerInfo?.name || 'Guest'}</p>
                    <span className="font-bold text-lg">GH₵{typeof order.totalAmount === 'number' ? order.totalAmount.toFixed(2) : '0.00'}</span>
                </div>
                <div className="flex justify-between items-center">
                    <Badge variant={getStatusVariant(order.status)} className="capitalize text-xs">{getStatusLabel(order.status)}</Badge>
                     <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                        <span>{isOpen ? 'Close' : 'Details'}</span>
                        <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')}/>
                    </div>
                </div>
            </div>
            <CollapsibleContent className="border-t">
                <OrderRowActions order={order} />
            </CollapsibleContent>
        </Collapsible>
    )
}

export default function OrdersPage() {
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { user, activeStore } = useAuth();
  const { toast } = useToast();
  const firestore = useFirestore();

  React.useEffect(() => {
    if (!user || !activeStore || !firestore) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(firestore, 'orders'),
      where('storeId', '==', activeStore.id)
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const ordersData = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return { id: doc.id, ...data } as Order;
        });
        
        ordersData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        setOrders(ordersData);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching orders:', error);
        toast({
          title: 'Error',
          description: 'Could not fetch orders.',
          variant: 'destructive',
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, activeStore, toast, firestore]);
  
  const handleExport = () => {
    if (orders.length === 0) {
      toast({ title: 'No orders to export.' });
      return;
    }

    // Define headers for the CSV
    const headers = [
      'OrderReference', 'Date', 'CustomerName', 'CustomerPhone',
      'CustomerAddress', 'TotalAmount', 'Status', 'Items'
    ];

    // Convert order data to CSV rows
    const csvRows = orders.map(order => {
      const orderDateObj = toDateSafe(order.createdAt);
      const orderDate = orderDateObj ? format(orderDateObj, 'yyyy-MM-dd HH:mm:ss') : 'N/A';
      const itemsSummary = order.items.map(item => `${item.productName} (x${item.quantity})`).join('; ');
      
      return [
        order.paymentReference,
        orderDate,
        order.customerInfo?.name || '',
        order.customerInfo?.phone || '',
        `"${(order.customerInfo?.address || '').replace(/"/g, '""')}"`, // Handle commas in address
        order.totalAmount.toFixed(2),
        order.status,
        `"${itemsSummary.replace(/"/g, '""')}"`
      ].join(',');
    });

    // Combine headers and rows
    const csvString = [headers.join(','), ...csvRows].join('\n');

    // Create and download the file
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `orders-export-${activeStore?.name}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>Orders</CardTitle>
            <CardDescription>
              Manage incoming orders.
            </CardDescription>
        </div>
        <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
        </Button>
      </CardHeader>
      <CardContent className="p-0 sm:p-6">

        {/* Mobile View */}
        <div className="sm:hidden px-4 pb-4">
             {loading ? (
                <p className="text-center text-muted-foreground py-10">Loading...</p>
             ) : orders.length > 0 ? (
                <div className="space-y-4">
                    {orders.map(order => <OrderCard key={order.id} order={order} />)}
                </div>
             ) : (
                <div className="text-center py-10 border-2 border-dashed rounded-lg bg-muted/20">
                    <p className="text-muted-foreground">No orders yet.</p>
                </div>
             )}
        </div>

        {/* Desktop View */}
        <div className="hidden sm:block">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-[50px]"></TableHead>
                </TableRow>
            </TableHeader>
            
            <TableBody>

            {loading ? (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center h-24">Loading...</TableCell>
                    </TableRow>
            ) : orders.length > 0 ? (
                 orders.map((order) => <OrderRow key={order.id} order={order} />)
            ) : (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">No orders found.</TableCell>
                    </TableRow>
            )}
            
            </TableBody>
            </Table>
        </div>
      </CardContent>
    </Card>
  );
}
