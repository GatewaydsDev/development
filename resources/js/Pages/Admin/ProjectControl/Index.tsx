import ActionHint from '@/Components/ActionHint';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/Components/ui/dialog';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { BellIcon, DownloadIcon, EditIcon, ExpandIcon, EyeIcon, PlusIcon, SearchIcon, UploadIcon } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { displayReminderWhen, reminderHow, reminderLabel, ReminderStatus, type ScheduledReminder } from './Partials/ReminderCards';
import ReminderDialog, { type ReminderJob, type ReminderPerson } from './Partials/ReminderDialog';

type JobRow = {
    uuid: string;
    job_code: string;
    name: string;
    customer: string | null;
    location: string | null;
    pipeline_status: string;
    status_note: string | null;
    award_status: string | null;
    current_value: string;
    material_cost: string | null;
    freight_cost: string | null;
    labor_cost: string | null;
    other_cost: string | null;
    direct_cost: string | null;
    profit: string | null;
    margin: string | null;
    deposit_due: string | null;
    next_follow_up_date: string | null;
    next_step: string | null;
    cash_flag: string | null;
    material_payment_date: string | null;
    customer_payment_date: string | null;
    counts_in_demonstrated: boolean;
    project: string | null;
    project_edit: string | null;
    records: {
        bid: string | null;
        quotation: string | null;
        takeoff: string | null;
    };
};

type Summary = {
    pipeline_value: string;
    demonstrated_value: string;
    known_cost: string;
    known_profit: string;
    known_margin: string | null;
    deposits_due: string;
    unordered_openings: number;
    calls_this_week: number;
    active_count: number;
    hold_count: number;
    lost_count: number;
};

type LineRow = {
    uuid: string;
    job_code: string;
    name: string;
    item: string;
    status: string;
    kind: string;
};

type PaymentRow = {
    uuid: string;
    date: string;
    kind: string;
    job_code: string;
    name: string;
    customer: string | null;
    amount: string | null;
};

type DepositRow = {
    uuid: string;
    job_code: string;
    name: string;
    customer: string | null;
    amount: string;
};

type Props = {
    report: 'pipeline' | 'hold' | 'queue' | 'cash';
    filters: {
        search: string;
        start: string;
        end: string;
    };
    people: ReminderPerson[];
    catalog: ReminderJob[];
    reminders: ScheduledReminder[];
    summary: Summary;
    jobs: JobRow[];
    calls: JobRow[];
    unordered: LineRow[];
    deposits: DepositRow[];
    payments: PaymentRow[];
};

const reports = [
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'hold', label: 'Lost and on hold' },
    { id: 'queue', label: 'Action queue' },
    { id: 'cash', label: 'Cash' },
] as const;

const money = (value: string | null | undefined) => {
    if (value === null || value === undefined || value === '') {
        return '—';
    }

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(Number(value));
};

const displayDate = (value: string | null) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');

    if (!match) {
        return '—';
    }

    return `${match[2]}/${match[3]}/${match[1]}`;
};

const statusLabel = (status: string) => {
    if (status === 'on_hold') {
        return 'On hold';
    }

    if (status === 'lost') {
        return 'Lost';
    }

    return 'Active';
};

const headCell =
    'sticky top-0 z-20 border-b border-border bg-muted px-2 py-2 text-left text-[11px] font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase';
const cell = 'border-b border-border px-2 py-2 align-top';

