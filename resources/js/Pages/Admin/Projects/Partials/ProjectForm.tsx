import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import CustomerSelect from '@/Components/CustomerSelect';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';
import {
    optionLabel,
    projectToFormData,
    type ProjectFormData,
    type ProjectOptions,
    type ProjectPayload,
} from '../types';

type ProjectFormProps = {
    action: string;
    method?: 'post' | 'patch';
    submitLabel: string;
    title: string;
    description: string;
    options: ProjectOptions;
    project?: ProjectPayload;
};

export default function ProjectForm({
    action,
    method = 'post',
    submitLabel,
    title,
    description,
    options,
    project,
}: ProjectFormProps) {
    const { data, setData, errors, processing, post, patch } =
        useForm<ProjectFormData>(projectToFormData(project));
    const canEditCoreFields = options.can.create || options.can.viewCustomerContactFields;
    const canViewSensitive = options.can.viewSensitiveFields;

    const submit: FormEventHandler = (event) => {
        event.preventDefault();

        if (method === 'patch') {
            patch(action);
            return;
        }

        post(action);
    };

    const inputClassName =
        'h-11 w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring';
    const labelClassName = 'text-emerald-700 dark:text-emerald-300';

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={submit} className="flex flex-col gap-6">
                    {canEditCoreFields && (
                        <>
                            <section className="grid gap-5 md:grid-cols-2">
                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor="project-name"
                                        value="Project name"
                                        className={labelClassName}
                                    />
                                    <TextInput
                                        id="project-name"
                                        value={data.name}
                                        className={inputClassName}
                                        isFocused
                                        onChange={(event) =>
                                            setData('name', event.target.value)
                                        }
                                    />
                                    <InputError message={errors.name} />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor="project-number"
                                        value="Project number"
                                        className={labelClassName}
                                    />
                                    <TextInput
                                        id="project-number"
                                        value={data.project_number}
                                        className={inputClassName}
                                        onChange={(event) =>
                                            setData(
                                                'project_number',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <InputError message={errors.project_number} />
                                </div>
                            </section>

                            <CustomerSelect
                                customers={options.customers}
                                value={data.customer_id}
                                onChange={(value) =>
                                    setData('customer_id', value)
                                }
                                error={errors.customer_id}
                            />

                            <section className="grid gap-5 border-t border-border pt-6 md:grid-cols-3">
                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor="service-type"
                                        value="Service type"
                                        className={labelClassName}
                                    />
                                    <select
                                        id="service-type"
                                        value={data.service_type}
                                        onChange={(event) =>
                                            setData(
                                                'service_type',
                                                event.target.value,
                                            )
                                        }
                                        className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                                    >
                                        <option value="">Select a service</option>
                                        {options.serviceTypes.map((type) => (
                                            <option key={type} value={type}>
                                                {optionLabel(type)}
                                            </option>
                                        ))}
                                    </select>
                                    <InputError message={errors.service_type} />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor="assigned-to"
                                        value="Assigned to"
                                        className={labelClassName}
                                    />
                                    <select
                                        id="assigned-to"
                                        value={data.assigned_to}
                                        onChange={(event) =>
                                            setData(
                                                'assigned_to',
                                                event.target.value,
                                            )
                                        }
                                        className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                                    >
                                        <option value="">Unassigned</option>
                                        {options.assignees.map((assignee) => (
                                            <option
                                                key={assignee.id}
                                                value={assignee.id}
                                            >
                                                {assignee.name}
                                            </option>
                                        ))}
                                    </select>
                                    <InputError message={errors.assigned_to} />
                                </div>
                            </section>
                        </>
                    )}

                    <section className="grid gap-5 border-t border-border pt-6 md:grid-cols-3">
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="project-status"
                                value="Status"
                                className={labelClassName}
                            />
                            <select
                                id="project-status"
                                value={data.status}
                                onChange={(event) =>
                                    setData('status', event.target.value)
                                }
                                className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                {options.statuses.map((status) => (
                                    <option key={status} value={status}>
                                        {optionLabel(status)}
                                    </option>
                                ))}
                            </select>
                            <InputError message={errors.status} />
                        </div>

                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="project-priority"
                                value="Priority"
                                className={labelClassName}
                            />
                            <select
                                id="project-priority"
                                value={data.priority}
                                onChange={(event) =>
                                    setData('priority', event.target.value)
                                }
                                className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                {options.priorities.map((priority) => (
                                    <option key={priority} value={priority}>
                                        {optionLabel(priority)}
                                    </option>
                                ))}
                            </select>
                            <InputError message={errors.priority} />
                        </div>

                        {canViewSensitive && (
                            <div className="flex flex-col gap-2">
                                <InputLabel
                                    htmlFor="budget-amount"
                                    value="Budget amount"
                                    className={labelClassName}
                                />
                                <TextInput
                                    id="budget-amount"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={data.budget_amount}
                                    className={inputClassName}
                                    onChange={(event) =>
                                        setData(
                                            'budget_amount',
                                            event.target.value,
                                        )
                                    }
                                />
                                <InputError message={errors.budget_amount} />
                            </div>
                        )}
                    </section>

                    {canEditCoreFields && (
                        <section className="grid gap-5 border-t border-border pt-6 md:grid-cols-2">
                            <div className="flex flex-col gap-2">
                                <InputLabel
                                    htmlFor="site-address-line-1"
                                    value="Site address line 1"
                                    className={labelClassName}
                                />
                                <TextInput
                                    id="site-address-line-1"
                                    value={data.site_address_line_1}
                                    className={inputClassName}
                                    onChange={(event) =>
                                        setData(
                                            'site_address_line_1',
                                            event.target.value,
                                        )
                                    }
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <InputLabel
                                    htmlFor="site-address-line-2"
                                    value="Site address line 2"
                                    className={labelClassName}
                                />
                                <TextInput
                                    id="site-address-line-2"
                                    value={data.site_address_line_2}
                                    className={inputClassName}
                                    onChange={(event) =>
                                        setData(
                                            'site_address_line_2',
                                            event.target.value,
                                        )
                                    }
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <InputLabel
                                    htmlFor="site-city"
                                    value="Site city"
                                    className={labelClassName}
                                />
                                <TextInput
                                    id="site-city"
                                    value={data.site_city}
                                    className={inputClassName}
                                    onChange={(event) =>
                                        setData('site_city', event.target.value)
                                    }
                                />
                            </div>
                            <div className="grid gap-5 sm:grid-cols-3">
                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor="site-state"
                                        value="State"
                                        className={labelClassName}
                                    />
                                    <TextInput
                                        id="site-state"
                                        value={data.site_state}
                                        className={inputClassName}
                                        onChange={(event) =>
                                            setData(
                                                'site_state',
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor="site-postal-code"
                                        value="Postal code"
                                        className={labelClassName}
                                    />
                                    <TextInput
                                        id="site-postal-code"
                                        value={data.site_postal_code}
                                        className={inputClassName}
                                        onChange={(event) =>
                                            setData(
                                                'site_postal_code',
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor="site-country"
                                        value="Country"
                                        className={labelClassName}
                                    />
                                    <TextInput
                                        id="site-country"
                                        value={data.site_country}
                                        className={inputClassName}
                                        onChange={(event) =>
                                            setData(
                                                'site_country',
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                            </div>
                        </section>
                    )}

                    <section className="grid gap-5 border-t border-border pt-6 md:grid-cols-3">
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="estimated-start-date"
                                value="Estimated start"
                                className={labelClassName}
                            />
                            <TextInput
                                id="estimated-start-date"
                                type="date"
                                value={data.estimated_start_date}
                                className={inputClassName}
                                onChange={(event) =>
                                    setData(
                                        'estimated_start_date',
                                        event.target.value,
                                    )
                                }
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="estimated-end-date"
                                value="Estimated end"
                                className={labelClassName}
                            />
                            <TextInput
                                id="estimated-end-date"
                                type="date"
                                value={data.estimated_end_date}
                                className={inputClassName}
                                onChange={(event) =>
                                    setData(
                                        'estimated_end_date',
                                        event.target.value,
                                    )
                                }
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="completed-at"
                                value="Completed at"
                                className={labelClassName}
                            />
                            <TextInput
                                id="completed-at"
                                type="date"
                                value={data.completed_at}
                                className={inputClassName}
                                onChange={(event) =>
                                    setData('completed_at', event.target.value)
                                }
                            />
                        </div>
                    </section>

                    <section className="grid gap-5 border-t border-border pt-6 md:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor="public-notes"
                                value="Project notes"
                                className={labelClassName}
                            />
                            <textarea
                                id="public-notes"
                                value={data.public_notes}
                                className="min-h-32 w-full rounded-md border border-border bg-background px-3 py-3 text-foreground shadow-sm placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                                onChange={(event) =>
                                    setData('public_notes', event.target.value)
                                }
                            />
                            <InputError message={errors.public_notes} />
                        </div>

                        {canViewSensitive && (
                            <div className="flex flex-col gap-2">
                                <InputLabel
                                    htmlFor="internal-notes"
                                    value="Internal notes"
                                    className={labelClassName}
                                />
                                <textarea
                                    id="internal-notes"
                                    value={data.internal_notes}
                                    className="min-h-32 w-full rounded-md border border-border bg-background px-3 py-3 text-foreground shadow-sm placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                                    onChange={(event) =>
                                        setData(
                                            'internal_notes',
                                            event.target.value,
                                        )
                                    }
                                />
                                <InputError message={errors.internal_notes} />
                            </div>
                        )}
                    </section>

                    <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                        <Button variant="outline" asChild>
                            <Link href={route('admin.projects.index')}>
                                Cancel
                            </Link>
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {submitLabel}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

