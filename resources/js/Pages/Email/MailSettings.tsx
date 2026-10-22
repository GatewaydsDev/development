import InputError from '@/Components/InputError';
import { router, useForm } from '@inertiajs/react';
import { SearchIcon } from 'lucide-react';
import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const footerPalette = ['#047857', '#b45309', '#111827', '#ffffff', '#dc2626', '#1d4ed8'];

type MailPart = 'header' | 'signature' | 'footer';

const inspectorInput =
    'h-7 w-full bg-transparent px-1 text-[13px] text-[#1a3d8f] outline-none focus:bg-[#fff8dc]';

export function FooterColorBoxes({ colors }: { colors: string[] }) {
    if (colors.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-wrap gap-1.5" aria-hidden="true">
            {colors.map((color, index) => (
                <span
                    key={`${color}-${index}`}
                    className="h-5 w-9 border border-[#b0b0b0]"
                    style={{ backgroundColor: color }}
                />
            ))}
        </div>
    );
}

function PropertyRow({
    name,
    query,
    children,
}: {
    name: string;
    query: string;
    children: ReactNode;
}) {
    if (query && !name.toLowerCase().includes(query)) {
        return null;
    }

    return (
        <div className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] border-b border-[#d6d6d6] text-[13px] hover:bg-[#e7f0fb]">
            <div className="border-r border-[#d6d6d6] bg-[#f7f7f7] px-2 py-1 text-neutral-900">{name}</div>
            <div className="min-w-0 bg-white">{children}</div>
        </div>
    );
}

