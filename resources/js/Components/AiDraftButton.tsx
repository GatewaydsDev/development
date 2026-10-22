import AiTrace, { type AiTraceEntry } from '@/Components/AiTrace';
import { Button } from '@/Components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/Components/ui/dialog';
import { SparklesIcon } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';

type AiCommandResult = string | { steps: string[] };

type Surface = 'quotation' | 'bid' | 'print_layout';

const readableAnswer = (value: string) => value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const placeholder: Record<Surface, string> = {
    quotation: 'Add a table, text, header, footer, or logo…',
    bid: 'Add a table, text, header, footer, or logo…',
    print_layout: 'Add a table, text, header, footer, or logo…',
};

export default function AiDraftButton({
    surface,
    facts = {},
    currentText = '',
    missing = [],
    onBlocked,
    onCommand,
    onDraft,
}: {
    surface: Surface;
    facts?: Record<string, string>;
    currentText?: string;
    missing?: string[];
    onBlocked?: () => void;
    onCommand?: (command: string) => AiCommandResult | null;
    onDraft: (text: string) => void;
}) {
    const inputId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const requestRef = useRef<AbortController | null>(null);
    const cancelRef = useRef(false);
    const [open, setOpen] = useState(false);
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [busy, setBusy] = useState(false);
    const [trace, setTrace] = useState<AiTraceEntry[]>([]);
    const asked = question.trim();
    const blocked = missing.length > 0;

    const remember = (entry: Omit<AiTraceEntry, 'id'>, id = `${Date.now()}-${trace.length}`) => {
        setTrace((current) => [{ id, ...entry }, ...current.filter((item) => item.id !== id)].slice(0, 12));

        return id;
    };

    const commandSteps = (handled: AiCommandResult) => {
        const steps = typeof handled === 'string'
            ? handled.split(/(?<=\.)\s+/)
            : handled.steps;

        return steps
            .map((step) => step.replace(/\s*Save the page to keep it\.?$/i, '').trim())
            .filter((step) => step !== '' && !/^save the page to keep it\.?$/i.test(step));
    };

    const stopRequest = () => {
        cancelRef.current = true;
        requestRef.current?.abort();
        requestRef.current = null;
        setBusy(false);
    };

    const ask = async () => {
        if (asked === '' || busy) {
            return;
        }

        try {
            const handled = onCommand?.(asked) ?? null;

            if (handled) {
                const steps = commandSteps(handled);
                remember({
                    command: asked,
                    steps: steps.length > 0 ? steps : ['The command was applied.'],
                    status: 'done',
                });
                setQuestion('');
                setAnswer('');
                setOpen(false);
                toast.success('Added to the page. Save when you want to keep it.');

                return;
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'That command could not be applied.';
            remember({ command: asked, steps: [message], status: 'error' });
            toast.error(message);

            return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 20000);
        cancelRef.current = false;
        requestRef.current = controller;
        const traceId = remember({ command: asked, steps: ['Asking…'], status: 'working' });
        setBusy(true);

        try {
            const token = decodeURIComponent(document.cookie.split('; ').find((row) => row.startsWith('XSRF-TOKEN='))?.split('=')[1] ?? '');
            const response = await fetch(route('admin.ai.draft'), {
                method: 'POST',
                credentials: 'same-origin',
                signal: controller.signal,
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': token,
                },
                body: JSON.stringify({
                    surface,
                    question: asked.slice(0, 2000),
                    current_text: currentText.slice(0, 8000),
                    facts,
                }),
            });
            const body = await response.json().catch(() => ({}));

            if (!response.ok) {
                const message = typeof body.message === 'string' ? body.message : 'The question could not be answered.';
                remember({ command: asked, steps: [message], status: 'error' }, traceId);
                toast.error(message);

                return;
            }

            const text = typeof body.text === 'string' ? body.text.trim() : '';
            const readable = readableAnswer(text);

            if (!readable) {
                remember({ command: asked, steps: ['The AI service returned an empty answer.'], status: 'error' }, traceId);
                toast.error('The AI service returned an empty answer.');

                return;
            }

            setAnswer(readable);
            onDraft(text);
            remember({
                command: asked,
                steps: ['Added the answer to the page.', readable],
                status: 'done',
            }, traceId);
            setOpen(false);
            toast.success('Added to the page. Save when you want to keep it.');
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                if (!cancelRef.current) {
                    remember({ command: asked, steps: ['The AI took too long to answer.'], status: 'error' }, traceId);
                    toast.error('The AI took too long to answer. Try again.');
                } else {
                    setTrace((current) => current.filter((item) => item.id !== traceId));
                }

                return;
            }

            remember({ command: asked, steps: ['The AI service could not be reached.'], status: 'error' }, traceId);
            toast.error('The AI service could not be reached.');
        } finally {
            window.clearTimeout(timer);
            if (requestRef.current === controller) {
                requestRef.current = null;
            }
            setBusy(false);
        }
    };

    const openPopup = () => {
        if (blocked) {
            onBlocked?.();
        }

        setOpen(true);
    };

    const fab = (
        <div className="fixed top-1/2 right-[max(0.75rem,env(safe-area-inset-right))] z-[44] flex -translate-y-1/2 items-center gap-3">
            <AiTrace entries={trace} onClear={() => setTrace([])} />
            <div className="flex flex-col items-center gap-1.5">
            <Button
                type="button"
                className={`size-14 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/20 hover:bg-primary/90 sm:size-16 ${blocked ? 'opacity-50' : ''}`}
                aria-disabled={blocked}
                aria-label={blocked ? 'Fill the required fields before asking the AI' : 'Ask the AI'}
                title={blocked ? 'Fill the required fields first' : 'Ask the AI'}
                onClick={openPopup}
            >
                <SparklesIcon className="size-6 sm:size-7" />
            </Button>
            <span className="rounded-full bg-background/90 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground shadow-sm ring-1 ring-border backdrop-blur sm:text-xs">
                AI
            </span>
            </div>
        </div>
    );

    return (
        <>
            {typeof document === 'undefined' ? null : createPortal(fab, document.body)}
            <Dialog open={open} onOpenChange={(next) => {
                if (!next) {
                    stopRequest();
                }

                setOpen(next);
            }}>
                <DialogContent
                    className="sm:max-w-md"
                    onOpenAutoFocus={(event) => {
                        event.preventDefault();
                        inputRef.current?.focus();
                    }}
                >
                    {blocked ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>Fill these fields first</DialogTitle>
                                <DialogDescription>
                                    The AI stays off until the required fields are filled.
                                </DialogDescription>
                            </DialogHeader>
                            <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
                                {missing.map((message) => (
                                    <li key={message}>{message}</li>
                                ))}
                            </ul>
                        </>
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle>Ask the AI</DialogTitle>
                                <DialogDescription>
                                    Add a table, row, column, header, footer, text, logo, or another layout piece. A question is answered as text on the page.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex flex-col gap-3">
                                <label className="sr-only" htmlFor={inputId}>
                                    Command
                                </label>
                                <div className="flex items-center gap-2 rounded-md border border-input bg-background px-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                                    <span className="font-mono text-sm text-muted-foreground" aria-hidden="true">&gt;</span>
                                    <input
                                        ref={inputRef}
                                        id={inputId}
                                        type="text"
                                        maxLength={2000}
                                        value={question}
                                        disabled={busy}
                                        placeholder={placeholder[surface]}
                                        onChange={(event) => setQuestion(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key !== 'Enter') {
                                                return;
                                            }

                                            event.preventDefault();
                                            event.stopPropagation();
                                            void ask();
                                        }}
                                        className="h-9 w-full bg-transparent font-mono text-sm text-foreground outline-none placeholder:font-sans"
                                    />
                                </div>
                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={busy || asked === ''}
                                        onClick={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            void ask();
                                        }}
                                    >
                                        <SparklesIcon data-icon="inline-start" />
                                        {busy ? 'Asking…' : 'Ask'}
                                    </Button>
                                </DialogFooter>
                            </div>
                            {answer ? (
                                <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-background p-2">
                                    <p className="whitespace-pre-wrap text-sm text-foreground">{answer}</p>
                                </div>
                            ) : null}
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
