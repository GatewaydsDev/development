import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import RichTextEditor from '@/Components/RichTextEditor';
import TextInput from '@/Components/TextInput';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/Components/ui/alert-dialog';
import { Button } from '@/Components/ui/button';
import { cn } from '@/lib/utils';
import { PageProps } from '@/types';
import { router } from '@inertiajs/react';
import { FileUpIcon, PlusIcon, SaveIcon } from 'lucide-react';
import { FormEvent, useRef, useState } from 'react';
import { toast } from 'sonner';
import { isEmptyHtml } from '@/Pages/Admin/Bids/bidText';
import type {
    QuotationOptions,
    QuotationTextTemplateOption,
} from '../types';

type QuotationReusableTextPurpose = 'proposal' | 'pricing' | 'pricing_basis';

type QuotationReusableTextSectionProps = {
    options: QuotationOptions;
    value: string;
    error?: string;
    purpose: QuotationReusableTextPurpose;
    showPlaceholders?: boolean;
    placeholderFields?: Array<{
        key: string;
        name?: string;
        label?: string;
        source?: string | null;
    }>;
    placeholderValues?: Record<string, string>;
    onChange: (html: string) => void;
};

const copyFor = (purpose: QuotationReusableTextPurpose) => {
    if (purpose === 'pricing_basis') {
        return {
            kind: 'quotation_pricing_basis',
            heading: 'Pricing Basis',
            description:
                'Describe how this Base Bid is priced. Insert quotation fields or reuse a saved pricing basis.',
            selectLabel: 'Saved pricing basis texts',
            selectId: 'quotation-pricing-basis-text-template',
            editorLabel: 'Custom text and descriptions',
            editorId: 'pricing_basis',
            editorPlaceholder:
                'Write the pricing basis and insert fields such as project name or Base Bid total…',
            saveTitle: 'Save reusable pricing basis text',
            importTitle: 'Import pricing basis text',
            emptySave: 'Enter pricing basis text before saving it.',
            namePlaceholder: 'Standard pricing basis',
            replaceNoun: 'pricing basis text',
            defaultBody:
                '<p>Pricing for this quotation is based on the following information for <strong>{{project_name}}</strong>.</p><p>Quotation {{quotation_number}} · Base Bid total {{base_bid_total}} · Quoted on {{quoted_on}}.</p>',
            catalogKey: 'pricingBasisTextTemplates' as const,
            importedText: 'importedQuotationPricingBasisText' as const,
            importedTemplateId:
                'importedQuotationPricingBasisTextTemplateId' as const,
        };
    }

    if (purpose === 'pricing') {
        return {
            kind: 'quotation_pricing',
            heading: 'Pricing, conditions and more',
            description:
                'Add pricing terms, conditions, exclusions, and any other wording that belongs with this quotation.',
            selectLabel: 'Saved pricing and conditions texts',
            selectId: 'quotation-pricing-text-template',
            editorLabel: 'Custom text and descriptions',
            editorId: 'pricing_conditions',
            editorPlaceholder:
                'Write pricing, conditions, exclusions, or other terms…',
            saveTitle: 'Save reusable pricing and conditions text',
            importTitle: 'Import pricing and conditions text',
            emptySave: 'Enter pricing and conditions text before saving it.',
            namePlaceholder: 'Standard pricing and conditions',
            replaceNoun: 'pricing and conditions text',
            defaultBody:
                '<p>Pricing, conditions, and exclusions for this quotation are as follows:</p>',
            catalogKey: 'pricingTextTemplates' as const,
            importedText: 'importedQuotationPricingText' as const,
            importedTemplateId: 'importedQuotationPricingTextTemplateId' as const,
        };
    }

    return {
        kind: 'quotation_proposal',
            heading: 'Quote proposal based',
            description:
                'Write the quote proposal this quotation is based on.',
            selectLabel: 'Save quotations',
            selectId: 'quotation-proposal-text-template',
            editorLabel: 'Custom text and descriptions',
            editorId: 'notes',
            editorPlaceholder: 'Write the quote proposal this quotation is based on…',
            saveTitle: 'Save reusable quotation text',
            importTitle: 'Import quotation text',
            emptySave: 'Enter quotation text before saving it.',
            namePlaceholder: 'Standard quotation',
            replaceNoun: 'quote proposal text',
            defaultBody:
                '<p>This quotation is based on the quote proposal for this project.</p>',
        catalogKey: 'proposalTextTemplates' as const,
        importedText: 'importedQuotationProposalText' as const,
        importedTemplateId: 'importedQuotationProposalTextTemplateId' as const,
    };
};

