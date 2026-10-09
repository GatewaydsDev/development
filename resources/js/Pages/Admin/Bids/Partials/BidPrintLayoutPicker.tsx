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
}: {
    layouts: PrintLayoutOption[];
    assignedLayoutId?: number | null;
    value: string;
    onSelect: (id: string) => void;
}) {
    const assigned = layouts.find((layout) => layout.id === assignedLayoutId);
    const selectedId = value || (assigned ? String(assigned.id) : '');

    return (
        <section aria-labelledby="bid-print-layout-heading" className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <h3 id="bid-print-layout-heading" className="text-sm font-medium">Print layout</h3>
                <p className="text-sm text-muted-foreground">
                    Choose a layout card to load its text, tables and images.
                    You will confirm before replacing the bid information.
                    Use Layout sections in the editor toolbar to add one piece at a time.
                </p>
            </div>
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
                                onClick={() => {
                                    if (!selected) onSelect(id);
                                }}
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
                                        {layout.id === assignedLayoutId ? 'Assigned default for bids' : 'Saved print layout'}
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
                    <Badge variant="outline">Using default</Badge>
                ) : (
                    <Button type="button" variant="outline" size="sm" onClick={() => onSelect('')}>
                        Use default
                    </Button>
                )}
            </div>
        </section>
    );
}
