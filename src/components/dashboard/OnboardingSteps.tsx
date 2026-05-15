
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Circle, Copy, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

const useOnboardingState = (userId: string) => {
    const getInitialState = () => {
        if (typeof window === 'undefined') return {};
        try {
            const saved = localStorage.getItem(`onboarding_${userId}`);
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.error("Failed to parse onboarding state:", error);
            return {};
        }
    };

    const [completedManualTasks, setCompletedManualTasks] = useState<Record<string, boolean>>(getInitialState);

    const markTaskComplete = (taskId: string) => {
        const newState = { ...completedManualTasks, [taskId]: true };
        setCompletedManualTasks(newState);
        if (typeof window !== 'undefined') {
            localStorage.setItem(`onboarding_${userId}`, JSON.stringify(newState));
        }
    };
    
    return { completedManualTasks, markTaskComplete };
};


const TaskItem = ({ isCompleted, title, description, onClick, children }: { isCompleted: boolean; title: string; description: string; onClick: () => void; children?: React.ReactNode }) => (
  <div onClick={onClick} className="flex items-start gap-4 p-4 rounded-lg hover:bg-muted transition-colors cursor-pointer">
    {isCompleted ? <CheckCircle className="h-6 w-6 text-green-500 mt-1 flex-shrink-0" /> : <Circle className="h-6 w-6 text-muted-foreground mt-1 flex-shrink-0" />}
    <div className="flex-1">
      <h4 className="font-semibold">{title}</h4>
      <p className="text-sm text-muted-foreground">{description}</p>
      {children}
    </div>
  </div>
);


export default function OnboardingSteps() {
  const { user, activeStore } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  
  const { completedManualTasks, markTaskComplete } = useOnboardingState(user?.uid || '');


  if (!user || !activeStore) return null;

  const storeUrl = activeStore?.customDomain ? `https://${activeStore.customDomain}` : `https://${activeStore.subdomain}.sellquic.com`;
  const whatsappCommunityLink = 'https://chat.whatsapp.com/ERSm5AcT1IgLcJl7DIInWF'; 

  const tasks = [
    { 
      id: 'account', 
      title: 'Account Created', 
      description: 'You\'re officially a SellQuic vendor!', 
      isCompleted: true, 
      href: '/dashboard/profile' 
    },
    { 
      id: 'product', 
      title: 'Add your first product', 
      description: 'Showcase what you sell to your customers.', 
      isCompleted: completedManualTasks['product'] || (activeStore.products?.length || 0) > 0, 
      href: '/dashboard/products/new' 
    },
    { 
      id: 'payments', 
      title: 'Set up payments', 
      description: 'Add your MoMo or bank details to get paid.', 
      isCompleted: completedManualTasks['payments'] || !!activeStore.paymentInfo || !!activeStore.momoNumber, 
      href: '/dashboard/payments' 
    },
    { 
      id: 'delivery', 
      title: 'Add a delivery option', 
      description: 'Let customers know how you deliver.', 
      isCompleted: completedManualTasks['delivery'] || (activeStore.deliveries?.length || 0) > 0, 
      href: '/dashboard/deliveries' 
    },
    {
      id: 'socials',
      title: 'Share link to socials',
      description: 'Copy your unique link and paste it in your social media bios.',
      isCompleted: completedManualTasks['socials'] || false,
      href: '#',
      customAction: (e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          navigator.clipboard.writeText(storeUrl);
          toast({ title: "Store link copied!" });
          markTaskComplete('socials');
      }
    },
    {
      id: 'community',
      title: 'Join our WhatsApp community',
      description: 'Get support, tips, and connect with other sellers.',
      isCompleted: completedManualTasks['community'] || false,
      href: whatsappCommunityLink,
      customAction: (e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          markTaskComplete('community');
          window.open(whatsappCommunityLink, '_blank');
      }
    },
    { 
      id: 'logo', 
      title: 'Add your business logo', 
      description: 'Make your store reflect your brand.', 
      isCompleted: completedManualTasks['logo'] || !!activeStore.logoUrl, 
      href: '/dashboard/settings' 
    }
  ];
  
  const handleTaskClick = (task: typeof tasks[0], event?: React.MouseEvent) => {
    if (task.customAction) {
        if(event) task.customAction(event);
    } else {
        markTaskComplete(task.id);
        router.push(task.href);
    }
  };

  const completedCount = tasks.filter(t => t.isCompleted).length;
  const progress = (completedCount / tasks.length) * 100;
  
  if (completedCount === tasks.length) {
    return null;
  }

  return (
    <div className="mb-6 animated-border-card">
      <Card>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Welcome! Let's get you set up.</CardTitle>
                  <CardDescription>Complete these steps to start selling effectively.</CardDescription>
                </div>
                <Button variant="ghost" size="icon">
                  {isOpen ? <ChevronUp /> : <ChevronDown />}
                </Button>
              </div>
              <div className="flex items-center gap-4 pt-4">
                <Progress value={progress} className="w-full" />
                <span className="text-sm font-semibold text-muted-foreground whitespace-nowrap">{completedCount} / {tasks.length}</span>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-2">
              <div className="divide-y">
                {tasks.map(task => (
                  <TaskItem
                    key={task.id}
                    isCompleted={task.isCompleted}
                    title={task.title}
                    description={task.description}
                    onClick={() => handleTaskClick(task)}
                  >
                   {task.id === 'socials' && (
                        <Button size="sm" variant="outline" className="mt-2" onClick={(e) => handleTaskClick(task, e)}>
                            <Copy className="h-4 w-4 mr-2" /> Copy Link
                        </Button>
                   )}
                   {task.id === 'community' && (
                        <Button size="sm" variant="outline" className="mt-2" asChild>
                            <a href={whatsappCommunityLink} target="_blank" rel="noopener noreferrer" onClick={(e) => handleTaskClick(task, e)}>
                                <FaWhatsapp className="h-4 w-4 mr-2 text-green-500" /> Join Group
                            </a>
                        </Button>
                   )}
                  </TaskItem>
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
