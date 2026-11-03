import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import FormActionFab from '@/Components/FormActionFab';
import { router, usePage } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import SimpleSelect from '@/Components/ContactDirectory/SimpleSelect';
import TextInput from '@/Components/TextInput';
import RichTextEditor from '@/Components/RichTextEditor';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/Components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { PageProps } from '@/types';

type Template = {
    id: number;
    uuid: string;
    name: string;
    category: string;
    subject: string;
    body: string;
    is_active: boolean;
    visibility: string;
    owner?: { id: number; name: string } | null;
};

type StarterTemplate = {
    name: string;
    category: string;
    subject: string;
    body: string;
};

type Paginated<T> = { data: T[]; current_page: number; last_page: number; total: number };

type Props = PageProps<{
    filters: { search?: string; category?: string; is_active?: string; visibility?: string };
    templates: Paginated<Template>;
    categories: string[];
    placeholders: Record<string, string>;
    starterTemplates: StarterTemplate[];
}>;

const CATEGORY_LABELS: Record<string, string> = {
    initial_pricing_request: 'Initial pricing request',
    follow_up_no_response: 'Follow-up with no response',
    revised_pricing_request: 'Revised pricing request',
    lead_time_availability_request: 'Lead time or availability request',
    thank_you_after_quotation: 'Thank-you after receiving a quotation',
    general: 'General',
};

