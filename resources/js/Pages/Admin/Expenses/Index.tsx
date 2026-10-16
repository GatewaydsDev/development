import InputError from '@/Components/InputError';
import MaskedDecimalInput from '@/Components/MaskedDecimalInput';
import PaginationNav, { type Paginator } from '@/Components/PaginationNav';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { PlusIcon, ReceiptIcon, Trash2Icon } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';

type PaymentRow = {
    id: number;
    due_on: string;
    paid_on: string | null;
    amount: string;
    status: 'paid' | 'scheduled';
    status_label: string;
    method: string;
    method_label: string;
};

type PaymentDraft = {
    id: number | null;
    due_on: string;
    paid_on: string;
    amount: string;
    status: 'paid' | 'scheduled';
    method: string;
};

type ExpenseRow = {
    id: number;
    spent_on: string;
    payee: string;
    description: string;
    category: string;
    category_label: string;
    amount: string;
    notes: string | null;
    receipt_name: string | null;
    receipt_is_image: boolean;
    receipt_url: string | null;
    receipt_preview_url: string | null;
    recorded_by: string | null;
    paid_amount: string;
    scheduled_amount: string;
    payments: PaymentRow[];
};

type Props = {
    filters: {
        search: string;
        category: string;
    };
    categories: Record<string, string>;
    paymentStatuses: Record<string, string>;
    paymentMethods: Record<string, string>;
    total: string;
    paid: string;
    scheduled: string;
    count: number;
    expenses: Paginator & { data: ExpenseRow[] };
};

const money = (value: string) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(Number(value || 0));

const today = () => {
    const date = new Date();

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const addMonths = (iso: string, count: number) => {
    const [year, month, day] = iso.split('-').map(Number);
    const date = new Date(year, month - 1 + count, 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, lastDay));

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const blankPayment = (amount = ''): PaymentDraft => ({
    id: null,
    due_on: today(),
    paid_on: '',
    amount,
    status: 'scheduled',
    method: 'card',
});

const fieldClass =
    'h-11 w-full rounded-md border border-border bg-background px-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm';

function ReceiptPicture({
    src,
    alt,
    pdfUrl,
    pdfName,
}: {
    src: string;
    alt: string;
    pdfUrl?: string | null;
    pdfName?: string | null;
}) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!open) {
            return;
        }

        const close = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        window.addEventListener('keydown', close);

        return () => window.removeEventListener('keydown', close);
    }, [open]);

    return (
        <>
            <button type="button" onClick={() => setOpen(true)} className="inline-block text-left">
                <img
                    src={src}
                    alt={alt}
                    className="max-h-40 max-w-full rounded-md border border-border object-contain"
                />
            </button>
            {open ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={alt}>
                    <button type="button" className="absolute inset-0 bg-black/70" aria-label="Close receipt" onClick={() => setOpen(false)} />
                    <div className="relative z-10 grid max-h-[90vh] w-full max-w-4xl justify-items-center gap-3">
                        <img src={src} alt={alt} className="max-h-[78vh] w-auto max-w-full rounded-md bg-white object-contain" />
                        <div className="flex flex-wrap justify-center gap-2">
                            {pdfUrl ? (
                                <a href={pdfUrl} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
                                    Open PDF{pdfName ? ` (${pdfName})` : ''}
                                </a>
                            ) : null}
                            <button type="button" className="inline-flex min-h-11 items-center rounded-md border border-border bg-background px-4 text-sm" onClick={() => setOpen(false)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}

function ChosenReceiptPreview({ file }: { file: File | null }) {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!file || !file.type.startsWith('image/')) {
            setUrl(null);

            return;
        }

        const next = URL.createObjectURL(file);
        setUrl(next);

        return () => URL.revokeObjectURL(next);
    }, [file]);

    if (!url) {
        return null;
    }

    return <ReceiptPicture src={url} alt={file?.name || 'Selected receipt'} />;
}

function Summary({ label, value, hint }: { label: string; value: string; hint: string }) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-2xl">{money(value)}</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">{hint}</p>
            </CardContent>
        </Card>
    );
}

