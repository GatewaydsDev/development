import { Button } from '@/Components/ui/button';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { router, useForm } from '@inertiajs/react';
import { mergeAttributes, Node } from '@tiptap/core';
import LinkExtension from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { BoldIcon, ImageIcon, ItalicIcon, UnderlineIcon, XIcon } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MailStationeryData } from '@/Pages/Email/mailLayouts';

type SectionKey = 'header' | 'footer' | 'signature';

const MailLogo = Node.create({
    name: 'mailLogo',
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    addAttributes() {
        return {
            src: { default: null },
            alt: { default: 'Gateway Door Systems' },
        };
    },
    parseHTML() {
        return [{ tag: 'img[src]' }];
    },
    renderHTML({ HTMLAttributes }) {
        return ['img', mergeAttributes(HTMLAttributes, {
            alt: HTMLAttributes.alt || 'Gateway Door Systems',
            width: '220',
            style: 'display:block;width:220px;max-width:100%;height:auto;border:0;background:#050505;',
        })];
    },
});

function SectionEditor({
    value,
    onChange,
    logoUrl,
}: {
    value: string;
    onChange: (html: string) => void;
    logoUrl: string;
}) {
    const { t } = useTranslation('mail');
    const editor = useEditor({
        extensions: [
            StarterKit.configure({ heading: false }),
            Underline,
            LinkExtension.configure({ openOnClick: false }),
            MailLogo,
        ],
        content: value || '<p></p>',
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: 'min-h-36 rounded-md border border-border bg-white px-3 py-2 text-sm text-[#111827] outline-none',
            },
        },
        onUpdate: ({ editor: current }) => onChange(current.getHTML()),
    });

    const addLogo = () => {
        const src = logoUrl.replace(/"/g, '');
        editor?.chain().focus().insertContent(`<p><img src="${src}" alt="Gateway Door Systems"></p>`).run();
    };

    return (
        <div className="grid gap-2">
            <div className="flex flex-wrap gap-1">
                <Button type="button" variant="outline" className="size-9" onClick={() => editor?.chain().focus().toggleBold().run()}>
                    <BoldIcon className="size-4" />
                </Button>
                <Button type="button" variant="outline" className="size-9" onClick={() => editor?.chain().focus().toggleItalic().run()}>
                    <ItalicIcon className="size-4" />
                </Button>
                <Button type="button" variant="outline" className="size-9" onClick={() => editor?.chain().focus().toggleUnderline().run()}>
                    <UnderlineIcon className="size-4" />
                </Button>
                <Button type="button" variant="outline" className="h-9" onClick={addLogo}>
                    <ImageIcon className="size-4" />
                    {t('addLogo')}
                </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t('logoHelp')}</p>
            <EditorContent editor={editor} />
        </div>
    );
}

