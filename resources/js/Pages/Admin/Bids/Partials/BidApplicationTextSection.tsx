import CreatableSelect from '@/Components/CreatableSelect';
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
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
    DEFAULT_SCOPE_TEXT_BODY,
    DEFAULT_SHIPPING_TEXT_BODY,
    isEmptyHtml,
} from '../bidText';
import {
    formatMoney,
    scopesCombinedPriceAmount,
    scopesTotalAmount,
    type BidCompanyOption,
    type BidFormData,
    type BidOptions,
    type BidProjectOption,
    type BidTextFieldOption,
    type BidTextTemplateOption,
} from '../types';

type BidReusableTextPurpose = 'scope' | 'shipping';

type BidApplicationTextSectionProps = {
    options: BidOptions;
    project?: BidProjectOption;
    scopes: BidFormData['scopes'];
    extraFieldValues?: Record<string, string>;
    value: string;
    templateId: string;
    error?: string;
    purpose: BidReusableTextPurpose;
    embedded?: boolean;
    onChange: (html: string) => void;
    onTemplateIdChange: (id: string) => void;
};

const copyFor = (purpose: BidReusableTextPurpose) => {
    if (purpose === 'shipping') {
        return {
            kind: 'shipping',
            heading: 'Shipping & handling, basis & qualification and more',
            description:
                'This is a customized notes section, not a fixed list of fields. Use it for the full wording this bid needs — shipping, handling, basis & qualification, exclusions, adjustments, lead times, or any other terms that do not belong on a product line. Pick a saved page to insert it, or write your own. Saving the bid stores this wording on the bid.',
            selectLabel: 'Saved shipping and handling texts',
            selectPlaceholder: 'Type to search or add shipping and handling…',
            selectId: 'bid-shipping-text-template',
            editorLabel: 'Custom text and descriptions',
            editorId: 'bid-shipping-text',
            editorPlaceholder:
                'Write shipping, handling, basis & qualification, exclusions, or any other notes…',
            saveTitle: 'Save reusable shipping and handling text',
            importTitle: 'Import shipping and handling text',
            emptySave: 'Enter shipping and handling text before saving it.',
            namePlaceholder: 'Standard shipping and handling',
            replaceNoun: 'shipping and handling text',
            entityLabel: 'saved shipping and handling text',
            allowCreate: true,
            gallery: true,
            defaultBody: DEFAULT_SHIPPING_TEXT_BODY,
            catalogKey: 'shippingTextTemplates' as const,
            importedText: 'importedShippingText' as const,
            importedTemplateId: 'importedShippingTextTemplateId' as const,
        };
    }

    return {
        kind: 'scope',
        heading: 'Predefined scope of work',
        description:
            'Pick a saved page to insert it, the same way Word templates work. Create new adds another reusable page. You can still add and remove scope lines below. Saving the bid stores this wording on the bid.',
        selectLabel: 'Saved scope texts',
        selectPlaceholder: 'Type to search or add a saved scope…',
        selectId: 'bid-scope-text-template',
        editorLabel: 'Scope of work text',
        editorId: 'bid-scope-of-work-text',
        editorPlaceholder:
            'Write the predefined scope of work, or click a saved page to start…',
        saveTitle: 'Save reusable scope text',
        importTitle: 'Import scope text',
        emptySave: 'Enter scope text before saving it.',
        namePlaceholder: 'Standard scope of work',
        replaceNoun: 'scope of work text',
        entityLabel: 'saved scope text',
        allowCreate: true,
        gallery: true,
        defaultBody: DEFAULT_SCOPE_TEXT_BODY,
        catalogKey: 'scopeTextTemplates' as const,
        importedText: 'importedScopeText' as const,
        importedTemplateId: 'importedScopeTextTemplateId' as const,
    };
};

const todayLabel = () =>
    new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date());

const formatQuantity = (value: number) => {
    if (!Number.isFinite(value) || value === 0) {
        return '';
    }

    return Number.isInteger(value) ? String(value) : value.toFixed(2);
};