export default function EmailTemplatesIndex({
    filters,
    templates,
    categories,
    placeholders,
    starterTemplates,
}: Props) {
    const page = usePage<Props>();
    const flash = page.props.flash;
    const can = (page.props.auth.can ?? {}) as Record<string, boolean>;
    const canManage = Boolean(can.manageEmailTemplates);

    const [search, setSearch] = useState(filters.search ?? '');
    const [draftName, setDraftName] = useState('');
    const [draftCategory, setDraftCategory] = useState('initial_pricing_request');
    const [draftSubject, setDraftSubject] = useState('');
    const [draftBody, setDraftBody] = useState('');
    const [draftVisibility, setDraftVisibility] = useState('organization');
        const [createOpen, setCreateOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editorKey, setEditorKey] = useState(0);
    const [toDelete, setToDelete] = useState<Template | null>(null);
    const [openPreview, setOpenPreview] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const closeEditor = () => {
        setCreateOpen(false);
        setEditingId(null);
        setErrors({});
        setDraftName('');
        setDraftSubject('');
        setDraftBody('');
        setDraftCategory('initial_pricing_request');
        setDraftVisibility('organization');
    };

    const loadIntoForm = (template: { name: string; category: string; subject: string; body: string; visibility?: string }, id: number | null = null) => {
        setEditingId(id);
        setDraftName(template.name);
        setDraftCategory(template.category);
        setDraftSubject(template.subject);
        setDraftBody(template.body);
        setDraftVisibility(template.visibility ?? 'organization');
        setEditorKey((key) => key + 1);
        setCreateOpen(true);
        setErrors({});
        window.setTimeout(() => document.getElementById('directory-template-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    };

    const toggleActive = (template: Template) => {
        router.patch(
            route('contact-directory.email-templates.update', template.uuid),
            {
                name: template.name,
                category: template.category,
                subject: template.subject,
                body: template.body,
                visibility: template.visibility,
                is_active: !template.is_active,
            },
            { preserveScroll: true },
        );
    };

    const applyFilters = (updates: Record<string, string | undefined>) => {
        router.get(
            route('contact-directory.email-templates.index'),
            { ...filters, ...updates },
            { preserveState: true, replace: true },
        );
    };

    const submitSearch = (event: FormEvent) => {
        event.preventDefault();
        applyFilters({ search });
    };

    const createTemplate = (event: FormEvent) => {
        event.preventDefault();
        const payload = {
            name: draftName,
            category: draftCategory,
            subject: draftSubject,
            body: draftBody,
            visibility: draftVisibility,
            is_active: true,
        };
        const options = {
            preserveScroll: true, onStart: () => { setSaving(true); setErrors({}); }, onError: setErrors, onFinish: () => setSaving(false), onSuccess: closeEditor };

        if (editingId !== null) {
            const current = templates.data.find((item) => item.id === editingId);

            router.patch(route('contact-directory.email-templates.update', current?.uuid), { ...payload, is_active: current?.is_active ?? true }, options);

            return;
        }

        router.post(route('contact-directory.email-templates.store'), payload, options);
    };

    const insertPlaceholder = (placeholder: string) => {
        setDraftBody((body) => {
            const token = `{{${placeholder}}}`;

            return body.endsWith('</p>') ? `${body.slice(0, -4)}${token}</p>` : `${body}${token}`;
        });
        setEditorKey((key) => key + 1);
    };

    return (
        <AuthenticatedLayout stickyTitle="Email templates">
            <div className="space-y-6 px-4 py-6 lg:px-8">
                {flash?.success && (
                    <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                        {flash.success}
                    </div>
                )}

                <form onSubmit={submitSearch} className="flex flex-wrap items-end gap-3">
                    <div className="min-w-0 flex-1">
                        <label className="mb-1 block text-sm font-medium text-foreground">
                            Search
                        </label>
                        <TextInput
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search templates by name or subject"
                            aria-label="Search email templates"
                        />
                    </div>
                    <SimpleSelect
                        label="Category"
                        value={filters.category ?? ''}
                        options={categories.map((category) => ({
                            value: category,
                            label: CATEGORY_LABELS[category] ?? category,
                        }))}
                        placeholder="All categories"
                        onChange={(value) => applyFilters({ category: value })}
                        className="w-[200px]"
                    />
                    <SimpleSelect
                        label="Visibility"
                        value={filters.visibility ?? ''}
                        options={[
                            { value: 'organization', label: 'Organization' },
                            { value: 'private', label: 'Private to me' },
                        ]}
                        placeholder="All"
                        onChange={(value) => applyFilters({ visibility: value })}
                        className="w-[160px]"
                    />
                    <Button type="submit">Search</Button>
                </form>

                <div className="space-y-4">
                    {templates.data.length === 0 && (
                        <Card>
                            <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                No email templates match these filters.
                            </CardContent>
                        </Card>
                    )}
                    {templates.data.map((template) => {
                        const unresolved = [...template.subject.matchAll(/\{\{(\w+)\}\}/g)]
                            .map((match) => match[1])
                            .filter((token) => placeholders[token] !== undefined);

                        return (
                            <Card key={template.id} className="border-sky-200 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/30">
                                <CardHeader>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <CardTitle className="text-base">{template.name}</CardTitle>
                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant="secondary">
                                                {CATEGORY_LABELS[template.category] ?? template.category}
                                            </Badge>
                                            <Badge variant="outline">{template.visibility}</Badge>
                                            <Badge variant={template.is_active ? 'default' : 'outline'}>
                                                {template.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <p className="text-sm font-medium">{template.subject}</p>
                                    {openPreview === template.id && (
                                        <div
                                            className="rich-text-content rounded-md border border-border bg-background p-3 text-sm"
                                            dangerouslySetInnerHTML={{ __html: template.body }}
                                        />
                                    )}
                                    {unresolved.length > 0 && (
                                        <p className="text-xs text-amber-700 dark:text-amber-400">
                                            Unresolved placeholders:{' '}
                                            {unresolved.map((token) => placeholders[token]).join(', ')}.
                                            Fill these before sending.
                                        </p>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                        Owner: {template.owner?.name ?? '—'}
                                    </p>
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        <Button type="button" variant="outline" size="sm" onClick={() => setOpenPreview(openPreview === template.id ? null : template.id)}>
                                            {openPreview === template.id ? 'Hide preview' : 'Preview'}
                                        </Button>
                                        {canManage && (
                                            <>
                                                <Button type="button" variant="outline" size="sm" onClick={() => loadIntoForm(template, template.id)}>
                                                    Edit
                                                </Button>
                                                <Button type="button" variant="outline" size="sm" onClick={() => toggleActive(template)}>
                                                    {template.is_active ? 'Deactivate' : 'Activate'}
                                                </Button>
                                                <Button type="button" variant="outline" size="sm" className="text-destructive" onClick={() => setToDelete(template)}>
                                                    Delete
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {canManage && (
                    <Card className="border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30">
                        <CardHeader>
                            <CardTitle className="text-base">{editingId !== null ? 'Edit template' : 'Create a template'}</CardTitle>
                            {!createOpen && <div><Button type="button" onClick={() => setCreateOpen(true)}>New template</Button></div>}
                        </CardHeader>
                        {createOpen && <CardContent>
                            <form id="directory-template-form" onSubmit={createTemplate} className="grid min-w-0 gap-5 pr-4 pb-28 sm:grid-cols-2 sm:pr-20 lg:pb-6">
                                <FormActionFab form="directory-template-form" cancelHref={route('contact-directory.email-templates.index')} saveLabel="Save template" onCancel={closeEditor} disabled={saving} />
                                {Object.keys(errors).length > 0 && <div role="alert" className="text-sm text-destructive sm:col-span-2">{Object.values(errors).join(' ')}</div>}
                                <div>
                                    <label htmlFor="template-name" className="mb-2 block text-sm font-medium text-emerald-700 dark:text-emerald-300">
                                        Name
                                    </label>
                                    <TextInput
                                        id="template-name"
                                        className="h-11 w-full min-w-0 border-border"
                                        value={draftName}
                                        onChange={(event) => setDraftName(event.target.value)}
                                        required
                                    />
                                </div>
                                <SimpleSelect
                                    label="Category"
                                    value={draftCategory}
                                    onChange={setDraftCategory}
                                    options={categories.map((category) => ({
                                        value: category,
                                        label: CATEGORY_LABELS[category] ?? category,
                                    }))}
                                />
                                <div className="sm:col-span-2">
                                    <label htmlFor="template-subject" className="mb-2 block text-sm font-medium text-emerald-700 dark:text-emerald-300">
                                        Subject
                                    </label>
                                    <TextInput
                                        id="template-subject"
                                        className="h-11 w-full min-w-0 border-border"
                                        value={draftSubject}
                                        onChange={(event) => setDraftSubject(event.target.value)}
                                        required
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label htmlFor="template-body" className="mb-2 block text-sm font-medium text-emerald-700 dark:text-emerald-300">
                                        Body
                                    </label>
                                    <RichTextEditor
                                        key={editorKey}
                                        id="template-body"
                                        compact
                                        showPlaceholders={false}
                                        value={draftBody}
                                        onChange={setDraftBody}
                                        error={errors.body}
                                    />
                                </div>
                                <SimpleSelect
                                    label="Visibility"
                                    value={draftVisibility}
                                    onChange={setDraftVisibility}
                                    options={[
                                        { value: 'organization', label: 'Organization' },
                                        { value: 'private', label: 'Private to me' },
                                    ]}
                                />
                                <div className="sm:col-span-2">
                                    <p className="mb-2 text-xs text-muted-foreground">
                                        Click a field to add it at the end of the message. It is replaced with real details when the template is used.
                                    </p>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(placeholders).map(([token, label]) => (
                                        <Button
                                            key={token}
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => insertPlaceholder(token)}
                                        >
                                            {label}
                                        </Button>
                                    ))}
                                </div>
                                </div>
                            </form>
                        </CardContent>}
                    </Card>
                )}

                <Card className="border-violet-200 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/30">
                    <CardHeader>
                        <CardTitle className="text-base">Starter templates</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {starterTemplates.map((template) => (
                            <div
                                key={template.name}
                                className="rounded-md border border-border px-3 py-2"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-medium">{template.name}</p>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={!canManage}
                                        onClick={() => loadIntoForm(template)}
                                    >
                                        Load into the form
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {template.subject}
                                </p>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>

            <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this template?</AlertDialogTitle>
                        <AlertDialogDescription>
                            "{toDelete?.name}" will no longer be offered when writing emails. Emails already sent are not affected.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (toDelete) {
                                    router.delete(route('contact-directory.email-templates.destroy', toDelete.uuid), { preserveScroll: true });
                                }
                                setToDelete(null);
                            }}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AuthenticatedLayout>
    );
}
