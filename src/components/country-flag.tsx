
'use client';

import { cn } from '@/lib/utils';
import Image from 'next/image';

interface CountryFlagProps {
  countryCode: string;
  isActive?: boolean;
  className?: string;
}

export function CountryFlag({ countryCode, isActive = false, className }: CountryFlagProps) {
  const flagUrl = `https://cdnjs.cloudflare.com/ajax/libs/flag-icon-css/3.5.0/flags/4x3/${countryCode.toLowerCase()}.svg`;

  return (
    <div
      className={cn(
        'w-12 h-9 rounded-md overflow-hidden transition-all duration-300',
        'bg-white/10 ring-1 ring-white/20',
        isActive ? 'scale-110 ring-2 ring-white shadow-lg' : 'scale-90 opacity-60 hover:opacity-100 hover:scale-100',
        className
      )}
    >
      <Image
        src={flagUrl}
        alt={`${countryCode} flag`}
        width={48}
        height={36}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
