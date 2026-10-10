import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/Components/ui/alert-dialog';
import { Button } from '@/Components/ui/button';
import { useEffect, useRef, useState } from 'react';

type AutoSaveChoice = 'on' | 'off';

export type TextAutoSaveConfig = {
    persistKey: string | null;
    url: string | null;
    field: string;
    unavailableMessage: string;
    extraData?: Record<string, string | null>;
};

const saveDelayMs = 1200;

type TextAutoSaveFlusher = () => Promise<boolean>;

const textAutoSaveFlushers = new Set<TextAutoSaveFlusher>();

export async function flushPendingTextAutoSaves(): Promise<boolean> {
    const results = await Promise.all(
        Array.from(textAutoSaveFlushers, (flush) => flush()),
    );

    return results.every(Boolean);
}

const preferenceKey = (persistKey: string) =>
    `gateway-autosave:${persistKey}`;

const readChoice = (persistKey: string | null): AutoSaveChoice | null => {
    if (!persistKey || typeof window === 'undefined') {
        return null;
    }

    try {
        const stored = window.localStorage.getItem(preferenceKey(persistKey));

        return stored === 'on' || stored === 'off' ? stored : null;
    } catch {
        return null;
    }
};

const writeChoice = (persistKey: string | null, choice: AutoSaveChoice) => {
    if (!persistKey) {
        return;
    }

    try {
        window.localStorage.setItem(preferenceKey(persistKey), choice);
    } catch {
        // The choice still applies for this visit when storage is blocked.
    }
};

const csrfToken = () =>
    decodeURIComponent(
        document.cookie
            .split('; ')
            .find((row) => row.startsWith('XSRF-TOKEN='))
            ?.slice('XSRF-TOKEN='.length) ?? '',
    );

