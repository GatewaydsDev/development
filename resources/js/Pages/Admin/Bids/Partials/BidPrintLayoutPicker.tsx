import PrintLayoutThumbnail from '@/Components/PrintLayoutThumbnail';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { cn } from '@/lib/utils';
import { CheckIcon } from 'lucide-react';
import type { PrintLayoutOption } from '../layoutSections';

export default function BidPrintLayoutPicker({
    layouts,
    assignedLayoutId,
    value,
    onSelect,
    document = 'bid',
    disabled = false,
}: {
    layouts: PrintLayoutOption[];
    assignedLayoutId?: number | null;
    value: string;
    onSelect: (id: string) => void;
    document?: 'bid' | 'quotation';
    disabled?: boolean;
}) {
    const assigned = layouts.find((layout) => layout.id === assignedLayoutId);
    const selectedId = value || (assigned ? String(assigned.id) : '');

    return (
        <section aria-labelledby={`${document}-print-layout-heading`} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <h3 id={`${document}-print-layout-heading`} className="text-sm font-medium">Print layout</h3>
                <p className="text-sm text-muted-foreground">
                    Choose a layout card to load its text, tables and images.
                    Select the current card again to reload its latest saved version.
                    You will confirm before replacing the {document === 'bid' ? 'bid information' : 'quotation header'}.
                    Use Layout sections in the editor toolbar to add one piece at a time.
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
                                'overflow-hidden p-0 transition-shadow hover:shadow-lg',
                                selected && 'ring-2 ring-primary',
                            )}
                        >
                            <button
                                type="button"
                                aria-pressed={selected}
                                aria-label={`Select ${layout.name}`}
                                disabled={disabled}
                                onClick={() => onSelect(id)}
                                className="flex h-full w-full flex-col gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                            >
                                <PrintLayoutThumbnail
                                    headerColor={layout.headerBackground || '#065f46'}
                                    tableColor={layout.tableHeaderBackground || '#065f46'}
                                />
                                <CardHeader className="w-full">
                                    <CardTitle className="break-words">{layout.name}</CardTitle>
                                </CardHeader>
                                <CardContent className="flex w-full flex-wrap items-center justify-between gap-2 pb-4">
                                    <span className="text-xs text-muted-foreground">
                                        {layout.id === assignedLayoutId ? `Assigned default for ${document}s` : 'Saved print layout'}
                                    </span>
                                    {selected ? (
                                        <Badge variant="success">
                                            <CheckIcon data-icon="inline-start" />
                                            Selected
                                        </Badge>
                                    ) : null}
                                </CardContent>
                            </button>
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
        </section>
    );
}