export default function QuotationReusableTextSection({
    options,
    value,
    error,
    purpose,
    showPlaceholders = false,
    placeholderFields = [],
    placeholderValues = {},
    onChange,
}: QuotationReusableTextSectionProps) {
    const copy = copyFor(purpose);
    const templates = options[copy.catalogKey] ?? [];
    const [selectedId, setSelectedId] = useState('');
    const [isSaveOpen, setIsSaveOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [importName, setImportName] = useState('');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [saveImported, setSaveImported] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [pendingReplace, setPendingReplace] = useState<
        | { kind: 'saved'; template: QuotationTextTemplateOption }
        | { kind: 'import' }
        | null
    >(null);
    const importInputRef = useRef<HTMLInputElement>(null);
    const selectedTemplate = templates.find(
        (template) => String(template.id) === selectedId,
    );

    const insertTemplate = (template: QuotationTextTemplateOption) => {
        onChange(template.body);
        setSelectedId(String(template.id));
        setPendingReplace(null);
        toast.success(`Inserted “${template.name}”. You can adapt it below.`);
    };

    const applyTemplate = (template: QuotationTextTemplateOption) => {
        if (!isEmptyHtml(value)) {
            setPendingReplace({ kind: 'saved', template });
            return;
        }

        insertTemplate(template);
    };

    const saveTemplate = (event?: FormEvent) => {
        event?.preventDefault();
        event?.stopPropagation();

        const name = templateName.trim();

        if (name === '') {
            toast.error('Enter a name for this saved text.');
            return;
        }

        if (isEmptyHtml(value) && copy.defaultBody === '') {
            toast.error(copy.emptySave);
            return;
        }

        const body = isEmptyHtml(value) ? copy.defaultBody : value;
        const insertAfterSave = isEmptyHtml(value);

        setIsSaving(true);

        const payload = {
            name,
            body,
            kind: copy.kind,
        };
        const selectedMatchesName =
            selectedTemplate &&
            selectedTemplate.name.toLowerCase() === name.toLowerCase();
        const visitCatalog = {
            preserveScroll: true,
            preserveState: true,
            onError: (errors: Record<string, string>) => {
                setIsSaving(false);
                toast.error(
                    Object.values(errors)[0] ||
                        'The quotation text could not be saved.',
                );
            },
            onSuccess: () => {
                setIsSaving(false);
                setIsSaveOpen(false);
                router.reload({
                    only: ['options'],
                    onSuccess: (page) => {
                        const catalog = page.props.options as QuotationOptions;
                        const created = (
                            catalog[copy.catalogKey] ?? []
                        ).find(
                            (template) =>
                                template.name.toLowerCase() ===
                                name.toLowerCase(),
                        );

                        if (created) {
                            setSelectedId(String(created.id));

                            if (insertAfterSave && created.body) {
                                onChange(created.body);
                                toast.success(
                                    `Created and inserted “${created.name}”.`,
                                );
                            }
                        }
                    },
                });
            },
        };

        if (selectedMatchesName && selectedTemplate) {
            router.patch(
                route('admin.bid-text-templates.update', selectedTemplate.id),
                payload,
                visitCatalog,
            );
            return;
        }

        router.post(
            route('admin.bid-text-templates.store'),
            payload,
            visitCatalog,
        );
    };

    const resetImport = () => {
        setImportFile(null);
        setImportName('');
        setSaveImported(true);
        setIsImporting(false);

        if (importInputRef.current) {
            importInputRef.current.value = '';
        }
    };

    const importText = (
        event?: FormEvent,
        confirmOptions?: { replaceConfirmed?: boolean },
    ) => {
        event?.preventDefault();
        event?.stopPropagation();

        if (!importFile) {
            toast.error('Choose a text file to import.');
            return;
        }

        if (!isEmptyHtml(value) && !confirmOptions?.replaceConfirmed) {
            setPendingReplace({ kind: 'import' });
            return;
        }

        setPendingReplace(null);
        setIsImporting(true);

        router.post(
            route('admin.bid-text-templates.import'),
            {
                file: importFile,
                name: importName.trim(),
                save: saveImported ? 1 : 0,
                kind: copy.kind,
            },
            {
                forceFormData: true,
                preserveScroll: true,
                preserveState: true,
                onError: (errors) => {
                    setIsImporting(false);
                    toast.error(
                        Object.values(errors)[0] ||
                            'The file could not be imported.',
                    );
                },
                onSuccess: (page) => {
                    setIsImporting(false);
                    const flash = (page.props as PageProps).flash;
                    const imported = flash?.[copy.importedText];

                    if (imported) {
                        onChange(imported);
                    }

                    const importedTemplateId = flash?.[copy.importedTemplateId];

                    if (importedTemplateId) {
                        setSelectedId(String(importedTemplateId));
                        router.reload({ only: ['options'] });
                    }

                    setIsImportOpen(false);
                    resetImport();
                },
            },
        );
    };

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <div>
                <h3 className="text-base font-semibold text-foreground">
                    {copy.heading}
                </h3>
                <p className="text-sm text-muted-foreground">
                    {copy.description}
                </p>
            </div>

            <div className="flex flex-col gap-3">
                <InputLabel
                    value={copy.selectLabel}
                    className="text-emerald-700 dark:text-emerald-300"
                />
                <div className="-mx-1 flex min-w-0 items-start gap-4 overflow-x-auto overscroll-x-contain px-1 pt-2 pb-3">
                    <button
                        type="button"
                        className="w-[7.25rem] shrink-0 text-center"
                        onClick={() => {
                            setTemplateName('');
                            setIsSaveOpen(true);
                        }}
                    >
                        <span className="flex h-36 w-full items-center justify-center rounded-[4px] border-[3px] border-emerald-600 bg-white p-3 shadow-sm dark:bg-background">
                            <PlusIcon className="size-7 shrink-0 overflow-visible text-emerald-600" />
                        </span>
                        <span className="mt-2 block text-xs font-medium leading-4 text-foreground">
                            Create new
                        </span>
                    </button>
                    {templates.map((template) => {
                        const selected = String(template.id) === selectedId;

                        return (
                            <button
                                key={template.id}
                                type="button"
                                aria-pressed={selected}
                                className="w-[7.25rem] shrink-0 text-center"
                                onClick={() => applyTemplate(template)}
                            >
                                <span
                                    className={cn(
                                        'relative block h-36 w-full overflow-hidden rounded-[4px] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.12)] dark:bg-background',
                                        selected
                                            ? 'ring-2 ring-emerald-600 ring-offset-2 ring-offset-background'
                                            : 'border border-border',
                                    )}
                                >
                                    <span
                                        className="pointer-events-none absolute left-1.5 top-2 origin-top-left text-left text-[7px] leading-[1.45] text-slate-600 dark:text-slate-300 [&_*]:mt-0 [&_p]:mb-1 [&_p:first-child]:mt-0 [&_strong]:font-semibold [&_ul]:ml-2 [&_ul]:list-disc"
                                        style={{
                                            width: 196,
                                            transform: 'scale(0.52)',
                                        }}
                                        dangerouslySetInnerHTML={{
                                            __html: template.body,
                                        }}
                                    />
                                </span>
                                <span className="mt-2 block text-xs font-medium leading-4 text-muted-foreground">
                                    {template.name}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <InputLabel
                    htmlFor={copy.editorId}
                    value={copy.editorLabel}
                    className="text-emerald-700 dark:text-emerald-300"
                />
                <RichTextEditor
                    id={copy.editorId}
                    value={value}
                    onChange={onChange}
                    error={error}
                    placeholder={copy.editorPlaceholder}
                    showPlaceholders={showPlaceholders}
                    placeholderFields={placeholderFields}
                    placeholderValues={placeholderValues}
                />
                <InputError message={error} />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                        Save as reusable text stores this wording in the
                        library without saving the quotation.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setIsImportOpen(true);
                            }}
                        >
                            <FileUpIcon />
                            Import text
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isEmptyHtml(value)}
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setTemplateName(selectedTemplate?.name ?? '');
                                setIsSaveOpen(true);
                            }}
                        >
                            <SaveIcon />
                            Save as reusable text
                        </Button>
                    </div>
                </div>
            </div>

            <AlertDialog open={isSaveOpen} onOpenChange={setIsSaveOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{copy.saveTitle}</AlertDialogTitle>
                        <AlertDialogDescription>
                            This saves a named card you can click into other
                            quotations. It does not save this quotation. If the
                            editor is empty, the standard wording is used. If
                            the name already exists, that saved text is updated.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor={`${copy.selectId}-name`}
                                value="Name"
                            />
                            <TextInput
                                id={`${copy.selectId}-name`}
                                value={templateName}
                                onChange={(event) =>
                                    setTemplateName(event.target.value)
                                }
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        saveTemplate();
                                    }
                                }}
                                placeholder={copy.namePlaceholder}
                            />
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel type="button">
                                Cancel
                            </AlertDialogCancel>
                            <Button
                                type="button"
                                disabled={isSaving}
                                onClick={() => saveTemplate()}
                            >
                                Save text only
                            </Button>
                        </AlertDialogFooter>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog
                open={isImportOpen}
                onOpenChange={(open) => {
                    setIsImportOpen(open);

                    if (!open) {
                        resetImport();
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{copy.importTitle}</AlertDialogTitle>
                        <AlertDialogDescription>
                            Import a Word file (.doc or .docx) or a PDF. .txt
                            and .html also work. Check save as reusable text to
                            keep it in the library without saving this
                            quotation.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor={`${copy.selectId}-import-file`}
                                value="File"
                            />
                            <input
                                ref={importInputRef}
                                id={`${copy.selectId}-import-file`}
                                type="file"
                                accept=".doc,.docx,.pdf,.txt,.text,.html,.htm,.rtf,.odt,.md,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,text/plain,text/html"
                                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-700"
                                onChange={(event) => {
                                    const file =
                                        event.target.files?.[0] ?? null;
                                    setImportFile(file);

                                    if (file && importName.trim() === '') {
                                        setImportName(
                                            file.name
                                                .replace(/\.[^.]+$/, '')
                                                .replace(/[_-]+/g, ' ')
                                                .trim(),
                                        );
                                    }
                                }}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <InputLabel
                                htmlFor={`${copy.selectId}-import-name`}
                                value="Name"
                            />
                            <TextInput
                                id={`${copy.selectId}-import-name`}
                                value={importName}
                                onChange={(event) =>
                                    setImportName(event.target.value)
                                }
                                placeholder={copy.namePlaceholder}
                            />
                        </div>
                        <label className="flex items-center gap-2 text-sm text-foreground">
                            <input
                                type="checkbox"
                                checked={saveImported}
                                onChange={(event) =>
                                    setSaveImported(event.target.checked)
                                }
                                className="rounded border-border text-emerald-700 focus:ring-emerald-600"
                            />
                            Save as reusable text (does not save this
                            quotation)
                        </label>
                        <AlertDialogFooter>
                            <AlertDialogCancel type="button">
                                Cancel
                            </AlertDialogCancel>
                            <Button
                                type="button"
                                disabled={isImporting || !importFile}
                                onClick={() => importText()}
                            >
                                {saveImported
                                    ? 'Import and save text'
                                    : 'Import into this quotation'}
                            </Button>
                        </AlertDialogFooter>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog
                open={pendingReplace !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingReplace(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {pendingReplace?.kind === 'import'
                                ? 'Import this file?'
                                : 'Insert this saved text?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingReplace?.kind === 'import'
                                ? `The imported file will replace the ${copy.replaceNoun} already in this quotation. You can edit it afterward.`
                                : `“${pendingReplace?.template.name ?? 'This saved text'}” will replace the ${copy.replaceNoun} already in this quotation. You can edit it after inserting. This does not save the quotation.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel type="button">
                            Keep current text
                        </AlertDialogCancel>
                        <AlertDialogAction
                            type="button"
                            onClick={() => {
                                const pending = pendingReplace;

                                if (pending?.kind === 'import') {
                                    importText(undefined, {
                                        replaceConfirmed: true,
                                    });
                                    return;
                                }

                                if (pending?.kind === 'saved') {
                                    insertTemplate(pending.template);
                                }
                            }}
                        >
                            {pendingReplace?.kind === 'import'
                                ? 'Import file'
                                : 'Insert saved text'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