export default function Index({
    filters,
    categories,
    paymentStatuses,
    paymentMethods,
    total,
    paid,
    scheduled,
    count,
    expenses,
}: Props) {
    const flash = usePage().props.flash as { success?: string | null } | undefined;
    const [search, setSearch] = useState(filters.search);
    const [category, setCategory] = useState(filters.category);
    const [editing, setEditing] = useState<ExpenseRow | null>(null);
    const [confirming, setConfirming] = useState<number | null>(null);
    const [months, setMonths] = useState('3');
    const [firstDue, setFirstDue] = useState(today());
    const form = useForm({
        spent_on: today(),
        payee: '',
        description: '',
        category: 'course',
        amount: '',
        notes: '',
        receipt: null as File | null,
        remove_receipt: false,
        payments: [blankPayment()] as PaymentDraft[],
    });
    const fieldError = (key: string) => (form.errors as Record<string, string | undefined>)[key];
    const paymentTotal = form.data.payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

    const applyFilters = (event: FormEvent) => {
        event.preventDefault();
        router.get(
            route('admin.expenses.index'),
            { search, category },
            { preserveState: true, preserveScroll: true },
        );
    };

    const resetForm = () => {
        setEditing(null);
        form.setData({
            spent_on: today(),
            payee: '',
            description: '',
            category: 'course',
            amount: '',
            notes: '',
            receipt: null,
            remove_receipt: false,
            payments: [blankPayment()],
        });
        form.clearErrors();
    };

    const edit = (expense: ExpenseRow) => {
        setEditing(expense);
        setConfirming(null);
        form.setData({
            spent_on: expense.spent_on,
            payee: expense.payee,
            description: expense.description,
            category: expense.category,
            amount: expense.amount,
            notes: expense.notes ?? '',
            receipt: null,
            remove_receipt: false,
            payments: expense.payments.length
                ? expense.payments.map((payment) => ({
                      id: payment.id,
                      due_on: payment.due_on,
                      paid_on: payment.paid_on ?? '',
                      amount: payment.amount,
                      status: payment.status,
                      method: payment.method,
                  }))
                : [blankPayment(expense.amount)],
        });
        form.clearErrors();
    };

    const updatePayment = (index: number, patch: Partial<PaymentDraft>) => {
        form.setData(
            'payments',
            form.data.payments.map((payment, paymentIndex) =>
                paymentIndex === index ? { ...payment, ...patch } : payment,
            ),
        );
    };

    const splitMonthly = () => {
        const countMonths = Math.min(36, Math.max(2, Number(months) || 0));
        const totalCents = Math.round((Number(form.data.amount) || 0) * 100);

        if (countMonths < 2 || totalCents < countMonths) {
            return;
        }

        const base = Math.floor(totalCents / countMonths);
        const remainder = totalCents - base * countMonths;
        const method = form.data.payments[0]?.method || 'card';

        form.setData(
            'payments',
            Array.from({ length: countMonths }, (_, index) => ({
                id: null,
                due_on: addMonths(firstDue, index),
                paid_on: '',
                amount: ((index === countMonths - 1 ? base + remainder : base) / 100).toFixed(2),
                status: 'scheduled' as const,
                method,
            })),
        );
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) => {
            const payload: Record<string, unknown> = {
                ...data,
                remove_receipt: data.remove_receipt ? 1 : 0,
                payments: data.payments.map((payment) => ({
                    due_on: payment.due_on,
                    paid_on: payment.status === 'paid' ? payment.paid_on || payment.due_on : '',
                    amount: payment.amount,
                    status: payment.status,
                    method: payment.method,
                    ...(payment.id ? { id: payment.id } : {}),
                })),
            };

            if (!data.receipt) {
                delete payload.receipt;
            }

            return payload;
        });

        const options = {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => resetForm(),
        };

        form.post(editing ? route('admin.expenses.update', editing.id) : route('admin.expenses.store'), options);
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                    Expenses
                </h2>
            }
        >
            <Head title="Expenses" />

            <div className="py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:py-8">
                <div className="mx-auto grid max-w-6xl min-w-0 gap-4 px-3 sm:gap-6 sm:px-6 lg:px-8">
                    <p className="text-sm text-muted-foreground">
                        Record what the company bought, attach the receipt, and track each payment.
                        Mark a payment as paid, or leave it to be paid later. A course can be split into monthly payments.
                    </p>
                    {flash?.success ? (
                        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
                            {flash.success}
                        </p>
                    ) : null}

                    <div className="grid gap-3 sm:grid-cols-3">
                        <Summary label="Expense total" value={total} hint={`${count} ${count === 1 ? 'record' : 'records'} in this view`} />
                        <Summary label="Paid" value={paid} hint="Money already sent" />
                        <Summary label="To be paid" value={scheduled} hint="Payments still coming due" />
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ReceiptIcon className="size-4" />
                                {editing ? 'Edit expense' : 'New expense'}
                            </CardTitle>
                            <CardDescription>
                                Start with what was bought, then add how it will be paid.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submit} className="grid gap-6">
                                <section className="grid gap-3">
                                    <h3 className="text-sm font-semibold text-foreground">What was bought</h3>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <label className="grid gap-1 text-sm">
                                            Date
                                            <input
                                                type="date"
                                                required
                                                value={form.data.spent_on}
                                                onChange={(event) => form.setData('spent_on', event.target.value)}
                                                className={fieldClass}
                                            />
                                            <InputError message={form.errors.spent_on} />
                                        </label>
                                        <label className="grid gap-1 text-sm">
                                            Category
                                            <select
                                                value={form.data.category}
                                                onChange={(event) => form.setData('category', event.target.value)}
                                                className={fieldClass}
                                            >
                                                {Object.entries(categories).map(([value, label]) => (
                                                    <option key={value} value={value}>{label}</option>
                                                ))}
                                            </select>
                                            <InputError message={form.errors.category} />
                                        </label>
                                        <label className="grid gap-1 text-sm">
                                            Paid to
                                            <input
                                                value={form.data.payee}
                                                onChange={(event) => form.setData('payee', event.target.value)}
                                                maxLength={160}
                                                required
                                                className={fieldClass}
                                            />
                                            <InputError message={form.errors.payee} />
                                        </label>
                                        <label className="grid gap-1 text-sm">
                                            What it was for
                                            <input
                                                value={form.data.description}
                                                onChange={(event) => form.setData('description', event.target.value)}
                                                maxLength={255}
                                                required
                                                className={fieldClass}
                                            />
                                            <InputError message={form.errors.description} />
                                        </label>
                                    </div>
                                    <label className="grid w-36 gap-1 text-sm">
                                        Total amount
                                        <MaskedDecimalInput
                                            id="expense-amount"
                                            value={form.data.amount}
                                            prefix="$"
                                            placeholder="0.00"
                                            className="h-9 text-sm"
                                            onChange={(value) => form.setData('amount', value)}
                                        />
                                        <InputError message={form.errors.amount} />
                                    </label>
                                    <label className="grid gap-1 text-sm">
                                        Notes
                                        <textarea
                                            value={form.data.notes}
                                            onChange={(event) => form.setData('notes', event.target.value)}
                                            rows={2}
                                            maxLength={2000}
                                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
                                        />
                                        <InputError message={form.errors.notes} />
                                    </label>
                                </section>

                                <section className="grid gap-3 border-t border-border pt-4">
                                    <h3 className="text-sm font-semibold text-foreground">Receipt</h3>
                                    <input
                                        type="file"
                                        accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
                                        className="block w-full text-sm file:me-3 file:min-h-11 file:rounded-md file:border-0 file:bg-muted file:px-3 file:text-sm"
                                        onChange={(event) => form.setData('receipt', event.target.files?.[0] ?? null)}
                                    />
                                    <InputError message={form.errors.receipt} />
                                    <ChosenReceiptPreview file={form.data.receipt} />
                                    {editing?.receipt_preview_url && !form.data.receipt && !form.data.remove_receipt ? (
                                        <ReceiptPicture
                                            src={editing.receipt_preview_url}
                                            alt={editing.receipt_name || 'Receipt'}
                                            pdfUrl={editing.receipt_url}
                                            pdfName={editing.receipt_name}
                                        />
                                    ) : null}
                                    {editing?.receipt_name ? (
                                        <label className="inline-flex min-h-11 items-center gap-2 text-sm text-foreground">
                                            <input
                                                type="checkbox"
                                                checked={form.data.remove_receipt}
                                                onChange={(event) => form.setData('remove_receipt', event.target.checked)}
                                            />
                                            Remove current receipt ({editing.receipt_name})
                                        </label>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">
                                        A photo is saved as a one-page PDF and kept smaller than the original. Click the picture to see it.
                                    </p>
                                    )}
                                </section>

                                <section className="grid gap-3 border-t border-border pt-4">
                                    <div className="flex flex-wrap items-end justify-between gap-3">
                                        <div>
                                            <h3 className="text-sm font-semibold text-foreground">Payments</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Scheduled {money(paymentTotal.toFixed(2))} of the {money(form.data.amount || '0')} total.
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="min-h-11 touch-manipulation"
                                            onClick={() => form.setData('payments', [...form.data.payments, blankPayment()])}
                                        >
                                            <PlusIcon className="size-4" />
                                            Add payment
                                        </Button>
                                    </div>
                                    <div className="grid gap-2 rounded-md border border-border bg-muted/30 p-3 sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:items-end">
                                        <label className="grid gap-1 text-sm">
                                            Months
                                            <input
                                                inputMode="numeric"
                                                value={months}
                                                onChange={(event) => setMonths(event.target.value)}
                                                className={fieldClass}
                                            />
                                        </label>
                                        <label className="grid gap-1 text-sm">
                                            First due date
                                            <input
                                                type="date"
                                                value={firstDue}
                                                onChange={(event) => setFirstDue(event.target.value)}
                                                className={fieldClass}
                                            />
                                        </label>
                                        <Button type="button" variant="outline" className="min-h-11 touch-manipulation" onClick={splitMonthly}>
                                            Split monthly
                                        </Button>
                                    </div>
                                    <div className="grid gap-3">
                                        {form.data.payments.map((payment, index) => (
                                            <div key={`${payment.id ?? 'new'}-${index}`} className="grid gap-2 rounded-md border border-border p-3">
                                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                                    <label className="grid gap-1 text-sm">
                                                        Due
                                                        <input
                                                            type="date"
                                                            value={payment.due_on}
                                                            onChange={(event) => updatePayment(index, { due_on: event.target.value })}
                                                            className={fieldClass}
                                                        />
                                                        <InputError message={fieldError(`payments.${index}.due_on`)} />
                                                    </label>
                                                    <label className="grid gap-1 text-sm">
                                                        Amount
                                                        <MaskedDecimalInput
                                                            id={`payment-amount-${index}`}
                                                            value={payment.amount}
                                                            prefix="$"
                                                            placeholder="0.00"
                                                            className="h-9 text-sm"
                                                            onChange={(value) => updatePayment(index, { amount: value })}
                                                        />
                                                        <InputError message={fieldError(`payments.${index}.amount`)} />
                                                    </label>
                                                    <label className="grid gap-1 text-sm">
                                                        Status
                                                        <select
                                                            value={payment.status}
                                                            onChange={(event) =>
                                                                updatePayment(index, {
                                                                    status: event.target.value as PaymentDraft['status'],
                                                                })
                                                            }
                                                            className={fieldClass}
                                                        >
                                                            {Object.entries(paymentStatuses).map(([value, label]) => (
                                                                <option key={value} value={value}>{label}</option>
                                                            ))}
                                                        </select>
                                                    </label>
                                                    <label className="grid gap-1 text-sm">
                                                        How we pay
                                                        <select
                                                            value={payment.method}
                                                            onChange={(event) => updatePayment(index, { method: event.target.value })}
                                                            className={fieldClass}
                                                        >
                                                            {Object.entries(paymentMethods).map(([value, label]) => (
                                                                <option key={value} value={value}>{label}</option>
                                                            ))}
                                                        </select>
                                                    </label>
                                                </div>
                                                {payment.status === 'paid' ? (
                                                    <label className="grid max-w-xs gap-1 text-sm">
                                                        Date paid
                                                        <input
                                                            type="date"
                                                            value={payment.paid_on}
                                                            onChange={(event) => updatePayment(index, { paid_on: event.target.value })}
                                                            className={fieldClass}
                                                        />
                                                    </label>
                                                ) : null}
                                                {form.data.payments.length > 1 ? (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="min-h-11 w-fit touch-manipulation"
                                                        onClick={() =>
                                                            form.setData(
                                                                'payments',
                                                                form.data.payments.filter((_, paymentIndex) => paymentIndex !== index),
                                                            )
                                                        }
                                                    >
                                                        <Trash2Icon className="size-4" />
                                                        Remove payment
                                                    </Button>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <div className="flex flex-wrap gap-2">
                                    <Button type="submit" className="min-h-11 touch-manipulation" disabled={form.processing}>
                                        {editing ? 'Save expense' : 'Save expense'}
                                    </Button>
                                    {editing ? (
                                        <Button type="button" variant="outline" className="min-h-11 touch-manipulation" onClick={resetForm}>
                                            Cancel
                                        </Button>
                                    ) : null}
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Ledger</CardTitle>
                            <CardDescription>Each record shows what is already paid and what is still due.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                            <form onSubmit={applyFilters} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
                                <input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Search payee, description, or notes"
                                    className={fieldClass}
                                />
                                <select
                                    value={category}
                                    onChange={(event) => setCategory(event.target.value)}
                                    className={fieldClass}
                                    aria-label="Filter by category"
                                >
                                    <option value="">All categories</option>
                                    {Object.entries(categories).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                                <Button type="submit" variant="outline" className="min-h-11 touch-manipulation">
                                    Search
                                </Button>
                            </form>

                            {expenses.data.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No expenses match this view.</p>
                            ) : (
                                <ul className="grid gap-3">
                                    {expenses.data.map((expense) => (
                                        <li key={expense.id} className="grid gap-3 rounded-md border border-border p-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                                            <div className="grid min-w-0 gap-3 sm:grid-cols-[7rem_minmax(0,1fr)]">
                                                {expense.receipt_preview_url ? (
                                                    <ReceiptPicture
                                                        src={expense.receipt_preview_url}
                                                        alt={expense.receipt_name || 'Receipt'}
                                                        pdfUrl={expense.receipt_url}
                                                        pdfName={expense.receipt_name}
                                                    />
                                                ) : (
                                                    <div className="hidden sm:block" />
                                                )}
                                                <div className="min-w-0">
                                                    <p className="break-words text-base font-medium text-foreground">{expense.description}</p>
                                                    <p className="break-words text-sm text-muted-foreground">
                                                        {expense.spent_on} · {expense.payee} · {expense.category_label}
                                                    </p>
                                                    <p className="mt-1 text-sm font-semibold text-foreground">{money(expense.amount)}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        Paid {money(expense.paid_amount)} · To be paid {money(expense.scheduled_amount)}
                                                    </p>
                                                    {expense.notes ? (
                                                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{expense.notes}</p>
                                                    ) : null}
                                                    {expense.payments.length > 0 ? (
                                                        <ul className="mt-2 grid gap-1">
                                                            {expense.payments.map((payment) => (
                                                                <li key={payment.id} className="flex flex-wrap items-center gap-2 text-sm">
                                                                    <Badge variant={payment.status === 'paid' ? 'default' : 'outline'}>
                                                                        {payment.status_label}
                                                                    </Badge>
                                                                    <span>{payment.due_on}</span>
                                                                    <span className="font-medium">{money(payment.amount)}</span>
                                                                    <span className="text-muted-foreground">{payment.method_label}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <p className="mt-2 text-sm text-muted-foreground">No payments recorded yet.</p>
                                                    )}
                                                    <p className="mt-2 text-xs text-muted-foreground">
                                                        Recorded by {expense.recorded_by || 'a removed account'}
                                                        {expense.receipt_url ? (
                                                            <>
                                                                {' '}
                                                                · <a href={expense.receipt_url} target="_blank" rel="noopener" className="underline">{expense.receipt_name || 'Receipt'}</a>
                                                            </>
                                                        ) : null}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 lg:justify-end">
                                                <Button type="button" variant="outline" className="min-h-11 touch-manipulation" onClick={() => edit(expense)}>
                                                    Edit
                                                </Button>
                                                {confirming === expense.id ? (
                                                    <Button
                                                        type="button"
                                                        variant="destructive"
                                                        className="min-h-11 touch-manipulation"
                                                        onClick={() =>
                                                            router.delete(route('admin.expenses.destroy', expense.id), {
                                                                preserveScroll: true,
                                                                onFinish: () => setConfirming(null),
                                                            })
                                                        }
                                                    >
                                                        Confirm delete
                                                    </Button>
                                                ) : (
                                                    <Button type="button" variant="outline" className="min-h-11 touch-manipulation" onClick={() => setConfirming(expense.id)}>
                                                        Delete
                                                    </Button>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <PaginationNav paginator={expenses} itemLabel="expenses" />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
