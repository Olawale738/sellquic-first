'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Loader2, FileText, Trash2, Pencil, X } from 'lucide-react';
import { useRequireSuperAdmin } from '@/hooks/use-auth';
import { getAuth } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useFirestore } from '@/firebase';

export default function EmailTemplatesPage() {
    useRequireSuperAdmin();
    const { toast } = useToast();
    const firestore = useFirestore();

    const [name, setName] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    const [templates, setTemplates] = useState<any[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        if (!firestore) return;
        setLoadingTemplates(true);
        const templatesQuery = query(collection(firestore, 'email_templates'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(templatesQuery, (snapshot) => {
            setTemplates(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoadingTemplates(false);
        });
        return () => unsubscribe();
    }, [firestore]);

    const handleSaveTemplate = async () => {
        if (!name || !subject || !body) {
            toast({ title: "All fields are required.", variant: "destructive" });
            return;
        }
        setIsSaving(true);
        try {
            const auth = getAuth();
            const idToken = await auth.currentUser?.getIdToken();

            const isEditing = !!editingId;
            const response = await fetch('/api/superadmin/emails/templates', {
                method: isEditing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
                body: JSON.stringify(isEditing ? { id: editingId, name, subject, body } : { name, subject, body })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save template.');
            }
            
            toast({ title: isEditing ? "Template Updated!" : "Template Saved!" });
            setEditingId(null);
            setName('');
            setSubject('');
            setBody('');

        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    }

    const handleEditTemplate = (template: any) => {
        setEditingId(template.id);
        setName(template.name);
        setSubject(template.subject);
        setBody(template.body);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setName('');
        setSubject('');
        setBody('');
    };

    const handleDeleteTemplate = async (templateId: string) => {
        setDeletingId(templateId);
        try {
            const auth = getAuth();
            const idToken = await auth.currentUser?.getIdToken();
            const response = await fetch(`/api/superadmin/emails/templates?id=${templateId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${idToken}` },
            });
            if(!response.ok) throw new Error("Failed to delete");
            toast({ title: "Template Deleted" });
            if (editingId === templateId) handleCancelEdit();
        } catch (error) {
            toast({ title: "Error deleting template", variant: "destructive" });
        } finally {
            setDeletingId(null);
        }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>{editingId ? 'Edit Template' : 'Create Email Template'}</CardTitle>
                            <CardDescription>{editingId ? 'Update your existing template.' : 'Design a new reusable email template.'}</CardDescription>
                        </div>
                        {editingId && (
                            <Button variant="ghost" size="icon" onClick={handleCancelEdit}>
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="template-name">Template Name</Label>
                        <Input id="template-name" placeholder="e.g., Monthly Newsletter" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="template-subject">Email Subject</Label>
                        <Input id="template-subject" placeholder="e.g., 3 Tips to Boost Your Sales" value={subject} onChange={e => setSubject(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="template-body">Email Body (Supports HTML)</Label>
                        <Textarea id="template-body" placeholder="<p>Hi {{firstName}},</p>" className="min-h-[250px] font-mono" value={body} onChange={e => setBody(e.target.value)} />
                        <p className="text-xs text-muted-foreground">
                            Use variables: {'{{firstName}}'}, {'{{storeName}}'}, or BeeFree format: [First Name], [Store Name]
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleSaveTemplate} disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4"/>}
                            {editingId ? 'Update Template' : 'Save Template'}
                        </Button>
                        {editingId && (
                            <Button variant="outline" onClick={handleCancelEdit}>
                                Cancel
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Saved Templates</CardTitle>
                    <CardDescription>Your library of reusable email templates.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loadingTemplates ? <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div> : (
                        <div className="space-y-2">
                            {templates.map(t => (
                                <div key={t.id} className={`flex justify-between items-center p-3 border rounded-lg transition-colors ${editingId === t.id ? 'bg-primary/10 border-primary/30' : 'bg-muted/50'}`}>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold">{t.name}</p>
                                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">{t.subject}</p>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <Button variant="ghost" size="icon" onClick={() => handleEditTemplate(t)}>
                                            <Pencil className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteTemplate(t.id)} disabled={deletingId === t.id}>
                                            {deletingId === t.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4 text-destructive"/>}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            {templates.length === 0 && (
                                <div className="text-center py-10 border-2 border-dashed rounded-lg text-muted-foreground">
                                    <FileText className="h-8 w-8 mx-auto mb-2" />
                                    No templates created yet.
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}