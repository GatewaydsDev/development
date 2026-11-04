import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeftIcon, PrinterIcon } from 'lucide-react';
import { resultClasses, type JobSchedule } from './types';

type Props = {
    job: JobSchedule;
    report: {
        uuid: string;
        inspected_on: string;
        result: string;
        result_label: string;
        inspector: string | null;
        task: string | null;
        notes: string | null;
        corrective_action: string | null;
        quality_control: string | null;
        checklist: { label: string; answer: string; reason: string | null }[];
    };
};

const answerLabels: Record<string, string> = {
    pass: 'Pass',
    fail: 'Fail',
    na: 'N/A',
};

export default function Report({ job, report }: Props) {
    return (
        <AuthenticatedLayout
            header={
                <div className="print:hidden">
                    <Link
                        href={route('admin.job-progress.show', job.uuid)}
                        className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeftIcon className="size-3" /> Job progress
                    </Link>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Quality control report
                    </h2>
                </div>
            }
        >
            <Head title="Quality control report" />
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:py-8">
                <div className="flex justify-end print:hidden">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => window.print()}
                    >
                        <PrinterIcon className="mr-1 size-4" /> Print
                    </Button>
                </div>
                <Card>
                    <CardContent className="flex flex-col gap-5 p-6 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-semibold">
                                    {report.task}
                                </h3>
                                <p className="text-muted-foreground">
                                    {job.project?.name}
                                    {job.project?.project_number &&
                                        ` · ${job.project.project_number}`}
                                </p>
                            </div>
                            <span
                                className={`rounded-full px-3 py-1 font-medium ${resultClasses[report.result] ?? ''}`}
                            >
                                {report.result_label}
                            </span>
                        </div>

                        <dl className="grid gap-3 sm:grid-cols-2">
                            <Item label="Inspection date" value={report.inspected_on} />
                            <Item label="Inspector" value={report.inspector} />
                            <Item label="Foreman" value={job.foreman} />
                            <Item
                                label="Quality control person"
                                value={report.quality_control}
                            />
                        </dl>

                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-border text-xs text-muted-foreground">
                                    <th className="py-2">Check</th>
                                    <th className="py-2 text-right">Result</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.checklist.map((item) => (
                                    <tr
                                        key={item.label}
                                        className="border-b border-border last:border-0"
                                    >
                                        <td className="py-2">
                                            {item.label}
                                            {item.reason && (
                                                <span className="block text-xs text-red-600">
                                                    Reason: {item.reason}
                                                </span>
                                            )}
                                        </td>
                                        <td
                                            className={`py-2 text-right font-medium ${item.answer === 'fail' ? 'text-red-600' : ''}`}
                                        >
                                            {answerLabels[item.answer] ??
                                                item.answer}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {report.notes && (
                            <Item label="Notes" value={report.notes} />
                        )}
                        {report.corrective_action && (
                            <Item
                                label="Corrective action"
                                value={report.corrective_action}
                            />
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
            <dd className="whitespace-pre-line">{value ?? '—'}</dd>
        </div>
    );
}
