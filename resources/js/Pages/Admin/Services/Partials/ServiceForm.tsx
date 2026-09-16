import FormActionFab from '@/Components/FormActionFab';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from '@inertiajs/react';
import { FormEventHandler, useMemo } from 'react';
import {
    FieldErrors,
    FieldPath,
    PathValue,
    useForm,
    useWatch,
} from 'react-hook-form';
import { z } from 'zod';
import {
    serviceToFormData,
    type ServiceFormData,
    type ServicePayload,
} from '../types';

type ServiceFormProps = {
    action: string;
    method?: 'post' | 'patch';
    title: string;
    description: string;
    service?: ServicePayload;
};

const schema = z.object({
    name: z
        .string()
        .trim()
        .min(1, 'Enter the service name.')
        .max(255),
    description: z.string().trim().max(5000),
});

function errorMessage(
    errors: FieldErrors<ServiceFormData>,
    path: string,
): string | undefined {
    const current = (errors as Record<string, { message?: string }>)[path];

    return current?.message;
}

export default function ServiceForm({
    action,
    method = 'post',
    title,
    description,
    service,
}: ServiceFormProps) {
    const defaultValues = useMemo(
        () => serviceToFormData(service),
        [service],
    );
    const {
        handleSubmit,
        setValue,
        setError,
        control,
        formState: { errors: validationErrors, isSubmitting },
    } = useForm<ServiceFormData>({
        resolver: zodResolver(schema),
        defaultValues,
    });
    const data = useWatch({
        control,
        defaultValue: defaultValues,
    }) as ServiceFormData;

    const setData = <Field extends FieldPath<ServiceFormData>>(
        field: Field,
        value: PathValue<ServiceFormData, Field>,
    ) => {
        setValue(field, value, {
            shouldDirty: true,
            shouldValidate: true,
        });
    };

    const submit: FormEventHandler = (event) => {
        event.preventDefault();

        void handleSubmit((values) => {
            router[method](action, values, {
                onError: (serverErrors: Record<string, string>) => {
                    Object.entries(serverErrors).forEach(([field, message]) => {
                        setError(field as FieldPath<ServiceFormData>, {
                            type: 'server',
                            message,
                        });
                    });
                },
            });
        })(event);
    };

    return (
        <form onSubmit={submit} className="flex min-w-0 flex-col gap-6 pr-4 pb-28 sm:pr-20 lg:pb-6">
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                        <InputLabel
                            htmlFor="service-name"
                            value="Service"
                            className="text-emerald-700 dark:text-emerald-300"
                        />
                        <TextInput
                            id="service-name"
                            value={data.name ?? ''}
                            className="h-11"
                            placeholder="Assembly w/ vision glazing"
                            onChange={(event) =>
                                setData('name', event.target.value)
                            }
                        />
                        <p className="text-sm text-muted-foreground">
                            The work performed on a product, for example
                            assembly, installation, or glazing.
                        </p>
                        <InputError
                            message={errorMessage(validationErrors, 'name')}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <InputLabel
                            htmlFor="service-description"
                            value="Description"
                            className="text-emerald-700 dark:text-emerald-300"
                        />
                        <textarea
                            id="service-description"
                            value={data.description ?? ''}
                            rows={4}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                            placeholder="Optional notes about when this service is used."
                            onChange={(event) =>
                                setData('description', event.target.value)
                            }
                        />
                        <InputError
                            message={errorMessage(
                                validationErrors,
                                'description',
                            )}
                        />
                    </div>
                </CardContent>
            </Card>

            <FormActionFab
                cancelHref={route('admin.services.index')}
                saveLabel={service ? 'Save service' : 'Create service'}
                disabled={isSubmitting}
            />
        </form>
    );
}
