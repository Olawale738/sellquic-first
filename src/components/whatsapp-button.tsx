
'use client';
import { useStore } from "@/context/store-context";
import { FaWhatsapp } from 'react-icons/fa';
import Link from 'next/link';
import { formatPhoneNumberForApi } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function WhatsAppButton() {
    const { store } = useStore();

    if (!store?.sellerPhone) {
        return null;
    }

    // 🛑 Hide WhatsApp completely if the AI is enabled
    if (store?.aiAssistant?.enabled) {
        return null;
    }
    
    const formattedPhone = formatPhoneNumberForApi(store.sellerPhone);
    const whatsappLink = `https://wa.me/${formattedPhone.replace(/\D/g, '')}`;
    
    // Always use green for WhatsApp icon
    const backgroundColor = '#25D366';

    return (
        <Link 
            href={whatsappLink} 
            target="_blank" 
            className="fixed bottom-6 right-6 z-40 text-white p-3 rounded-full shadow-lg transition-all hover:scale-110"
            style={{ backgroundColor: backgroundColor }}
        >
            <FaWhatsapp className="h-6 w-6" />
        </Link>
    );
}
