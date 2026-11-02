import { Button } from '@/Components/ui/button';
import UserAvatar from '@/Components/UserAvatar';
import { PageProps } from '@/types';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { usePage } from '@inertiajs/react';
import { ArrowLeftIcon, CheckIcon, DownloadIcon, FileTextIcon, MessageCircleIcon, PaperclipIcon, SendIcon, UserPlusIcon, UsersIcon, XIcon } from 'lucide-react';
import { setUnreadChat } from '@/lib/unreadChat';
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

type ChatGroup = {
    id: number;
    name: string;
    members: { id: number; name: string }[];
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

let chimeContext: AudioContext | null = null;

function audioContextConstructor(): typeof AudioContext | null {
    return window.AudioContext
        ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        ?? null;
}

function playIncomingChime(): void {
    const context = chimeContext;

    if (!context) {
        return;
    }

    const ring = () => {
        if (context.state !== 'running') {
            return;
        }

        const now = context.currentTime;
        const notes = [659.25, 880];

        notes.forEach((frequency, index) => {
            const start = now + index * 0.14;
            const master = context.createGain();
            master.gain.setValueAtTime(0.0001, start);
            master.gain.exponentialRampToValueAtTime(0.08, start + 0.015);
            master.gain.exponentialRampToValueAtTime(0.0001, start + 0.72);
            master.connect(context.destination);

            [
                { ratio: 1, level: 1, decay: 0.7 },
                { ratio: 2.76, level: 0.28, decay: 0.32 },
                { ratio: 5.4, level: 0.08, decay: 0.16 },
            ].forEach((partial) => {
                const oscillator = context.createOscillator();
                const partialGain = context.createGain();
                oscillator.type = 'sine';
                oscillator.frequency.value = frequency * partial.ratio;
                partialGain.gain.setValueAtTime(partial.level, start);
                partialGain.gain.exponentialRampToValueAtTime(0.0001, start + partial.decay);
                oscillator.connect(partialGain);
                partialGain.connect(master);
                oscillator.start(start);
                oscillator.stop(start + partial.decay + 0.02);
            });
        });
    };

    if (context.state === 'suspended') {
        void context.resume().then(ring).catch(() => undefined);

        return;
    }

    ring();
}

export default function InternalChat() {
    const { auth } = usePage<PageProps>().props;
    const enabled = Boolean(auth.can.useInternalChat);
    const [open, setOpen] = useState(false);
    const [unread, setUnread] = useState(0);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [participants, setParticipants] = useState<ChatPerson[]>([]);
    const [person, setPerson] = useState<ChatPerson | null>(null);
    const [groups, setGroups] = useState<ChatGroup[]>([]);
    const [group, setGroup] = useState<ChatGroup | null>(null);
    const [picker, setPicker] = useState<'new' | 'add' | null>(null);
    const [picked, setPicked] = useState<number[]>([]);
    const [groupName, setGroupName] = useState('');
    const [body, setBody] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewer, setViewer] = useState<ChatAttachment | null>(null);
    const [besideFormActions, setBesideFormActions] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const knownLatest = useRef<number | null>(null);
    const openRef = useRef(open);
    const personRef = useRef(person);
    const groupRef = useRef(group);
    openRef.current = open;
    personRef.current = person;
    groupRef.current = group;

    useEffect(() => {
        const sync = () => setBesideFormActions(Number(document.body.dataset.formActionFab || 0) > 0);
        sync();
        const observer = new MutationObserver(sync);
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-form-action-fab'] });

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const openChat = () => setOpen(true);
        window.addEventListener('gateway:open-chat', openChat);

        return () => window.removeEventListener('gateway:open-chat', openChat);
    }, []);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const unlock = () => {
            const Context = audioContextConstructor();

            if (!Context) {
                return;
            }

            chimeContext ??= new Context();

            if (chimeContext.state === 'suspended') {
                void chimeContext.resume();
            }
        };

        window.addEventListener('pointerdown', unlock);
        window.addEventListener('keydown', unlock);

        return () => {
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
        };
    }, [enabled]);

    const scrollToEnd = () => {
        const list = listRef.current;

        if (list) {
            list.scrollTop = list.scrollHeight;
        }
    };

    const markRead = async (messageId: number, targetId: number, isGroup = false) => {
        const response = await fetch(route('internal-chat.read'), {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-XSRF-TOKEN': csrfToken(),
            },
            body: JSON.stringify(isGroup ? { message_id: messageId, group_id: targetId } : { message_id: messageId, with_user_id: targetId }),
        });
        const payload = await readJson(response);

        if (typeof payload.unread === 'number') {
            setUnread(payload.unread);
            setUnreadChat(payload.unread);
        }

        if (isGroup) {
            setGroups((current) => current.map((item) => item.id === targetId ? { ...item, unread: 0 } : item));
        } else {
            setParticipants((current) => current.map((item) => item.id === targetId ? { ...item, unread: 0 } : item));
        }
    };

    const loadMessages = async (after = 0) => {
        const peer = personRef.current;
        const room = groupRef.current;

        if (!peer && !room) {
            return;
        }

        const response = await fetch(route('internal-chat.index', {
            ...(room ? { group: room.id } : { with: peer!.id }),
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
        setGroups(Array.isArray(payload.groups) ? payload.groups as ChatGroup[] : []);
        setMessages((current) => {
            if (after === 0) {
                return incoming;
            }

            const seen = new Set(current.map((message) => message.id));

            return [...current, ...incoming.filter((message) => !seen.has(message.id))];
        });

        if (after > 0) {
            const newestIncoming = incoming.reduce(
                (max, message) => (!message.mine && message.id > max ? message.id : max),
                0,
            );

            if (newestIncoming > (knownLatest.current ?? 0)) {
                knownLatest.current = newestIncoming;
                playIncomingChime();
            }
        }

        if (openRef.current && incoming.length > 0) {
            const latest = incoming[incoming.length - 1]?.id ?? 0;

            if (latest > 0) {
                void markRead(latest, room ? room.id : peer!.id, Boolean(room));
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
        setGroups(Array.isArray(payload.groups) ? payload.groups as ChatGroup[] : []);

        if (typeof payload.unread === 'number') {
            setUnread(payload.unread);
            setUnreadChat(payload.unread);
        }
    };

    useEffect(() => {
        if (!enabled) {
            setUnreadChat(0);

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
            } else if (latest && latest.id > knownLatest.current) {
                knownLatest.current = latest.id;
                playIncomingChime();

                if (!openRef.current) {
                    toast.message(`New chat message from ${latest.name}`, {
                        description: latest.preview,
                    });
                }
            }

            setUnread(count);
            setUnreadChat(count);

            if (openRef.current) {
                if (personRef.current || groupRef.current) {
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

        if (!person && !group) {
            setMessages([]);
            void loadPeople();

            return;
        }

        void loadMessages(0).then(() => window.setTimeout(scrollToEnd, 40));
    }, [open, person, group]);

    useEffect(() => {
        if (open) {
            scrollToEnd();
        }
    }, [messages, open]);

    if (!enabled) {
        return null;
    }

    const chatTitle = group?.name ?? person?.name ?? '';
    const inChat = person !== null || group !== null;

    const leaveChat = () => {
        setPerson(null);
        setGroup(null);
        setPicker(null);
        setPicked([]);
    };

    const togglePicked = (id: number) =>
        setPicked((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

    const jsonRequest = async (url: string, method: string, data: unknown) => {
        const response = await fetch(url, {
            method,
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-XSRF-TOKEN': csrfToken(),
            },
            body: JSON.stringify(data),
        });

        return { ok: response.ok, payload: await readJson(response) };
    };

    const submitPicker = async () => {
        setError(null);

        if (picker === 'new') {
            const { ok, payload } = await jsonRequest(route('internal-chat.groups.store'), 'POST', {
                name: groupName.trim() || null,
                member_ids: picked,
            });

            if (!ok) {
                setError(typeof payload.message === 'string' ? payload.message : 'The group could not be created.');

                return;
            }

            setGroups((current) => [...current, payload.group as ChatGroup]);
            setPerson(null);
            setGroup(payload.group as ChatGroup);
        } else if (group) {
            const { ok, payload } = await jsonRequest(route('internal-chat.groups.members', group.id), 'POST', { member_ids: picked });

            if (!ok) {
                setError(typeof payload.message === 'string' ? payload.message : 'People could not be added.');

                return;
            }

            setGroup(payload.group as ChatGroup);
        }

        setPicker(null);
        setPicked([]);
        setGroupName('');
    };

    const leaveGroup = async () => {
        if (!group || !confirm(`Leave “${group.name}”?`)) {
            return;
        }

        await jsonRequest(route('internal-chat.groups.leave', group.id), 'DELETE', {});
        setGroups((current) => current.filter((item) => item.id !== group.id));
        leaveChat();
    };

    const send = async (event: FormEvent) => {
        event.preventDefault();
        const text = body.trim();

        if ((!person && !group) || (text === '' && files.length === 0) || sending) {
            return;
        }

        setSending(true);
        setError(null);
        const form = new FormData();
        form.append(group ? 'group_id' : 'recipient_id', String(group ? group.id : person!.id));
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
                    className={`fixed z-40 flex h-[min(70dvh,36rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl ${besideFormActions ? 'start-3 end-[max(6.25rem,calc(env(safe-area-inset-right)+5.5rem))] bottom-[max(7.25rem,calc(env(safe-area-inset-bottom)+6.25rem))] sm:start-auto sm:end-[7.75rem] sm:bottom-[8.75rem] sm:w-[24rem] landscape:end-[5.5rem] landscape:bottom-28' : 'inset-x-3 bottom-24 sm:inset-x-auto sm:end-5 sm:w-[24rem]'}`}
                >
                    <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                        <div className="flex min-w-0 items-start gap-2">
                            {inChat || picker ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Back"
                                    onClick={() => (picker && inChat ? setPicker(null) : leaveChat())}
                                >
                                    <ArrowLeftIcon />
                                </Button>
                            ) : null}
                            <div className="min-w-0">
                                <h2 className="truncate text-sm font-semibold text-foreground">
                                    {picker === 'new'
                                        ? 'New group chat'
                                        : picker === 'add'
                                          ? 'Add people'
                                          : inChat
                                            ? chatTitle
                                            : 'Choose who receives this chat'}
                                </h2>
                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                    {picker
                                        ? 'Select two or more people.'
                                        : group
                                          ? group.members.map((member) => member.name).join(', ')
                                          : person
                                            ? 'Only this person sees these messages.'
                                            : 'Select a super administrator or start a group.'}
                                </p>
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center">
                            {person && !picker ? (
                                <Button type="button" variant="ghost" size="icon" aria-label="Add someone to this chat" onClick={() => { setError(null); setPicked([person.id]); setGroupName(''); setPicker('new'); }}>
                                    <UserPlusIcon />
                                </Button>
                            ) : null}
                            {group && !picker ? (
                                <>
                                    <Button type="button" variant="ghost" size="icon" aria-label="Add people" onClick={() => { setPicked([]); setPicker('add'); }}>
                                        <UserPlusIcon />
                                    </Button>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => void leaveGroup()}>
                                        Leave
                                    </Button>
                                </>
                            ) : null}
                            <Button type="button" variant="ghost" size="icon" aria-label="Close chat" onClick={() => setOpen(false)}>
                                <XIcon />
                            </Button>
                        </div>
                    </header>
                    {picker ? (
                        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
                            {picker === 'new' ? (
                                <input
                                    value={groupName}
                                    onChange={(event) => setGroupName(event.target.value)}
                                    maxLength={120}
                                    placeholder="Group name (optional)"
                                    className="min-h-11 rounded-md border border-border bg-background px-3 text-sm"
                                />
                            ) : null}
                            {participants
                                .filter((item) => !(picker === 'add' && group?.members.some((member) => member.id === item.id)))
                                .map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => togglePicked(item.id)}
                                        aria-pressed={picked.includes(item.id)}
                                        className={`flex min-h-11 items-center justify-between gap-3 rounded-lg border-2 px-3 py-2 text-left ${picked.includes(item.id) ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' : 'border-border hover:bg-muted'}`}
                                    >
                                        <span className="font-medium text-foreground">{item.name}</span>
                                        {picked.includes(item.id) ? <CheckIcon className="size-4 text-emerald-700" /> : null}
                                    </button>
                                ))}
                            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
                            <Button
                                type="button"
                                className="mt-auto min-h-11 bg-emerald-700 text-white hover:bg-emerald-800"
                                disabled={picker === 'new' ? picked.length < 2 : picked.length < 1}
                                onClick={() => void submitPicker()}
                            >
                                {picker === 'new' ? `Start group (${picked.length + 1} people)` : 'Add to group'}
                            </Button>
                        </div>
                    ) : null}
                    {picker ? null : !inChat ? (
                        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
                            <Button
                                type="button"
                                variant="outline"
                                className="min-h-11 gap-2"
                                disabled={participants.length < 2}
                                onClick={() => { setError(null); setPicked([]); setGroupName(''); setPicker('new'); }}
                            >
                                <UsersIcon className="size-4" />
                                New group chat
                            </Button>
                            {groups.map((item) => (
                                <button
                                    key={`group-${item.id}`}
                                    type="button"
                                    onClick={() => {
                                        setError(null);
                                        setBody('');
                                        setFiles([]);
                                        setGroup(item);
                                    }}
                                    className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-left hover:bg-muted"
                                >
                                    <span className="min-w-0">
                                        <span className="flex items-center gap-2 font-medium text-foreground">
                                            <UsersIcon className="size-4 shrink-0" />
                                            <span className="truncate">{item.name}</span>
                                        </span>
                                        <span className="block truncate text-xs text-muted-foreground">
                                            {item.members.length} people
                                        </span>
                                    </span>
                                    {item.unread > 0 ? (
                                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                                            {item.unread}
                                        </span>
                                    ) : null}
                                </button>
                            ))}
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
                                No messages yet. Write to {chatTitle}.
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
                    {inChat && !picker ? (
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
                                placeholder={`Message ${chatTitle}`}
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
                className={`fixed z-40 flex size-14 items-center justify-center rounded-full bg-emerald-700 text-white shadow-lg shadow-emerald-950/20 hover:bg-emerald-800 ${besideFormActions ? 'bottom-[max(2.75rem,calc(env(safe-area-inset-bottom)+1.75rem))] end-[max(6.25rem,calc(env(safe-area-inset-right)+5.5rem))] sm:bottom-16 sm:end-[7.75rem] landscape:bottom-[2.4rem] landscape:end-[5.5rem]' : 'bottom-5 end-5'} ${unread > 0 ? 'ring-4 ring-red-500/40' : ''}`}
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
