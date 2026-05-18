
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

  // Split into two columns for desktop
  const mid = Math.ceil(faqs.length / 2);
  const left  = faqs.slice(0, mid);
  const right = faqs.slice(mid);

  return (
    <section className="py-16 md:py-24 bg-secondary/30 border-t">
      <div className="container mx-auto px-4 md:px-6">

        {/* Header */}
        <div className="text-center mb-12 md:mb-16 max-w-xl mx-auto">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">FAQ</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            Frequently Asked Questions
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Everything you need to know. Can't find an answer? Use the Help button in the navigation to reach us directly.
          </p>
        </div>

        {/* Two-column accordion grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-0 max-w-5xl mx-auto">
          {[left, right].map((col, ci) => (
            <Accordion key={ci} type="single" collapsible className="space-y-3">
              {col.map((faq: { q: string; a: string }, index: number) => (
                <AccordionItem
                  key={index}
                  value={`col-${ci}-item-${index}`}
                  className="rounded-2xl border bg-card px-5 shadow-sm data-[state=open]:shadow-md transition-shadow"
                >
                  <AccordionTrigger className="text-left font-semibold text-sm md:text-base py-4 hover:no-underline">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm leading-relaxed pb-4">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ))}
        </div>

      </div>
    </section>
  );
}