export default function MailSettings({
    signature,
    headerUrl,
    headerWidth,
    footerColors,
}: {
    signature: string | null;
    headerUrl: string | null;
    headerWidth: number;
    footerColors: string[];
}) {
    const { t } = useTranslation('mail');
    const [part, setPart] = useState<MailPart>('header');
    const [query, setQuery] = useState('');
    const [width, setWidth] = useState(headerWidth);
    const [savingWidth, setSavingWidth] = useState(false);
    const [widthError, setWidthError] = useState<string | undefined>();
    const [colors, setColors] = useState(footerColors);
    const [draftColor, setDraftColor] = useState('#047857');
    const [savingColors, setSavingColors] = useState(false);
    const [colorError, setColorError] = useState<string | undefined>();
    const signatureForm = useForm({
        signature: signature ?? '',
    });
    const headerForm = useForm({
        header: null as File | null,
    });
    const needle = query.trim().toLowerCase();

    useEffect(() => {
        setWidth(headerWidth);
    }, [headerWidth]);

    useEffect(() => {
        setColors(footerColors);
    }, [footerColors]);

    useEffect(() => {
        signatureForm.setData('signature', signature ?? '');
        // The saved signature arrives from the server after a reload.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [signature]);

    const saveSignature = (event: FormEvent) => {
        event.preventDefault();
        signatureForm.put(route('mailbox.signature'), { preserveScroll: true });
    };

    const saveHeader = () => {
        if (!headerForm.data.header) {
            return;
        }

        headerForm.post(route('mailbox.header'), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => headerForm.setData('header', null),
        });
    };

    const saveWidth = (event: FormEvent) => {
        event.preventDefault();
        setSavingWidth(true);
        setWidthError(undefined);
        router.put(
            route('mailbox.header.size'),
            { width },
            {
                preserveScroll: true,
                onError: (errors) => setWidthError(errors.width),
                onFinish: () => setSavingWidth(false),
            },
        );
    };

    const addColor = (color: string) => {
        if (colors.length >= 8 || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
            return;
        }

        setColors((current) => [...current, color.toLowerCase()]);
    };

    const saveColors = (event: FormEvent) => {
        event.preventDefault();
        setSavingColors(true);
        setColorError(undefined);
        router.put(
            route('mailbox.footer'),
            { colors },
            {
                preserveScroll: true,
                onError: (errors) => setColorError(errors.colors ?? errors['colors.0']),
                onFinish: () => setSavingColors(false),
            },
        );
    };

    const actionClass =
        'h-7 border border-[#b0b0b0] bg-[#f4f4f4] px-2 text-[12px] text-neutral-900 hover:bg-[#e7f0fb] disabled:opacity-50';

    return (
        <aside aria-label={t('objectInspector')} className="object-inspector min-w-0">
            <div className="overflow-hidden border border-[#b0b0b0] bg-[#f0f0f0] text-neutral-900 shadow-sm">
                <div className="border-b border-[#b0b0b0] bg-[#f4f4f4] px-2 py-1.5 text-sm font-semibold">
                    {t('objectInspector')}
                </div>
                <div className="border-b border-[#b0b0b0] bg-white p-1">
                    <label className="sr-only" htmlFor="mail-inspector-component">
                        {t('component')}
                    </label>
                    <select
                        id="mail-inspector-component"
                        aria-label={t('component')}
                        className="h-8 w-full border border-[#b0b0b0] bg-white px-1 text-sm font-semibold text-neutral-900"
                        value={part}
                        onChange={(event) => setPart(event.target.value as MailPart)}
                    >
                        <option value="header">{t('header')}</option>
                        <option value="signature">{t('signature')}</option>
                        <option value="footer">{t('footerColors')}</option>
                    </select>
                </div>
                <div className="flex items-end border-b border-[#b0b0b0] bg-[#f0f0f0] px-1">
                    <span className="-mb-px border border-b-white border-[#b0b0b0] bg-white px-3 py-1 text-sm">
                        {t('properties')}
                    </span>
                </div>
                <label className="flex items-center gap-1.5 border-b border-[#b0b0b0] bg-white px-2">
                    <SearchIcon className="size-4 shrink-0 text-neutral-500" />
                    <input
                        aria-label={t('searchProperties')}
                        value={query}
                        placeholder={t('searchProperties')}
                        onChange={(event) => setQuery(event.target.value)}
                        className="h-8 w-full bg-transparent text-sm text-neutral-900 outline-none"
                    />
                </label>
                <div className="bg-white">
                    {part === 'header' ? (
                        <>
                            <PropertyRow name={t('header')} query={needle}>
                                <div className="grid gap-1 px-1 py-1">
                                    {headerUrl ? (
                                        <img
                                            src={headerUrl}
                                            alt=""
                                            className="h-auto max-w-full border border-[#d6d6d6] object-contain"
                                            style={{ width: `${width}%` }}
                                        />
                                    ) : (
                                        <p className="text-[12px] text-neutral-500">{t('noHeader')}</p>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/gif,image/webp"
                                        className="block w-full text-[12px] text-neutral-900 file:me-2 file:h-7 file:border file:border-[#b0b0b0] file:bg-[#f4f4f4] file:px-2"
                                        onChange={(event) =>
                                            headerForm.setData('header', event.target.files?.[0] ?? null)
                                        }
                                    />
                                    <InputError message={headerForm.errors.header} />
                                    <div className="flex flex-wrap gap-1">
                                        <button
                                            type="button"
                                            className={actionClass}
                                            disabled={headerForm.processing || !headerForm.data.header}
                                            onClick={saveHeader}
                                        >
                                            {t('uploadHeader')}
                                        </button>
                                        {headerUrl ? (
                                            <button
                                                type="button"
                                                className={actionClass}
                                                onClick={() =>
                                                    router.delete(route('mailbox.header.destroy'), {
                                                        preserveScroll: true,
                                                    })
                                                }
                                            >
                                                {t('removeHeader')}
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            </PropertyRow>
                            <PropertyRow name={t('headerSize')} query={needle}>
                                <form onSubmit={saveWidth} className="flex items-center gap-1 px-1 py-1">
                                    <input
                                        id="mail-header-size"
                                        type="number"
                                        min={20}
                                        max={100}
                                        step={5}
                                        aria-label={t('headerSize')}
                                        value={width}
                                        onChange={(event) => setWidth(Number(event.target.value))}
                                        className={`${inspectorInput} w-16 border border-[#d6d6d6]`}
                                    />
                                    <span className="text-[12px] text-neutral-500">%</span>
                                    <button type="submit" className={actionClass} disabled={savingWidth}>
                                        {t('saveHeaderSize')}
                                    </button>
                                </form>
                                <InputError message={widthError} className="px-1" />
                            </PropertyRow>
                        </>
                    ) : null}
                    {part === 'signature' ? (
                        <PropertyRow name={t('signature')} query={needle}>
                            <form onSubmit={saveSignature} className="grid gap-1 px-1 py-1">
                                <textarea
                                    id="mail-signature"
                                    value={signatureForm.data.signature}
                                    onChange={(event) => signatureForm.setData('signature', event.target.value)}
                                    rows={6}
                                    maxLength={2000}
                                    aria-label={t('signature')}
                                    className="w-full border border-[#d6d6d6] bg-white px-1 py-1 text-[13px] text-[#1a3d8f] outline-none focus:bg-[#fff8dc]"
                                />
                                <InputError message={signatureForm.errors.signature} />
                                <button type="submit" className={`${actionClass} w-fit`} disabled={signatureForm.processing}>
                                    {t('saveSignature')}
                                </button>
                            </form>
                        </PropertyRow>
                    ) : null}
                    {part === 'footer' ? (
                        <PropertyRow name={t('footerColors')} query={needle}>
                            <form onSubmit={saveColors} className="grid gap-1 px-1 py-1">
                                {colors.length === 0 ? (
                                    <p className="text-[12px] text-neutral-500">{t('noFooterColors')}</p>
                                ) : (
                                    <ul className="flex flex-wrap gap-1">
                                        {colors.map((color, index) => (
                                            <li key={`${color}-${index}`}>
                                                <button
                                                    type="button"
                                                    className="size-7 border border-[#b0b0b0]"
                                                    style={{ backgroundColor: color }}
                                                    aria-label={`${t('removeColor')} ${color}`}
                                                    onClick={() =>
                                                        setColors((current) =>
                                                            current.filter((_, itemIndex) => itemIndex !== index),
                                                        )
                                                    }
                                                />
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <div className="flex flex-wrap items-center gap-1">
                                    {footerPalette.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            className="size-7 border border-[#b0b0b0]"
                                            style={{ backgroundColor: color }}
                                            aria-label={`${t('addColor')} ${color}`}
                                            disabled={colors.length >= 8}
                                            onClick={() => addColor(color)}
                                        />
                                    ))}
                                    <input
                                        type="color"
                                        value={draftColor}
                                        aria-label={t('addColor')}
                                        onChange={(event) => setDraftColor(event.target.value)}
                                        className="h-7 w-10 cursor-pointer border border-[#b0b0b0] bg-white p-0.5"
                                    />
                                    <button
                                        type="button"
                                        className={actionClass}
                                        disabled={colors.length >= 8}
                                        onClick={() => addColor(draftColor)}
                                    >
                                        {t('addColor')}
                                    </button>
                                </div>
                                <InputError message={colorError} />
                                <button type="submit" className={`${actionClass} w-fit`} disabled={savingColors}>
                                    {t('saveFooter')}
                                </button>
                            </form>
                        </PropertyRow>
                    ) : null}
                </div>
                <div className="border-t border-[#b0b0b0] bg-[#f4f4f4] px-2 py-1 text-[11px] text-neutral-600">
                    {needle
                        ? `${t('showingMatches')} “${query.trim()}”`
                        : t('allShown')}
                </div>
            </div>
        </aside>
    );
}