export default function Index({
    report,
    filters,
    people,
    catalog,
    reminders,
    summary,
    jobs,
    calls,
    unordered,
    deposits,
    payments,
}: Props) {
    const errors = usePage().props.errors as { workbook?: string };
    const [importing, setImporting] = useState(false);
    const [search, setSearch] = useState(filters.search);
    const [start, setStart] = useState(filters.start);
    const [end, setEnd] = useState(filters.end);
    const [reminderOpen, setReminderOpen] = useState(false);
    const [reminderJob, setReminderJob] = useState(catalog[0]?.uuid ?? '');
    const holdJobs = jobs.filter((job) => job.pipeline_status === 'on_hold');
    const lostJobs = jobs.filter((job) => job.pipeline_status === 'lost');

    const submitImport = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);

        setImporting(true);
        router.post(route('admin.project-control.import'), data, {
            forceFormData: true,
            onFinish: () => setImporting(false),
        });
    };

    const query = {
        report,
        search: search || undefined,
        start: start || undefined,
        end: end || undefined,
    };

    const applySearch = (event: FormEvent) => {
        event.preventDefault();
        router.get(route('admin.project-control.index'), query, { preserveState: true, replace: true });
    };

    const clearSearch = () => {
        setSearch('');
        setStart('');
        setEnd('');
        router.get(route('admin.project-control.index'), { report }, { preserveState: true, replace: true });
    };

    const openReminder = (uuid: string) => {
        setReminderJob(uuid);
        setReminderOpen(true);
    };

    return (
        <AuthenticatedLayout
            fullWidth
            header={
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                            Project control
                        </h2>
                        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                            Update the job, its current bid, and its openings. Pipeline value uses each active job&apos;s current value. Subset bids and opening prices stay out of that total.
                        </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button type="button" className="bg-sky-700 text-white hover:bg-sky-800" onClick={() => openReminder(catalog[0]?.uuid ?? '')}>
                            <BellIcon className="h-4 w-4" />
                            Reminder
                        </Button>
                        <Button asChild variant="create">
                            <Link href={route('admin.project-control.create')}>
                                <PlusIcon className="h-4 w-4" />
                                Add job
                            </Link>
                        </Button>
                    </div>
                </div>
            }
        >
            <Head title="Project control" />

            <div className="space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                <form onSubmit={applySearch} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end">
                    <label className="block w-full min-w-0 flex-1 text-sm font-medium text-foreground sm:min-w-48">
                        Search
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Job, customer, or project"
                            className="mt-1 h-11 w-full rounded-md border border-border bg-background px-3 text-base font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
                        />
                    </label>
                    <label className="block w-full text-sm font-medium text-foreground sm:w-auto">
                        Follow-up from
                        <input
                            type="date"
                            value={start}
                            onChange={(event) => setStart(event.target.value)}
                            className="mt-1 h-11 w-full rounded-md border border-border bg-background px-3 text-base font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:text-sm dark:[color-scheme:dark]"
                        />
                    </label>
                    <label className="block w-full text-sm font-medium text-foreground sm:w-auto">
                        Follow-up to
                        <input
                            type="date"
                            value={end}
                            onChange={(event) => setEnd(event.target.value)}
                            className="mt-1 h-11 w-full rounded-md border border-border bg-background px-3 text-base font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:text-sm dark:[color-scheme:dark]"
                        />
                    </label>
                    <Button type="submit" className="min-h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto">
                        <SearchIcon className="h-4 w-4" />
                        Search
                    </Button>
                    {filters.search || filters.start || filters.end ? (
                        <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={clearSearch}>
                            Clear
                        </Button>
                    ) : null}
                </form>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <SummaryCard label="Pipeline value" value={money(summary.pipeline_value)} detail={`${summary.active_count} active jobs`} />
                    <SummaryCard label="Known margin" value={summary.known_margin === null ? '—' : `${summary.known_margin}%`} detail={`${money(summary.known_profit)} on ${money(summary.known_cost)} known cost`} />
                    <SummaryCard label="Deposits due" value={money(summary.deposits_due)} detail="From the deposit percent on active jobs" />
                    <SummaryCard label="Openings still unordered" value={String(summary.unordered_openings)} detail="Active jobs with no purchase order" />
                    <SummaryCard label="Who to call this week" value={String(summary.calls_this_week)} detail="Follow-ups due through Sunday, including earlier ones still open" />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <nav className="flex flex-wrap gap-2" aria-label="Reports">
                        {reports.map((item) => (
                            <Link
                                key={item.id}
                                href={route('admin.project-control.index', {
                                    report: item.id,
                                    search: filters.search || undefined,
                                    start: filters.start || undefined,
                                    end: filters.end || undefined,
                                })}
                                className={
                                    report === item.id
                                        ? 'inline-flex h-8 items-center rounded-md bg-emerald-700 px-3 text-sm font-medium text-white'
                                        : 'inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted'
                                }
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button variant="outline" asChild className="border-sky-300 bg-sky-600 text-white hover:bg-sky-700 hover:text-white">
                            <a href={route('admin.project-control.export', {
                                search: filters.search || undefined,
                                start: filters.start || undefined,
                                end: filters.end || undefined,
                            })}>
                                <DownloadIcon className="h-4 w-4" />
                                Export Excel
                            </a>
                        </Button>
                        <form onSubmit={submitImport} className="flex flex-wrap items-center justify-end gap-2">
                            <input
                                name="workbook"
                                type="file"
                                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                required
                                className="h-8 max-w-40 text-sm text-muted-foreground file:mr-2 file:h-8 file:rounded-md file:border-0 file:bg-amber-100 file:px-2 file:text-sm file:font-medium file:text-amber-900"
                                aria-label="September workbook"
                            />
                            <Button type="submit" className="bg-amber-600 text-white hover:bg-amber-700" disabled={importing}>
                                <UploadIcon className="h-4 w-4" />
                                {importing ? 'Importing' : 'Import'}
                            </Button>
                        </form>
                    </div>
                </div>
                {errors.workbook ? <p className="text-sm text-destructive">{errors.workbook}</p> : null}
                <p className="text-sm text-muted-foreground">
                    Import the September workbook once. Jobs already here are left as you saved them. Demonstrated value in this set is {money(summary.demonstrated_value)}. On hold: {summary.hold_count}. Lost: {summary.lost_count}.
                </p>

                {report === 'queue' ? <CallList calls={calls} /> : null}
                {report === 'hold' ? (
                    <div className="space-y-6">
                        <JobTable title="On hold" jobs={holdJobs} mode="hold" reminders={reminders} onRemind={openReminder} />
                        <JobTable title="Lost" jobs={lostJobs} mode="hold" reminders={reminders} onRemind={openReminder} />
                    </div>
                ) : (
                    <JobTable
                        title={reports.find((item) => item.id === report)?.label ?? 'Pipeline'}
                        jobs={jobs}
                        mode={report === 'cash' ? 'cash' : report === 'queue' ? 'queue' : 'pipeline'}
                        reminders={reminders}
                        onRemind={openReminder}
                    />
                )}

                {report === 'pipeline' ? <UnorderedTable rows={unordered} /> : null}
                {report === 'cash' ? (
                    <div className="space-y-6">
                        <DepositTable rows={deposits} />
                        <PaymentTable rows={payments} />
                    </div>
                ) : null}
            </div>
            <ReminderDialog
                open={reminderOpen}
                jobUuid={reminderJob}
                jobs={catalog}
                people={people}
                onOpenChange={setReminderOpen}
            />
        </AuthenticatedLayout>
    );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
    return (
        <section className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
        </section>
    );
}

function CallList({ calls }: { calls: JobRow[] }) {
    return (
        <section className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">Who to call this week</h3>
            {calls.length === 0 ? (
                <p className="text-sm text-muted-foreground">No follow-ups are due through Sunday.</p>
            ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                    {calls.map((job) => (
                        <Link
                            key={job.uuid}
                            href={route('admin.project-control.edit', job.uuid)}
                            className="rounded-lg border border-border bg-card p-4 transition hover:border-emerald-700"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="font-medium text-foreground">{job.customer || 'Customer not set'}</p>
                                    <p className="text-sm text-muted-foreground">{job.job_code} · {job.name}</p>
                                </div>
                                <p className="text-sm font-medium text-foreground">{displayDate(job.next_follow_up_date)}</p>
                            </div>
                            <div className="mt-3">
                                <ColumnText label="Next step" value={job.next_step || 'No next step recorded.'} wide />
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </section>
    );
}

function JobTable({
    title,
    jobs,
    mode,
    reminders,
    onRemind,
}: {
    title: string;
    jobs: JobRow[];
    mode: 'pipeline' | 'hold' | 'queue' | 'cash';
    reminders: ScheduledReminder[];
    onRemind: (uuid: string) => void;
}) {
    const [openReminder, setOpenReminder] = useState<ScheduledReminder | null>(null);
    const forJob = (uuid: string) => reminders.filter((reminder) => reminder.job_uuid === uuid);

    return (
        <section className="overflow-hidden rounded-lg border border-border">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h3 className="font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground">{jobs.length}</p>
            </div>
            <div className="space-y-3 p-3 md:hidden">
                {jobs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No jobs in this report.</p>
                ) : (
                    jobs.map((job) => (
                        <article key={job.uuid} className="rounded-lg border border-border bg-card p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <Link href={route('admin.project-control.edit', job.uuid)} className="text-base font-semibold text-emerald-700 hover:underline dark:text-emerald-300">
                                        {job.job_code}
                                    </Link>
                                    <ReminderBadges reminders={forJob(job.uuid)} onOpen={setOpenReminder} />
                                    <JobActions jobUuid={job.uuid} />
                                </div>
                                <p className="text-sm font-medium text-foreground">{money(job.current_value)}</p>
                            </div>
                            <div className="mt-2">
                                <ColumnText label="Project" value={job.name} wide />
                            </div>
                            <div className="mt-2">
                                <ColumnText label="Customer" value={job.customer} wide />
                            </div>
                            <div className="mt-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Records</p>
                                <RecordLinks records={job.records} />
                            </div>
                            {mode === 'hold' ? (
                                <div className="mt-2">
                                    <Badge variant={job.pipeline_status === 'lost' ? 'destructive' : 'secondary'}>{statusLabel(job.pipeline_status)}</Badge>
                                    <div className="mt-2">
                                        <ColumnText label="Status note" value={job.status_note} wide />
                                    </div>
                                </div>
                            ) : null}
                            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                {mode === 'cash' ? (
                                    <>
                                        <div><dt className="text-muted-foreground">Material</dt><dd>{money(job.material_cost)}</dd></div>
                                        <div><dt className="text-muted-foreground">Freight</dt><dd>{money(job.freight_cost)}</dd></div>
                                        <div><dt className="text-muted-foreground">Labor</dt><dd>{money(job.labor_cost)}</dd></div>
                                        <div><dt className="text-muted-foreground">Other</dt><dd>{money(job.other_cost)}</dd></div>
                                        <div><dt className="text-muted-foreground">Profit</dt><dd>{money(job.profit)}</dd></div>
                                    </>
                                ) : null}
                                {mode !== 'hold' ? <div><dt className="text-muted-foreground">Margin</dt><dd>{job.margin === null ? '—' : `${job.margin}%`}</dd></div> : null}
                                {mode !== 'queue' ? <div><dt className="text-muted-foreground">Deposit</dt><dd>{money(job.deposit_due)}</dd></div> : null}
                                {mode !== 'cash' ? <div><dt className="text-muted-foreground">Follow-up</dt><dd>{displayDate(job.next_follow_up_date)}</dd></div> : null}
                                {mode === 'cash' ? (
                                    <>
                                        <div><dt className="text-muted-foreground">Material payment</dt><dd>{displayDate(job.material_payment_date)}</dd></div>
                                        <div><dt className="text-muted-foreground">Customer payment</dt><dd>{displayDate(job.customer_payment_date)}</dd></div>
                                    </>
                                ) : null}
                            </dl>
                            {mode !== 'cash' ? (
                                <div className="mt-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next step</p>
                                    <ColumnText label="Next step" value={job.next_step} wide />
                                </div>
                            ) : null}
                            <Button type="button" className="mt-3 min-h-11 w-full bg-sky-600 text-white hover:bg-sky-700" onClick={() => onRemind(job.uuid)}>
                                <BellIcon className="h-4 w-4" />
                                Reminder
                            </Button>
                        </article>
                    ))
                )}
            </div>
            <div className="hidden max-h-[40rem] overflow-auto md:block">
                <table className="min-w-full border-separate border-spacing-0 text-sm">
                    <thead>
                        <tr>
                            <th className={`${headCell} left-0 z-30`}>Actions</th>
                            <th className={headCell}>Job</th>
                            <th className={headCell}>Project</th>
                            <th className={headCell}>Customer</th>
                            <th className={headCell}>Records</th>
                            {mode === 'hold' ? <th className={headCell}>Status</th> : null}
                            <th className={headCell}>Value</th>
                            {mode === 'cash' ? (
                                <>
                                    <th className={headCell}>Material</th>
                                    <th className={headCell}>Freight</th>
                                    <th className={headCell}>Labor</th>
                                    <th className={headCell}>Other</th>
                                    <th className={headCell}>Profit</th>
                                </>
                            ) : null}
                            {mode !== 'hold' ? <th className={headCell}>Margin</th> : null}
                            {mode !== 'queue' ? <th className={headCell}>Deposit</th> : null}
                            {mode !== 'cash' ? <th className={headCell}>Follow-up</th> : null}
                            {mode === 'cash' ? (
                                <>
                                    <th className={headCell}>Material payment</th>
                                    <th className={headCell}>Customer payment</th>
                                </>
                            ) : (
                                <th className={headCell}>Next step</th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {jobs.length === 0 ? (
                            <tr>
                                <td className={cell} colSpan={8}>
                                    No jobs in this report.
                                </td>
                            </tr>
                        ) : (
                            jobs.map((job) => (
                                <tr key={job.uuid} className="hover:bg-muted/40">
                                    <td className={`${cell} sticky left-0 z-10 whitespace-nowrap bg-card`}>
                                        <JobActions jobUuid={job.uuid} />
                                    </td>
                                    <td className={`${cell} whitespace-nowrap font-medium`}>
                                        <Link href={route('admin.project-control.edit', job.uuid)} className="text-emerald-700 hover:underline dark:text-emerald-300">
                                            {job.job_code}
                                        </Link>
                                        <ReminderBadges reminders={forJob(job.uuid)} onOpen={setOpenReminder} />
                                        <button type="button" className="mt-1 block text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-300" onClick={() => onRemind(job.uuid)}>
                                            Reminder
                                        </button>
                                    </td>
                                    <td className={cell}>
                                        <ColumnText label="Project" value={job.name} />
                                        {job.counts_in_demonstrated ? <Badge variant="secondary" className="mt-1">Demonstrated</Badge> : null}
                                    </td>
                                    <td className={cell}>
                                        <ColumnText label="Customer" value={job.customer} />
                                    </td>
                                    <td className={cell}>
                                        <RecordLinks records={job.records} />
                                    </td>
                                    {mode === 'hold' ? (
                                        <td className={cell}>
                                            <Badge variant={job.pipeline_status === 'lost' ? 'destructive' : 'secondary'}>{statusLabel(job.pipeline_status)}</Badge>
                                            <div className="mt-1">
                                                <ColumnText label="Status note" value={job.status_note} />
                                            </div>
                                        </td>
                                    ) : null}
                                    <td className={`${cell} whitespace-nowrap`}>{money(job.current_value)}</td>
                                    {mode === 'cash' ? (
                                        <>
                                            <td className={`${cell} whitespace-nowrap`}>{money(job.material_cost)}</td>
                                            <td className={`${cell} whitespace-nowrap`}>{money(job.freight_cost)}</td>
                                            <td className={`${cell} whitespace-nowrap`}>{money(job.labor_cost)}</td>
                                            <td className={`${cell} whitespace-nowrap`}>{money(job.other_cost)}</td>
                                            <td className={`${cell} whitespace-nowrap`}>{money(job.profit)}</td>
                                        </>
                                    ) : null}
                                    {mode !== 'hold' ? <td className={`${cell} whitespace-nowrap`}>{job.margin === null ? '—' : `${job.margin}%`}</td> : null}
                                    {mode !== 'queue' ? <td className={`${cell} whitespace-nowrap`}>{money(job.deposit_due)}</td> : null}
                                    {mode !== 'cash' ? <td className={`${cell} whitespace-nowrap`}>{displayDate(job.next_follow_up_date)}</td> : null}
                                    {mode === 'cash' ? (
                                        <>
                                            <td className={`${cell} whitespace-nowrap`}>{displayDate(job.material_payment_date)}</td>
                                            <td className={`${cell} whitespace-nowrap`}>{displayDate(job.customer_payment_date)}</td>
                                        </>
                                    ) : (
                                        <td className={cell}>
                                            <ColumnText label="Next step" value={job.next_step} />
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <Dialog open={openReminder !== null} onOpenChange={(open) => { if (!open) setOpenReminder(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{openReminder ? reminderLabel(openReminder) : 'Reminder'}</DialogTitle>
                        <DialogDescription>
                            {openReminder ? `${openReminder.job_code} · ${openReminder.job_name}` : ''}
                        </DialogDescription>
                    </DialogHeader>
                    {openReminder ? (
                        <table className="w-full text-sm">
                            <tbody>
                                <tr className="border-t border-border">
                                    <th className="w-24 py-2 pr-3 text-left font-medium text-muted-foreground">When</th>
                                    <td className="py-2 text-right text-foreground">{displayReminderWhen(openReminder.remind_at)}</td>
                                </tr>
                                <tr className="border-t border-border">
                                    <th className="py-2 pr-3 text-left font-medium text-muted-foreground">Who</th>
                                    <td className="py-2 text-right text-foreground">{openReminder.user_name || '—'}</td>
                                </tr>
                                <tr className="border-t border-border">
                                    <th className="py-2 pr-3 text-left font-medium text-muted-foreground">How</th>
                                    <td className="py-2 text-right text-foreground">{reminderHow(openReminder)}</td>
                                </tr>
                                <tr className="border-t border-border">
                                    <th className="py-2 pr-3 text-left font-medium text-muted-foreground">Status</th>
                                    <td className="py-2 text-right"><ReminderStatus status={openReminder.status} /></td>
                                </tr>
                            </tbody>
                        </table>
                    ) : null}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpenReminder(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}

function ReminderBadges({ reminders, onOpen }: { reminders: ScheduledReminder[]; onOpen: (reminder: ScheduledReminder) => void }) {
    if (reminders.length === 0) {
        return null;
    }

    return (
        <div className="mt-1 flex max-w-48 flex-wrap gap-1">
            {reminders.map((reminder) => (
                <button
                    key={reminder.uuid}
                    type="button"
                    title={reminderLabel(reminder)}
                    className="max-w-40 truncate rounded-full bg-rose-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-rose-700"
                    onClick={() => onOpen(reminder)}
                >
                    {reminderLabel(reminder)}
                </button>
            ))}
        </div>
    );
}

function JobActions({ jobUuid }: { jobUuid: string }) {
    const jobHref = route('admin.project-control.edit', jobUuid);

    return (
        <div className="flex flex-nowrap gap-1">
            <ActionHint hint="View job">
                <Button
                    asChild
                    variant="outline"
                    size="icon-sm"
                    className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 dark:border-indigo-800/60 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                >
                    <Link href={jobHref} aria-label="View job">
                        <EyeIcon className="size-4" />
                    </Link>
                </Button>
            </ActionHint>
            <ActionHint hint="Edit job">
                <Button
                    asChild
                    variant="outline"
                    size="icon-sm"
                    className="border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-800/60 dark:text-amber-400 dark:hover:bg-amber-950/40"
                >
                    <Link href={jobHref} aria-label="Edit job">
                        <EditIcon className="size-4" />
                    </Link>
                </Button>
            </ActionHint>
        </div>
    );
}

function UnorderedTable({ rows }: { rows: LineRow[] }) {
    return (
        <section className="overflow-hidden rounded-lg border border-border">
            <div className="border-b border-border px-4 py-3">
                <h3 className="font-semibold text-foreground">Openings still unordered</h3>
            </div>
            <div className="space-y-3 p-3 md:hidden">
                {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Every active opening has an order or is closed.</p>
                ) : (
                    rows.map((row, index) => (
                        <article key={`${row.uuid}-${index}`} className="rounded-lg border border-border bg-card p-4">
                            <Link href={route('admin.project-control.edit', row.uuid)} className="font-medium text-emerald-700 hover:underline dark:text-emerald-300">
                                {row.job_code}
                            </Link>
                            <div className="mt-2"><ColumnText label="Item" value={row.item} wide /></div>
                            <p className="mt-2 text-sm text-muted-foreground">{row.kind}</p>
                            <div className="mt-2"><ColumnText label="Status" value={row.status} wide /></div>
                        </article>
                    ))
                )}
            </div>
            <div className="hidden max-h-96 overflow-auto md:block">
                <table className="min-w-full border-separate border-spacing-0 text-sm">
                    <thead>
                        <tr>
                            <th className={headCell}>Job</th>
                            <th className={headCell}>Item</th>
                            <th className={headCell}>Kind</th>
                            <th className={headCell}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td className={cell} colSpan={4}>Every active opening has an order or is closed.</td>
                            </tr>
                        ) : (
                            rows.map((row, index) => (
                                <tr key={`${row.uuid}-${index}`}>
                                    <td className={`${cell} whitespace-nowrap`}>
                                        <Link href={route('admin.project-control.edit', row.uuid)} className="text-emerald-700 hover:underline dark:text-emerald-300">
                                            {row.job_code}
                                        </Link>
                                    </td>
                                    <td className={cell}><ColumnText label="Item" value={row.item} /></td>
                                    <td className={cell}>{row.kind}</td>
                                    <td className={cell}><ColumnText label="Status" value={row.status} /></td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function DepositTable({ rows }: { rows: DepositRow[] }) {
    return (
        <section className="overflow-hidden rounded-lg border border-border">
            <div className="border-b border-border px-4 py-3">
                <h3 className="font-semibold text-foreground">Deposits due</h3>
            </div>
            <div className="space-y-3 p-3 md:hidden">
                {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active job has a deposit percent.</p>
                ) : (
                    rows.map((row) => (
                        <article key={row.uuid} className="rounded-lg border border-border bg-card p-4">
                            <Link href={route('admin.project-control.edit', row.uuid)} className="font-medium text-emerald-700 hover:underline dark:text-emerald-300">
                                {row.job_code}
                            </Link>
                            <div className="mt-2"><ColumnText label="Project" value={row.name} wide /></div>
                            <div className="mt-2"><ColumnText label="Customer" value={row.customer} wide /></div>
                            <p className="mt-2 text-sm font-medium">{money(row.amount)}</p>
                        </article>
                    ))
                )}
            </div>
            <div className="hidden md:block">
            <table className="min-w-full text-sm">
                <thead>
                    <tr>
                        <th className={headCell}>Job</th>
                        <th className={headCell}>Customer</th>
                        <th className={headCell}>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td className={cell} colSpan={3}>No active job has a deposit percent.</td>
                        </tr>
                    ) : (
                        rows.map((row) => (
                            <tr key={row.uuid}>
                                <td className={cell}>
                                    <Link href={route('admin.project-control.edit', row.uuid)} className="font-medium text-emerald-700 hover:underline dark:text-emerald-300">
                                        {row.job_code}
                                    </Link>
                                    <ColumnText label="Project" value={row.name} />
                                </td>
                                <td className={cell}><ColumnText label="Customer" value={row.customer} /></td>
                                <td className={cell}>{money(row.amount)}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
            </div>
        </section>
    );
}

function PaymentTable({ rows }: { rows: PaymentRow[] }) {
    return (
        <section className="overflow-hidden rounded-lg border border-border">
            <div className="border-b border-border px-4 py-3">
                <h3 className="font-semibold text-foreground">Expected payments</h3>
            </div>
            <div className="space-y-3 p-3 md:hidden">
                {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No material or customer payment dates are set.</p>
                ) : (
                    rows.map((row, index) => (
                        <article key={`${row.uuid}-${row.kind}-${index}`} className="rounded-lg border border-border bg-card p-4">
                            <p className="text-sm text-muted-foreground">{displayDate(row.date)} · {row.kind}</p>
                            <Link href={route('admin.project-control.edit', row.uuid)} className="mt-2 block font-medium text-emerald-700 hover:underline dark:text-emerald-300">
                                {row.job_code}
                            </Link>
                            <div className="mt-2"><ColumnText label="Project" value={row.name} wide /></div>
                            <p className="mt-2 text-sm font-medium">{money(row.amount)}</p>
                        </article>
                    ))
                )}
            </div>
            <div className="hidden md:block">
            <table className="min-w-full text-sm">
                <thead>
                    <tr>
                        <th className={headCell}>Date</th>
                        <th className={headCell}>Kind</th>
                        <th className={headCell}>Job</th>
                        <th className={headCell}>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td className={cell} colSpan={4}>No material or customer payment dates are set.</td>
                        </tr>
                    ) : (
                        rows.map((row, index) => (
                            <tr key={`${row.uuid}-${row.kind}-${index}`}>
                                <td className={cell}>{displayDate(row.date)}</td>
                                <td className={cell}>{row.kind}</td>
                                <td className={cell}>
                                    <Link href={route('admin.project-control.edit', row.uuid)} className="font-medium text-emerald-700 hover:underline dark:text-emerald-300">
                                        {row.job_code}
                                    </Link>
                                    <ColumnText label="Project" value={row.name} />
                                </td>
                                <td className={cell}>{money(row.amount)}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
            </div>
        </section>
    );
}

function RecordLinks({ records }: { records: JobRow['records'] }) {
    const items = [
        { label: 'Bid', href: records.bid },
        { label: 'Quotation', href: records.quotation },
        { label: 'Takeoff', href: records.takeoff },
    ];

    return (
        <div className="flex flex-wrap gap-1.5">
            {items.map((item) => item.href ? (
                <Link
                    key={item.label}
                    href={item.href}
                    className="inline-flex min-h-11 items-center rounded-full bg-emerald-100 px-3 text-sm font-medium text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
                >
                    {item.label}
                </Link>
            ) : (
                <span key={item.label} className="inline-flex min-h-11 items-center rounded-full bg-muted px-3 text-sm text-muted-foreground">
                    No {item.label.toLowerCase()}
                </span>
            ))}
        </div>
    );
}

function ColumnText({ label, value, wide = false }: { label: string; value: string | null; wide?: boolean }) {
    const [open, setOpen] = useState(false);
    const text = (value ?? '').trim();

    if (text === '') {
        return <span className="text-muted-foreground">—</span>;
    }

    return (
        <div className={wide ? 'flex items-start gap-2' : 'flex max-w-44 items-start gap-2 xl:max-w-56'}>
            <p className="line-clamp-2 min-w-0 flex-1 break-words">{text}</p>
            {text.length > 42 ? (
                <Button type="button" variant="outline" className="h-11 w-11 shrink-0 px-0" aria-label={`View ${label}`} onClick={() => setOpen(true)}>
                    <ExpandIcon className="h-4 w-4" />
                </Button>
            ) : null}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{label}</DialogTitle>
                        <DialogDescription className="sr-only">Full text for {label}.</DialogDescription>
                    </DialogHeader>
                    <p className="whitespace-pre-wrap break-words pr-8 text-base text-foreground sm:text-sm">{text}</p>
                    <DialogFooter>
                        <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => setOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
