import ActionHint from '@/Components/ActionHint';
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
import { Head, Link, router } from '@inertiajs/react';
import { EditIcon, PlusIcon, ReceiptIcon, SearchIcon, Trash2Icon } from 'lucide-react';
import { FormEvent, Fragment, useState } from 'react';
import { createPortal } from 'react-dom';

type ExpenseRow = {
    id: number;
    spent_on: string;
    person_name: string;
    payee: string;
    description: string;
    category_label: string;
    group_name: string;
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
        group: string;
    };
    categories: Record<string, string>;
    groups: { name: string; count: number; total: string }[];
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

const cell = 'border-b border-border px-2 py-2 align-middle whitespace-nowrap';
const headCell = 'sticky top-0 z-20 border-b border-border bg-muted px-2 py-2 text-left text-[11px] font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase';

type HoverPreview = {
    src: string;
    name: string;
    top: number;
    left: number;
};

export default function Index({
    filters,
    categories,
    groups,
    total,
    paid,
    scheduled,
    count,
    expenses,
}: Props) {
    const [search, setSearch] = useState(filters.search);
    const [category, setCategory] = useState(filters.category);
    const [group, setGroup] = useState(filters.group);
    const [confirming, setConfirming] = useState<number | null>(null);
    const [hover, setHover] = useState<HoverPreview | null>(null);

    const showReceipt = (expense: ExpenseRow, row: HTMLTableRowElement) => {
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
            { search, category, group },
            { preserveState: true, replace: true },
        );
    };
    const showGroups = expenses.data.some((expense) => expense.group_name.trim() !== '');
    let previousGroup = '\u0000';

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
                                <CardDescription>Purchases are listed under a group, such as Course in Maryland.</CardDescription>
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
                                    value={group}
                                    onChange={(event) => setGroup(event.target.value)}
                                    aria-label="Filter by group"
                                    className="h-11 min-w-[8.5rem] rounded-md border border-border bg-background px-4 text-sm text-foreground"
                                >
                                    <option value="">All groups</option>
                                    {groups.filter((item) => item.name !== '').map((item) => (
                                        <option key={item.name} value={item.name}>{item.name}</option>
                                    ))}
                                </select>
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
                            <div className="-mx-1 overflow-x-auto rounded-lg border border-border">
                                <table className="w-full min-w-[48rem] table-fixed border-collapse text-xs text-foreground sm:text-sm">
                                    <thead>
                                        <tr>
                                            <th className={`${headCell} sticky left-0 z-30 w-12 bg-muted`}>Receipt</th>
                                            <th className={`${headCell} w-24`}>Date</th>
                                            <th className={`${headCell} w-32`}>Person</th>
                                            <th className={`${headCell} w-32`}>Paid to</th>
                                            <th className={`${headCell} min-w-40`}>What it was for</th>
                                            <th className={`${headCell} w-28`}>Category</th>
                                            <th className={`${headCell} w-24 text-right`}>Total</th>
                                            <th className={`${headCell} w-24 text-right`}>Paid</th>
                                            <th className={`${headCell} w-28 text-right`}>To be paid</th>
                                            <th className={`${headCell} w-32 text-right`}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {expenses.data.length > 0 ? (
                                            expenses.data.map((expense) => {
                                                const groupName = expense.group_name.trim();
                                                const heading = showGroups && groupName !== previousGroup;
                                                const summary = groups.find((item) => item.name === groupName);
                                                previousGroup = groupName;

                                                return (
                                                <Fragment key={expense.id}>
                                                {heading ? (
                                                    <tr>
                                                        <td colSpan={10} className="border-b border-emerald-200 bg-emerald-50 px-2 py-2 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <span className="font-semibold">{groupName || 'No group'}</span>
                                                                <span className="shrink-0 tabular-nums">{summary ? `${summary.count} · ${money(summary.total)}` : ''}</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : null}
                                                <tr
                                                    className="bg-background"
                                                    onMouseEnter={(event) => showReceipt(expense, event.currentTarget)}
                                                    onMouseLeave={() => setHover(null)}
                                                >
                                                    <td className={`${cell} sticky left-0 z-10 bg-background`}>
                                                        {expense.receipt_preview_url ? (
                                                            <img
                                                                src={expense.receipt_preview_url}
                                                                alt={expense.receipt_name || 'Receipt'}
                                                                className="h-8 w-8 rounded border border-border bg-background object-cover"
                                                            />
                                                        ) : (
                                                            <span className="text-muted-foreground">—</span>
                                                        )}
                                                    </td>
                                                    <td className={`${cell} tabular-nums`}>{displayDate(expense.spent_on)}</td>
                                                    <td className={`${cell} max-w-32 truncate`}>{expense.person_name || 'No person'}</td>
                                                    <td className={`${cell} max-w-32 truncate text-muted-foreground`}>{expense.payee}</td>
                                                    <td className={`${cell} max-w-56 truncate font-medium`}>{expense.description}</td>
                                                    <td className={cell}>
                                                        <Badge variant="outline" className="max-w-28 truncate">{expense.category_label}</Badge>
                                                    </td>
                                                    <td className={`${cell} text-right font-medium tabular-nums`}>{money(expense.amount)}</td>
                                                    <td className={`${cell} text-right tabular-nums`}>{money(expense.paid_amount)}</td>
                                                    <td className={`${cell} text-right tabular-nums`}>{money(expense.scheduled_amount)}</td>
                                                    <td className={cell}>
                                                        <div className="flex justify-end gap-1">
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
                                                    </td>
                                                </tr>
                                                </Fragment>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td className="px-4 py-10 text-center text-sm text-muted-foreground" colSpan={10}>
                                                    No expenses found.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
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
