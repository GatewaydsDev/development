import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PaginationNav, { type Paginator } from '@/Components/PaginationNav';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

type Choice = {
    value: string;
    label: string;
};

type Field = {
    name: string;
    label: string;
    type: 'text' | 'email' | 'textarea' | 'boolean' | 'select' | string;
    required: boolean;
    options: Choice[];
};

type Values = Record<string, string | boolean>;

type RecordRow = {
    id: number;
    summary: string;
};

type SelectedRecord = {
    id: number;
    values: Values;
};

const controlClassName =
    'h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm';

export default function Index({
    tables,
    table,
    tableLabel,
    search,
    fields,
    records,
    record,
}: {
    tables: { key: string; label: string }[];
    table: string;
    tableLabel: string;
    search: string;
    fields: Field[];
    records: Paginator & { data: RecordRow[] };
    record: SelectedRecord | null;
}) {
    const searchForm = useForm({
        table,
        search,
    });

    const openTable = (nextTable: string) => {
        router.get(
            route('admin.record-corrections.index'),
            { table: nextTable },
            { preserveScroll: true, preserveState: true },
        );
    };

    const submitSearch = (event: FormEvent) => {
        event.preventDefault();
        router.get(
            route('admin.record-corrections.index'),
            { table, search: searchForm.data.search },
            { preserveScroll: true, preserveState: true },
        );
    };

    const openRecord = (id: number) => {
        router.get(
            route('admin.record-corrections.index'),
            { table, search, record: id },
            { preserveScroll: true, preserveState: true },
        );
    };

    return (
        <AuthenticatedLayout
            fullWidth
            header={
                <h2 className="text-xl font-semibold leading-tight text-foreground">
                    Record corrections
                </h2>
            }
        >
            <Head title="Record corrections" />

            <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Correct a saved value</CardTitle>
                        <CardDescription>
                            This updates the record that is already saved. It
                            does not add a record. Open Professions, select the
                            name that was typed wrong, and replace it. Owne
                            becomes Owner on that same profession.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <InputLabel htmlFor="correction-table" value="Table" />
                                <select
                                    id="correction-table"
                                    className={controlClassName}
                                    value={table}
                                    onChange={(event) => openTable(event.target.value)}
                                >
                                    {tables.map((item) => (
                                        <option key={item.key} value={item.key}>
                                            {item.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <form className="flex gap-2" onSubmit={submitSearch}>
                                <TextInput
                                    className="h-11 min-w-0 flex-1"
                                    value={searchForm.data.search}
                                    placeholder={`Search ${tableLabel.toLowerCase()}`}
                                    onChange={(event) =>
                                        searchForm.setData('search', event.target.value)
                                    }
                                />
                                <Button className="h-11 shrink-0" type="submit" variant="outline">
                                    Search
                                </Button>
                            </form>

                            <div className="overflow-hidden rounded-md border border-border">
                                <ul className="max-h-[32rem] divide-y divide-border overflow-y-auto">
                                    {records.data.length === 0 ? (
                                        <li className="px-3 py-6 text-sm text-muted-foreground">
                                            No records in this table.
                                        </li>
                                    ) : (
                                        records.data.map((row) => (
                                            <li key={row.id}>
                                                <button
                                                    type="button"
                                                    className={`w-full px-3 py-3 text-left text-sm hover:bg-muted ${
                                                        record?.id === row.id ? 'bg-muted font-medium' : ''
                                                    }`}
                                                    onClick={() => openRecord(row.id)}
                                                >
                                                    {row.summary}
                                                </button>
                                            </li>
                                        ))
                                    )}
                                </ul>
                                <div className="border-t border-border px-3 py-2">
                                    <PaginationNav paginator={records} itemLabel="records" />
                                </div>
                            </div>
                        </div>

                        {record ? (
                            <CorrectionForm
                                key={`${table}-${record.id}`}
                                table={table}
                                fields={fields}
                                record={record}
                            />
                        ) : (
                            <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
                                Select a saved record. The form edits that record and does not create a new one.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}

function CorrectionForm({
    table,
    fields,
    record,
}: {
    table: string;
    fields: Field[];
    record: SelectedRecord;
}) {
    const form = useForm<Values>(record.values);

    const save = (event: FormEvent) => {
        event.preventDefault();
        form.patch(
            route('admin.record-corrections.update', {
                table,
                record: record.id,
            }),
            { preserveScroll: true },
        );
    };

    return (
        <form className="grid content-start gap-4" onSubmit={save}>
            <div>
                <h3 className="text-base font-semibold text-foreground">
                    Editing existing record
                </h3>
                <p className="text-sm text-muted-foreground">
                    Replace the saved text, then update this same record.
                </p>
            </div>
            {fields.map((field) => {
                const saved = record.values[field.name];
                const savedText =
                    typeof saved === 'boolean'
                        ? saved
                            ? 'Yes'
                            : 'No'
                        : String(saved ?? '');

                return (
                <div key={field.name} className="grid gap-2">
                    {field.type === 'boolean' ? (
                        <label className="flex h-11 items-center gap-3 text-sm font-medium text-foreground">
                            <input
                                type="checkbox"
                                className="size-4 rounded border-input"
                                checked={Boolean(form.data[field.name])}
                                onChange={(event) =>
                                    form.setData(field.name, event.target.checked)
                                }
                            />
                            {field.label}
                            <span className="font-normal text-muted-foreground">
                                Saved: {savedText}
                            </span>
                        </label>
                    ) : (
                        <>
                            <InputLabel
                                htmlFor={`correction-${field.name}`}
                                value={field.label}
                            />
                            <p className="text-sm text-muted-foreground">
                                Saved value: {savedText === '' ? 'empty' : savedText}
                            </p>
                            {field.type === 'textarea' ? (
                                <textarea
                                    id={`correction-${field.name}`}
                                    className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm"
                                    value={String(form.data[field.name] ?? '')}
                                    onChange={(event) =>
                                        form.setData(field.name, event.target.value)
                                    }
                                />
                            ) : field.type === 'select' ? (
                                <select
                                    id={`correction-${field.name}`}
                                    className={controlClassName}
                                    value={String(form.data[field.name] ?? '')}
                                    onChange={(event) =>
                                        form.setData(field.name, event.target.value)
                                    }
                                >
                                    {!field.required ? <option value="">None</option> : null}
                                    {optionsFor(field, String(form.data[field.name] ?? '')).map(
                                        (option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ),
                                    )}
                                </select>
                            ) : (
                                <TextInput
                                    id={`correction-${field.name}`}
                                    type={field.type === 'email' ? 'email' : 'text'}
                                    className="h-11 w-full"
                                    value={String(form.data[field.name] ?? '')}
                                    onChange={(event) =>
                                        form.setData(field.name, event.target.value)
                                    }
                                />
                            )}
                        </>
                    )}
                    <InputError message={form.errors[field.name]} />
                </div>
                );
            })}

            <div>
                <Button className="h-11" disabled={form.processing} type="submit">
                    {form.processing ? 'Saving...' : 'Update existing record'}
                </Button>
            </div>
        </form>
    );
}

function optionsFor(field: Field, current: string): Choice[] {
    if (current === '' || field.options.some((option) => option.value === current)) {
        return field.options;
    }

    return [{ value: current, label: current }, ...field.options];
}
