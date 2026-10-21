import PrintLayoutThumbnail from '@/Components/PrintLayoutThumbnail';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { ElementsReadOnly, type LayoutElement, type MergeField } from '@/Pages/Admin/DocumentSettings/LayoutElements';
import { PRINT_LAYOUT_WIDTH } from '@/lib/printLayoutGeometry';
import { cn } from '@/lib/utils';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { CheckIcon, FileTextIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import type { PrintLayoutOption } from '../layoutSections';

export default function BidPrintLayoutPicker({
    layouts,
    assignedLayoutId,
    value,
    onSelect,
    document = 'bid',
    disabled = false,
    confirm = true,
    description,
    fields = [],
}: {
    layouts: PrintLayoutOption[];
    assignedLayoutId?: number | null;
    value: string;
    onSelect: (id: string) => void;
    document?: 'bid' | 'quotation';
    disabled?: boolean;
    confirm?: boolean;
    description?: string;
    fields?: MergeField[];
}) {
    const assigned = layouts.find((layout) => layout.id === assignedLayoutId);
    const selectedId = value || (assigned ? String(assigned.id) : '');
    const [preview, setPreview] = useState<PrintLayoutOption | null>(null);

    return (
        <section aria-labelledby={`${document}-print-layout-heading`} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <h3 id={`${document}-print-layout-heading`} className="text-sm font-medium">Print layout</h3>
                <p className="text-sm text-muted-foreground">
                    {description ?? (confirm
                        ? `Choose a layout card to load its text, tables and images. Select the current card again to reload its latest saved version. You will confirm before switching layouts and replacing the ${document === 'bid' ? 'bid information' : 'layout on the page'}.${document === 'bid' ? ' Use Layout sections in the editor toolbar to add one piece at a time.' : ''}`
                        : 'Choose a layout card and its text, tables, and images are placed on the page. Select the current card again to reload the latest saved version.')}
                </p>
            </div>
            {layouts.length === 0 ? (
                <p role="status" className="text-sm text-muted-foreground">
                    No layouts are assigned to {document}s. Enable a {document} output under Assign documents in Print Layouts to make a layout available here.
                </p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {layouts.map((layout) => {
                    const id = String(layout.id);
                    const selected = selectedId === id;
                    return (
                        <Card
                            key={id}
                            className={cn(
                                'p-0 transition-shadow hover:shadow-lg',
                                selected && 'ring-2 ring-primary',
                            )}
                        >
                            <button
                                type="button"
                                aria-pressed={selected}
                                aria-label={`Select ${layout.name}`}
                                disabled={disabled}
                                onClick={() => onSelect(id)}
                                className="flex w-full flex-col gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                            >
                                <PrintLayoutThumbnail
                                    headerColor={layout.headerBackground || '#065f46'}
                                    tableColor={layout.tableHeaderBackground || '#065f46'}
                                />
                                <CardHeader className="w-full">
                                    <CardTitle className="break-words whitespace-normal leading-snug">{layout.name}</CardTitle>
                                </CardHeader>
                            </button>
                            <CardContent className="flex w-full flex-wrap items-center justify-between gap-2 pb-4">
                                <span className="text-xs text-muted-foreground">
                                    {layout.id === assignedLayoutId ? `Assigned default for ${document}s` : 'Saved print layout'}
                                </span>
                                <span className="flex flex-wrap items-center gap-2">
                                    {selected ? (
                                        <Badge variant="success">
                                            <CheckIcon data-icon="inline-start" />
                                            Selected
                                        </Badge>
                                    ) : null}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="shrink-0 gap-1.5"
                                        disabled={layout.elements.length === 0}
                                        title={
                                            layout.elements.length === 0
                                                ? "Add a component before previewing this layout."
                                                : "Preview this layout"
                                        }
                                        onClick={() => setPreview(layout)}
                                    >
                                        <FileTextIcon />
                                        Preview
                                    </Button>
                                </span>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                    {assigned ? `Default: ${assigned.name}` : 'No default layout assigned'}
                </span>
                {value === '' ? (
                    assigned ? <Badge variant="outline">Using default</Badge> : null
                ) : (
                    <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onSelect('')}>
                        Use default
                    </Button>
                )}
            </div>
            <Dialog open={preview !== null} onClose={() => setPreview(null)} className="relative z-50">
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" aria-hidden="true" />
                <div className="fixed inset-0 overflow-y-auto p-3 sm:p-6">
                    <div className="flex min-h-full items-center justify-center">
                        <DialogPanel className="w-full max-w-6xl overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
                            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-7">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                                        Document preview
                                    </p>
                                    <DialogTitle className="mt-1 text-lg font-semibold text-foreground">
                                        {preview?.name ?? 'Layout preview'}
                                    </DialogTitle>
                                </div>
                                <Button type="button" variant="ghost" size="icon" aria-label="Close preview" onClick={() => setPreview(null)}>
                                    <XIcon />
                                </Button>
                            </div>
                            {preview ? (
                                <div className="max-h-[calc(100dvh-7rem)] overflow-y-auto bg-slate-100 p-4 dark:bg-slate-950 sm:p-8">
                                    <LayoutPreview layout={preview} fields={fields} />
                                </div>
                            ) : null}
                        </DialogPanel>
                    </div>
                </div>
            </Dialog>
        </section>
    );
}

function contrastColor(hex: string): string {
    const value = hex.replace('#', '');
    const red = Number.parseInt(value.slice(0, 2), 16);
    const green = Number.parseInt(value.slice(2, 4), 16);
    const blue = Number.parseInt(value.slice(4, 6), 16);
    const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;

    return luminance > 0.55 ? '#111827' : '#ffffff';
}

function LayoutPreview({ layout, fields }: { layout: PrintLayoutOption; fields: MergeField[] }) {
    const headerColor = layout.headerBackground || '#ffffff';

    return (
        <article className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl shadow-slate-900/10 dark:border-slate-700">
            <div className="overflow-x-auto">
                <header style={{ width: PRINT_LAYOUT_WIDTH, backgroundColor: headerColor, color: contrastColor(headerColor) }}>
                    <ElementsReadOnly
                        elements={layout.elements as LayoutElement[]}
                        zone="header"
                        fields={fields}
                        inBanner
                        headerHeight={layout.headerHeight ?? 160}
                    />
                </header>
            </div>
            <div aria-hidden="true" className="space-y-3 p-5 sm:p-12">
                <div className="h-2 w-1/3 rounded bg-slate-100" />
                <div className="h-2 w-2/3 rounded bg-slate-100" />
                <div className="h-2 w-1/2 rounded bg-slate-100" />
                <p className="pt-2 text-center text-[11px] text-slate-400">
                    The rest of the document is added by the system.
                </p>
            </div>
        </article>
    );
}
