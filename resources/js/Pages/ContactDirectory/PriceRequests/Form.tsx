import FormActionFab from '@/Components/FormActionFab';
import FormSection from '@/Components/ContactDirectory/FormSection';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import type { PageProps } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowDownIcon, ArrowUpIcon, ClipboardListIcon, CalendarClockIcon, ListChecksIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import type { FormEvent } from 'react';

type Item = { id?: number; description: string; quantity: string; unit_of_measure: string; specifications: string; notes: string };

type EditablePriceRequest = {
    uuid: string;
    title: string;
    description: string | null;
    project_id: number | null;
    owner_id: number;
    currency: string;
    required_by: string | null;
    status: string;
    items?: { id: number; description: string; quantity: string; unit_of_measure: string; specifications: string | null; notes: string | null }[];
};

type Props = PageProps<{
    priceRequest: EditablePriceRequest | null;
    users: { id: number; name: string }[];
    projects: { id: number; name: string; project_number: string | null }[];
    statuses: string[];
}>;

const STATUS_LABELS: Record<string, string> = {
    draft: 'Draft',
    open: 'Open',
    under_review: 'Under review',
    closed: 'Closed',
    cancelled: 'Cancelled',
};

const blankItem = (): Item => ({ description: '', quantity: '1', unit_of_measure: 'each', specifications: '', notes: '' });

