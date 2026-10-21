import { Button } from '@/Components/ui/button';
import UserAvatar from '@/Components/UserAvatar';
import { PageProps } from '@/types';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { usePage } from '@inertiajs/react';
import { ArrowLeftIcon, DownloadIcon, FileTextIcon, MessageCircleIcon, PaperclipIcon, SendIcon, XIcon } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

type ChatAttachment = {
    id: number;
    name: string;
    mime: string;
    size: number;
    image: boolean;
    url: string;
};

type ChatMessage = {
    id: number;
    body: string | null;
    created_at: string | null;
    mine: boolean;
    user: {
        id: number | null;
        name: string;
        initials?: string | null;
        avatar_url?: string | null;
    };
    attachments: ChatAttachment[];
};

type ChatPerson = {
    id: number;
    name: string;
    unread: number;
};

type LatestNotice = {
    id: number;
    user_id?: number;
    name: string;
    preview: string;
};

function csrfToken(): string {
    return decodeURIComponent(
        document.cookie
            .split('; ')
            .find((row) => row.startsWith('XSRF-TOKEN='))
            ?.slice('XSRF-TOKEN='.length) ?? '',
    );
}

function fileSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 1024) {
        return `${Math.max(0, Math.round(bytes || 0))} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${Math.round(bytes / 1024)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function whenLabel(value: string | null): string {
    if (!value) {
        return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
    return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

export default function InternalChat() {
    const { auth } = usePage<PageProps>().props;
    const enabled = Boolean(auth.can.useInternalChat);
    const [open, setOpen] = useState(false);
    const [unread, setUnread] = useState(0);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [participants, setParticipants] = useState<ChatPerson[]>([]);
    const [person, setPerson] = useState<ChatPerson | null>(null);
    const [body, setBody] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewer, setViewer] = useState<ChatAttachment | null>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const knownLatest = useRef<number | null>(null);
    const openRef = useRef(open);
    const personRef = useRef(person);
    openRef.current = open;
    personRef.current = person;

    const scrollToEnd = () => {
        const list = listRef.current;

        if (list) {
            list.scrollTop = list.scrollHeight;
        }
    };

    const markRead = async (messageId: number, withUserId: number) => {
        const response = await fetch(route('internal-chat.read'), {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-XSRF-TOKEN': csrfToken(),
            },
            body: JSON.stringify({ message_id: messageId, with_user_id: withUserId }),
        });
        const payload = await readJson(response);

        if (typeof payload.unread === 'number') {
            setUnread(payload.unread);
        }

        setParticipants((current) => current.map((item) => item.id === withUserId ? { ...item, unread: 0 } : item));
    };

    const loadMessages = async (after = 0) => {
        const peer = personRef.current;

        if (!peer) {
            return;
        }

        const response = await fetch(route('internal-chat.index', {
            with: peer.id,
            ...(after > 0 ? { after } : {}),
        }), {
            credentials: 'same-origin',
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        });

        if (!response.ok) {
            return;
        }

        const payload = await readJson(response);
        const incoming = Array.isArray(payload.messages) ? payload.messages as ChatMessage[] : [];
        const people = Array.isArray(payload.participants) ? payload.participants as ChatPerson[] : [];

        setParticipants(people);
        setMessages((current) => {
            if (after === 0) {
                return incoming;
            }

            const seen = new Set(current.map((message) => message.id));

            return [...current, ...incoming.filter((message) => !seen.has(message.id))];
        });

        if (openRef.current && incoming.length > 0) {
            const latest = incoming[incoming.length - 1]?.id ?? 0;

            if (latest > 0) {
                void markRead(latest, peer.id);
            }
        }
    };

    const loadPeople = async () => {
        const response = await fetch(route('internal-chat.index'), {
            credentials: 'same-origin',
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        });

        if (!response.ok) {
            return;
        }

        const payload = await readJson(response);
        setParticipants(Array.isArray(payload.participants) ? payload.participants as ChatPerson[] : []);

        if (typeof payload.unread === 'number') {
            setUnread(payload.unread);
        }
    };

    useEffect(() => {
        if (!enabled) {
            return;
        }

        let active = true;

        const poll = async () => {
            if (document.visibilityState === 'hidden') {
                return;
            }

            const response = await fetch(route('internal-chat.unread'), {
                credentials: 'same-origin',
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            });

            if (!active || !response.ok) {
                return;
            }

            const payload = await readJson(response);
            const count = typeof payload.unread === 'number' ? payload.unread : 0;
            const latest = payload.latest && typeof payload.latest === 'object'
                ? payload.latest as LatestNotice
                : null;

            if (knownLatest.current === null) {
                knownLatest.current = latest?.id ?? 0;
            } else if (latest && latest.id !== knownLatest.current) {
                knownLatest.current = latest.id;

                if (!openRef.current) {
                    toast.message(`New chat message from ${latest.name}`, {
                        description: latest.preview,
                    });
                }
            }

            setUnread(count);

            if (openRef.current) {
                if (personRef.current) {
                    const lastId = messagesRef.current.at(-1)?.id ?? 0;
                    void loadMessages(lastId);
                } else {
                    void loadPeople();
                }
            }
        };

        void poll();
        const timer = window.setInterval(() => void poll(), open ? 8000 : 15000);

        return () => {
            active = false;
            window.clearInterval(timer);
        };
    }, [enabled, open]);

    const messagesRef = useRef(messages);
    messagesRef.current = messages;

    useEffect(() => {
        if (!open) {
            return;
        }

        if (!person) {
            setMessages([]);
            void loadPeople();

            return;
        }

        void loadMessages(0).then(() => window.setTimeout(scrollToEnd, 40));
    }, [open, person]);

    useEffect(() => {
        if (open) {
            scrollToEnd();
        }
    }, [messages, open]);

    if (!enabled) {
        return null;
    }

    const send = async (event: FormEvent) => {
        event.preventDefault();
        const text = body.trim();

        if (!person || (text === '' && files.length === 0) || sending) {
            return;
        }

        setSending(true);
        setError(null);
        const form = new FormData();
        form.append('recipient_id', String(person.id));
        form.append('body', text);
        files.forEach((file) => form.append('files[]', file));

        const response = await fetch(route('internal-chat.store'), {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-XSRF-TOKEN': csrfToken(),
            },
            body: form,
        });
        const payload = await readJson(response);
        setSending(false);

        if (!response.ok) {
            const errors = payload.errors as Record<string, string[]> | undefined;
            setError(errors?.body?.[0] ?? errors?.files?.[0] ?? (typeof payload.message === 'string' ? payload.message : 'The message could not be sent.'));

            return;
        }

        const created = payload.message as ChatMessage | undefined;

        if (created?.id) {
            setMessages((current) => current.some((item) => item.id === created.id) ? current : [...current, created]);
            knownLatest.current = created.id;
        }

        setBody('');
        setFiles([]);

        if (fileRef.current) {
            fileRef.current.value = '';
        }
    };

    return (
        <>
            {open ? (
                <section
                    aria-label="Super administrator chat"
                    className="fixed inset-x-3 bottom-24 z-40 flex h-[min(70dvh,36rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-auto sm:end-5 sm:w-[24rem]"
                >
                    <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                        <div className="flex min-w-0 items-start gap-2">
                            {person ? (
                                <Button type="button" variant="ghost" size="icon" aria-label="Choose another person" onClick={() => setPerson(null)}>
                                    <ArrowLeftIcon />
                                </Button>
                            ) : null}
                            <div className="min-w-0">
                                <h2 className="truncate text-sm font-semibold text-foreground">
                                    {person ? person.name : 'Choose who receives this chat'}
                                </h2>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {person
                                        ? 'Only this person sees these messages.'
                                        : 'Select a super administrator.'}
                                </p>
                            </div>
                        </div>
                        <Button type="button" variant="ghost" size="icon" aria-label="Close chat" onClick={() => setOpen(false)}>
                            <XIcon />
                        </Button>
                    </header>
                    {!person ? (
                        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
                            {participants.length === 0 ? (
                                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                                    No other super administrators are available.
                                </p>
                            ) : participants.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                        setError(null);
                                        setBody('');
                                        setFiles([]);
                                        setPerson(item);
                                    }}
                                    className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-left hover:bg-muted"
                                >
                                    <span className="font-medium text-foreground">{item.name}</span>
                                    {item.unread > 0 ? (
                                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                                            {item.unread}
                                        </span>
                                    ) : null}
                                </button>
                            ))}
                        </div>
                    ) : (
                    <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
                        {messages.length === 0 ? (
                            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                                No messages yet. Write to {person.name}.
                            </p>
                        ) : messages.map((message) => (
                            <article key={message.id} className={message.mine ? 'ms-8' : 'me-8'}>
                                <div className={`flex items-end gap-2 ${message.mine ? 'flex-row-reverse' : ''}`}>
                                    <UserAvatar
                                        name={message.user.name}
                                        avatarUrl={message.user.avatar_url}
                                        initials={message.user.initials}
                                        className="size-8"
                                    />
                                    <div className={`min-w-0 rounded-2xl px-3 py-2 ${message.mine ? 'bg-emerald-700 text-white' : 'bg-muted text-foreground'}`}>
                                        <p className={`text-xs font-medium ${message.mine ? 'text-emerald-100' : 'text-muted-foreground'}`}>
                                            {message.user.name}
                                            <span className="ms-2 font-normal">{whenLabel(message.created_at)}</span>
                                        </p>
                                        {message.body ? (
                                            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{message.body}</p>
                                        ) : null}
                                        {message.attachments.length > 0 ? (
                                            <div className="mt-2 grid gap-2">
                                                {message.attachments.map((file) => file.image ? (
                                                    <button
                                                        key={file.id}
                                                        type="button"
                                                        className="block text-left"
                                                        onClick={() => setViewer(file)}
                                                    >
                                                        <img src={file.url} alt={file.name} className="max-h-40 max-w-full rounded-md bg-white" />
                                                        <span className={`mt-1 block text-xs font-medium ${message.mine ? 'text-emerald-100' : 'text-emerald-700 dark:text-emerald-300'}`}>Open</span>
                                                    </button>
                                                ) : (
                                                    <a
                                                        key={file.id}
                                                        href={`${file.url}?download=1`}
                                                        className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm ${message.mine ? 'border-white/30' : 'border-border bg-background'}`}
                                                    >
                                                        <FileTextIcon className="size-4 shrink-0" />
                                                        <span className="min-w-0 truncate">{file.name}</span>
                                                        <span className="shrink-0 text-xs opacity-70">{fileSize(file.size)}</span>
                                                    </a>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                    )}
                    {person ? (
                    <form onSubmit={(event) => void send(event)} className="grid gap-2 border-t border-border p-3">
                        {files.length > 0 ? (
                            <ul className="flex flex-wrap gap-2">
                                {files.map((file) => (
                                    <li key={`${file.name}-${file.size}`} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs">
                                        <span className="max-w-40 truncate">{file.name}</span>
                                        <button
                                            type="button"
                                            aria-label={`Remove ${file.name}`}
                                            onClick={() => setFiles((current) => current.filter((item) => item !== file))}
                                        >
                                            <XIcon className="size-3" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
                        <div className="flex items-end gap-2">
                            <input
                                ref={fileRef}
                                type="file"
                                multiple
                                accept="image/jpeg,image/png,image/gif,image/webp,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx"
                                className="sr-only"
                                onChange={(event) => {
                                    const picked = Array.from(event.target.files ?? []).slice(0, 5);
                                    setFiles(picked);
                                }}
                            />
                            <Button type="button" variant="outline" size="icon" aria-label="Attach a file" onClick={() => fileRef.current?.click()}>
                                <PaperclipIcon />
                            </Button>
                            <textarea
                                value={body}
                                onChange={(event) => setBody(event.target.value)}
                                rows={2}
                                maxLength={4000}
                                placeholder={`Message ${person.name}`}
                                className="min-h-11 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                            />
                            <Button type="submit" className="min-h-11 bg-emerald-700 text-white hover:bg-emerald-800" disabled={sending} aria-label="Send message">
                                <SendIcon />
                            </Button>
                        </div>
                    </form>
                    ) : null}
                </section>
            ) : null}
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-label={unread > 0 ? `Open internal chat, ${unread} new messages` : 'Open internal chat'}
                className={`fixed bottom-5 end-5 z-40 flex size-14 items-center justify-center rounded-full bg-emerald-700 text-white shadow-lg shadow-emerald-950/20 hover:bg-emerald-800 ${unread > 0 ? 'ring-4 ring-red-500/40' : ''}`}
            >
                <MessageCircleIcon className="size-6" />
                {unread > 0 ? (
                    <span className="absolute -end-1 -top-1 flex min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-semibold text-white">
                        {unread > 99 ? '99+' : unread}
                    </span>
                ) : null}
            </button>
            <Dialog open={viewer !== null} onClose={() => setViewer(null)} className="relative z-50">
                <div className="fixed inset-0 bg-slate-950/70" aria-hidden="true" />
                <div className="fixed inset-0 overflow-y-auto p-4">
                    <div className="flex min-h-full items-center justify-center">
                        <DialogPanel className="w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
                            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                                <DialogTitle className="truncate text-base font-semibold">{viewer?.name ?? 'Image'}</DialogTitle>
                                <div className="flex items-center gap-2">
                                    {viewer ? (
                                        <Button asChild className="min-h-11 bg-emerald-700 text-white hover:bg-emerald-800">
                                            <a href={`${viewer.url}?download=1`} download={viewer.name}>
                                                <DownloadIcon />
                                                Download
                                            </a>
                                        </Button>
                                    ) : null}
                                    <Button type="button" variant="ghost" size="icon" aria-label="Close image" onClick={() => setViewer(null)}>
                                        <XIcon />
                                    </Button>
                                </div>
                            </div>
                            {viewer ? <img src={viewer.url} alt={viewer.name} className="mx-auto max-h-[75dvh] max-w-full bg-slate-100" /> : null}
                        </DialogPanel>
                    </div>
                </div>
            </Dialog>
        </>
    );
}
