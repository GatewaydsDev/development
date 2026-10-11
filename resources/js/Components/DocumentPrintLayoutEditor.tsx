import RichTextEditor from '@/Components/RichTextEditor';
import {
    AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/Components/ui/alert-dialog';
import { Button } from '@/Components/ui/button';
import BidPrintLayoutPicker from '@/Pages/Admin/Bids/Partials/BidPrintLayoutPicker';
import {
    editorLayoutDocument, layoutSections, positionedLayoutSections, quotationComponentsHtml,
    type PrintLayoutCatalog, type PrintLayoutElement, type PrintLayoutOption,
} from '@/Pages/Admin/Bids/layoutSections';
import LayoutElementsEditor, {
    ImportPanel, LayoutElementsFileInput, PreviewZone, transformCase, useLayoutElements,
    type ElementCase, type LayoutElement, type MergeField,
} from '@/Pages/Admin/DocumentSettings/LayoutElements';
import type { QuotationLayoutDesign } from '@/Pages/Admin/Quotations/types';
import { PRINT_LAYOUT_WIDTH } from '@/lib/printLayoutGeometry';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

type Props = {
    document: 'bid' | 'quotation';
    catalog: PrintLayoutCatalog;
    layoutId: string;
    version: string;
    onLayoutChange: (id: string, version: string) => void;
    literals: Record<string, string>;
    fieldKeys?: Record<string, string>;
    hasUnsavedChanges: boolean;
    onSaveCurrent: () => Promise<boolean>;
    componentCanvas?: boolean;
    design?: QuotationLayoutDesign;
    onDesignChange?: (design: QuotationLayoutDesign, html: string) => void;
} & Pick<React.ComponentProps<typeof RichTextEditor>,
    'id' | 'value' | 'onChange' | 'error' | 'placeholder' |
    'placeholderFields' | 'placeholderValues' | 'placeholderCatalog'>;

const cloneLayoutElements = (elements: PrintLayoutElement[]): PrintLayoutElement[] => {
    try {
        return structuredClone(elements);
    } catch {
        return elements.map((element) => ({ ...element }));
    }
};

const layoutTextCase = (value?: string): ElementCase =>
    value === 'camel' || value === 'uppercase' || value === 'lowercase' ? value : 'original';

function QuotationComponentCanvas({
    design, literals, fieldKeys, placeholderFields, placeholderValues, error, onDesignChange,
}: {
    design: QuotationLayoutDesign;
    literals: Record<string, string>;
    fieldKeys?: Record<string, string>;
    placeholderFields?: Props['placeholderFields'];
    placeholderValues?: Record<string, string>;
    error?: string;
    onDesignChange: (design: QuotationLayoutDesign, html: string) => void;
}) {
    const designRef = useRef(design);
    const literalsRef = useRef(literals);
    const fieldKeysRef = useRef(fieldKeys);
    const onDesignChangeRef = useRef(onDesignChange);
    designRef.current = design;
    literalsRef.current = literals;
    fieldKeysRef.current = fieldKeys;
    onDesignChangeRef.current = onDesignChange;

    const publish = (patch: Partial<QuotationLayoutDesign>) => {
        const next = { ...designRef.current, ...patch };
        designRef.current = next;
        onDesignChangeRef.current(
            next,
            quotationComponentsHtml(next, literalsRef.current, fieldKeysRef.current),
        );
    };
    const fields = useMemo<MergeField[]>(() => (placeholderFields ?? []).map((field) => ({
        key: field.key,
        label: field.label ?? field.name ?? field.key,
        group: field.group ?? 'Quotation',
        sample: placeholderValues?.[field.key] ?? literals[field.key] ?? '',
    })), [placeholderFields, placeholderValues, literals]);
    const textCase = layoutTextCase(design.text_case);
    const controller = useLayoutElements(
        design.elements as LayoutElement[],
        (elements) => publish({ elements }),
        fields,
        {
            header: design.header_background || '#ffffff',
            intro: '',
            body: '',
            footer: '',
        },
        (zone, color) => {
            if (zone === 'header') publish({ header_background: color });
        },
        design.header_height ?? 160,
        (height) => publish({ header_height: height }),
    );

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <LayoutElementsFileInput controller={controller} />
            <ImportPanel controller={controller} />
            <LayoutElementsEditor controller={controller} error={error}>
                <div className="rounded-xl bg-muted/40 p-4 sm:p-6">
                    <article className="mx-auto overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl shadow-slate-900/10">
                        <div className="overflow-x-auto">
                            <header style={{ width: PRINT_LAYOUT_WIDTH + 52, backgroundColor: design.header_background || '#ffffff' }}>
                                <PreviewZone
                                    controller={controller}
                                    zone="header"
                                    applyCase={(value) => transformCase(value, textCase)}
                                    textCase={textCase}
                                />
                            </header>
                        </div>
                    </article>
                </div>
            </LayoutElementsEditor>
        </div>
    );
}

