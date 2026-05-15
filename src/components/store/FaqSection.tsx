
'use client';

import { useStore } from '@/context/store-context';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export function FaqSection() {
  const { store } = useStore();

  const faqs = store?.faqs || [];

  if (!store?.isFaqActive || !faqs || faqs.length === 0) {
    return null;
  }

  return (
    <section className="py-12 md:py-20 bg-background">
      <div className="container max-w-3xl mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
          Frequently Asked Questions
        </h2>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq: { q: string; a: string }, index: number) => (
            <AccordionItem value={`item-${index}`} key={index}>
              <AccordionTrigger className="text-left font-semibold text-lg">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground prose">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
