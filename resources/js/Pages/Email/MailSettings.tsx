import InputError from '@/Components/InputError';
import { Button } from '@/Components/ui/button';
import { router, useForm } from '@inertiajs/react';
import { ImageIcon } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function MailSettings({
    signature,
    headerUrl,
}: {
    signature: string | null;
    headerUrl: string | null;
}) {
    const { t } = useTranslation('mail');
    const [open, setOpen] = useState(false);
    const signatureForm = useForm({
        signature: signature ?? '',
    });
    const headerForm = useForm({
        header: null as File | null,
    });

    const saveSignature = (event: FormEvent) => {
        event.preventDefault();
        signatureForm.put(route('mailbox.signature'), { preserveScroll: true });
    };

    const saveHeader = (event: FormEvent) => {
        event.preventDefault();

        if (!headerForm.data.header) {
            return;
        }

        headerForm.post(route('mailbox.header'), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => headerForm.setData('header', null),
        });
    };

    return (
        <div className="rounded-lg border border-border bg-background">
            <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-foreground touch-manipulation"
                aria-expanded={open}
                onClick={() => setOpen((current) => !current)}
            >
                {t('appearance')}
                <span className="text-xs font-normal text-muted-foreground">
                    {open ? t('close') : t('editAppearance')}
                </span>
            </button>
            {open ? (
                <div className="grid gap-4 border-t border-border px-3 py-3">
                    <form onSubmit={saveHeader} className="grid gap-2">
                        <p className="text-sm font-medium text-foreground">{t('header')}</p>
                        <p className="text-sm text-muted-foreground">{t('headerHelp')}</p>
                        {headerUrl ? (
                            <img
                                src={headerUrl}
                                alt=""
                                className="max-h-32 w-full rounded-md border border-border object-contain"
                            />
                        ) : (
                            <p className="flex min-h-16 items-center gap-2 rounded-md border border-dashed border-border px-3 text-sm text-muted-foreground">
                                <ImageIcon className="size-4" />
                                {t('noHeader')}
                            </p>
                        )}
                        <input
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            className="block w-full text-sm text-foreground file:me-3 file:min-h-11 file:rounded-md file:border-0 file:bg-muted file:px-3 file:text-sm file:font-medium"
                            onChange={(event) =>
                                headerForm.setData('header', event.target.files?.[0] ?? null)
                            }
                        />
                        <InputError message={headerForm.errors.header} />
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="submit"
                                className="min-h-11 touch-manipulation"
                                disabled={headerForm.processing || !headerForm.data.header}
                            >
                                {t('uploadHeader')}
                            </Button>
                            {headerUrl ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="min-h-11 touch-manipulation"
                                    onClick={() =>
                                        router.delete(route('mailbox.header.destroy'), {
                                            preserveScroll: true,
                                        })
                                    }
                                >
                                    {t('removeHeader')}
                                </Button>
                            ) : null}
                        </div>
                    </form>
                    <form onSubmit={saveSignature} className="grid gap-2">
                        <label htmlFor="mail-signature" className="text-sm font-medium text-foreground">
                            {t('signature')}
                        </label>
                        <p className="text-sm text-muted-foreground">{t('signatureHelp')}</p>
                        <textarea
                            id="mail-signature"
                            value={signatureForm.data.signature}
                            onChange={(event) => signatureForm.setData('signature', event.target.value)}
                            rows={5}
                            maxLength={2000}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
                        />
                        <InputError message={signatureForm.errors.signature} />
                        <Button
                            type="submit"
                            className="min-h-11 w-fit touch-manipulation"
                            disabled={signatureForm.processing}
                        >
                            {t('saveSignature')}
                        </Button>
                    </form>
                </div>
            ) : null}
        </div>
    );
}