const activeLayout = (catalog: PrintLayoutCatalog, id: string) =>
    catalog.printLayouts.find((layout) => layout.id === (id ? Number(id) : catalog.assignedPrintLayoutId));

export default function DocumentPrintLayoutEditor({
    document: documentType, catalog: initialCatalog, layoutId, version,
    onLayoutChange, literals, fieldKeys, hasUnsavedChanges, onSaveCurrent,
    componentCanvas = false, design, onDesignChange, ...editorProps
}: Props) {
    const [catalog, setCatalog] = useState(initialCatalog);
    const [pending, setPending] = useState<{
        id: string; layout: PrintLayoutOption; kind: 'select' | 'update';
    } | null>(null);
    const [busy, setBusy] = useState(false);
    const [checkError, setCheckError] = useState<string | null>(null);
    const [layoutLoad, setLayoutLoad] = useState<{
        key: number; sections: ReturnType<typeof layoutSections>; replace: boolean;
        document: ReturnType<typeof editorLayoutDocument>;
    } | null>(null);
    const acknowledged = useRef(version || activeLayout(initialCatalog, layoutId)?.version);
    const dismissed = useRef<string | null>(null);
    const canvasEdited = useRef(false);
    const requestSequence = useRef(0);
    const mounted = useRef(true);
    const latest = useRef({ layoutId, pending, busy });
    const onDesignChangeRef = useRef(onDesignChange);
    const literalsRef = useRef(literals);
    const fieldKeysRef = useRef(fieldKeys);
    const placeLayoutRef = useRef<(id: string, layout: PrintLayoutOption) => void>(() => {});
    const elementCount = useRef(design?.elements.length ?? 0);
    latest.current = { layoutId, pending, busy };
    onDesignChangeRef.current = onDesignChange;
    literalsRef.current = literals;
    fieldKeysRef.current = fieldKeys;
    elementCount.current = design?.elements.length ?? 0;
    placeLayoutRef.current = (id, layout) => {
        if (!onDesignChangeRef.current) return;
        const nextDesign: QuotationLayoutDesign = {
            elements: cloneLayoutElements(layout.elements),
            header_height: layout.headerHeight ?? 160,
            header_background: layout.headerBackground ?? '#ffffff',
            text_case: layout.textCase ?? 'original',
        };
        if (nextDesign.elements.length === 0) {
            throw new Error('This layout has no components to place.');
        }
        acknowledged.current = layout.version;
        dismissed.current = null;
        canvasEdited.current = false;
        onLayoutChange(id || String(layout.id), layout.version ?? '');
        onDesignChangeRef.current(
            nextDesign,
            quotationComponentsHtml(nextDesign, literalsRef.current, fieldKeysRef.current),
        );
    };

    useEffect(() => {
        acknowledged.current = version || activeLayout(initialCatalog, layoutId)?.version;
        dismissed.current = null;
        setPending(null);
    }, [layoutId, version]);

    useEffect(() => {
        mounted.current = true;
        const controller = new AbortController();
        let checking = false;
        const check = async () => {
            if (checking || document.hidden || latest.current.busy) return;
            checking = true;
            const sequence = ++requestSequence.current;
            try {
                const response = await fetch(route('admin.document-layouts.catalog', documentType), {
                    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                    cache: 'no-store', signal: controller.signal,
                });
                if (!response.ok) {
                    setCheckError('Layout updates could not be checked. Your current content is unchanged.');
                    return;
                }
                const next: PrintLayoutCatalog = await response.json();
                if (!mounted.current || sequence !== requestSequence.current) return;
                setCatalog(next);
                setCheckError(null);
                const layout = activeLayout(next, latest.current.layoutId);
                if (!layout && (latest.current.layoutId || acknowledged.current)) {
                    setPending(null);
                    setCheckError('The selected layout is no longer assigned to this document type. Its loaded content is unchanged; assign it again in Print Layouts or choose another layout.');
                } else if (layout && layout.version !== acknowledged.current &&
                    layout.version !== dismissed.current && !latest.current.pending) {
                    if (componentCanvas && onDesignChangeRef.current && !canvasEdited.current && elementCount.current === 0) {
                        placeLayoutRef.current(latest.current.layoutId || String(layout.id), layout);
                    } else if (!componentCanvas) {
                        setPending({ id: latest.current.layoutId, layout, kind: 'update' });
                    }
                }
            } catch (error) {
                if (!controller.signal.aborted && mounted.current) {
                    setCheckError(error instanceof Error ? error.message : 'Layout updates could not be checked.');
                }
            } finally {
                checking = false;
            }
        };
        void check();
        const timer = window.setInterval(() => void check(), 5000);
        const onVisible = () => { if (!document.hidden) void check(); };
        window.addEventListener('focus', onVisible);
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            mounted.current = false;
            controller.abort();
            window.clearInterval(timer);
            window.removeEventListener('focus', onVisible);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [documentType, componentCanvas]);

    useEffect(() => {
        if (!componentCanvas || elementCount.current > 0) return;
        const layout = activeLayout(initialCatalog, layoutId);
        if (!layout?.elements.length) return;
        placeLayoutRef.current(layoutId || String(layout.id), layout);
    }, [componentCanvas, initialCatalog, layoutId]);

    const fetchLatest = async () => {
        ++requestSequence.current;
        const response = await fetch(route('admin.document-layouts.catalog', documentType), {
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            cache: 'no-store',
        });
        if (!response.ok) throw new Error('The latest layout could not be loaded. Your current content is unchanged.');
        const next: PrintLayoutCatalog = await response.json();
        if (!mounted.current) throw new Error('The document editor was closed.');
        setCatalog(next);
        setCheckError(null);
        return next;
    };

    const select = async (id: string) => {
        setBusy(true);
        try {
            const next = await fetchLatest();
            const layout = activeLayout(next, id);
            if (!layout) {
                toast.error('This layout is no longer available. Choose another saved layout.');
                return;
            }
            if (componentCanvas && onDesignChangeRef.current) {
                placeLayoutRef.current(id || String(layout.id), layout);
                toast.success(`Loaded “${layout.name}”. Save the ${documentType} to keep it.`);
                return;
            }
            setPending({ id, layout, kind: 'select' });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'The layout could not be loaded.');
        } finally {
            if (mounted.current) setBusy(false);
        }
    };
    const keepCurrent = () => {
        if (pending && (pending.kind === 'update' || pending.id === layoutId)) {
            dismissed.current = pending.layout.version ?? null;
        }
        setPending(null);
    };
    const apply = async (saveFirst: boolean) => {
        if (!pending) return;
        setBusy(true);
        try {
            if (saveFirst && !(await onSaveCurrent())) return;
            const next = await fetchLatest();
            const layout = activeLayout(next, pending.id);
            if (!layout) {
                toast.error('This layout is no longer available. Your current content is unchanged.');
                return;
            }
            if (layout.version !== pending.layout.version) {
                setPending({ ...pending, layout });
                toast.info('The layout changed again. Review and confirm the latest version.');
                return;
            }
            if (componentCanvas && onDesignChangeRef.current) {
                placeLayoutRef.current(pending.id || String(layout.id), layout);
                setPending(null);
                toast.success(`Loaded the latest “${layout.name}” layout. Save the ${documentType} to keep it.`);
                return;
            }
            const sections = positionedLayoutSections(layout, literals, fieldKeys);
            const document = editorLayoutDocument(layout, literals, fieldKeys);
            if (!document) {
                toast.error('This layout has no content to load. Your current content is unchanged.');
                return;
            }
            acknowledged.current = layout.version;
            dismissed.current = null;
            onLayoutChange(pending.id, layout.version ?? '');
            setLayoutLoad((previous) => ({ key: (previous?.key ?? 0) + 1, sections, replace: true, document }));
            setPending(null);
            toast.success(`Loaded the latest “${layout.name}” layout. Save the ${documentType} to keep it.`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'The layout could not be updated.');
        } finally {
            if (mounted.current) setBusy(false);
        }
    };
    const selected = activeLayout(catalog, layoutId);
    const sections = useMemo(() => selected ? layoutSections(selected.elements, literals, fieldKeys) : [], [selected, literals, fieldKeys]);

    return (
        <div className="flex min-w-0 flex-col gap-3">
            <BidPrintLayoutPicker
                layouts={catalog.printLayouts}
                assignedLayoutId={catalog.assignedPrintLayoutId}
                value={layoutId} document={documentType} disabled={busy}
                confirm={!componentCanvas}
                onSelect={(id) => void select(id)}
            />
            <p className="text-sm text-muted-foreground" role="status">
                {busy
                    ? 'Placing the layout components…'
                    : componentCanvas
                        ? 'Choosing a layout places its text, tables, and images on the page.'
                        : 'Saved layout changes are checked while this document editor is open.'}
            </p>
            {checkError ? <p role="alert" className="text-sm text-destructive">{checkError}</p> : null}
            {componentCanvas ? (
                <QuotationComponentCanvas
                    design={design ?? { elements: [], header_height: 160, header_background: '#ffffff', text_case: 'original' }}
                    literals={literals}
                    fieldKeys={fieldKeys}
                    placeholderFields={editorProps.placeholderFields}
                    placeholderValues={editorProps.placeholderValues}
                    error={editorProps.error}
                    onDesignChange={(next, html) => {
                        canvasEdited.current = true;
                        onDesignChange?.(next, html);
                    }}
                />
            ) : (
                <RichTextEditor {...editorProps} layoutSections={sections}
                    layoutLoad={layoutLoad} allowBlockDrag layoutName={selected?.name} />
            )}
            <AlertDialog open={pending !== null} onOpenChange={(open) => {
                if (!open && !busy) keepCurrent();
            }}>
                <AlertDialogContent onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {pending?.kind === 'update' ? 'A newer print layout is available' : 'Load the latest layout?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {pending?.kind === 'update' ? `“${pending.layout.name}” has changed since your current version. ` : ''}
                            Loading it replaces only the {documentType === 'bid' ? 'bid information' : 'quotation header'}.
                            {hasUnsavedChanges
                                ? ` Save your current ${documentType} changes first, or replace without saving.`
                                : ' Other document fields will not be changed.'}
                            {' '}Keeping the current content will not update it automatically.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-wrap">
                        <AlertDialogCancel type="button" disabled={busy} onClick={keepCurrent}>
                            Keep current
                        </AlertDialogCancel>
                        <Button type="button" variant={hasUnsavedChanges ? 'outline' : 'default'}
                            disabled={busy} onClick={() => void apply(false)}>
                            {hasUnsavedChanges ? 'Update without saving' : 'Update layout'}
                        </Button>
                        {hasUnsavedChanges ? (
                            <Button type="button" disabled={busy} onClick={() => void apply(true)}>
                                {busy ? 'Saving and updating…' : 'Save changes, then update'}
                            </Button>
                        ) : null}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
