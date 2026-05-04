import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PhoneInput from '@/Components/PhoneInput';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from '@inertiajs/react';
import {
    CheckCircle2Icon,
    LoaderCircleIcon,
    MailIcon,
    MessageSquareTextIcon,
    XIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

type ContactFormData = {
    name: string;
    email: string;
    phone_number: string;
    organization: string;
    project_type: string;
    message: string;
    source_url: string;
    website: string;
};

const projectTypes = [
    'secureDoorInstallation',
    'scifRelatedOpening',
    'accessControlReady',
    'retrofitReplacement',
    'generalInquiry',
];

export default function ContactSlideOver() {
    const { t } = useTranslation('common');
    const [isOpen, setIsOpen] = useState(false);
    const [wasSubmitted, setWasSubmitted] = useState(false);
    const [processing, setProcessing] = useState(false);
    const contactSchema = useMemo(
        () =>
            z.object({
                name: z.string().trim().min(1, t('contact.validation.name')),
                email: z
                    .string()
                    .trim()
                    .email(t('contact.validation.email')),
                phone_number: z.string().trim().max(50),
                organization: z.string().trim().max(255),
                project_type: z.string().trim().max(255),
                message: z
                    .string()
                    .trim()
                    .min(1, t('contact.validation.message'))
                    .max(5000, t('contact.validation.messageMax')),
                source_url: z.string(),
                website: z.string().max(0),
            }),
        [t],
    );
    const {
        control,
        register,
        handleSubmit,
        reset,
        setError,
        setFocus,
        setValue,
        clearErrors,
        formState: { errors },
    } = useForm<ContactFormData>({
        resolver: zodResolver(contactSchema),
        defaultValues: {
            name: '',
            email: '',
            phone_number: '',
            organization: '',
            project_type: '',
            message: '',
            source_url: '',
            website: '',
        },
        mode: 'onChange',
    });

    const openForm = () => {
        setWasSubmitted(false);
        clearErrors();
        reset({
            name: '',
            email: '',
            phone_number: '',
            organization: '',
            project_type: '',
            message: '',
            source_url: window.location.href,
            website: '',
        });
        setIsOpen(true);

        window.setTimeout(() => setFocus('name'), 150);
    };

    const closeForm = () => {
        setIsOpen(false);
        clearErrors();
    };

    const submit = (values: ContactFormData) => {
        router.post(route('contact.store'), values, {
            preserveScroll: true,
            onBefore: () => {
                setProcessing(true);
            },
            onError: (serverErrors) => {
                Object.entries(serverErrors).forEach(([field, message]) => {
                    if (field in values) {
                        setError(field as keyof ContactFormData, {
                            type: 'server',
                            message: String(message),
                        });
                    }
                });
            },
            onSuccess: () => {
                reset();
                setWasSubmitted(true);
            },
            onFinish: () => {
                setProcessing(false);
            },
        });
    };

    const inputClassName =
        'h-11 w-full border-border bg-background px-3 text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring dark:bg-input/30';
    const labelClassName = '!text-foreground';

    return (
        <>
            <button
                type="button"
                onClick={openForm}
                className="fixed right-0 top-1/2 z-50 hidden -translate-y-1/2 rounded-l-2xl border border-emerald-500/20 bg-emerald-600 px-3 py-4 text-sm font-semibold text-white shadow-2xl shadow-emerald-950/20 transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-background lg:block"
                aria-label={t('contact.open')}
            >
                <span className="block [writing-mode:vertical-rl]">
                    {t('contact.tab')}
                </span>
            </button>

            <button
                type="button"
                onClick={openForm}
                className="fixed bottom-20 right-4 z-50 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-2xl shadow-emerald-950/20 transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-background sm:right-6 lg:hidden"
            >
                <MailIcon className="size-4" />
                {t('contact.tab')}
            </button>

            <div
                className={cn(
                    'fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-sm transition duration-300',
                    isOpen
                        ? 'pointer-events-auto opacity-100'
                        : 'pointer-events-none opacity-0',
                )}
                onClick={closeForm}
                aria-hidden="true"
            />

            <aside
                className={cn(
                    'fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-border bg-background text-foreground shadow-2xl transition duration-500 ease-out dark:bg-card',
                    isOpen ? 'translate-x-0' : 'translate-x-full',
                )}
                aria-labelledby="contact-slide-over-title"
                aria-modal="true"
                role="dialog"
            >
                <div className="flex items-start justify-between gap-4 border-b border-border bg-card/60 px-5 py-5 backdrop-blur sm:px-6">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                            {t('contact.eyebrow')}
                        </p>
                        <h2
                            id="contact-slide-over-title"
                            className="mt-2 text-2xl font-semibold tracking-tight text-foreground"
                        >
                            {t('contact.title')}
                        </h2>
                    </div>

                    <button
                        type="button"
                        onClick={closeForm}
                        className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                        aria-label={t('contact.close')}
                    >
                        <XIcon className="size-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-6">
                    {wasSubmitted ? (
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                            <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/15">
                                <CheckCircle2Icon className="size-6 text-emerald-700 dark:text-emerald-300" />
                            </div>
                            <h3 className="mt-4 text-lg font-semibold text-foreground">
                                {t('contact.successTitle')}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                {t('contact.successDescription')}
                            </p>
                            <Button
                                type="button"
                                onClick={closeForm}
                                className="mt-5"
                            >
                                {t('contact.done')}
                            </Button>
                        </div>
                    ) : (
                        <form
                            onSubmit={handleSubmit(submit)}
                            className="flex flex-col gap-5"
                            noValidate
                        >
                            <p className="text-sm leading-6 text-muted-foreground">
                                {t('contact.description')}
                            </p>

                            <div className="flex flex-col gap-2">
                                <InputLabel
                                    htmlFor="contact-name"
                                    value={t('contact.fields.name')}
                                    className={labelClassName}
                                />
                                <TextInput
                                    id="contact-name"
                                    className={inputClassName}
                                    autoComplete="name"
                                    aria-invalid={Boolean(errors.name)}
                                    {...register('name')}
                                />
                                <InputError
                                    message={errors.name?.message}
                                    className="text-destructive"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <InputLabel
                                    htmlFor="contact-email"
                                    value={t('contact.fields.email')}
                                    className={labelClassName}
                                />
                                <TextInput
                                    id="contact-email"
                                    type="email"
                                    className={inputClassName}
                                    autoComplete="email"
                                    aria-invalid={Boolean(errors.email)}
                                    {...register('email')}
                                />
                                <InputError
                                    message={errors.email?.message}
                                    className="text-destructive"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <InputLabel
                                    htmlFor="contact-phone"
                                    value={t('contact.fields.phone')}
                                    className={labelClassName}
                                />
                                <Controller
                                    name="phone_number"
                                    control={control}
                                    render={({ field }) => (
                                        <PhoneInput
                                            id="contact-phone"
                                            className={inputClassName}
                                            autoComplete="tel"
                                            aria-invalid={Boolean(
                                                errors.phone_number,
                                            )}
                                            value={field.value}
                                            onBlur={field.onBlur}
                                            onValueChange={field.onChange}
                                        />
                                    )}
                                />
                                <InputError
                                    message={errors.phone_number?.message}
                                    className="text-destructive"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <InputLabel
                                    htmlFor="contact-organization"
                                    value={t('contact.fields.organization')}
                                    className={labelClassName}
                                />
                                <TextInput
                                    id="contact-organization"
                                    className={inputClassName}
                                    autoComplete="organization"
                                    aria-invalid={Boolean(errors.organization)}
                                    {...register('organization')}
                                />
                                <InputError
                                    message={errors.organization?.message}
                                    className="text-destructive"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <InputLabel
                                    htmlFor="contact-project-type"
                                    value={t('contact.fields.projectType')}
                                    className={labelClassName}
                                />
                                <select
                                    id="contact-project-type"
                                    className="h-11 w-full rounded-md border border-border bg-background px-3 text-foreground shadow-sm focus:border-ring focus:ring-ring dark:bg-input/30"
                                    aria-invalid={Boolean(errors.project_type)}
                                    {...register('project_type')}
                                >
                                    <option value="">
                                        {t('contact.fields.projectTypePlaceholder')}
                                    </option>
                                    {projectTypes.map((type) => (
                                        <option key={type} value={type}>
                                            {t(`contact.projectTypes.${type}`)}
                                        </option>
                                    ))}
                                </select>
                                <InputError
                                    message={errors.project_type?.message}
                                    className="text-destructive"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <InputLabel
                                    htmlFor="contact-message"
                                    value={t('contact.fields.message')}
                                    className={labelClassName}
                                />
                                <textarea
                                    id="contact-message"
                                    className="min-h-36 w-full rounded-md border border-border bg-background px-3 py-3 text-foreground shadow-sm placeholder:text-muted-foreground focus:border-ring focus:ring-ring dark:bg-input/30"
                                    aria-invalid={Boolean(errors.message)}
                                    {...register('message')}
                                />
                                <InputError
                                    message={errors.message?.message}
                                    className="text-destructive"
                                />
                            </div>

                            <input
                                type="text"
                                className="hidden"
                                tabIndex={-1}
                                autoComplete="off"
                                {...register('website')}
                            />

                            <input
                                type="hidden"
                                {...register('source_url')}
                            />

                            <Button
                                type="submit"
                                size="lg"
                                disabled={processing}
                                className="w-full"
                            >
                                {processing ? (
                                    <LoaderCircleIcon className="size-4 animate-spin" />
                                ) : (
                                    <MessageSquareTextIcon className="size-4" />
                                )}
                                {processing
                                    ? t('contact.submitting')
                                    : t('contact.submit')}
                            </Button>
                        </form>
                    )}
                </div>
            </aside>
        </>
    );
}
