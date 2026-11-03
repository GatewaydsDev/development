import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { router, usePage } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import SimpleSelect from '@/Components/ContactDirectory/SimpleSelect';
import TextInput from '@/Components/TextInput';
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
    const [previewDraft, setPreviewDraft] = useState('');

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
        router.post(
            route('contact-directory.email-templates.store'),
            {
                name: draftName,
                category: draftCategory,
                subject: draftSubject,
                body: draftBody,
                visibility: draftVisibility,
                is_active: true,
            },
            { preserveScroll: true },
        );
    };

    const insertPlaceholder = (placeholder: string) => {
        setDraftBody((body) => `${body}{{${placeholder}}}`);
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
                            <Card key={template.id}>
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
                                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                                        {template.body}
                                    </p>
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
                                    {previewDraft === String(template.id) && (
                                        <p className="whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-sm">
                                            Template preview. Selecting a template never sends an
                                            email.
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {canManage && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Create a template</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={createTemplate} className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-foreground">
                                        Name
                                    </label>
                                    <TextInput
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
                                    <label className="mb-1 block text-sm font-medium text-foreground">
                                        Subject
                                    </label>
                                    <TextInput
                                        value={draftSubject}
                                        onChange={(event) => setDraftSubject(event.target.value)}
                                        required
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="mb-1 block text-sm font-medium text-foreground">
                                        Body
                                    </label>
                                    <textarea
                                        value={draftBody}
                                        onChange={(event) => setDraftBody(event.target.value)}
                                        rows={8}
                                        required
                                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:ring-2 focus:ring-ring/40 focus:outline-none"
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
                                <Button type="submit" className="sm:col-span-2">
                                    Save template
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                )}

                <Card>
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
                                        onClick={() => {
                                            setDraftName(template.name);
                                            setDraftCategory(template.category);
                                            setDraftSubject(template.subject);
                                            setDraftBody(template.body);
                                        }}
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
        </AuthenticatedLayout>
    );
}