export default function PriceRequestForm({ auth, priceRequest, users, projects, statuses }: Props) {
    const editing = priceRequest !== null;
    const form = useForm({
        title: priceRequest?.title ?? '',
        description: priceRequest?.description ?? '',
        project_id: priceRequest?.project_id ? String(priceRequest.project_id) : '',
        owner_id: String(priceRequest?.owner_id ?? auth.user.id),
        currency: priceRequest?.currency ?? 'USD',
        required_by: priceRequest?.required_by ? priceRequest.required_by.slice(0, 10) : '',
        status: priceRequest?.status ?? 'open',
        items: (priceRequest?.items?.length
            ? priceRequest.items.map((item) => ({
                  id: item.id,
                  description: item.description,
                  quantity: String(Number(item.quantity)),
                  unit_of_measure: item.unit_of_measure ?? '',
                  specifications: item.specifications ?? '',
                  notes: item.notes ?? '',
              }))
            : [blankItem()]) as Item[],
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            description: data.description || null,
            project_id: data.project_id || null,
            required_by: data.required_by || null,
            currency: data.currency.toUpperCase(),
            items: data.items
                .filter((item) => item.description.trim() !== '')
                .map((item) => ({
                    ...item,
                    quantity: item.quantity || null,
                    unit_of_measure: item.unit_of_measure || null,
                    specifications: item.specifications || null,
                    notes: item.notes || null,
                })),
        }));
        const options = {
            onError: () => requestAnimationFrame(() => document.querySelector('[role="alert"]')?.scrollIntoView({ block: 'center' })),
        };
        if (priceRequest) form.patch(route('contact-directory.price-requests.update', priceRequest.uuid), options);
        else form.post(route('contact-directory.price-requests.store'), options);
    };

    const setItem = (index: number, key: keyof Item, value: string) =>
        form.setData('items', form.data.items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
    const moveItem = (index: number, direction: -1 | 1) => {
        const next = [...form.data.items];
        const target = index + direction;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target], next[index]];
        form.setData('items', next);
    };

    const inputClass = 'h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 text-foreground focus:border-ring focus:ring-ring';
    const labelClass = 'text-emerald-700 dark:text-emerald-300';
    const cancelHref = priceRequest
        ? route('contact-directory.price-requests.show', priceRequest.uuid)
        : route('contact-directory.price-requests.index');
    const itemError = (index: number, key: string) => (form.errors as Record<string, string>)[`items.${index}.${key}`];

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
                        <span>People</span>
                        <span>/</span>
                        <Link href={route('contact-directory.price-requests.index')} className="transition hover:text-foreground">Price requests</Link>
                        <span>/</span>
                        <span className="text-foreground">{editing ? 'Edit' : 'Add'}</span>
                    </nav>
                    <h2 className={`text-xl font-semibold leading-tight ${labelClass}`}>{editing ? 'Edit price request' : 'New price request'}</h2>
                </div>
            }
        >
            <Head title={editing ? 'Edit price request' : 'New price request'} />
            <div className="py-6 sm:py-8">
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    <Card className="border-0 bg-transparent p-0 shadow-none ring-0">
                        <CardHeader className="px-0">
                            <CardTitle>Price request information</CardTitle>
                            <CardDescription>Describe what you need priced. You can then send supplier inquiries from the price request.</CardDescription>
                        </CardHeader>
                        <CardContent className="px-0">
                            <form id="price-request-form" onSubmit={submit} className="flex w-full min-w-0 flex-col gap-6 pr-4 pb-28 sm:pr-20 lg:pb-6">
                                <FormActionFab form="price-request-form" cancelHref={cancelHref} saveLabel={editing ? 'Save changes' : 'Create price request'} disabled={form.processing} />
                                {Object.keys(form.errors).length > 0 && (
                                    <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
                                        Please correct the highlighted fields before saving.
                                    </div>
                                )}

                                <FormSection title="Request details" description="What you are asking suppliers to price." icon={ClipboardListIcon} tone="emerald">
                                    <div className="grid min-w-0 gap-5 md:grid-cols-2">
                                        <div className="space-y-2 md:col-span-2">
                                            <InputLabel htmlFor="pr-title" value="Title" className={labelClass} />
                                            <input id="pr-title" required className={inputClass} value={form.data.title} onChange={(e) => form.setData('title', e.target.value)} placeholder="e.g. Hollow metal doors – Building A" />
                                            <InputError message={form.errors.title} />
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                            <InputLabel htmlFor="pr-description" value="Description" className={labelClass} />
                                            <textarea id="pr-description" rows={3} className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-ring focus:ring-ring" value={form.data.description} onChange={(e) => form.setData('description', e.target.value)} />
                                            <InputError message={form.errors.description} />
                                        </div>
                                        <div className="space-y-2">
                                            <InputLabel htmlFor="pr-project" value="Project (optional)" className={labelClass} />
                                            <select id="pr-project" className={inputClass} value={form.data.project_id} onChange={(e) => form.setData('project_id', e.target.value)}>
                                                <option value="">No project</option>
                                                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                                            </select>
                                            <InputError message={form.errors.project_id} />
                                        </div>
                                        <div className="space-y-2">
                                            <InputLabel htmlFor="pr-owner" value="Owner" className={labelClass} />
                                            <select id="pr-owner" required className={inputClass} value={form.data.owner_id} onChange={(e) => form.setData('owner_id', e.target.value)}>
                                                {users.map((user) => <option key={user.id} value={user.id}>{user.name}{user.id === auth.user.id ? ' (me)' : ''}</option>)}
                                            </select>
                                            <InputError message={form.errors.owner_id} />
                                        </div>
                                    </div>
                                </FormSection>

                                <FormSection title="Schedule & status" description="When you need it and where the request stands." icon={CalendarClockIcon} tone="sky">
                                    <div className="grid min-w-0 gap-5 md:grid-cols-3">
                                        <div className="space-y-2">
                                            <InputLabel htmlFor="pr-required-by" value="Required by" className={labelClass} />
                                            <input id="pr-required-by" type="date" className={inputClass} value={form.data.required_by} onChange={(e) => form.setData('required_by', e.target.value)} />
                                            <InputError message={form.errors.required_by} />
                                        </div>
                                        <div className="space-y-2">
                                            <InputLabel htmlFor="pr-status" value="Status" className={labelClass} />
                                            <select id="pr-status" className={inputClass} value={form.data.status} onChange={(e) => form.setData('status', e.target.value)}>
                                                {statuses.map((status) => <option key={status} value={status}>{STATUS_LABELS[status] ?? status}</option>)}
                                            </select>
                                            <InputError message={form.errors.status} />
                                        </div>
                                        <div className="space-y-2">
                                            <InputLabel htmlFor="pr-currency" value="Currency" className={labelClass} />
                                            <input id="pr-currency" required maxLength={3} className={`${inputClass} uppercase`} value={form.data.currency} onChange={(e) => form.setData('currency', e.target.value)} />
                                            <InputError message={form.errors.currency} />
                                        </div>
                                    </div>
                                </FormSection>

                                <FormSection title="Items" description="The line items suppliers will quote, in this order." icon={ListChecksIcon} tone="violet">
                                    <div className="mb-4 flex justify-end">
                                        <Button type="button" className="bg-violet-600 text-white hover:bg-violet-700" onClick={() => form.setData('items', [...form.data.items, blankItem()])}>
                                            <PlusIcon className="mr-1 size-4" aria-hidden /> Add item
                                        </Button>
                                    </div>
                                    {form.data.items.length === 0 && <p className="text-sm text-muted-foreground">No items added yet.</p>}
                                    <div className="space-y-4">
                                        {form.data.items.map((item, index) => (
                                            <div key={item.id ?? `new-${index}`} className="flex items-start gap-2">
                                                <span className="mt-8 flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-semibold text-white">{index + 1}</span>
                                                <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-[1fr_110px_120px]">
                                                    <div className="space-y-2">
                                                        <InputLabel htmlFor={`pr-item-${index}`} value="Description" className="text-violet-700 dark:text-violet-300" />
                                                        <input id={`pr-item-${index}`} className={inputClass} value={item.description} onChange={(e) => setItem(index, 'description', e.target.value)} />
                                                        <InputError message={itemError(index, 'description')} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <InputLabel htmlFor={`pr-qty-${index}`} value="Quantity" className="text-violet-700 dark:text-violet-300" />
                                                        <input id={`pr-qty-${index}`} type="number" min="0" step="any" className={inputClass} value={item.quantity} onChange={(e) => setItem(index, 'quantity', e.target.value)} />
                                                        <InputError message={itemError(index, 'quantity')} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <InputLabel htmlFor={`pr-unit-${index}`} value="Unit" className="text-violet-700 dark:text-violet-300" />
                                                        <input id={`pr-unit-${index}`} className={inputClass} value={item.unit_of_measure} onChange={(e) => setItem(index, 'unit_of_measure', e.target.value)} />
                                                        <InputError message={itemError(index, 'unit_of_measure')} />
                                                    </div>
                                                    <div className="space-y-2 md:col-span-3">
                                                        <InputLabel htmlFor={`pr-spec-${index}`} value="Specifications (optional)" className="text-violet-700 dark:text-violet-300" />
                                                        <input id={`pr-spec-${index}`} className={inputClass} value={item.specifications} onChange={(e) => setItem(index, 'specifications', e.target.value)} />
                                                    </div>
                                                </div>
                                                <div className="mt-7 flex shrink-0 gap-1">
                                                    <Button type="button" variant="outline" size="icon" aria-label="Move item up" disabled={index === 0} onClick={() => moveItem(index, -1)}><ArrowUpIcon className="size-4" /></Button>
                                                    <Button type="button" variant="outline" size="icon" aria-label="Move item down" disabled={index === form.data.items.length - 1} onClick={() => moveItem(index, 1)}><ArrowDownIcon className="size-4" /></Button>
                                                    <Button type="button" variant="outline" size="icon" aria-label="Remove item" onClick={() => form.setData('items', form.data.items.filter((_, i) => i !== index))}><Trash2Icon className="size-4" /></Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </FormSection>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
