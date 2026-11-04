import { Button } from '@/Components/ui/button';
import { useForm } from '@inertiajs/react';

type Props = {
    scheduleUuid: string;
    taskUuid: string;
    today: string;
    checklist: Record<string, string>;
    results: Record<string, string>;
    onDone: () => void;
};

const answers: [string, string][] = [
    ['pass', 'Pass'],
    ['fail', 'Fail'],
    ['na', 'N/A'],
];

export default function QualityReportForm({
    scheduleUuid,
    taskUuid,
    today,
    checklist,
    results,
    onDone,
}: Props) {
    const form = useForm({
        inspected_on: today,
        result: 'passed',
        checklist: Object.fromEntries(
            Object.keys(checklist).map((key) => [key, 'pass']),
        ) as Record<string, string>,
        fail_reasons: {} as Record<string, string>,
        notes: '',
        corrective_action: '',
    });

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        form.post(
            route('admin.job-progress.reports.store', [scheduleUuid, taskUuid]),
            { preserveScroll: true, onSuccess: onDone },
        );
    };

    return (
        <form
            onSubmit={submit}
            className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm"
        >
            <div className="grid gap-2">
                {Object.entries(checklist).map(([key, label]) => (
                    <div key={key} className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>{label}</span>
                        <div className="flex gap-1">
                            {answers.map(([value, text]) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() =>
                                        form.setData('checklist', {
                                            ...form.data.checklist,
                                            [key]: value,
                                        })
                                    }
                                    className={`rounded-md border px-2 py-1 text-xs ${
                                        form.data.checklist[key] === value
                                            ? value === 'fail'
                                                ? 'border-red-600 bg-red-600 text-white'
                                                : 'border-emerald-600 bg-emerald-600 text-white'
                                            : 'border-border hover:bg-muted'
                                    }`}
                                >
                                    {text}
                                </button>
                            ))}
                        </div>
                    </div>
                    {form.data.checklist[key] === 'fail' && (
                        <div>
                            <input
                                type="text"
                                autoFocus
                                placeholder="Why did this check fail?"
                                value={form.data.fail_reasons[key] ?? ''}
                                onChange={(event) =>
                                    form.setData('fail_reasons', {
                                        ...form.data.fail_reasons,
                                        [key]: event.target.value,
                                    })
                                }
                                className="w-full rounded-md border border-red-300 bg-background px-2 py-1.5"
                            />
                            {(form.errors as Record<string, string>)[
                                `fail_reasons.${key}`
                            ] && (
                                <span className="text-xs text-red-600">
                                    {
                                        (form.errors as Record<string, string>)[
                                            `fail_reasons.${key}`
                                        ]
                                    }
                                </span>
                            )}
                        </div>
                    )}
                    </div>
                ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Result</span>
                    <select
                        value={form.data.result}
                        onChange={(event) =>
                            form.setData('result', event.target.value)
                        }
                        className="rounded-md border border-border bg-background px-2 py-1.5"
                    >
                        {Object.entries(results).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                    {form.errors.result && (
                        <span className="text-xs text-red-600">
                            {form.errors.result}
                        </span>
                    )}
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                        Inspection date
                    </span>
                    <input
                        type="date"
                        max={today}
                        value={form.data.inspected_on}
                        onChange={(event) =>
                            form.setData('inspected_on', event.target.value)
                        }
                        className="rounded-md border border-border bg-background px-2 py-1.5"
                    />
                </label>
            </div>

            <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Notes</span>
                <textarea
                    rows={2}
                    value={form.data.notes}
                    onChange={(event) =>
                        form.setData('notes', event.target.value)
                    }
                    className="rounded-md border border-border bg-background px-2 py-1.5"
                />
            </label>

            {form.data.result !== 'passed' && (
                <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                        Corrective action
                    </span>
                    <textarea
                        rows={2}
                        value={form.data.corrective_action}
                        onChange={(event) =>
                            form.setData('corrective_action', event.target.value)
                        }
                        className="rounded-md border border-border bg-background px-2 py-1.5"
                    />
                    {form.errors.corrective_action && (
                        <span className="text-xs text-red-600">
                            {form.errors.corrective_action}
                        </span>
                    )}
                </label>
            )}

            <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={form.processing}>
                    Save report
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={onDone}>
                    Cancel
                </Button>
            </div>
        </form>
    );
}