export default function EmailStationery({
    open,
    stationery,
    onClose,
}: {
    open: boolean;
    stationery: MailStationeryData;
    onClose: () => void;
}) {
    const { t } = useTranslation('mail');
    const logoUrl = stationery.logoUrl || '/images/Gateway_Door_Systems_Logo.png';
    const [section, setSection] = useState<SectionKey>('signature');
    const [signatureId, setSignatureId] = useState(stationery.newSignatureId ?? stationery.signatures[0]?.id ?? '');
    const form = useForm({
        header: stationery.header,
        footer: stationery.footer,
        signatures: stationery.signatures,
        new_signature_id: stationery.newSignatureId,
        reply_signature_id: stationery.replySignatureId,
    });

    useEffect(() => {
        if (!open) {
            return;
        }

        form.setData({
            header: stationery.header,
            footer: stationery.footer,
            signatures: stationery.signatures,
            new_signature_id: stationery.newSignatureId,
            reply_signature_id: stationery.replySignatureId,
        });
        setSignatureId(stationery.newSignatureId ?? stationery.signatures[0]?.id ?? '');
        setSection('signature');
        // Reload the editor from the saved stationery each time the dialog opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, stationery]);

    const selected = form.data.signatures.find((item) => item.id === signatureId) ?? form.data.signatures[0];

    const updateSelected = (html: string) => {
        form.setData(
            'signatures',
            form.data.signatures.map((item) => (item.id === selected?.id ? { ...item, html } : item)),
        );
    };

    const addSignature = () => {
        const id = `sig${Date.now()}`;
        const next = [
            ...form.data.signatures,
            {
                id,
                name: t('newSignature'),
                html: '<p></p>',
            },
        ];
        form.setData('signatures', next);
        setSignatureId(id);
        setSection('signature');
    };

    const save = (event: FormEvent) => {
        event.preventDefault();
        form.put(route('mailbox.stationery'), {
            preserveScroll: true,
            onSuccess: () => onClose(),
        });
    };

    return (
        <Dialog open={open} onClose={onClose} className="relative z-50">
            <div className="fixed inset-0 bg-slate-950/70" aria-hidden="true" />
            <div className="fixed inset-0 overflow-y-auto p-3 sm:p-6">
                <div className="flex min-h-full items-center justify-center">
                    <DialogPanel className="w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
                        <form onSubmit={save}>
                            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                                        {t('stationery')}
                                    </p>
                                    <DialogTitle className="mt-1 text-lg font-semibold text-foreground">
                                        {t('stationeryTitle')}
                                    </DialogTitle>
                                </div>
                                <Button type="button" variant="ghost" size="icon" aria-label={t('close')} onClick={onClose}>
                                    <XIcon />
                                </Button>
                            </div>
                            <div className="grid gap-4 p-5 md:grid-cols-[14rem_minmax(0,1fr)]">
                                <div className="grid content-start gap-2">
                                    <button
                                        type="button"
                                        className={`min-h-11 rounded-md px-3 text-left text-sm ${section === 'header' ? 'bg-emerald-700 text-white' : 'hover:bg-muted'}`}
                                        onClick={() => setSection('header')}
                                    >
                                        {t('header')}
                                    </button>
                                    <button
                                        type="button"
                                        className={`min-h-11 rounded-md px-3 text-left text-sm ${section === 'footer' ? 'bg-emerald-700 text-white' : 'hover:bg-muted'}`}
                                        onClick={() => setSection('footer')}
                                    >
                                        {t('footer')}
                                    </button>
                                    <p className="mt-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        {t('signatures')}
                                    </p>
                                    {form.data.signatures.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            className={`min-h-11 rounded-md px-3 text-left text-sm ${section === 'signature' && item.id === selected?.id ? 'bg-emerald-700 text-white' : 'hover:bg-muted'}`}
                                            onClick={() => {
                                                setSignatureId(item.id);
                                                setSection('signature');
                                            }}
                                        >
                                            {item.name}
                                        </button>
                                    ))}
                                    <Button type="button" variant="outline" className="min-h-11" onClick={addSignature}>
                                        {t('newSignature')}
                                    </Button>
                                </div>
                                <div className="grid gap-3">
                                    {section === 'header' ? (
                                        <SectionEditor key="header" value={form.data.header} logoUrl={logoUrl} onChange={(html) => form.setData('header', html)} />
                                    ) : null}
                                    {section === 'footer' ? (
                                        <SectionEditor key="footer" value={form.data.footer} logoUrl={logoUrl} onChange={(html) => form.setData('footer', html)} />
                                    ) : null}
                                    {section === 'signature' && selected ? (
                                        <>
                                            <label className="grid gap-1 text-sm">
                                                <span className="font-medium text-foreground">{t('signatureName')}</span>
                                                <input
                                                    value={selected.name}
                                                    maxLength={80}
                                                    onChange={(event) =>
                                                        form.setData(
                                                            'signatures',
                                                            form.data.signatures.map((item) =>
                                                                item.id === selected.id ? { ...item, name: event.target.value } : item,
                                                            ),
                                                        )
                                                    }
                                                    className="h-11 rounded-md border border-border bg-background px-3 text-foreground"
                                                />
                                            </label>
                                            <SectionEditor key={selected.id} value={selected.html} logoUrl={logoUrl} onChange={updateSelected} />
                                            <div className="flex flex-wrap gap-4 text-sm">
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name="new-signature"
                                                        checked={form.data.new_signature_id === selected.id}
                                                        onChange={() => form.setData('new_signature_id', selected.id)}
                                                    />
                                                    {t('signatureForNew')}
                                                </label>
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name="reply-signature"
                                                        checked={form.data.reply_signature_id === selected.id}
                                                        onChange={() => form.setData('reply_signature_id', selected.id)}
                                                    />
                                                    {t('signatureForReply')}
                                                </label>
                                            </div>
                                            {form.data.signatures.length > 1 ? (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="w-fit"
                                                    onClick={() => {
                                                        const remaining = form.data.signatures.filter((item) => item.id !== selected.id);
                                                        form.setData({
                                                            ...form.data,
                                                            signatures: remaining,
                                                            new_signature_id:
                                                                form.data.new_signature_id === selected.id
                                                                    ? (remaining[0]?.id ?? null)
                                                                    : form.data.new_signature_id,
                                                            reply_signature_id:
                                                                form.data.reply_signature_id === selected.id
                                                                    ? (remaining[0]?.id ?? null)
                                                                    : form.data.reply_signature_id,
                                                        });
                                                        setSignatureId(remaining[0]?.id ?? '');
                                                    }}
                                                >
                                                    {t('deleteSignature')}
                                                </Button>
                                            ) : null}
                                        </>
                                    ) : null}
                                    <p className="text-sm text-muted-foreground">{t('stationeryHelp')}</p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
                                <Button type="button" variant="outline" onClick={onClose}>
                                    {t('close')}
                                </Button>
                                <Button type="submit" className="bg-emerald-700 text-white hover:bg-emerald-800" disabled={form.processing}>
                                    {t('saveStationery')}
                                </Button>
                            </div>
                        </form>
                    </DialogPanel>
                </div>
            </div>
        </Dialog>
    );
}
