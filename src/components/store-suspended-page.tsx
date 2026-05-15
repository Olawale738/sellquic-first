
'use client';

import { BedDouble } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export function StoreSuspendedPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-center p-6">
            <div className="max-w-md">
                <Image 
                    src="https://firebasestorage.googleapis.com/v0/b/sellquic.firebasestorage.app/o/ULVH-Cats-sleep-shutterstock_2295390477-removebg-preview.png?alt=media&token=aa9203f0-5b9b-4b27-a8a7-5b3f7a7877a1" 
                    alt="Cartoon cat sleeping"
                    width={200}
                    height={200}
                    className="mx-auto"
                />
                <h1 className="mt-6 text-3xl font-bold text-gray-800">This Shop is Taking a Nap!</h1>
                <p className="mt-3 text-lg text-gray-600">
                    The store is currently unavailable. The owner might be updating things or taking a short break.
                </p>
                <p className="mt-4 text-sm text-gray-500">
                    Please check back in a little while.
                </p>
                <p className="text-xs text-muted-foreground mt-12">
                    Powered by <Link href="https://sellquic.com/signup" className="font-semibold text-primary hover:underline">SellQuic</Link>
                </p>
            </div>
        </div>
    );
}
