
'use client';

import { Button } from '@/components/ui/button';
import Image from 'next/image';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import imageData from '@/lib/placeholder-images.json';
const { placeholderImages } = imageData;

export default function NotFound() {
  const notFoundImage = placeholderImages.find(img => img.id === '404-cat')?.imageUrl || "https://picsum.photos/seed/404cat/250/250";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-center p-6">
      <div className="max-w-md">
        <Image
          src={notFoundImage}
          alt="Confused cat looking at a map"
          width={250}
          height={250}
          className="mx-auto"
          data-ai-hint="confused cat"
        />
        <h1 className="mt-8 text-4xl font-bold text-gray-800">404 - Page Not Found</h1>
        <p className="mt-4 text-lg text-gray-600">
          Oops! It looks like you've taken a wrong turn. The page you're looking for seems to have wandered off.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/">
            Go Back to Homepage
          </Link>
        </Button>
      </div>
    </div>
  );
}