export default function TextAutoSave({
    html,
    persistKey,
    url,
    field,
    unavailableMessage,
    extraData = {},
}: TextAutoSaveConfig & { html: string }) {
    const [choice, setChoice] = useState<AutoSaveChoice | null>(() =>
        readChoice(persistKey),
    );
    const [engaged, setEngaged] = useState(false);
    const [promptOpen, setPromptOpen] = useState(false);
    const closingForEnable = useRef(false);
    const [status, setStatus] = useState<
        'idle' | 'saving' | 'saved' | 'error'
    >('idle');
    const baseline = useRef(html);
    const latestHtml = useRef(html);
    const savedHtml = useRef(html);
    const asked = useRef(choice !== null);
    const timer = useRef<number | null>(null);
    const urlRef = useRef(url);
    const fieldRef = useRef(field);
    const extraDataRef = useRef(extraData);
    const dataKey = JSON.stringify(extraData);
    const savedDataKey = useRef(dataKey);
    const baselineDataKey = useRef(dataKey);
    const inFlight = useRef<Promise<boolean> | null>(null);

    latestHtml.current = html;
    urlRef.current = url;
    fieldRef.current = field;
    extraDataRef.current = extraData;

    const clearTimer = () => {
        if (timer.current !== null) {
            window.clearTimeout(timer.current);
            timer.current = null;
        }
    };

    const sendSave = async (body: string): Promise<boolean> => {
        const endpoint = urlRef.current;

        if (!endpoint) {
            return false;
        }

        setStatus('saving');
        const metadata = extraDataRef.current;
        const metadataKey = JSON.stringify(metadata);

        try {
            const response = await fetch(endpoint, {
                method: 'PATCH',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': csrfToken(),
                },
                body: JSON.stringify({
                    ...metadata,
                    [fieldRef.current]: body,
                }),
            });

            if (!response.ok) {
                setStatus('error');

                return false;
            }

            if (latestHtml.current !== body || JSON.stringify(extraDataRef.current) !== metadataKey) {
                return true;
            }

            savedHtml.current = body;
            savedDataKey.current = metadataKey;
            setStatus('saved');
            return true;
        } catch {
            setStatus('error');
            return false;
        }
    };

    const saveNow = async (): Promise<boolean> => {
        while (inFlight.current) {
            if (!(await inFlight.current)) {
                return false;
            }
        }
        if (
            latestHtml.current === savedHtml.current &&
            JSON.stringify(extraDataRef.current) === savedDataKey.current
        ) {
            return true;
        }
        const request = sendSave(latestHtml.current);
        inFlight.current = request;
        try {
            return await request;
        } finally {
            if (inFlight.current === request) inFlight.current = null;
        }
    };

    const flush = async (): Promise<boolean> => {
        clearTimer();
        if (!urlRef.current) {
            return true;
        }
        if (inFlight.current && !(await inFlight.current)) {
            return false;
        }

        while (latestHtml.current !== savedHtml.current || JSON.stringify(extraDataRef.current) !== savedDataKey.current) {
            if (!(await saveNow())) {
                return false;
            }
        }

        return true;
    };

    const flushRef = useRef(flush);
    flushRef.current = flush;

    const scheduleSave = (body: string) => {
        if (!urlRef.current || (body === savedHtml.current && JSON.stringify(extraDataRef.current) === savedDataKey.current)) {
            return;
        }

        clearTimer();
        setStatus('saving');
        timer.current = window.setTimeout(() => {
            timer.current = null;
            void saveNow();
        }, saveDelayMs);
    };

    useEffect(() => {
        if (html === baseline.current && dataKey === baselineDataKey.current) {
            return;
        }

        baseline.current = html;
        baselineDataKey.current = dataKey;
        setEngaged(true);

        if (!asked.current) {
            asked.current = true;
            setPromptOpen(true);

            return;
        }

        if (choice === 'on') {
            scheduleSave(html);
        }
    }, [html, choice, dataKey]);

    useEffect(() => () => clearTimer(), []);

    useEffect(() => {
        const registeredFlush = () => flushRef.current();

        textAutoSaveFlushers.add(registeredFlush);

        return () => {
            textAutoSaveFlushers.delete(registeredFlush);
        };
    }, []);

    const enable = () => {
        asked.current = true;
        closingForEnable.current = true;
        writeChoice(persistKey, 'on');
        setChoice('on');
        setEngaged(true);
        setPromptOpen(false);
        scheduleSave(latestHtml.current);
    };

    const decline = () => {
        asked.current = true;
        clearTimer();
        writeChoice(persistKey, 'off');
        setChoice('off');
        setPromptOpen(false);
        setStatus('idle');
    };

    const statusLabel = (() => {
        if (choice !== 'on') {
            return null;
        }

        if (!url) {
            return unavailableMessage;
        }

        if (status === 'saving') {
            return 'Saving…';
        }

        if (status === 'saved') {
            return 'Saved';
        }

        if (status === 'error') {
            return "Couldn't save";
        }

        return 'AutoSave on';
    })();

    return (
        <>
            {choice === 'off' && engaged ? (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs text-muted-foreground"
                    onClick={enable}
                >
                    Turn on AutoSave
                </Button>
            ) : null}
            {statusLabel ? (
                <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <span aria-live="polite">{statusLabel}</span>
                    {url ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs text-muted-foreground"
                            onClick={
                                status === 'error'
                                    ? () => scheduleSave(latestHtml.current)
                                    : decline
                            }
                        >
                            {status === 'error' ? 'Try again' : 'Turn off'}
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs text-muted-foreground"
                            onClick={decline}
                        >
                            Turn off
                        </Button>
                    )}
                </span>
            ) : null}
            <AlertDialog
                open={promptOpen}
                onOpenChange={(open) => {
                    if (open) {
                        return;
                    }

                    if (closingForEnable.current) {
                        closingForEnable.current = false;

                        return;
                    }

                    decline();
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Turn on AutoSave?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Keep this text saved while you write, the same way
                            Microsoft Word does. You can turn it off whenever
                            you want.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel type="button" onClick={decline}>
                            Not now
                        </AlertDialogCancel>
                        <Button type="button" onClick={enable}>
                            Turn on AutoSave
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
