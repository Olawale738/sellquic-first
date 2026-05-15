'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Minus, Zap, Rocket, Store, ChevronDown, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { HomeHeader } from '@/components/landing/HomeHeader';


const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const plans = [
  {
    name: 'Starter',
    priceDay: '1.2',
    priceMonth: '35',
    description: 'For vendors who want a simple online store and manual selling tools.',
    buttonText: 'Get Started',
    buttonVariant: 'outline' as const,
    icon: <Rocket className="h-5 w-5 text-purple-500" />,
    highlight: 'AI available via top-up',
    features: [
      'Online storefront',
      'Up to 10 products',
      'Manual order management',
      'Basic sales analytics',
      'Real-time order alerts',
      'Top up AI credits anytime',
    ],
   
  },
  {
    name: 'Standard',
    priceDay: '2.3',
    priceMonth: '70',
    description: 'For vendors who want more selling tools and optional AI top-ups.',
    buttonText: 'Start Free Trial',
    buttonVariant: 'outline' as const,
    icon: <Store className="h-5 w-5 text-purple-600" />,
    highlight: 'AI available via top-up',
    features: [
      'Everything in Starter',
      'Customer CRM',
      'Discount tools',
      'Sales badges',
      'WhatsApp / Instagram AI via top-up',
      '7-day free trial available',
    ],
    notIncluded: [''],
  },
  {
    name: 'Growth',
    priceDay: '6.7',
    priceMonth: '200',
    description: 'For vendors who want full AI selling automation included.',
    buttonText: 'Start Free Trial',
    buttonVariant: 'default' as const,
    popular: true,
    icon: <Zap className="h-5 w-5 text-purple-600" />,
    highlight: 'Includes monthly AI credits',
    features: [
      'Everything in Standard',
      'Full AI assistant access',
      'WhatsApp AI automation',
      'Instagram DM AI automation',
      'AI insights dashboard',
      'Abandoned cart recovery',
      '7-day free trial available',
    ],
  },
];

const comparisonData = [
  {
    category: 'AI ASSISTANT',
    features: [
      {
        name: 'Monthly AI Credits Included',
        starter: 'None',
        standard: 'None',
        growth: 'Included',
      },
      {
        name: 'AI Credit Top-up',
        starter: true,
        standard: true,
        growth: true,
      },
      {
        name: 'Instagram DM Assistant',
        starter: 'Top-up Required',
        standard: 'Top-up Required',
        growth: true,
      },
      {
        name: 'WhatsApp AI Automation',
        starter: 'Top-up Required',
        standard: 'Top-up Required',
        growth: true,
      },
      {
        name: 'AI Insights Dashboard',
        starter: false,
        standard: false,
        growth: true,
      },
    ],
  },
  {
    category: 'YOUR STORE',
    features: [
      {
        name: 'Number of Products',
        starter: 'Unlimited',
        standard: 'Unlimited',
        growth: 'Unlimited',
      },
      {
        name: 'Manual Order Management',
        starter: true,
        standard: true,
        growth: true,
      },
      {
        name: 'Customer CRM',
        starter: 'Basic',
        standard: true,
        growth: true,
      },
      {
        name: 'Analytics',
        starter: 'Basic',
        standard: 'Standard',
        growth: 'Full Dashboard',
      },
      {
        name: 'Number of Stores',
        starter: '1',
        standard: '1',
        growth: '1',
      },
    ],
  },
  {
    category: 'PAYMENTS',
    features: [
      {
        name: 'Mobile Money',
        starter: true,
        standard: true,
        growth: true,
      },
      {
        name: 'Visa & Mastercard',
        starter: true,
        standard: true,
        growth: true,
      },
      {
        name: 'Payment Links',
        starter: true,
        standard: true,
        growth: true,
      },
      {
        name: 'Real-Time Order Alerts',
        starter: true,
        standard: true,
        growth: true,
      },
    ],
  },
  {
    category: 'MARKETING',
    features: [
      {
        name: 'Discount Tools',
        starter: false,
        standard: true,
        growth: true,
      },
      {
        name: 'Sales Badges',
        starter: false,
        standard: true,
        growth: true,
      },
      {
        name: 'Abandoned Cart Recovery',
        starter: false,
        standard: false,
        growth: true,
      },
      {
        name: 'SEO Tools',
        starter: false,
        standard: false,
        growth: true,
      },
    ],
  },
  {
    category: 'SUPPORT',
    features: [
      {
        name: 'Support Level',
        starter: 'Standard',
        standard: 'Standard',
        growth: 'Priority',
      },
      {
        name: 'Onboarding Help',
        starter: true,
        standard: true,
        growth: true,
      },
    ],
  },
];