function placeholderValues(
    project: BidProjectOption | undefined,
    company: BidCompanyOption | undefined,
    scopes: BidFormData['scopes'],
    customFields: BidTextFieldOption[] = [],
    extraFieldValues: Record<string, string> = {},
): Record<string, string> {
    const scopeLines = scopes
        .map((scope) => {
            const name = scope.title_name.trim();
            const notes = isEmptyHtml(scope.notations)
                ? ''
                : scope.notations
                      .replace(/<[^>]*>/g, ' ')
                      .replace(/\s+/g, ' ')
                      .trim();

            if (name === '' && notes === '') {
                return '';
            }

            if (name === '') {
                return notes;
            }

            return notes !== '' ? `${name}: ${notes}` : name;
        })
        .filter(Boolean);

    const lines = scopes.flatMap((scope) =>
        (scope.products ?? []).filter((line) =>
            line.description.trim() !== '' ||
            line.product_id.trim() !== '' ||
            line.service_id.trim() !== '' ||
            line.location.trim() !== '' ||
            line.quantity.trim() !== '' ||
            line.unit_bid.trim() !== '' ||
            line.allocated_handling.trim() !== '' ||
            line.combined_price.trim() !== '',
        ),
    );
    const quantity = lines.reduce((sum, line) => {
        const amount = Number(line.quantity);

        return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
    const latestTotal = scopesTotalAmount(scopes);
    const combinedPrice = scopesCombinedPriceAmount(scopes);

    const screenValues: Record<string, string> = {
        project_name: project?.name ?? '',
        project_number: project?.project_number ?? '',
        customer_name: project?.contractor_contact_name ?? '',
        customer_company: project?.contractor_name ?? '',
        project_address: project?.site_address ?? '',
        site_address: project?.site_address ?? '',
        scope_of_work: scopeLines.join('\n'),
        estimated_start_date: project?.estimated_start_date ?? '',
        estimated_end_date: project?.estimated_end_date ?? '',
        company_name: company?.name ?? 'Gateway Door Systems',
        company_legal_name:
            company?.legal_name || company?.name || 'Gateway Door Systems',
        company_phone: company?.phone ?? '',
        company_email: company?.email ?? '',
        company_address: company?.address ?? '',
        today: todayLabel(),
        combined_price: combinedPrice ? formatMoney(combinedPrice) : '',
        latest_revision_total: latestTotal ? formatMoney(latestTotal) : '',
        item_quantity: formatQuantity(quantity),
        item_count: lines.length > 0 ? String(lines.length) : '',
        ...extraFieldValues,
    };

    const customValues = Object.fromEntries(
        customFields
            .map((field) => {
                if (field.source && (screenValues[field.source] ?? '') !== '') {
                    return [field.key, screenValues[field.source]];
                }

                if ((field.value ?? '').trim() !== '') {
                    return [field.key, field.value ?? ''];
                }

                return null;
            })
            .filter((entry): entry is [string, string] => entry !== null),
    );

    return {
        ...customValues,
        ...screenValues,
    };
}

export default function BidApplicationTextSection({
    options,
    project,
    scopes,
    extraFieldValues = {},
    value,
    templateId,
    error,
    purpose,
    embedded = false,
    onChange,
    onTemplateIdChange,
}: BidApplicationTextSectionProps) {
    const copy = copyFor(purpose);
    const templates = options[copy.catalogKey] ?? [];
    const [selectedId, setSelectedId] = useState(templateId);
    const [isSaveOpen, setIsSaveOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [importName, setImportName] = useState('');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [saveImported, setSaveImported] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [pendingReplace, setPendingReplace] = useState<
        | { kind: 'saved'; template: BidTextTemplateOption }
        | { kind: 'import' }
        | null
    >(null);
    const importInputRef = useRef<HTMLInputElement>(null);

    const values = useMemo(
        () =>
            placeholderValues(
                project,
                options.company,
                scopes,
                options.textFields ?? [],
                extraFieldValues,
            ),
        [
            project,
            options.company,
            scopes,
            options.textFields,
            extraFieldValues,
        ],
    );

    useEffect(() => {
        setSelectedId(templateId);
    }, [templateId]);

    const selectedTemplate = templates.find(
        (template) => String(template.id) === selectedId,
    );

    const insertTemplate = (template: BidTextTemplateOption) => {
        onChange(template.body);
        onTemplateIdChange(String(template.id));
        setSelectedId(String(template.id));
        setPendingReplace(null);
        toast.success(`Inserted “${template.name}”. You can adapt it below.`);
    };

    const applyTemplate = (template: BidTextTemplateOption) => {
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
                        'The bid text could not be saved.',
                );
            },
            onSuccess: () => {
                setIsSaving(false);
                setIsSaveOpen(false);
                router.reload({
                    only: ['options'],
                    onSuccess: (page) => {
                        const catalog = page.props.options as BidOptions;
                        const created = (
                            catalog[copy.catalogKey] ?? []
                        ).find(
                            (template) =>
                                template.name.toLowerCase() ===
                                name.toLowerCase(),
                        );

                        if (created) {
                            onTemplateIdChange(String(created.id));
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
                        const templateIdValue = String(importedTemplateId);
                        onTemplateIdChange(templateIdValue);
                        setSelectedId(templateIdValue);
                        router.reload({ only: ['options'] });
                    }

                    setIsImportOpen(false);
                    resetImport();
                },
            },
        );
    };

    const fields = (
        <>
            <div>
                <h3 className="text-base font-semibold text-foreground">
                    {copy.heading}
                </h3>
                <p className="text-sm text-muted-foreground">
                    {copy.description}
                </p>
            </div>

            <div>
                {copy.gallery ? (
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
                                const selected =
                                    String(template.id) === selectedId;

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
                ) : (
                    <div className="grid gap-4 overflow-visible rounded-lg border border-emerald-200 bg-background p-4 dark:border-emerald-900/70 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                        <CreatableSelect
                            id={copy.selectId}
                            label={copy.selectLabel}
                            value={selectedId}
                            options={templates}
                            allowCreate={copy.allowCreate}
                            createRoute={
                                copy.allowCreate
                                    ? route('admin.bid-text-templates.store')
                                    : undefined
                            }
                            catalogKey={copy.catalogKey}
                            entityLabel={copy.entityLabel}
                            placeholder={copy.selectPlaceholder}
                            createExtras={
                                copy.allowCreate
                                    ? {
                                          kind: copy.kind,
                                          body: isEmptyHtml(value)
                                              ? copy.defaultBody
                                              : value,
                                      }
                                    : {}
                            }
                            onChange={(id, option) => {
                                setSelectedId(id);

                                if (!id) {
                                    return;
                                }

                                onTemplateIdChange(id);

                                if (!isEmptyHtml(value)) {
                                    return;
                                }

                                const template =
                                    templates.find(
                                        (item) => String(item.id) === id,
                                    ) ??
                                    (option?.body
                                        ? {
                                              id: Number(id),
                                              name: option.name,
                                              body: option.body,
                                          }
                                        : undefined);

                                if (template?.body) {
                                    insertTemplate(template);
                                }
                            }}
                        />
                        <Button
                            type="button"
                            disabled={!selectedTemplate}
                            onClick={() => {
                                if (selectedTemplate) {
                                    applyTemplate(selectedTemplate);
                                }
                            }}
                        >
                            Insert into bid
                        </Button>
                    </div>
                )}
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
                    placeholderFields={options.textFields ?? []}
                    placeholderValues={values}
                />
                <InputError message={error} />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                        Save as reusable text stores this wording in the
                        library without saving the bid. Save bid keeps this
                        text on the bid.
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
        </>
    );

    return (
        <div
            className={
                embedded
                    ? 'flex flex-col gap-4'
                    : 'flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30'
            }
        >
            {fields}

            <AlertDialog open={isSaveOpen} onOpenChange={setIsSaveOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {copy.saveTitle}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {copy.gallery ? (
                                <>
                                    This saves a named card you can click into
                                    other bids. It does not save this bid. If
                                    the editor is empty, the standard wording
                                    is used. If the name already exists, that
                                    saved text is updated.
                                </>
                            ) : (
                                <>
                                    This saves the wording to the library so
                                    you can insert it into other bids. It does
                                    not save this bid. If the name already
                                    exists, that saved text is updated. Keep{' '}
                                    {'{{project_name}}'} and similar fields if
                                    you want them filled automatically next
                                    time.
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-2">
                            <InputLabel htmlFor={`${copy.selectId}-name`} value="Name" />
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
                            keep it in the library without saving this bid, or
                            import it into this bid and save the bid later.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-2">
                            <InputLabel htmlFor={`${copy.selectId}-import-file`} value="File" />
                            <input
                                ref={importInputRef}
                                id={`${copy.selectId}-import-file`}
                                type="file"
                                accept=".doc,.docx,.pdf,.txt,.text,.html,.htm,.rtf,.odt,.md,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,text/plain,text/html"
                                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-700"
                                onChange={(event) => {
                                    const file = event.target.files?.[0] ?? null;
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
                            Save as reusable text (does not save this bid)
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
                                    : 'Import into this bid'}
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
                                ? `The imported file will replace the ${copy.replaceNoun} already in this bid. You can edit it afterward.`
                                : `“${pendingReplace?.template.name ?? 'This saved text'}” will replace the ${copy.replaceNoun} already in this bid. You can edit it after inserting. This does not save the bid.`}
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
