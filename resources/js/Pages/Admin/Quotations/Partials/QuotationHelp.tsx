import { Button } from '@/Components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/Components/ui/dialog';
import { cn } from '@/lib/utils';
import { useEffect, useId, useMemo, useState } from 'react';
import { registerFabTool } from '@/lib/fabStack';

type HelpStep = {
    id: string;
    title: string;
    summary: string;
    target?: string;
    details: string[];
};

const STEPS: HelpStep[] = [
    {
        id: 'details',
        title: 'Project and title',
        summary: 'Start in Details with the project, title, status, and validity.',
        target: 'quotation-details',
        details: [
            'Select a project. Use New project when the project is not in the list yet.',
            'The quotation number is assigned for you.',
            'Select a quotation title, or add a new title.',
            'Set the status. A new quotation starts as a draft.',
            'Set Quoted on, then set Valid until to 30, 60, or 90 days, or type a date.',
        ],
    },
    {
        id: 'customer',
        title: 'Customer',
        summary: 'Choose who the quotation is for and which contacts appear on it.',
        target: 'quotation-customer',
        details: [
            'Under Quoted for, choose Contractor or Owner.',
            'Select the contractor, or the owner of the project.',
            'Check the contacts that should appear on the quotation.',
        ],
    },
    {
        id: 'pricing',
        title: 'Price',
        summary: 'Check the project prices. Their total becomes the quotation amount.',
        target: 'quotation-pricing',
        details: [
            'Select a project first. Its prices then appear here.',
            'Check every price that belongs on this quotation, such as one price for windows and another for doors.',
            'The amount is the total of the prices you check. You can also type Amount for this quotation.',
            'A project, a contractor or owner, a title, and an amount are required before the quotation can be saved.',
        ],
    },
    {
        id: 'openings',
        title: 'Takeoff openings',
        summary: 'Add openings from a project takeoff.',
        target: 'quotation-openings',
        details: [
            'Select a project so its takeoffs are listed.',
            'Choose a takeoff, then select the openings to put on the quotation.',
            'Each opening is added once, with its size and specs.',
            'Save the quotation to keep the openings.',
        ],
    },
    {
        id: 'layout',
        title: 'Layout',
        summary: 'Choose the print layout and place the header, footer, and table on the page.',
        target: 'quotation-layout',
        details: [
            'Choose a print layout. Switching to another layout asks you to confirm before the page is replaced.',
            'On the page, add a header, footer, text, logo, or table.',
            'The AI button on the right can add those pieces from a command. The trace beside it lists what was added.',
            'The layout stays on this page until you save.',
        ],
    },
    {
        id: 'revisions',
        title: 'Revisions',
        summary: 'Record drawing or document revisions.',
        target: 'quotation-revisions',
        details: [
            'Choose Add revision when a drawing or document changes.',
            'Enter the revision mark, status, notes, and the responsible user.',
            'Removing a revision asks you to confirm first.',
        ],
    },
    {
        id: 'authorization',
        title: 'Authorization',
        summary: 'Decide whether the printed quotation includes signature lines.',
        target: 'quotation-authorization',
        details: [
            'Choose Yes to print signature lines for the company and the customer.',
            'Choose No to leave the authorization section off this document.',
        ],
    },
    {
        id: 'save',
        title: 'Save',
        summary: 'Store the quotation from the Actions button.',
        details: [
            'Open Actions at the bottom right of the page.',
            'Choose Add quotation when this is a new quote.',
            'Choose Save quotation when you are updating one that is already stored.',
            'After it is saved, Actions also includes Print quotation.',
            'Until you save, the changes stay only on this page.',
        ],
    },
];

export default function QuotationHelp({ mode }: { mode: 'create' | 'update' }) {
    const searchId = useId();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeId, setActiveId] = useState(STEPS[0].id);
    const normalized = query.trim().toLowerCase();
    const visible = useMemo(
        () => STEPS.filter((step) => {
            if (normalized === '') {
                return true;
            }

            return [step.title, step.summary, ...step.details]
                .join(' ')
                .toLowerCase()
                .includes(normalized);
        }),
        [normalized],
    );
    const active = visible.find((step) => step.id === activeId) ?? visible[0] ?? null;

    const showStep = (target: string) => {
        document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setOpen(false);
    };

    useEffect(() => registerFabTool({
        id: 'quotation-help',
        label: 'Quotation help',
        icon: 'help',
        order: 10,
        onOpen: () => setOpen(true),
    }), []);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent
                    className="max-w-xl"
                    onOpenAutoFocus={(event) => {
                        event.preventDefault();
                        document.getElementById(searchId)?.focus();
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>Quotation help</DialogTitle>
                        <DialogDescription>
                            {mode === 'create'
                                ? 'Follow these steps to add a quotation.'
                                : 'Follow these steps to update this quotation.'}
                        </DialogDescription>
                    </DialogHeader>
                    <label className="sr-only" htmlFor={searchId}>
                        Search the steps
                    </label>
                    <input
                        id={searchId}
                        type="search"
                        value={query}
                        placeholder="Search the steps"
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key !== 'Enter') {
                                return;
                            }

                            event.preventDefault();
                            event.stopPropagation();
                        }}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                    {visible.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No steps match that search.</p>
                    ) : (
                        <ol className="flex max-h-[min(28rem,60vh)] flex-col gap-2 overflow-y-auto pr-1">
                            {visible.map((step) => {
                                const number = STEPS.findIndex((item) => item.id === step.id) + 1;
                                const selected = active?.id === step.id;

                                return (
                                    <li key={step.id}>
                                        <button
                                            type="button"
                                            className={cn(
                                                'flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left',
                                                selected
                                                    ? 'border-emerald-300 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30'
                                                    : 'border-border bg-background',
                                            )}
                                            aria-expanded={selected}
                                            onClick={() => setActiveId(step.id)}
                                        >
                                            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                                                {number}
                                            </span>
                                            <span>
                                                <span className="block text-sm font-medium text-foreground">{step.title}</span>
                                                <span className="mt-0.5 block text-sm text-muted-foreground">{step.summary}</span>
                                            </span>
                                        </button>
                                        {selected ? (
                                            <div className="ml-9 mt-2 flex flex-col gap-3">
                                                <ol className="list-decimal space-y-1 pl-4 text-sm text-foreground">
                                                    {step.details.map((detail) => (
                                                        <li key={detail}>{detail}</li>
                                                    ))}
                                                </ol>
                                                {step.target ? (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="self-start"
                                                        onClick={() => showStep(step.target!)}
                                                    >
                                                        Show this section
                                                    </Button>
                                                ) : null}
                                            </div>
                                        ) : null}
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </DialogContent>
            </Dialog>
    );
}
