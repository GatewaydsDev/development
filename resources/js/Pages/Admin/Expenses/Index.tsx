import ActionHint from '@/Components/ActionHint';
import DirectoryFieldLabel from '@/Components/DirectoryFieldLabel';
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
import { cn } from '@/lib/utils';
import { Head, Link, router } from '@inertiajs/react';
import { EditIcon, PlusIcon, ReceiptIcon, SearchIcon, Trash2Icon } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { createPortal } from 'react-dom';

type ExpenseRow = {
    id: number;
    spent_on: string;
    person_name: string;
    payee: string;
    description: string;
    category_label: string;
    amount: string;
    paid_amount: string;
    scheduled_amount: string;
    receipt_name: string | null;
    receipt_preview_url: string | null;
};

type Props = {
    filters: {
        search: string;
        category: string;
    };
    categories: Record<string, string>;
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

const displayDate = (value: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

    if (!match) {
        return value;
    }

    return `${match[2]}/${match[3]}/${match[1]}`;
};

const rowGridClassName =
    'xl:grid-cols-[3.5rem_7rem_minmax(7rem,0.9fr)_minmax(7rem,1fr)_minmax(10rem,1.4fr)_7.5rem_6.5rem_6.5rem_7rem_4.75rem]';

type HoverPreview = {
    src: string;
    name: string;
    top: number;
    left: number;
};

export default function Index({
    filters,
    categories,
    total,
    paid,
    scheduled,
    count,
    expenses,
}: Props) {
    const [search, setSearch] = useState(filters.search);
    const [category, setCategory] = useState(filters.category);
    const [confirming, setConfirming] = useState<number | null>(null);
    const [hover, setHover] = useState<HoverPreview | null>(null);

    const showReceipt = (expense: ExpenseRow, row: HTMLDivElement) => {
        if (!expense.receipt_preview_url) {
            setHover(null);

            return;
        }

        const rect = row.getBoundingClientRect();
        const width = 320;
        let left = rect.right + 12;

        if (left + width > window.innerWidth - 8) {
            left = Math.max(8, rect.left - width - 12);
        }

        const top = Math.max(8, Math.min(rect.top, window.innerHeight - 300));

        setHover({
            src: expense.receipt_preview_url,
            name: expense.receipt_name || 'Receipt',
            top,
            left,
        });
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        router.get(
            route('admin.expenses.index'),
            { search, category },
            { preserveState: true, replace: true },
        );
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <nav className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <span>Administration</span>
                            <span>/</span>
                            <span className="text-foreground">Expenses</span>
                        </nav>
                        <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                            Expenses
                        </h2>
                    </div>
                    <Button asChild variant="create">
                        <Link href={route('admin.expenses.create')}>
                            <PlusIcon className="size-4" />
                            Add expense
                        </Link>
                    </Button>
                </div>
            }
        >
            <Head title="Expenses" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto flex max-w-[96rem] flex-col gap-6 px-4 sm:px-6 lg:px-8">
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ReceiptIcon className="size-4 text-emerald-700 dark:text-emerald-300" />
                                    Expense total
                                </CardTitle>
                                <CardDescription>
                                    {count} {count === 1 ? 'purchase' : 'purchases'} in this view
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-right text-3xl font-semibold tabular-nums text-foreground">{money(total)}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-foreground">Paid</CardTitle>
                                <CardDescription>Already sent</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-right text-3xl font-semibold tabular-nums text-foreground">{money(paid)}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-foreground">To be paid</CardTitle>
                                <CardDescription>Still due</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-right text-3xl font-semibold tabular-nums text-foreground">{money(scheduled)}</p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="shadow-sm">
                        <CardHeader className="gap-4 md:grid-cols-[1fr_auto] md:items-center">
                            <div>
                                <CardTitle>Expense list</CardTitle>
                                <CardDescription>Search purchases by person, payee, or what they were for.</CardDescription>
                            </div>
                            <form onSubmit={submit} className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                                <div className="relative">
                                    <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="Search expenses"
                                        className="h-11 w-full rounded-md border border-border bg-background pr-3 pl-9 text-sm text-foreground sm:w-64"
                                    />
                                </div>
                                <select
                                    value={category}
                                    onChange={(event) => setCategory(event.target.value)}
                                    aria-label="Filter by category"
                                    className="h-11 min-w-[8.5rem] rounded-md border border-border bg-background px-4 text-sm text-foreground"
                                >
                                    <option value="">All categories</option>
                                    {Object.entries(categories).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                                <Button type="submit" variant="outline" size="sm" className="self-center">
                                    <SearchIcon data-icon="inline-start" />
                                    Search
                                </Button>
                            </form>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto rounded-lg border border-border">
                                <div className={cn('hidden items-center gap-3 border-b border-border bg-muted/50 px-4 py-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase xl:grid', rowGridClassName)}>
                                    <div>Receipt</div>
                                    <div>Date</div>
                                    <div>Person</div>
                                    <div>Paid to</div>
                                    <div>What it was for</div>
                                    <div>Category</div>
                                    <div className="text-right">Total</div>
                                    <div className="text-right">Paid</div>
                                    <div className="text-right">To be paid</div>
                                    <div className="text-right">Actions</div>
                                </div>

                                {expenses.data.length > 0 ? (
                                    expenses.data.map((expense) => (
                                        <div
                                            key={expense.id}
                                            className={cn(
                                                'grid gap-3 border-b border-border px-4 py-4 last:border-b-0 xl:min-h-20 xl:items-center xl:gap-3',
                                                rowGridClassName,
                                            )}
                                            onMouseEnter={(event) => showReceipt(expense, event.currentTarget)}
                                            onMouseLeave={() => setHover(null)}
                                        >
                                            <div>
                                                <DirectoryFieldLabel hideFrom="xl">Receipt</DirectoryFieldLabel>
                                                {expense.receipt_preview_url ? (
                                                    <img
                                                        src={expense.receipt_preview_url}
                                                        alt={expense.receipt_name || 'Receipt'}
                                                        className="h-10 w-10 rounded-md border border-border bg-background object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">—</span>
                                                )}
                                            </div>
                                            <div>
                                                <DirectoryFieldLabel hideFrom="xl">Date</DirectoryFieldLabel>
                                                <p className="text-sm text-foreground">{displayDate(expense.spent_on)}</p>
                                            </div>
                                            <div className="min-w-0">
                                                <DirectoryFieldLabel hideFrom="xl">Person</DirectoryFieldLabel>
                                                <p className="truncate text-sm text-foreground">{expense.person_name || 'No person'}</p>
                                            </div>
                                            <div className="min-w-0">
                                                <DirectoryFieldLabel hideFrom="xl">Paid to</DirectoryFieldLabel>
                                                <p className="truncate text-sm text-muted-foreground">{expense.payee}</p>
                                            </div>
                                            <div className="min-w-0">
                                                <DirectoryFieldLabel hideFrom="xl">What it was for</DirectoryFieldLabel>
                                                <p className="font-medium wrap-break-word text-foreground">{expense.description}</p>
                                            </div>
                                            <div>
                                                <DirectoryFieldLabel hideFrom="xl">Category</DirectoryFieldLabel>
                                                <Badge variant="outline">{expense.category_label}</Badge>
                                            </div>
                                            <div className="xl:text-right">
                                                <DirectoryFieldLabel hideFrom="xl">Total</DirectoryFieldLabel>
                                                <p className="text-sm font-medium tabular-nums text-foreground">{money(expense.amount)}</p>
                                            </div>
                                            <div className="xl:text-right">
                                                <DirectoryFieldLabel hideFrom="xl">Paid</DirectoryFieldLabel>
                                                <p className="text-sm tabular-nums text-foreground">{money(expense.paid_amount)}</p>
                                            </div>
                                            <div className="xl:text-right">
                                                <DirectoryFieldLabel hideFrom="xl">To be paid</DirectoryFieldLabel>
                                                <p className="text-sm tabular-nums text-foreground">{money(expense.scheduled_amount)}</p>
                                            </div>
                                            <div className="flex min-w-0 flex-col gap-1 md:items-end">
                                                <DirectoryFieldLabel hideFrom="xl">Actions</DirectoryFieldLabel>
                                                <div className="flex flex-wrap gap-1.5 md:justify-end">
                                                    <ActionHint hint="Edit this expense">
                                                        <Button
                                                            variant="outline"
                                                            size="icon-sm"
                                                            className="border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-800/60 dark:text-amber-400 dark:hover:bg-amber-950/40"
                                                            asChild
                                                        >
                                                            <Link
                                                                href={route('admin.expenses.edit', expense.id)}
                                                                aria-label="Edit this expense"
                                                            >
                                                                <EditIcon className="size-4" />
                                                            </Link>
                                                        </Button>
                                                    </ActionHint>
                                                    {confirming === expense.id ? (
                                                        <Button
                                                            type="button"
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() =>
                                                                router.delete(route('admin.expenses.destroy', expense.id), {
                                                                    preserveScroll: true,
                                                                    onFinish: () => setConfirming(null),
                                                                })
                                                            }
                                                        >
                                                            Confirm
                                                        </Button>
                                                    ) : (
                                                        <ActionHint hint="Delete this expense">
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="icon-sm"
                                                                className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-800/60 dark:text-rose-400 dark:hover:bg-rose-950/40"
                                                                aria-label="Delete this expense"
                                                                onClick={() => setConfirming(expense.id)}
                                                            >
                                                                <Trash2Icon className="size-4" />
                                                            </Button>
                                                        </ActionHint>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                                        No expenses found.
                                    </div>
                                )}
                            </div>
                            <PaginationNav paginator={expenses} itemLabel="expenses" />
                            {hover
                                ? createPortal(
                                    <div
                                        className="pointer-events-none fixed z-50 rounded-lg border border-border bg-background p-2 shadow-lg"
                                        style={{ top: hover.top, left: hover.left }}
                                    >
                                        <img
                                            src={hover.src}
                                            alt={hover.name}
                                            className="max-h-72 max-w-xs rounded-md bg-white object-contain"
                                        />
                                    </div>,
                                    document.body,
                                )
                                : null}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