export default function PricingPage() {
  const [isTableOpen, setIsTableOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <HomeHeader />

      <main className="pt-28 pb-20 px-4 md:px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeIn}
          className="container mx-auto text-center mb-16"
        >
          <Badge
            variant="secondary"
            className="mb-6 py-1.5 px-5 text-xs font-black uppercase tracking-widest bg-purple-50 text-purple-700 border-purple-100"
          >
            No hidden fees. No long contracts.
          </Badge>

          <h1 className="text-4xl md:text-7xl font-[1000] tracking-tighter text-slate-900 mb-6 leading-[1.1] uppercase">
            Choose the plan that <br className="hidden md:block" />
            <span className="text-purple-600 italic underline decoration-purple-200 underline-offset-8 lowercase">
              fits your business
            </span>
          </h1>

          <p className="text-base md:text-xl text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed">
            Start with a simple store, add AI when you need it, or choose Growth for full AI
            automation from day one.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
        >
          {plans.map((plan) => (
            <motion.div key={plan.name} variants={fadeIn} className="h-full">
              <Card
                className={`relative h-full flex flex-col transition-all duration-300 ${
                  plan.popular
                    ? 'ring-2 ring-purple-600 shadow-2xl scale-105 z-10'
                    : 'shadow-sm border-slate-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-purple-600 text-white px-4 py-1 rounded-full uppercase tracking-widest text-[9px] font-black">
                      ⭐ Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    {plan.icon}
                    <CardTitle className="text-lg uppercase tracking-widest text-slate-400 font-black">
                      {plan.name}
                    </CardTitle>
                  </div>
                  {plan.name === 'Growth' ? (
  <>
    <div className="flex items-baseline gap-1 mt-2">
      <span className="text-4xl md:text-5xl font-extrabold text-slate-900">
        {plan.priceDay} GHS
      </span>
      <span className="text-slate-500 font-bold text-sm uppercase">/ day</span>
    </div>

    <p className="text-[10px] font-black text-purple-600 mt-1 uppercase tracking-tight">
      Billed at {plan.priceMonth} GHS/month
    </p>
  </>
) : (
  <div className="flex items-baseline gap-1 mt-2">
    <span className="text-4xl md:text-5xl font-extrabold text-slate-900">
      {plan.priceMonth} GHS
    </span>
    <span className="text-slate-500 font-bold text-sm uppercase">/ month</span>
  </div>
)}

                  <CardDescription className="pt-4 text-slate-500 text-xs font-medium min-h-[50px]">
                    {plan.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-grow">
                  <div className="bg-purple-50 rounded-xl p-3 mb-6 border border-purple-100 text-center">
                    <p className="text-xs font-bold text-purple-800 uppercase">
                      {plan.highlight}
                    </p>
                  </div>

                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 text-[13px] text-slate-700 font-semibold"
                      >
                        <Check className="h-4 w-4 text-purple-600 mt-0.5 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}

                    {plan.notIncluded?.map((feature, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 text-[13px] text-slate-300 font-medium"
                      >
                        <Minus className="h-4 w-4 mt-0.5 shrink-0" />
                        <span className="line-through">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Button
                    onClick={() => {
                      window.location.href = '/signup';
                    }}
                    variant={plan.buttonVariant}
                    className={`w-full py-6 rounded-xl text-xs font-black uppercase tracking-widest ${
                      plan.popular ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''
                    }`}
                  >
                    {plan.buttonText}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <div className="container mx-auto max-w-4xl mb-20">
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-4 flex items-center justify-center gap-3">
            <Info className="h-5 w-5 text-purple-600" />
            <p className="text-sm font-bold text-slate-600 italic">
              Starter and Standard do not include monthly AI credits. Vendors can top up AI
              credits anytime when they want to use the assistant.
            </p>
          </div>
        </div>

        <div className="container mx-auto mb-32">
          <div className="flex flex-col items-center">
            <button
              onClick={() => setIsTableOpen(!isTableOpen)}
              className="group flex items-center gap-3 bg-white border-2 border-slate-900 px-8 py-4 rounded-2xl hover:bg-slate-900 hover:text-white transition-all mb-12"
            >
              <span className="text-sm font-black uppercase tracking-widest">
                {isTableOpen ? 'Hide' : 'Show'} Full Feature Comparison
              </span>
              <ChevronDown
                className={`w-5 h-5 transition-transform ${
                  isTableOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>

          <AnimatePresence>
            {isTableOpen && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="overflow-x-auto"
              >
                <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xl">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="w-[250px] py-6 pl-8 font-black uppercase text-xs tracking-widest">
                          Feature
                        </TableHead>
                        <TableHead className="text-center font-black uppercase text-xs">
                          Starter
                        </TableHead>
                        <TableHead className="text-center font-black uppercase text-xs">
                          Standard
                        </TableHead>
                        <TableHead className="text-center font-black uppercase text-xs text-purple-600">
                          Growth
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {comparisonData.map((section) => (
                        <React.Fragment key={section.category}>
                          <TableRow className="bg-purple-50/50">
                            <TableCell
                              colSpan={4}
                              className="font-black text-[10px] tracking-widest text-purple-700 py-4 px-8 uppercase"
                            >
                              {section.category}
                            </TableCell>
                          </TableRow>

                          {section.features.map((row: any) => (
                            <TableRow key={row.name} className="border-b border-slate-100">
                              <TableCell className="font-bold text-slate-700 py-4 px-8 text-sm uppercase">
                                {row.name}
                              </TableCell>
                              <TableCell className="text-center">
                                {renderCell(row.starter)}
                              </TableCell>
                              <TableCell className="text-center">
                                {renderCell(row.standard)}
                              </TableCell>
                              <TableCell className="text-center bg-purple-50/20">
                                {renderCell(row.growth)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="container mx-auto max-w-3xl mb-32">
          <h2 className="text-3xl font-[1000] uppercase text-center mb-12">
            Frequently Asked Questions
          </h2>

          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="cancel" className="border border-slate-200 rounded-2xl px-6">
              <AccordionTrigger className="font-black uppercase text-sm">
                Can I cancel anytime?
              </AccordionTrigger>
              <AccordionContent className="font-medium text-slate-500">
                Yes. SellQuic is a monthly subscription. No long contracts, no cancellation
                fees.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="momo" className="border border-slate-200 rounded-2xl px-6">
              <AccordionTrigger className="font-black uppercase text-sm">
                What payment methods do you accept?
              </AccordionTrigger>
              <AccordionContent className="font-medium text-slate-500">
                We accept Mobile Money, Visa, Mastercard, and supported online payment
                methods through Paystack.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="trial" className="border border-slate-200 rounded-2xl px-6">
              <AccordionTrigger className="font-black uppercase text-sm">
                How does the 7-day free trial work?
              </AccordionTrigger>
              <AccordionContent className="font-medium text-slate-500">
                Standard and Growth support a 7-day trial. Growth includes AI credits during
                the trial. Standard does not include monthly AI credits, but AI can be used
                when credits are topped up.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="topup" className="border border-slate-200 rounded-2xl px-6">
              <AccordionTrigger className="font-black uppercase text-sm">
                Can I top up AI credits?
              </AccordionTrigger>
              <AccordionContent className="font-medium text-slate-500">
                Yes. Vendors on Starter and Standard can top up AI credits when they want to
                use the AI assistant. Growth includes AI credits as part of the plan.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <div className="container mx-auto">
          <div className="bg-[#5722c1] rounded-[3rem] py-16 px-8 text-center text-white relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-4xl md:text-6xl font-[1000] uppercase mb-6 tracking-tighter">
                Ready to sell smarter?
              </h2>

              <p className="text-purple-100 text-lg mb-10 max-w-xl mx-auto font-bold opacity-90">
                Create your store, choose your plan, and start selling online with SellQuic.
              </p>

              <Button
                onClick={() => {
                  window.location.href = '/signup';
                }}
                className="bg-white text-purple-700 hover:bg-slate-100 h-16 px-12 rounded-2xl font-black text-lg uppercase tracking-widest"
              >
                Get Started Now
              </Button>
            </div>
          </div>
        </div>
      </main>

   
    </div>
  );
}

function renderCell(value: string | boolean) {
  if (typeof value === 'boolean') {
    return value ? (
      <div className="flex justify-center">
        <Check className="h-5 w-5 text-purple-600 stroke-[3px]" />
      </div>
    ) : (
      <div className="flex justify-center">
        <Minus className="h-5 w-5 text-slate-200" />
      </div>
    );
  }

  return (
    <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">
      {value}
    </span>
  );
}