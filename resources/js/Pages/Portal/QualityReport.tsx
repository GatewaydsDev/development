import { Badge } from '@/Components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeftIcon, ShieldAlertIcon } from 'lucide-react';

type Props = {
    report: {
        uuid: string;
        project: {
            uuid: string;
            name: string;
            project_number: string | null;
        } | null;
        task: string | null;
        inspected_on: string | null;
        result: string;
        result_label: string;
        inspector: string | null;
        assigned_at: string | null;
        notes: string | null;
        corrective_action: string | null;
        checklist: {
            key: string;
            label: string;
            answer: string;
            reason: string | null;
        }[];
    };
};

const answerLabels: Record<string, string> = {
    pass: 'Pass',
    fail: 'Failed',
    na: 'N/A',
};

export default function QualityReport({ report }: Props) {
    return (
        <AuthenticatedLayout
            header={
                <div>
                    <Link
                        href={route('portal.index')}
                        className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeftIcon className="size-4" />
                        My projects
                    </Link>
                    <h2 className="flex items-center gap-2 text-xl font-semibold text-emerald-700 dark:text-emerald-300">
                        <ShieldAlertIcon className="size-5" />
                        Quality control report
                    </h2>
                </div>
            }
        >
            <Head title="Quality control report" />
            <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
                <Card>
                    <CardHeader>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <CardTitle>{report.task}</CardTitle>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {report.project?.name}
                                    {report.project?.project_number &&
                                        ` · ${report.project.project_number}`}
                                </p>
                            </div>
                            <Badge
                                variant={
                                    report.result === 'passed'
                                        ? 'secondary'
                                        : 'destructive'
                                }
                            >
                                {report.result_label}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-5">
                        <dl className="grid gap-3 text-sm sm:grid-cols-2">
                            <Item
                                label="Inspection date"
                                value={formatDate(report.inspected_on)}
                            />
                            <Item label="Inspector" value={report.inspector} />
                        </dl>

                        <div className="overflow-hidden rounded-lg border border-border">
                            {report.checklist.map((item) => (
                                <div
                                    key={item.key}
                                    className="flex items-start justify-between gap-4 border-b border-border p-3 text-sm last:border-0"
                                >
                                    <div>
                                        <p>{item.label}</p>
                                        {item.reason && (
                                            <p className="mt-1 text-sm text-red-600">
                                                What is wrong: {item.reason}
                                            </p>
                                        )}
                                    </div>
                                    <span
                                        className={
                                            item.answer === 'fail'
                                                ? 'font-semibold text-red-600'
                                                : 'text-muted-foreground'
                                        }
                                    >
                                        {answerLabels[item.answer] ??
                                            item.answer}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {report.corrective_action && (
                            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
                                <p className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-300">
                                    Corrective action required
                                </p>
                                <p className="mt-1 whitespace-pre-line text-sm">
                                    {report.corrective_action}
                                </p>
                            </div>
                        )}

                        {report.notes && (
                            <Item label="Notes" value={report.notes} />
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}

function Item({ label, value }: { label: string; value: string | null }) {
    return (
        <div>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="whitespace-pre-line text-sm">{value ?? '—'}</dd>
        </div>
    );
}

function formatDate(value: string | null): string | null {
    if (!value) {
        return null;
    }

    const [year, month, day] = value.split('-');

    return year && month && day ? `${month}/${day}/${year}` : value;
}
