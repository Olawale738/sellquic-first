
'use client';

import { useStore } from "@/context/store-context";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StoreBreadcrumbs } from "@/components/store-breadcrumbs";

export default function ShippingPolicyPage() {
    const { store } = useStore();

    const shippingPolicy = store?.deliveryNotice || store?.themeConfig?.deliveryInfo;

    if (!shippingPolicy) {
        notFound();
    }

    return (
        <div className="container mx-auto px-4 md:px-6 py-8">
            <StoreBreadcrumbs />
            <div className="max-w-4xl mx-auto mt-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-3xl">Shipping & Delivery</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div 
                            className="prose max-w-none"
                            dangerouslySetInnerHTML={{ __html: shippingPolicy.replace(/\n/g, '<br />') }} 
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
