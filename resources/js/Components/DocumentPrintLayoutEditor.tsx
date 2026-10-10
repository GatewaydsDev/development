import RichTextEditor from '@/Components/RichTextEditor';
import {
    AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/Components/ui/alert-dialog';
import { Button } from '@/Components/ui/button';
import BidPrintLayoutPicker from '@/Pages/Admin/Bids/Partials/BidPrintLayoutPicker';
import {
    layoutSections, positionedLayoutSections,
    type PrintLayoutCatalog, type PrintLayoutOption,
} from '@/Pages/Admin/Bids/layoutSections';
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
} & Pick<React.ComponentProps<typeof RichTextEditor>,
    'id' | 'value' | 'onChange' | 'error' | 'placeholder' |
    'placeholderFields' | 'placeholderValues' | 'placeholderCatalog'>;

const activeLayout = (catalog: PrintLayoutCatalog, id: string) =>
    catalog.printLayouts.find((layout) => layout.id === (id ? Number(id) : catalog.assignedPrintLayoutId));

export default function DocumentPrintLayoutEditor({
    document: documentType, catalog: initialCatalog, layoutId, version,
    onLayoutChange, literals, fieldKeys, hasUnsavedChanges, onSaveCurrent, ...editorProps
}: Props) {
    const [catalog, setCatalog] = useState(initialCatalog);
    const [pending, setPending] = useState<{
        id: string; layout: PrintLayoutOption; kind: 'select' | 'update';
    } | null>(null);
    const [busy, setBusy] = useState(false);
    const [checkError, setCheckError] = useState<string | null>(null);
    const [layoutLoad, setLayoutLoad] = useState<{
        key: number; sections: ReturnType<typeof layoutSections>; replace: boolean;
    } | null>(null);
    const acknowledged = useRef(version || activeLayout(initialCatalog, layoutId)?.version);
    const dismissed = useRef<string | null>(null);
    const requestSequence = useRef(0);
    const mounted = useRef(true);
    const latest = useRef({ layoutId, pending, busy });
    latest.current = { layoutId, pending, busy };

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
                if (!response.ok) throw new Error('Layout updates could not be checked. Your current content is unchanged.');
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
                    setPending({ id: latest.current.layoutId, layout, kind: 'update' });
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
    }, [documentType]);

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
            if (!layout) throw new Error('This layout is no longer available. Choose another saved layout.');
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
            if (!layout) throw new Error('This layout is no longer available. Your current content is unchanged.');
            if (layout.version !== pending.layout.version) {
                setPending({ ...pending, layout });
                toast.info('The layout changed again. Review and confirm the latest version.');
                return;
            }
            const sections = positionedLayoutSections(layout, literals, fieldKeys);
            if (!sections.length) throw new Error('This layout has no content to load. Your current content is unchanged.');
            acknowledged.current = layout.version;
            dismissed.current = null;
            onLayoutChange(pending.id, layout.version ?? '');
            setLayoutLoad((previous) => ({ key: (previous?.key ?? 0) + 1, sections, replace: true }));
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
                onSelect={(id) => void select(id)}
            />
            <p className="text-sm text-muted-foreground" role="status">
                {busy ? 'Checking the latest layout…' : 'Saved layout changes are checked while this document editor is open.'}
            </p>
            {checkError ? <p role="alert" className="text-sm text-destructive">{checkError}</p> : null}
            <RichTextEditor {...editorProps} layoutSections={sections}
                layoutLoad={layoutLoad} allowBlockDrag layoutName={selected?.name} />
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
