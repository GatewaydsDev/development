import AiDraftButton from '@/Components/AiDraftButton';
import CreatableSelect from '@/Components/CreatableSelect';
import RichTextEditor from '@/Components/RichTextEditor';
import { notesToHtml } from '@/lib/notesHtml';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import FormActionFab from '@/Components/FormActionFab';
import TextInput from '@/Components/TextInput';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/Components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/Components/ui/dialog';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import type { PageProps } from '@/types';
import { cn } from '@/lib/utils';
import { BookmarkIcon, CheckIcon, ChevronDownIcon, CopyIcon, DoorOpenIcon, DownloadIcon, DraftingCompassIcon, EyeIcon, ListIcon, PencilIcon, PlusIcon, RefreshCwIcon, Trash2Icon, XIcon } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { countMark } from './pinLabels';
import OpeningEditor, { openingForm, openingPayload, type OpeningForm } from './Partials/OpeningEditor';
import OpeningReview from './Partials/OpeningReview';
import PdfWorkspace, { savedCountTool, type CountTool, type PdfPoint } from './Partials/PdfWorkspace';
import {
    marginLabel,
    money,
    statusLabel,
    type OpeningProposal,
    type AssemblyTemplate,
    type ConversionLine,
    type TakeoffAbilities,
    type TakeoffDetail,
    type TakeoffSheetSection,
} from './types';

type Props = {
    takeoff: TakeoffDetail;
    templates: AssemblyTemplate[];
    quotations: { id: number; number: string; title: string; status: string }[];
    can: TakeoffAbilities;
    openingTypes: { id: number; name: string }[];
};

function copiedLines(body: string): string[] {
    return body
        .split(/\r?\n/)
        .map((line) => line.split('\t').map((cell) => cell.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim())
        .filter((line) => line !== '');
}

function lineMarker(line: string): { marker: string; text: string } | null {
    const bullet = line.match(/^([•·●◦▪‣]|\*|-|–|—)\s+(.*)$/);

    if (bullet) {
        return { marker: bullet[1], text: bullet[2] };
    }

    const number = line.match(/^(\d{1,4}[\.\)]?)\s+(.*)$/);

    if (number) {
        return { marker: number[1], text: number[2] };
    }

    const letter = line.match(/^([A-Z][\.\)]?)\s+(.*)$/);

    if (letter) {
        return { marker: letter[1], text: letter[2] };
    }

    return null;
}

function CopiedLine({ line }: { line: string }) {
    const marked = lineMarker(line);

    if (!marked) {
        return <>{line}</>;
    }

    return (
        <>
            <span className="font-bold text-neutral-950 dark:text-white">{marked.marker}</span>
            {marked.text ? ` ${marked.text}` : ''}
        </>
    );
}

function SectionSheet({ body, onChange, compact = false }: { body: string; onChange?: (body: string) => void; compact?: boolean }) {
    const lines = copiedLines(body);

    if (lines.length === 0) {
        return <p className="px-4 py-6 text-sm text-muted-foreground">No lines were copied from this area.</p>;
    }

    const edit = (index: number, value: string) => {
        if (!onChange) {
            return;
        }

        const next = lines.map((line, lineIndex) => lineIndex === index ? value : line);
        onChange(next.join('\n'));
    };

    return (
        <ul className={`list-none space-y-1 text-foreground ${compact ? 'max-h-40 overflow-auto px-2 py-2 text-xs' : 'max-h-80 overflow-auto px-3 py-3 text-sm'}`}>
            {lines.map((line, index) => (
                <li key={index}>
                    {onChange ? (
                        <input
                            value={line}
                            onChange={(event) => edit(index, event.target.value)}
                            className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 hover:border-border focus:border-ring focus:bg-background focus:outline-none"
                        />
                    ) : <CopiedLine line={line} />}
                </li>
            ))}
        </ul>
    );
}

const scanStages = [
    { label: 'Opening the drawing', at: 4 },
    { label: 'Reading the pages', at: 8 },
    { label: 'Reading schedules', at: 74 },
    { label: 'Checking marks', at: 88 },
    { label: 'Saving the openings', at: 99 },
];

const sections = [
    { id: 'workspace', label: 'Scope' },
    { id: 'assemblies', label: 'Assemblies' },
    { id: 'review', label: 'Review' },
    { id: 'convert', label: 'Convert' },
    { id: 'history', label: 'History' },
] as const;

function openingSpecs(opening: TakeoffDetail['openings'][number]): string {
    return [
        opening.door_type,
        opening.product_category,
        opening.frame_type ? `Frame ${opening.frame_type}` : null,
        opening.handing ? `Hand ${opening.handing}` : null,
        opening.hardware_set ? `Hardware ${opening.hardware_set}` : null,
        opening.finish,
        opening.glazing,
        opening.acoustic_requirement,
        opening.fire_requirement ? `Fire ${opening.fire_requirement}` : null,
    ].filter(Boolean).join(' · ') || '—';
}

export default function Show({ takeoff, templates, quotations, can, openingTypes = [] }: Props) {
    const countedOpeningId = usePage<PageProps>().props.flash?.counted_opening_id;
    const [section, setSection] = useState<(typeof sections)[number]['id']>('workspace');
    const [scanOpen, setScanOpen] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [scanPercent, setScanPercent] = useState(0);
    const [scanLabel, setScanLabel] = useState('Opening the drawing');
    const [scanError, setScanError] = useState<string | null>(null);
    const [copyOpen, setCopyOpen] = useState(false);
    const [copyReading, setCopyReading] = useState(false);
    const [copyPercent, setCopyPercent] = useState(0);
    const [copyLabel, setCopyLabel] = useState('Opening the marked area');
    const [copyTitle, setCopyTitle] = useState('');
    const [copyBody, setCopyBody] = useState('');
    const [copyError, setCopyError] = useState<string | null>(null);
    const [copyRegion, setCopyRegion] = useState<{ documentId: number; page: number; x: number; y: number; x2: number; y2: number } | null>(null);
    const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [clipboardNote, setClipboardNote] = useState<string | null>(null);
    const [viewingSection, setViewingSection] = useState<TakeoffSheetSection | null>(null);
    const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
    const [openingsDragOpen, setOpeningsDragOpen] = useState(false);
    const [openingsDragReading, setOpeningsDragReading] = useState(false);
    const [openingsDragPercent, setOpeningsDragPercent] = useState(0);
    const [openingsDragLabel, setOpeningsDragLabel] = useState('Reading the marked area');
    const [openingsDragError, setOpeningsDragError] = useState<string | null>(null);
    const [openingsBox, setOpeningsBox] = useState<{ documentId: number; page: number; x: number; y: number; x2: number; y2: number; openingType: string } | null>(null);
    const [openingsNaming, setOpeningsNaming] = useState(false);
    const [openingTypeName, setOpeningTypeName] = useState('');
    const [openingTypeId, setOpeningTypeId] = useState('');
    const [openingsFound, setOpeningsFound] = useState<{ id?: number; tag: string; callout?: string | null; opening_type: string; quantity: string; width: string | null; height: string | null; location: string | null }[]>([]);
    const [selectedOpeningIds, setSelectedOpeningIds] = useState<number[]>([]);
    const [savedSectionId, setSavedSectionId] = useState<number | null>(null);
    const [savedMarkupId, setSavedMarkupId] = useState<number | null>(null);
    const [selectionRemoval, setSelectionRemoval] = useState<{ markupId: number | null; openingIds: number[] } | null>(null);
    const [copyRemovalId, setCopyRemovalId] = useState<number | null>(null);
    const [selectedOpeningId, setSelectedOpeningId] = useState<number | null>(null);
    const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(() => {
        try {
            const saved = Number(localStorage.getItem(`gateway.takeoff-drawing.${takeoff.uuid}`));

            if (takeoff.documents.some((item) => item.id === saved)) {
                return saved;
            }
        } catch {
            // Keep the first drawing when stored choices cannot be read.
        }

        return takeoff.documents[0]?.id ?? null;
    });

    useEffect(() => {
        if (!selectedDocumentId) {
            return;
        }

        try {
            localStorage.setItem(`gateway.takeoff-drawing.${takeoff.uuid}`, String(selectedDocumentId));
        } catch {
            // The drawing still stays selected for this visit.
        }
    }, [selectedDocumentId, takeoff.uuid]);
    const [uploadingPdf, setUploadingPdf] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [countTool, setCountTool] = useState<CountTool>(() => savedCountTool());
    const [activeProposal, setActiveProposal] = useState<OpeningProposal | null>(null);

    useEffect(() => {
        if (activeProposal && activeProposal.document_id !== selectedDocumentId) {
            setSelectedDocumentId(activeProposal.document_id);
        }
    }, [activeProposal, selectedDocumentId]);

    const undoKey = `gateway.takeoff-undo.${takeoff.uuid}`;
    const [undoIds, setUndoIds] = useState<number[]>(() => {
        try {
            const parsed = JSON.parse(sessionStorage.getItem(undoKey) ?? '[]') as unknown;

            return Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === 'number') : [];
        } catch {
            return [];
        }
    });
    const documentIds = useRef(takeoff.documents.map((document) => document.id));
    const [paletteView, setPaletteView] = useState<'drawing' | 'inspector'>('drawing');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (selectedOpeningId || creating) {
            setPaletteView('inspector');
        }
    }, [selectedOpeningId, creating]);
    const [pendingMarker, setPendingMarker] = useState<PdfPoint | null>(null);
    const [drafts, setDrafts] = useState<Record<string, OpeningForm>>({});
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('');
    const [location, setLocation] = useState('');
    const [scope, setScope] = useState('');
    const [review, setReview] = useState('');
    const [groupName, setGroupName] = useState('Assembly');
    const [checked, setChecked] = useState<number[]>([]);
    const [quotationId, setQuotationId] = useState(quotations[0] ? String(quotations[0].id) : '');
    const [lines, setLines] = useState<ConversionLine[]>([]);
    const [chosen, setChosen] = useState<string[]>([]);
    const [replace, setReplace] = useState(false);
    const [previewError, setPreviewError] = useState('');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [duplicateMode, setDuplicateMode] = useState<'reject' | 'flag'>('reject');
    const [importPreview, setImportPreview] = useState<{ errors: { row: number; messages: string[] }[]; duplicates: string[]; rows: unknown[] } | null>(null);
    const details = useForm({
        title: takeoff.title,
        revision_number: String(takeoff.revision_number ?? 1),
        revision_label: takeoff.revision_label ?? '',
        notes: takeoff.notes ?? '',
        status: takeoff.status,
        pricing_method: takeoff.pricing_method,
        markup_percent: takeoff.markup_percent ?? '',
        margin_percent: takeoff.margin_percent ?? '',
    });
    const selected = takeoff.openings.find((opening) => opening.id === selectedOpeningId) ?? null;
    const unsavedCount = Object.keys(drafts).length;
    const rememberDraft = useCallback((key: string, form: OpeningForm | null) => {
        setDrafts((current) => {
            if (form === null) {
                if (!(key in current)) {
                    return current;
                }

                const next = { ...current };
                delete next[key];

                return next;
            }

            return { ...current, [key]: form };
        });
    }, []);

    useEffect(() => {
        if (unsavedCount === 0) {
            return;
        }

        const warn = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', warn);

        return () => window.removeEventListener('beforeunload', warn);
    }, [unsavedCount]);

    useEffect(() => {
        if (!countedOpeningId) {
            return;
        }

        const opening = takeoff.openings.find((item) => item.id === Number(countedOpeningId));

        if (!opening) {
            return;
        }

        setSelectedOpeningId(opening.id);
        setCreating(false);
        setPaletteView('inspector');
        setSection('workspace');
        setUndoIds((current) => {
            if (current.at(-1) === opening.id) {
                return current;
            }

            const next = [...current, opening.id].slice(-30);

            try {
                sessionStorage.setItem(undoKey, JSON.stringify(next));
            } catch {
                // Undo still works until the page is closed.
            }

            return next;
        });
    }, [countedOpeningId, takeoff.openings, undoKey]);

    useEffect(() => {
        const ids = takeoff.documents.map((document) => document.id);
        const added = ids.find((id) => !documentIds.current.includes(id));
        documentIds.current = ids;

        if (added) {
            setSelectedDocumentId(added);
        }
    }, [takeoff.documents]);

    const uploadPdf = (file: File) => {
        const data = new FormData();
        data.append('file', file);
        data.append('document_type', 'drawing');
        setUploadError(null);
        setUploadingPdf(true);
        router.post(route('admin.takeoffs.documents.store', takeoff.uuid), data, {
            forceFormData: true,
            preserveScroll: true,
            onError: (errors) => setUploadError(errors.file ?? 'The PDF could not be uploaded.'),
            onFinish: () => setUploadingPdf(false),
        });
    };

    const lineByOpening = useMemo(
        () => new Map(takeoff.openings.map((opening, index) => [opening.id, index + 1])),
        [takeoff.openings],
    );
    const filtered = useMemo(() => takeoff.openings.filter((opening) => {
        const haystack = `${opening.tag ?? ''} ${opening.label}`.toLowerCase();

        if (query && !haystack.includes(query.toLowerCase())) {
            return false;
        }

        if (category && (opening.product_category ?? '') !== category) {
            return false;
        }

        if (location && (opening.location ?? '') !== location) {
            return false;
        }

        if (scope && opening.scope !== scope) {
            return false;
        }

        if (review === 'flagged' && opening.flags.length === 0) {
            return false;
        }

        if (review === 'clear' && opening.flags.length > 0) {
            return false;
        }

        return !review || review === 'flagged' || review === 'clear' || opening.disposition === review;
    }), [takeoff.openings, query, category, location, scope, review]);

    const openOpening = (id: number) => {
        const opening = takeoff.openings.find((item) => item.id === id);

        setSelectedOpeningId(id);
        setCreating(false);
        setPaletteView('inspector');
        const marker = opening?.markers[0];

        if (marker) {
            setSelectedDocumentId(marker.document_id);
        }
    };

    const countOpening = (point: PdfPoint, tool: 'door' | 'window', box?: { x: number; y: number; x2: number; y2: number }) => {
        if (!can.update || takeoff.status === 'archived') {
            return;
        }

        router.post(route('admin.takeoffs.counts.store', takeoff.uuid), {
            opening_type: tool,
            document_id: point.documentId,
            page: point.page,
            x: box?.x ?? point.x,
            y: box?.y ?? point.y,
            ...(box ? { x2: box.x2, y2: box.y2 } : {}),
        }, { preserveScroll: true });
    };

    const undoLastCount = () => {
        const openingId = undoIds.at(-1);

        if (!openingId) {
            return;
        }

        const next = undoIds.slice(0, -1);
        setUndoIds(next);

        try {
            sessionStorage.setItem(undoKey, JSON.stringify(next));
        } catch {
            // The count is still removed for this visit.
        }

        if (selectedOpeningId === openingId) {
            setSelectedOpeningId(null);
        }

        router.delete(route('admin.takeoffs.openings.destroy', [takeoff.uuid, openingId]), { preserveScroll: true });
    };

    const saveMarkDetails = (openingId: number, details: { opening_type: string; width: string; height: string; notes: string; callout: string | null }) => {
        const opening = takeoff.openings.find((item) => item.id === openingId);

        if (!opening) {
            return;
        }

        const calloutChanged = (opening.callout?.trim() || null) !== details.callout;

        router.patch(route('admin.takeoffs.openings.update', [takeoff.uuid, opening.id]), openingPayload({
            ...openingForm(opening, false),
            opening_type: details.opening_type,
            width: details.width,
            height: details.height,
            notes: details.notes,
        }, opening.updated_at, null), {
            preserveScroll: true,
            onSuccess: () => {
                if (!calloutChanged) {
                    return;
                }

                router.patch(route('admin.takeoffs.openings.callout', [takeoff.uuid, opening.id]), {
                    callout: details.callout,
                }, { preserveScroll: true });
            },
        });
    };

    const copyAbort = useRef<AbortController | null>(null);
    const csrf = () => decodeURIComponent(document.cookie.split('; ').find((row) => row.startsWith('XSRF-TOKEN='))?.split('=')[1] ?? '');

    const reloadDrawing = async () => {
        if (!selectedDocumentId || scanning) {
            return;
        }

        const token = crypto.randomUUID();
        const seen = { current: 0 };
        setScanning(true);
        setScanOpen(true);
        setScanError(null);
        setScanPercent(0);
        setScanLabel('Opening the drawing');

        const apply = (percent: number, label: string) => {
            if (percent < seen.current) {
                return;
            }

            seen.current = percent;
            setScanPercent(percent);
            setScanLabel(label || 'Reading the drawing');
        };

        try {
            const response = await fetch(route('admin.takeoffs.documents.scan', [takeoff.uuid, selectedDocumentId]), {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'text/event-stream',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': csrf(),
                },
                body: JSON.stringify({ progress: token }),
            });

            if (!response.ok || !response.body) {
                const body = await response.json().catch(() => ({ message: 'The drawing could not be read.' })) as { message?: string };
                setScanError(body.message || 'The drawing could not be read.');

                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let message = 'Drawing scanned.';
            let failed = false;
            const readEvents = (block: string) => {
                block.split('\n\n').forEach((part) => {
                    const line = part.split('\n').find((item) => item.startsWith('data: '));

                    if (!line) {
                        return;
                    }

                    try {
                        const event = JSON.parse(line.slice(6)) as { percent?: number; label?: string; message?: string; error?: boolean };
                        apply(event.percent ?? seen.current, event.label || 'Reading the drawing');

                        if (event.message) {
                            message = event.message;
                        }

                        if (event.error) {
                            failed = true;
                        }
                    } catch {
                        // A split chunk is completed by the next read.
                    }
                });
            };

            while (true) {
                const chunk = await reader.read();

                if (chunk.done) {
                    break;
                }

                buffer += decoder.decode(chunk.value, { stream: true });
                const parts = buffer.split('\n\n');
                buffer = parts.pop() ?? '';
                readEvents(parts.join('\n\n'));
            }

            readEvents(buffer);

            if (failed || seen.current < 100) {
                setScanError(failed ? message : 'The drawing read stopped before it finished.');

                return;
            }

            apply(100, message);
            router.reload({ preserveScroll: true });
        } catch {
            setScanError('The drawing could not be read.');
        } finally {
            setScanning(false);
        }
    };

    const copyText = async (text: string, key: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedKey(key);
            setClipboardNote(null);
            window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1600);
        } catch {
            setClipboardNote('The browser blocked the copy. Select the text and copy it.');
        }
    };

    const discardSelection = () => {
        copyAbort.current?.abort();
        copyAbort.current = null;
        const removing = editingSectionId;
        setCopyOpen(false);
        setCopyReading(false);
        setCopyRegion(null);
        setEditingSectionId(null);

        if (removing) {
            router.delete(route('admin.takeoffs.sections.destroy', [takeoff.uuid, removing]), { preserveScroll: true });
        }
    };

    const readRegion = async (region: { documentId: number; page: number; x: number; y: number; x2: number; y2: number }) => {
        copyAbort.current?.abort();
        const controller = new AbortController();
        copyAbort.current = controller;
        const seen = { current: 0 };
        setCopyRegion(region);
        setEditingSectionId(null);
        setCopyOpen(true);
        setCopyReading(true);
        setCopyError(null);
        setClipboardNote(null);
        setCopyPercent(0);
        setCopyLabel('Opening the marked area');
        setCopyTitle('');
        setCopyBody('');

        const apply = (percent: number, label: string) => {
            if (percent < seen.current) {
                return;
            }

            seen.current = percent;
            setCopyPercent(percent);
            setCopyLabel(label || 'Reading the marked area');
        };

        try {
            const response = await fetch(route('admin.takeoffs.sections.read', takeoff.uuid), {
                method: 'POST',
                credentials: 'same-origin',
                signal: controller.signal,
                headers: {
                    Accept: 'text/event-stream',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': csrf(),
                },
                body: JSON.stringify({
                    document_id: region.documentId,
                    page: region.page,
                    x: region.x,
                    y: region.y,
                    x2: region.x2,
                    y2: region.y2,
                }),
            });

            if (!response.ok || !response.body) {
                const body = await response.json().catch(() => ({ message: 'That part of the drawing could not be read.' })) as { message?: string };
                setCopyError(body.message || 'That part of the drawing could not be read.');

                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let title = '';
            let copied = '';
            let failed = false;
            let message = 'That part of the drawing could not be read.';
            const readEvents = (block: string) => {
                block.split('\n\n').forEach((part) => {
                    const line = part.split('\n').find((item) => item.startsWith('data: '));

                    if (!line) {
                        return;
                    }

                    try {
                        const event = JSON.parse(line.slice(6)) as { percent?: number; label?: string; title?: string; body?: string; message?: string; error?: boolean };
                        apply(event.percent ?? seen.current, event.label || 'Reading the marked area');

                        if (event.title) {
                            title = event.title;
                        }

                        if (event.body) {
                            copied = event.body;
                        }

                        if (event.message) {
                            message = event.message;
                        }

                        if (event.error) {
                            failed = true;
                        }
                    } catch {
                        // A split chunk is completed by the next read.
                    }
                });
            };

            while (true) {
                const chunk = await reader.read();

                if (chunk.done) {
                    break;
                }

                buffer += decoder.decode(chunk.value, { stream: true });
                const parts = buffer.split('\n\n');
                buffer = parts.pop() ?? '';
                readEvents(parts.join('\n\n'));
            }

            readEvents(buffer);

            if (failed || !copied) {
                setCopyError(message);

                return;
            }

            apply(100, 'Section ready');
            setCopyTitle(title || 'Copied section');
            setCopyBody(copied);
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                return;
            }

            setCopyError('That part of the drawing could not be read.');
        } finally {
            if (copyAbort.current === controller) {
                setCopyReading(false);
            }
        }
    };

    const normalizeOpeningType = (value: string) => {
        const trimmed = value.trim();
        const lower = trimmed.toLowerCase();

        if (lower === 'door' || lower === 'doors') {
            return 'door';
        }

        if (lower === 'window' || lower === 'windows') {
            return 'window';
        }

        return trimmed;
    };

    const beginOpeningSelection = (region: { documentId: number; page: number; x: number; y: number; x2: number; y2: number }) => {
        copyAbort.current?.abort();
        setOpeningsBox({ ...region, openingType: '' });
        setOpeningTypeName('');
        setOpeningTypeId('');
        setOpeningsFound([]);
        setSelectedOpeningIds([]);
        setOpeningsDragError(null);
        setOpeningsDragReading(false);
        setOpeningsNaming(true);
        setOpeningsDragOpen(true);
        setOpeningsDragPercent(0);
        setOpeningsDragLabel('Name the openings in this selection.');
    };

    const readOpenings = async (region: { documentId: number; page: number; x: number; y: number; x2: number; y2: number }, openingType: string) => {
        copyAbort.current?.abort();
        const controller = new AbortController();
        copyAbort.current = controller;
        const seen = { current: 0 };
        const named = openingType === 'window' ? 'Window' : openingType === 'door' ? 'Door' : openingType;
        setOpeningsBox({ ...region, openingType });
        setOpeningsNaming(false);
        setOpeningsFound([]);
        setSelectedOpeningIds([]);
        setOpeningsDragOpen(true);
        setOpeningsDragReading(true);
        setOpeningsDragError(null);
        setOpeningsDragPercent(0);
        setOpeningsDragLabel(`Reading the ${named.toLowerCase()} selection`);

        const apply = (percent: number, label: string) => {
            if (percent < seen.current) {
                return;
            }

            seen.current = percent;
            setOpeningsDragPercent(percent);
            setOpeningsDragLabel(label || `Reading the ${named.toLowerCase()}s`);
        };

        try {
            const response = await fetch(route('admin.takeoffs.sections.read', takeoff.uuid), {
                method: 'POST',
                credentials: 'same-origin',
                signal: controller.signal,
                headers: {
                    Accept: 'text/event-stream',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': csrf(),
                },
                body: JSON.stringify({
                    document_id: region.documentId,
                    page: region.page,
                    x: region.x,
                    y: region.y,
                    x2: region.x2,
                    y2: region.y2,
                }),
            });

            if (!response.ok || !response.body) {
                const body = await response.json().catch(() => ({ message: 'That part of the drawing could not be read.' })) as { message?: string };
                setOpeningsDragError(body.message || 'That part of the drawing could not be read.');
                setOpeningsDragReading(false);

                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let title = '';
            let copied = '';
            let failed = false;
            let message = 'That part of the drawing could not be read.';
            const readEvents = (block: string) => {
                block.split('\n\n').forEach((part) => {
                    const line = part.split('\n').find((item) => item.startsWith('data: '));

                    if (!line) {
                        return;
                    }

                    try {
                        const event = JSON.parse(line.slice(6)) as { percent?: number; label?: string; title?: string; body?: string; message?: string; error?: boolean };
                        apply(event.percent ?? seen.current, event.label || 'Reading the marked area');

                        if (event.title) {
                            title = event.title;
                        }

                        if (event.body) {
                            copied = event.body;
                        }

                        if (event.message) {
                            message = event.message;
                        }

                        if (event.error) {
                            failed = true;
                        }
                    } catch {
                        // A split chunk is completed by the next read.
                    }
                });
            };

            while (true) {
                const chunk = await reader.read();

                if (chunk.done) {
                    break;
                }

                buffer += decoder.decode(chunk.value, { stream: true });
                const parts = buffer.split('\n\n');
                buffer = parts.pop() ?? '';
                readEvents(parts.join('\n\n'));
            }

            readEvents(buffer);

            if (failed || !copied) {
                setOpeningsDragError(message);
                setOpeningsDragReading(false);

                return;
            }

            apply(100, `Adding the ${named.toLowerCase()}s to the list`);
            router.post(route('admin.takeoffs.openings.from-text', takeoff.uuid), {
                document_id: region.documentId,
                page: region.page,
                opening_type: openingType,
                title: title || named,
                body: copied,
                x: region.x,
                y: region.y,
                x2: region.x2,
                y2: region.y2,
            }, {
                preserveScroll: true,
                preserveState: true,
                onSuccess: (page) => {
                    const flash = (page.props.flash ?? {}) as {
                        success?: string | null;
                        error?: string | null;
                        created_section_id?: number | null;
                        created_openings?: { id?: number; tag: string; callout?: string | null; opening_type: string; quantity: string; width: string | null; height: string | null; location: string | null }[];
                        created_markup_id?: number | null;
                    };
                    const created = flash.created_openings ?? [];
                    setOpeningsDragReading(false);
                    setSavedSectionId(typeof flash.created_section_id === 'number' ? flash.created_section_id : null);
                    setSavedMarkupId(typeof flash.created_markup_id === 'number' ? flash.created_markup_id : null);
                    setOpeningsBox(null);

                    if (flash.error) {
                        setOpeningsFound([]);
                        setSelectedOpeningIds([]);
                        setOpeningsDragError(flash.error);

                        return;
                    }

                    setOpeningsDragError(null);
                    setOpeningsDragLabel(flash.success || `${named} openings were added to the list.`);
                    setOpeningsFound(created);
                    setSelectedOpeningIds(created.map((item) => item.id).filter((id): id is number => typeof id === 'number' && id > 0));
                    window.setTimeout(() => window.document.getElementById('takeoff-openings')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 200);
                },
                onError: () => {
                    setOpeningsDragReading(false);
                    setOpeningsFound([]);
                    setOpeningsDragError(`This ${named.toLowerCase()} selection cannot be created.`);
                },
            });
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                return;
            }

            setOpeningsDragError('That part of the drawing could not be read.');
            setOpeningsDragReading(false);
        }
    };

    const clearOpeningSelection = () => {
        copyAbort.current?.abort();
        setOpeningsBox(null);
        setOpeningsFound([]);
        setSelectedOpeningIds([]);
        setSavedSectionId(null);
        setSavedMarkupId(null);
        setSelectionRemoval(null);
        setOpeningsNaming(false);
        setOpeningTypeName('');
        setOpeningTypeId('');
        setOpeningsDragOpen(false);
        setOpeningsDragError(null);
    };

    const confirmOpeningType = () => {
        const type = normalizeOpeningType(openingTypeName);

        if (!type || !openingsBox) {
            return;
        }

        void readOpenings(openingsBox, type);
    };

    const askToRemoveSelection = () => {
        if (selectedOpeningIds.length === 0 && savedMarkupId === null) {
            clearOpeningSelection();

            return;
        }

        setSelectionRemoval({
            markupId: savedMarkupId,
            openingIds: selectedOpeningIds,
        });
    };

    const removeSelection = () => {
        const request = selectionRemoval;

        if (!request) {
            return;
        }

        setSelectionRemoval(null);

        if (request.markupId) {
            router.delete(route('admin.takeoffs.markups.destroy', [takeoff.uuid, request.markupId]), {
                data: { opening_ids: request.openingIds },
                preserveScroll: true,
                preserveState: false,
                onSuccess: () => clearOpeningSelection(),
            });

            return;
        }

        if (request.openingIds.length === 0) {
            clearOpeningSelection();

            return;
        }

        router.post(route('admin.takeoffs.openings.forget', takeoff.uuid), { ids: request.openingIds, section_id: savedSectionId }, {
            preserveScroll: true,
            onSuccess: () => clearOpeningSelection(),
        });
    };

    const saveSection = () => {
        const title = copyTitle.trim();
        const body = copyBody.trim();

        if (!title || !body) {
            return;
        }

        void copyText(body, 'draft');

        if (editingSectionId) {
            router.patch(route('admin.takeoffs.sections.update', [takeoff.uuid, editingSectionId]), { title, body }, {
                preserveScroll: true,
                onSuccess: () => setCopyOpen(false),
            });

            return;
        }

        if (!copyRegion) {
            return;
        }

        router.post(route('admin.takeoffs.sections.store', takeoff.uuid), {
            document_id: copyRegion.documentId,
            page: copyRegion.page,
            title,
            body,
            x: copyRegion.x,
            y: copyRegion.y,
            x2: copyRegion.x2,
            y2: copyRegion.y2,
        }, {
            preserveScroll: true,
            onSuccess: () => setCopyOpen(false),
        });
    };

    const loadPreview = async () => {
        setPreviewError('');
        const body = new FormData();
        body.append('quotation_id', quotationId);
        const response = await fetch(route('admin.takeoffs.convert.preview', takeoff.uuid), {
            method: 'POST',
            headers: { Accept: 'application/json', 'X-XSRF-TOKEN': csrf(), 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'same-origin',
            body,
        });
        const payload = await response.json();

        if (!response.ok) {
            setPreviewError(payload?.errors?.quotation_id?.[0] ?? payload?.message ?? 'The preview could not be loaded.');
            setLines([]);

            return;
        }

        setLines(payload.lines ?? []);
        setChosen([]);
    };

    const previewImport = async (event: FormEvent) => {
        event.preventDefault();

        if (!importFile) {
            return;
        }

        const body = new FormData();
        body.append('file', importFile);
        const response = await fetch(route('admin.takeoffs.import.preview', takeoff.uuid), {
            method: 'POST',
            headers: { Accept: 'application/json', 'X-XSRF-TOKEN': csrf(), 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'same-origin',
            body,
        });
        setImportPreview(await response.json());
    };

    const saveDetails = (event: FormEvent) => {
        event.preventDefault();
        const activeKey = creating ? 'new' : selectedOpeningId ? String(selectedOpeningId) : '';
        const openings = Object.fromEntries(Object.entries(drafts).map(([key, form]) => {
            const opening = takeoff.openings.find((item) => String(item.id) === key) ?? null;

            return [key, openingPayload(form, opening?.updated_at ?? null, key === activeKey ? pendingMarker : null)];
        }));

        details.transform((data) => ({
            ...data,
            ...(Object.keys(openings).length > 0 ? { openings } : {}),
        }));
        details.patch(route('admin.takeoffs.update', takeoff.uuid), {
            preserveScroll: true,
            onSuccess: () => setDrafts({}),
        });
    };

    const fieldErrorsFor = (key: string) => {
        const prefix = `openings.${key}.`;
        const errors: Record<string, string> = {};

        Object.entries(details.errors).forEach(([name, message]) => {
            if (name.startsWith(prefix) && typeof message === 'string') {
                errors[name.slice(prefix.length)] = message;
            }
        });

        return errors;
    };

        const editable = can.update && takeoff.status !== 'archived';
    const openingSummary = takeoff.openings.slice(0, 40).map((opening) => {
        const size = [opening.width, opening.height, opening.depth].filter(Boolean).join(' x ');

        return [
            opening.tag || opening.label,
            opening.opening_type,
            opening.quantity && opening.quantity !== '1' ? `qty ${opening.quantity}` : null,
            size ? `${size} ${opening.dimension_unit}` : null,
            opening.location,
        ].filter(Boolean).join(' · ');
    }).join('\n');

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">{takeoff.title}</h2>}>
            <Head title={takeoff.title} />
            <div className="space-y-4 px-4 py-6 pb-28 sm:px-6 lg:px-8">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-sm text-muted-foreground">{takeoff.project?.project_number} {takeoff.project?.name} · Revision {takeoff.revision_number}{takeoff.revision_label ? ` ${takeoff.revision_label}` : ''}</p>
                        <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-100">
                            Scope of work: {takeoff.openings.length === 0 ? 'mark each opening on the drawing' : `${takeoff.openings.length} ${takeoff.openings.length === 1 ? 'opening' : 'openings'} marked on the drawing`}
                        </p>
                        <Badge variant="outline">{statusLabel[takeoff.status] ?? takeoff.status}</Badge>
                        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Estimates are internal. Approval means this takeoff was reviewed inside Gateway. It does not certify that a product meets the specification.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {can.export ? (
                            <Button type="button" variant="outline" size="sm" asChild>
                                <a href={route('admin.takeoffs.export', takeoff.uuid)}>
                                    <DownloadIcon data-icon="inline-start" />
                                    Export CSV
                                </a>
                            </Button>
                        ) : null}
                    </div>
                </div>
                {takeoff.show_pricing && takeoff.estimate ? (
                    <div className="grid gap-3 sm:grid-cols-4">
                        <Estimate label="Estimated cost" value={money(takeoff.estimate.cost)} />
                        <Estimate label="Estimated selling price" value={money(takeoff.estimate.selling)} />
                        <Estimate label="Estimated gross profit" value={money(takeoff.estimate.profit)} />
                        <Estimate label="Estimated gross margin" value={marginLabel(takeoff.estimate.margin)} />
                    </div>
                ) : null}
                <form id="takeoff-details" onSubmit={saveDetails} className="grid gap-3 rounded-lg border p-3 md:grid-cols-4 border-sky-200 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/30">
                    <FormActionFab
                        form="takeoff-details"
                        cancelHref={route('admin.takeoffs.index')}
                        saveLabel="Save takeoff"
                        attention={unsavedCount > 0}
                        disabled={!editable || details.processing}
                        onCancel={unsavedCount > 0 ? () => {
                            if (window.confirm('Openings on this takeoff are not saved. Leave without saving them?')) {
                                router.visit(route('admin.takeoffs.index'));
                            }
                        } : undefined}
                    />
                    <AiDraftButton
                        surface="takeoff"
                        facts={{
                            title: takeoff.title,
                            project: takeoff.project?.name ?? '',
                            project_number: takeoff.project?.project_number ?? '',
                            status: statusLabel[takeoff.status] ?? takeoff.status,
                            revision: [String(takeoff.revision_number), takeoff.revision_label].filter(Boolean).join(' '),
                            openings: String(takeoff.openings.length),
                        }}
                        currentText={[details.data.notes, openingSummary].filter(Boolean).join('\n')}
                        onDraft={(text) => {
                            const incoming = notesToHtml(text.trim());

                            if (incoming === '') {
                                return;
                            }

                            const notes = details.data.notes.trim();
                            details.setData('notes', notes === '' ? incoming : `${notes}${incoming}`);
                        }}
                    />
                    <label className="text-sm">Title<TextInput className="mt-1 w-full" value={details.data.title} onChange={(event) => details.setData('title', event.target.value)} /></label>
                    <label className="text-sm">Revision number
                        <TextInput className="mt-1 w-full" inputMode="numeric" value={details.data.revision_number} onChange={(event) => details.setData('revision_number', event.target.value.replace(/\D/g, '').slice(0, 4))} />
                    </label>
                    <label className="text-sm">Revision
                        <TextInput className="mt-1 w-full" value={details.data.revision_label} placeholder="A" maxLength={40} onChange={(event) => details.setData('revision_label', event.target.value)} />
                    </label>
                    <label className="text-sm">Status
                        <select className="mt-1 h-12 w-full rounded-md border-gray-300 py-2 text-sm leading-6 shadow-sm" value={details.data.status} onChange={(event) => details.setData('status', event.target.value)}>
                            {Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value} disabled={value === 'approved' && !can.approve}>{label}</option>)}
                        </select>
                    </label>
                    {can.pricing ? (
                        <>
                            <label className="text-sm">Pricing method
                                <select className="mt-1 h-12 w-full rounded-md border-gray-300 py-2 text-sm leading-6 shadow-sm" value={details.data.pricing_method} onChange={(event) => details.setData('pricing_method', event.target.value as 'markup' | 'margin')}>
                                    <option value="markup">Markup</option>
                                    <option value="margin">Target gross margin</option>
                                </select>
                            </label>
                            {details.data.pricing_method === 'markup'
                                ? <label className="text-sm">Markup percent<TextInput className="mt-1 w-full" value={details.data.markup_percent} onChange={(event) => details.setData('markup_percent', event.target.value)} /></label>
                                : <label className="text-sm">Target margin percent<TextInput className="mt-1 w-full" value={details.data.margin_percent} onChange={(event) => details.setData('margin_percent', event.target.value)} /></label>}
                        </>
                    ) : null}
                    <div className="text-sm md:col-span-4">
                        Notes
                        <div className="mt-1">
                            <RichTextEditor
                                id="takeoff-notes"
                                compact
                                showPlaceholders={false}
                                allowSideToolbar={false}
                                value={notesToHtml(details.data.notes)}
                                onChange={(html) => details.setData('notes', html)}
                                placeholder="Notes for this takeoff"
                            />
                        </div>
                    </div>
                    <div className="md:col-span-4 flex gap-2">
                        {details.errors.pricing_method ? <p className="text-sm text-destructive">{details.errors.pricing_method}</p> : null}
                        {details.errors.margin_percent ? <p className="text-sm text-destructive">{details.errors.margin_percent}</p> : null}
                    </div>
                </form>
                <div data-section-stack className="z-20 flex flex-col gap-2 bg-background pb-2 md:sticky md:top-[var(--app-sticky-top,4.75rem)]">
                <nav aria-label="Takeoff sections" data-document-toolbar data-pinned="true" className="rounded-xl border border-[#c5d0dc] bg-[#eef3f8] p-1.5 text-[#0a2540] shadow-sm dark:border-[#353a42] dark:bg-[#212429] dark:text-[#e6e8eb]">
                    <div className="flex gap-1 overflow-x-auto">
                        {sections.map((item, index) => {
                            const active = section === item.id;

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    aria-current={active ? 'location' : undefined}
                                    className={cn(
                                        'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
                                        active ? 'bg-emerald-600 text-white' : 'bg-white text-[#0a2540] hover:bg-[#d6e6f8] dark:bg-[#2b2f36] dark:text-[#e6e8eb] dark:hover:bg-[#353a42]',
                                    )}
                                    onClick={() => setSection(item.id)}
                                >
                                    <span className={cn(
                                        'flex size-5 items-center justify-center rounded-full text-[11px] font-semibold',
                                        active ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
                                    )}>
                                        {index + 1}
                                    </span>
                                    {item.label}
                                    {item.id === 'review' && takeoff.flags.length > 0 ? ` (${takeoff.flags.length})` : ''}
                                </button>
                            );
                        })}
                    </div>
                </nav>
                {section === 'workspace' ? (
                    <div className="flex flex-wrap gap-2 rounded-xl border border-[#c5d0dc] bg-[#eef3f8] p-1.5 shadow-sm dark:border-[#353a42] dark:bg-[#212429]">
                        <button type="button" onClick={() => document.getElementById('takeoff-openings')?.scrollIntoView({ behavior: 'smooth' })} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                            <ListIcon className="size-4" />
                            Openings
                        </button>
                        <button type="button" onClick={() => document.getElementById('takeoff-drawing')?.scrollIntoView({ behavior: 'smooth' })} className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-800">
                            <DraftingCompassIcon className="size-4" />
                            Drawing
                        </button>
                        {editable && selectedDocumentId ? (
                            <button type="button" onClick={reloadDrawing} disabled={scanning} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
                                <RefreshCwIcon className={`size-4 ${scanning ? 'animate-spin' : ''}`} />
                                Reload
                            </button>
                        ) : null}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700">
                                    <BookmarkIcon className="size-4" />
                                    Sections
                                    <ChevronDownIcon className="size-4" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="max-h-80 min-w-64 overflow-y-auto">
                                {editable ? (
                                    <>
                                        <DropdownMenuItem onSelect={() => {
                                            setCountTool('copy');
                                            setPaletteView('drawing');
                                            document.getElementById('takeoff-drawing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }}>
                                            <CopyIcon />
                                            Copy
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => {
                                            setCountTool('openings');
                                            setPaletteView('drawing');
                                            document.getElementById('takeoff-drawing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }}>
                                            <DoorOpenIcon />
                                            Openings
                                        </DropdownMenuItem>
                                    </>
                                ) : null}
                                {editable ? <DropdownMenuSeparator /> : null}
                                <DropdownMenuLabel>Select a section</DropdownMenuLabel>
                                {(takeoff.sections ?? []).length === 0 ? (
                                    <p className="px-2 py-2 text-sm text-muted-foreground">Copy a part of the drawing to save a section.</p>
                                ) : (takeoff.sections ?? []).map((item) => (
                                    <DropdownMenuItem key={item.id} onSelect={() => {
                                        setSelectedSectionId(item.id);
                                        setSelectedDocumentId(item.document_id);
                                        document.getElementById('takeoff-drawing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }}>
                                        {selectedSectionId === item.id ? <CheckIcon /> : <span className="size-4" />}
                                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                                        <span className="text-xs text-muted-foreground">p. {item.page}</span>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                ) : null}
                </div>
                {openingsDragOpen ? (
                    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center p-4">
                    <div className="pointer-events-auto w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-[#b7ebc9] bg-[#e7f8ee] p-4 text-neutral-950 shadow-xl">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-base font-semibold">{openingsNaming ? 'Name this selection' : openingsDragError ? 'This selection cannot be created' : openingsDragReading ? 'Reading the selection' : openingsDragLabel.toLowerCase().includes('already') && openingsFound.length === 0 ? 'Already on the list' : openingsFound.length > 0 ? 'Openings added' : 'Selection checked'}</p>
                                <p className="mt-1 text-sm text-neutral-700">{openingsDragError ?? openingsDragLabel}</p>
                            </div>
                            {openingsDragReading ? null : (
                                <button
                                    type="button"
                                    className="rounded-full p-1 text-neutral-600 hover:bg-[#d4f3e1] hover:text-neutral-950"
                                    aria-label="Close"
                                    onClick={clearOpeningSelection}
                                >
                                    <XIcon className="size-4" />
                                </button>
                            )}
                        </div>
                        {openingsNaming ? (
                            <form className="mt-3 grid gap-3" onSubmit={(event) => { event.preventDefault(); confirmOpeningType(); }}>
                                <CreatableSelect
                                    id="opening-type-name"
                                    label="These openings are"
                                    value={openingTypeId}
                                    options={openingTypes}
                                    createRoute={route('admin.takeoffs.opening-types.store')}
                                    optionsProp="openingTypes"
                                    entityLabel="opening type"
                                    placeholder="Search or add a type"
                                    compact
                                    autoFocus
                                    onChange={(id, option) => {
                                        setOpeningTypeId(id);
                                        setOpeningTypeName(option?.name ?? '');
                                    }}
                                />
                                <div className="flex justify-end gap-2">
                                    <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={clearOpeningSelection}>Cancel</Button>
                                    <Button type="submit" variant="create" size="sm" className="rounded-full" disabled={normalizeOpeningType(openingTypeName) === ''}>Add openings</Button>
                                </div>
                            </form>
                        ) : null}
                        {openingsDragReading ? (
                            <div className="mt-3 grid gap-3">
                                <p className="text-3xl font-semibold tabular-nums">{openingsDragPercent}%</p>
                                <div className="relative h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700" role="progressbar" aria-valuenow={openingsDragPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Opening read progress">
                                    <div className="h-full rounded-full bg-indigo-600 transition-[width] duration-500 ease-out" style={{ width: `${openingsDragPercent}%` }} />
                                </div>
                            </div>
                        ) : null}
                        {openingsDragReading || openingsNaming ? null : (
                            <div className="mt-3 flex items-center justify-end gap-3">
                                {selectedOpeningIds.length > 0 ? <p className="mr-auto text-xs text-neutral-500">Removes these openings from the list.</p> : null}
                                <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={askToRemoveSelection}>
                                    Cancel selection
                                </Button>
                            </div>
                        )}
                        {openingsFound.length > 0 ? (
                            <ul className="mt-3 max-h-64 overflow-y-auto rounded-md border">
                                {openingsFound.map((item) => (
                                    <li key={item.tag} className="grid grid-cols-[3.25rem_4.5rem_1fr] items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0">
                                        <span className="font-semibold tabular-nums">{item.callout || item.tag}</span>
                                        <span className="truncate">{item.callout ? item.tag : (item.opening_type === 'window' ? 'Window' : item.opening_type === 'door' ? 'Door' : item.opening_type)}</span>
                                        <span className="truncate text-neutral-500">{[
                                            item.callout ? (item.opening_type === 'window' ? 'Window' : item.opening_type === 'door' ? 'Door' : item.opening_type) : null,
                                            [item.width, item.height].filter(Boolean).join(' x ') || null,
                                            item.location,
                                        ].filter(Boolean).join(' · ')}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </div>
                    </div>
                ) : null}
                {selectionRemoval ? (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                        <div className="w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-[#b7ebc9] bg-[#e7f8ee] p-4 text-neutral-950 shadow-xl">
                            <p className="text-base font-semibold">Remove this selection?</p>
                            <p className="mt-1 text-sm text-neutral-700">The openings from this box will be removed from the Openings list.</p>
                            <div className="mt-4 flex justify-end gap-2">
                                <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setSelectionRemoval(null)}>Keep selection</Button>
                                <Button type="button" size="sm" className="rounded-full bg-red-700 text-white hover:bg-red-800" onClick={removeSelection}>Remove selection</Button>
                            </div>
                        </div>
                    </div>
                ) : null}
                {copyRemovalId ? (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                        <div className="w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-[#b7ebc9] bg-[#e7f8ee] p-4 text-neutral-950 shadow-xl">
                            <p className="text-base font-semibold">Remove this copy?</p>
                            <p className="mt-1 text-sm text-neutral-700">
                                {(takeoff.sections ?? []).find((item) => item.id === copyRemovalId)?.title || 'This copied section'} will be removed from the drawing.
                            </p>
                            <div className="mt-4 flex justify-end gap-2">
                                <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setCopyRemovalId(null)}>Keep it</Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    className="rounded-full bg-red-700 text-white hover:bg-red-800"
                                    onClick={() => {
                                        const sectionId = copyRemovalId;
                                        setCopyRemovalId(null);
                                        router.delete(route('admin.takeoffs.sections.destroy', [takeoff.uuid, sectionId]), { preserveScroll: true });
                                    }}
                                >
                                    Remove copy
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : null}
                <Dialog open={scanOpen} onOpenChange={(next) => {
                    if (!next && scanning) {
                        return;
                    }

                    setScanOpen(next);
                }}>
                    <DialogContent className="sm:max-w-md" showCloseButton={!scanning} onPointerDownOutside={(event) => {
                        if (scanning) {
                            event.preventDefault();
                        }
                    }} onEscapeKeyDown={(event) => {
                        if (scanning) {
                            event.preventDefault();
                        }
                    }}>
                        <DialogHeader>
                            <DialogTitle>{scanError ? 'The drawing could not be read' : scanning ? 'Reading the drawing' : 'Drawing read'}</DialogTitle>
                            <DialogDescription>
                                {scanError ?? scanLabel}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-3">
                            <div className="flex items-end justify-between gap-3">
                                <p className="text-3xl font-semibold tabular-nums text-foreground">{scanPercent}%</p>
                                <p className="pb-1 text-sm text-muted-foreground">{scanning ? 'Reading' : 'Finished'}</p>
                            </div>
                            <div className="relative h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={scanPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Drawing read progress">
                                <div className="h-full rounded-full bg-emerald-600 transition-[width] duration-500 ease-out" style={{ width: `${scanPercent}%` }} />
                                {scanning ? <div className="absolute inset-0 animate-pulse bg-white/25" /> : null}
                            </div>
                            <ol className="grid gap-1.5">
                                {scanStages.map((stage) => {
                                    const activeAt = scanStages.find((item) => scanPercent < item.at)?.at ?? scanStages[scanStages.length - 1].at;
                                    const current = scanning && stage.at === activeAt;
                                    const reached = scanPercent >= stage.at && !current;

                                    return (
                                        <li key={stage.label} className={`flex items-center gap-2 text-sm ${reached || current ? 'text-foreground' : 'text-muted-foreground'}`}>
                                            <span className={`flex size-5 items-center justify-center rounded-full text-[11px] font-semibold ${reached ? 'bg-emerald-600 text-white' : current ? 'bg-emerald-100 text-emerald-800 animate-pulse' : 'bg-muted text-muted-foreground'}`}>
                                                {reached ? '✓' : current ? '…' : ''}
                                            </span>
                                            {stage.label}
                                        </li>
                                    );
                                })}
                            </ol>
                        </div>
                        {scanning ? null : (
                            <Button type="button" onClick={() => setScanOpen(false)}>Close</Button>
                        )}
                    </DialogContent>
                </Dialog>
                <Dialog open={copyOpen} onOpenChange={(next) => {
                    if (!next) {
                        copyAbort.current?.abort();
                        copyAbort.current = null;
                        setCopyReading(false);
                    }

                    setCopyOpen(next);
                }}>
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader>
                            <DialogTitle>{editingSectionId ? 'Edit section' : 'Save copied section'}</DialogTitle>
                            <DialogDescription>
                                {copyReading ? copyLabel : copyError ?? 'The text inside the mark is below. Save it as a section, copy it, or remove the selection.'}
                            </DialogDescription>
                        </DialogHeader>
                        {copyReading ? (
                            <div className="grid gap-2">
                                <div className="flex items-end justify-between gap-3">
                                    <p className="text-2xl font-semibold tabular-nums text-foreground">{copyPercent}%</p>
                                    <p className="pb-1 text-sm text-muted-foreground">{copyLabel}</p>
                                </div>
                                <div className="relative h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={copyPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Copied section progress">
                                    <div className="h-full rounded-full bg-emerald-600 transition-[width] duration-500 ease-out" style={{ width: `${copyPercent}%` }} />
                                </div>
                                <Button type="button" variant="outline" onClick={discardSelection}>Remove selection</Button>
                            </div>
                        ) : copyError && !copyBody ? (
                            <Button type="button" variant="outline" onClick={discardSelection}>Remove selection</Button>
                        ) : (
                            <div className="grid gap-3">
                                <label className="grid gap-1 text-sm font-medium text-foreground">
                                    Section name
                                    <input value={copyTitle} onChange={(event) => setCopyTitle(event.target.value)} className="h-11 rounded-md border border-border bg-background px-3 text-sm" />
                                </label>
                                <div className="grid gap-1">
                                    <p className="text-sm font-medium text-foreground">Information</p>
                                    <div className="overflow-hidden rounded-xl border border-border">
                                        <SectionSheet body={copyBody} onChange={setCopyBody} />
                                    </div>
                                </div>
                                {clipboardNote ? <p className="text-sm text-amber-700">{clipboardNote}</p> : null}
                                <div className="flex flex-wrap gap-2">
                                    {editable ? (
                                        <Button type="button" disabled={!copyTitle.trim() || !copyBody.trim()} onClick={saveSection}>Save section</Button>
                                    ) : null}
                                    <Button type="button" variant="outline" disabled={!copyBody.trim()} onClick={() => copyText(copyBody, 'draft')}>
                                        <CopyIcon className="size-4" />
                                        {copiedKey === 'draft' ? 'Copied' : 'Copy'}
                                    </Button>
                                    <Button type="button" variant="outline" onClick={discardSelection}>Remove selection</Button>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
                <Dialog open={viewingSection !== null} onOpenChange={(next) => {
                    if (!next) {
                        setViewingSection(null);
                    }
                }}>
                    <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>{viewingSection?.title ?? 'Section'}</DialogTitle>
                            <DialogDescription>
                                {viewingSection ? `Page ${viewingSection.page}` : ''}
                            </DialogDescription>
                        </DialogHeader>
                        {viewingSection ? (
                            <div className="grid gap-3">
                                <div className="overflow-hidden rounded-xl border border-border">
                                    <SectionSheet body={viewingSection.body} />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button type="button" variant="outline" onClick={() => copyText(viewingSection.body, `view-${viewingSection.id}`)}>
                                        <CopyIcon className="size-4" />
                                        {copiedKey === `view-${viewingSection.id}` ? 'Copied' : 'Copy'}
                                    </Button>
                                    <Button type="button" variant="outline" onClick={() => setViewingSection(null)}>Close</Button>
                                </div>
                            </div>
                        ) : null}
                    </DialogContent>
                </Dialog>

                {section === 'workspace' ? (
                    <div className="flex flex-col gap-3">
                            <div className="flex min-w-0 flex-col gap-4">
                            <div id="takeoff-drawing" className="min-w-0">
                                <OpeningReview
                                    proposals={takeoff.proposals ?? []}
                                    canEdit={editable}
                                    onActive={setActiveProposal}
                                    onConfirm={(proposal, kind) => {
                                        router.post(route('admin.takeoffs.proposals.confirm', [takeoff.uuid, proposal.document_id]), {
                                            tag: proposal.tag,
                                            opening_type: kind,
                                        }, { preserveScroll: true });
                                    }}
                                    onDismiss={(proposal) => {
                                        router.post(route('admin.takeoffs.proposals.dismiss', [takeoff.uuid, proposal.document_id]), {
                                            tag: proposal.tag,
                                        }, { preserveScroll: true });
                                    }}
                                />
                                <PdfWorkspace
                                    documents={takeoff.documents}
                                    openings={takeoff.openings}
                                    review={activeProposal?.markers[0] ? {
                                        tag: activeProposal.tag,
                                        page: activeProposal.markers[0].page,
                                        x: activeProposal.markers[0].x,
                                        y: activeProposal.markers[0].y,
                                    } : null}
                                    markups={takeoff.markups ?? []}
                                    onMarkup={editable ? (markup) => {
                                        router.post(route('admin.takeoffs.markups.store', takeoff.uuid), {
                                            document_id: markup.documentId,
                                            page: markup.page,
                                            kind: markup.kind,
                                            color: markup.color,
                                            points: markup.points,
                                        }, { preserveScroll: true, preserveState: true });
                                    } : undefined}
                                    onDeleteMarkup={editable ? (markupId) => {
                                        router.delete(route('admin.takeoffs.markups.destroy', [takeoff.uuid, markupId]), {
                                            preserveScroll: true,
                                            preserveState: true,
                                        });
                                    } : undefined}
                                    onRemoveOpeningMark={editable ? (markupId) => {
                                        const markup = (takeoff.markups ?? []).find((item) => item.id === markupId);

                                        setSelectionRemoval({
                                            markupId,
                                            openingIds: markup?.opening_ids ?? [],
                                        });
                                    } : undefined}
                                    selectedDocumentId={selectedDocumentId}
                                    selectedOpeningId={selectedOpeningId}
                                    selectedMarkerId={selected?.markers[0]?.id ?? null}
                                    canEdit={editable}
                                    onSelectDocument={setSelectedDocumentId}
                                    onSelectOpening={openOpening}
                                    onCount={countOpening}
                                    onDelete={(openingId) => {
                                        if (selectedOpeningId === openingId) {
                                            setSelectedOpeningId(null);
                                        }

                                        router.delete(route('admin.takeoffs.openings.destroy', [takeoff.uuid, openingId]), { preserveScroll: true });
                                    }}
                                    onPlace={(markerId, point) => router.patch(route('admin.takeoffs.markers.update', [takeoff.uuid, markerId]), {
                                        x: point.x,
                                        y: point.y,
                                        page: point.page,
                                        label_x: point.labelX,
                                        label_y: point.labelY,
                                        ...(point.x2 != null && point.y2 != null ? { x2: point.x2, y2: point.y2 } : {}),
                                    }, { preserveScroll: true })}
                                    onRename={(openingId, callout) => router.patch(route('admin.takeoffs.openings.callout', [takeoff.uuid, openingId]), { callout }, { preserveScroll: true })}
                                    onRemove={(markerId) => router.delete(route('admin.takeoffs.markers.destroy', [takeoff.uuid, markerId]), { preserveScroll: true })}
                                    onUpload={editable ? uploadPdf : undefined}
                                    onScan={editable && selectedDocumentId ? reloadDrawing : undefined}
                                    sections={takeoff.sections ?? []}
                                    focusedSection={(() => {
                                        const focused = (takeoff.sections ?? []).find((item) => item.id === selectedSectionId);

                                        return focused ? { id: focused.id, page: focused.page, documentId: focused.document_id } : null;
                                    })()}
                                    onCopyRegion={editable ? readRegion : undefined}
                                    onOpeningsRegion={editable ? beginOpeningSelection : undefined}
                                    openingsBox={openingsBox}
                                    onDeleteSection={editable ? (sectionId) => setCopyRemovalId(sectionId) : undefined}
                                    uploading={uploadingPdf}
                                    uploadError={uploadError}
                                    tool={countTool}
                                    onToolChange={setCountTool}
                                    onSaveDetails={saveMarkDetails}
                                    onUndo={editable ? undoLastCount : undefined}
                                    canUndo={undoIds.length > 0}
                                    onSaveRotation={editable ? (documentId, rotation) => {
                                        router.patch(route('admin.takeoffs.documents.rotation', [takeoff.uuid, documentId]), { rotation }, {
                                            preserveScroll: true,
                                            preserveState: true,
                                        });
                                    } : undefined}
                                    paletteView={paletteView}
                                    onPaletteView={setPaletteView}
                                    inspector={(
                                        <div className="flex flex-col gap-3">
                                                <OpeningEditor
                                                    takeoffUuid={takeoff.uuid}
                                                    opening={creating ? null : selected}
                                                    openings={takeoff.openings}
                                                    creating={creating}
                                                    documents={takeoff.documents}
                                                    pendingMarker={pendingMarker}
                                                    canEdit={editable}
                                                    tool={countTool}
                                                    unsavedIds={Object.keys(drafts).filter((key) => key !== 'new').map((key) => Number(key))}
                                                    newUnsaved={Boolean(drafts.new)}
                                                    fieldErrors={fieldErrorsFor(creating ? 'new' : String(selectedOpeningId ?? ''))}
                                                    draft={creating ? drafts.new ?? null : selectedOpeningId ? drafts[String(selectedOpeningId)] ?? null : null}
                                                    embedded
                                                    onToolChange={setCountTool}
                                                    onDraft={rememberDraft}
                                                    onSelect={(choice) => {
                                                        if (choice !== null && choice !== 'new') {
                                                            openOpening(choice);
                                                            return;
                                                        }

                                                        if (choice === 'new') {
                                                            setCreating(true);
                                                            setPaletteView('inspector');
                                                            setSelectedOpeningId(null);
                                                            return;
                                                        }

                                                        setPendingMarker(null);
                                                        setCreating(false);
                                                        setSelectedOpeningId(null);
                                                    }}
                                                />
                                            {selected && !creating ? (
                                                <form className="grid gap-2" onSubmit={(event) => {
                                                    event.preventDefault();
                                                    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
                                                    router.post(route('admin.takeoffs.references.store', [takeoff.uuid, selected.id]), data, { preserveScroll: true });
                                                    event.currentTarget.reset();
                                                }}>
                                                    <p className="text-sm font-semibold">References for {selected.label}</p>
                                                    <p className="text-sm text-muted-foreground">Add a schedule or specification reference. This does not change quantity.</p>
                                                    <select name="document_id" className="h-12 rounded-md border-gray-300 py-2 text-sm leading-6">
                                                        <option value="">Document</option>
                                                        {takeoff.documents.map((item) => <option key={item.id} value={item.id}>{item.original_filename}</option>)}
                                                    </select>
                                                    <TextInput name="page" placeholder="Page" />
                                                    <TextInput name="section" placeholder="Section" />
                                                    <TextInput name="note" placeholder="Note" />
                                                    {editable ? <Button type="submit" variant="outline" size="sm">Add reference</Button> : null}
                                                    <ul className="text-sm text-muted-foreground">
                                                        {selected.references.map((reference) => <li key={reference.id}>{reference.section || 'Reference'} {reference.page ? `p. ${reference.page}` : ''} {reference.note}</li>)}
                                                    </ul>
                                                </form>
                                            ) : (
                                                <p className="text-sm text-muted-foreground">Select an opening on the drawing, then add its schedule or specification references here.</p>
                                            )}
                                        </div>
                                    )}
                                />
                            </div>
                            <div id="takeoff-sections" className="flex flex-col gap-3">
                                <div>
                                    <h3 className="flex items-center gap-2 text-base font-semibold text-amber-800">
                                        <BookmarkIcon className="size-4" />
                                        Sections
                                    </h3>
                                    <p className="text-sm text-muted-foreground">Marked parts of the drawing. Use Openings, next to Copy, to drag a schedule. Name it as a door, a window, or another type, and those marks are added to the list.</p>
                                </div>
                                {(takeoff.sections ?? []).length === 0 ? (
                                    <p className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">Choose Copy on the drawing tools and drag around the part you want to keep.</p>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                        {(takeoff.sections ?? []).map((item) => {
                                            const lines = copiedLines(item.body).length;

                                            return (
                                                <article id={`takeoff-section-${item.id}`} className={cn('flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm', selectedSectionId === item.id ? 'border-amber-500 ring-2 ring-amber-500' : 'border-border')}>
                                                    <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/40">
                                                        <div className="min-w-0">
                                                            <h4 className="truncate text-sm font-semibold text-foreground">{item.title}</h4>
                                                            <p className="text-[11px] text-muted-foreground">Page {item.page} · {lines === 1 ? '1 line' : `${lines} lines`}</p>
                                                        </div>
                                                        <div className="mt-2 flex flex-nowrap items-center gap-1 overflow-x-auto">
                                                            <Button type="button" variant="outline" size="xs" onClick={() => setViewingSection(item)}>
                                                                <EyeIcon className="size-3.5" />
                                                                View
                                                            </Button>
                                                            <Button type="button" variant="outline" size="xs" aria-label={copiedKey === String(item.id) ? 'Copied' : 'Copy'} onClick={() => copyText(item.body, String(item.id))}>
                                                                <CopyIcon className="size-3.5" />
                                                                {copiedKey === String(item.id) ? 'Copied' : 'Copy'}
                                                            </Button>
                                                            {editable ? (
                                                                <>
                                                                    <Button type="button" variant="outline" size="xs" onClick={() => {
                                                                        setEditingSectionId(item.id);
                                                                        setCopyTitle(item.title);
                                                                        setCopyBody(item.body);
                                                                        setCopyError(null);
                                                                        setClipboardNote(null);
                                                                        setCopyReading(false);
                                                                        setCopyOpen(true);
                                                                    }}>
                                                                        <PencilIcon className="size-3.5" />
                                                                        Edit
                                                                    </Button>
                                                                    <Button type="button" variant="outline" size="xs" onClick={() => router.delete(route('admin.takeoffs.sections.destroy', [takeoff.uuid, item.id]), { preserveScroll: true })}>
                                                                        <Trash2Icon className="size-3.5" />
                                                                        Remove
                                                                    </Button>
                                                                </>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                    <SectionSheet body={item.body} compact />
                                                </article>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            <div id="takeoff-openings" className="flex flex-col gap-3">
                                <div>
                                    <h3 className="flex items-center gap-2 text-base font-semibold text-indigo-800">
                                        <ListIcon className="size-4" />
                                        Openings
                                    </h3>
                                    <p className="text-sm text-muted-foreground">Every opening on this takeoff is one row. Click a row and the drawing card opens its Object inspector tab.</p>
                                </div>
                                <div className="grid gap-2 md:grid-cols-2">
                                    <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Opening tag" />
                                    <TextInput value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Category" />
                                    <TextInput value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location" />
                                    <select className="h-12 rounded-md border-gray-300 py-2 text-sm leading-6" value={scope} onChange={(event) => setScope(event.target.value)}>
                                        <option value="">All scopes</option>
                                        <option value="supply">Supply only</option>
                                        <option value="installation">Installation only</option>
                                        <option value="both">Supply and installation</option>
                                    </select>
                                    <select className="h-12 rounded-md border-gray-300 py-2 text-sm leading-6" value={review} onChange={(event) => setReview(event.target.value)}>
                                        <option value="">All review states</option>
                                        <option value="flagged">Has review flags</option>
                                        <option value="clear">No flags</option>
                                        <option value="active">Active</option>
                                        <option value="excluded">Excluded</option>
                                        <option value="not_applicable">Not applicable</option>
                                    </select>
                                </div>
                                <div className="flex w-full flex-wrap items-center gap-2">
                                    {unsavedCount > 0 ? (
                                        <p className="mr-auto rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
                                            {unsavedCount === 1 ? '1 opening is not saved.' : `${unsavedCount} openings are not saved.`} Open Actions and choose Save takeoff to keep them.
                                        </p>
                                    ) : null}
                                    {editable ? (
                                        <Button type="button" variant="create" size="sm" className="ml-auto rounded-full px-4" onClick={() => { setCreating(true); setSelectedOpeningId(null); }}>
                                            <PlusIcon data-icon="inline-start" />
                                            Add opening
                                        </Button>
                                    ) : null}
                                </div>
                                <div className="max-h-[32rem] overflow-auto rounded-md border">
                                    <table className="min-w-full text-sm">
                                        <thead className="sticky top-0 text-left text-white">
                                            <tr>
                                                <th className="bg-[#16324F] px-2 py-2 text-right">#</th>
                                                <th className="bg-[#16324F] px-2 py-2">Tag</th>
                                                <th className="bg-[#16324F] px-2 py-2">Type</th>
                                                <th className="bg-[#16324F] px-2 py-2">Qty</th>
                                                <th className="bg-[#16324F] px-2 py-2">Size</th>
                                                <th className="bg-[#16324F] px-2 py-2">Location</th>
                                                <th className="bg-[#16324F] px-2 py-2">Specs</th>
                                                <th className="bg-[#16324F] px-2 py-2">Flags</th>
                                                {editable ? <th className="bg-[#16324F] px-2 py-2"> </th> : null}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.length === 0 ? (
                                                <tr>
                                                    <td className="px-2 py-4 text-muted-foreground" colSpan={editable ? 9 : 8}>No openings yet. Choose Count door or Count window, then click a door on the sheet.</td>
                                                </tr>
                                            ) : null}
                                            {drafts.new ? (
                                                <tr className="cursor-pointer border-t border-l-4 border-l-red-600 bg-red-100 text-red-950" onClick={() => { setCreating(true); setSelectedOpeningId(null); }}>
                                                    <td className="px-2 py-2 text-right font-semibold"> </td>
                                                    <td className="px-2 py-2 font-semibold">
                                                        {drafts.new.tag || 'New opening'}
                                                        <span className="ml-2 rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">Not saved</span>
                                                    </td>
                                                    <td className="px-2 py-2">{drafts.new.opening_type === 'window' ? 'Window' : drafts.new.opening_type === 'door' ? 'Door' : drafts.new.opening_type}</td>
                                                    <td className="px-2 py-2">{drafts.new.quantity}</td>
                                                    <td className="px-2 py-2">{[drafts.new.width, drafts.new.height, drafts.new.depth].filter(Boolean).join(' x ')} {drafts.new.dimension_unit}</td>
                                                    <td className="px-2 py-2">{drafts.new.location || '—'}</td>
                                                </tr>
                                            ) : null}
                                            {filtered.map((opening) => {
                                                const draft = drafts[String(opening.id)];
                                                const unsaved = Boolean(draft);
                                                const tag = draft?.tag ?? opening.tag;
                                                const locationText = draft?.location ?? opening.location;
                                                const quantity = draft?.quantity ?? opening.quantity;
                                                const width = draft?.width || opening.width;
                                                const height = draft?.height || opening.height;
                                                const depth = draft?.depth || opening.depth;
                                                const unit = draft?.dimension_unit ?? opening.dimension_unit;
                                                const kind = draft?.opening_type ?? opening.opening_type;

                                                return (
                                                <tr key={opening.id} className={`cursor-pointer border-t ${unsaved ? 'border-l-4 border-l-red-600 bg-red-100 text-red-950' : selectedOpeningIds.includes(opening.id) ? 'bg-sky-100' : selectedOpeningId === opening.id ? 'bg-[#3FCF8E]/20' : ''}`} onClick={() => openOpening(opening.id)}>
                                                    <td className="px-2 py-2 text-right font-semibold tabular-nums">{countMark(opening.callout, lineByOpening.get(opening.id) ?? 1)}</td>
                                                    <td className="px-2 py-2">
                                                        {opening.is_bulk ? `Bulk ${tag ?? ''}`.trim() : tag}
                                                        {unsaved ? <span className="ml-2 rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">Not saved</span> : null}
                                                    </td>
                                                    <td className="px-2 py-2">{kind === 'door' ? (opening.door_type || 'Door') : kind === 'window' ? 'Window' : kind}</td>
                                                    <td className="px-2 py-2">{quantity}</td>
                                                    <td className="px-2 py-2">{[width, height, depth].filter(Boolean).join(' x ')} {unit}</td>
                                                    <td className={`px-2 py-2 ${selectedOpeningId === opening.id ? 'font-medium' : ''}`}>{locationText || '—'}</td>
                                                    <td className="px-2 py-2">{openingSpecs(opening)}</td>
                                                    <td className="px-2 py-2">{opening.flags.length || '—'}</td>
                                                    {editable ? (
                                                        <td className="px-2 py-2">
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();

                                                                    if (selectedOpeningId === opening.id) {
                                                                        setSelectedOpeningId(null);
                                                                    }

                                                                    setDrafts((current) => {
                                                                        if (!(String(opening.id) in current)) {
                                                                            return current;
                                                                        }

                                                                        const next = { ...current };
                                                                        delete next[String(opening.id)];

                                                                        return next;
                                                                    });
                                                                    router.delete(route('admin.takeoffs.openings.destroy', [takeoff.uuid, opening.id]), { preserveScroll: true });
                                                                }}
                                                            >
                                                                Remove
                                                            </Button>
                                                        </td>
                                                    ) : null}
                                                </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <dl className="grid grid-cols-2 rounded-md border bg-muted/40 px-2 py-3 lg:grid-cols-4">
                                    {([
                                        ['Openings', String(filtered.length)],
                                        ['Total quantity', filtered.reduce((sum, opening) => sum + Number(opening.quantity || 0), 0).toLocaleString('en-US', { maximumFractionDigits: 2 })],
                                        ['Doors', String(filtered.filter((opening) => opening.opening_type !== 'window').length)],
                                        ['Windows', String(filtered.filter((opening) => opening.opening_type === 'window').length)],
                                    ] as const).map(([label, value]) => (
                                        <div key={label} className="px-4 even:border-l even:border-border lg:[&:nth-child(4n+3)]:border-l lg:[&:nth-child(4n+3)]:border-border lg:[&:nth-child(4n+1)]:border-l-0">
                                            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
                                            <dd className="mt-1 text-right text-lg font-semibold tabular-nums">{value}</dd>
                                        </div>
                                    ))}
                                </dl>
                                {editable ? (
                                    <form className="space-y-2 rounded-md border p-3" onSubmit={previewImport}>
                                        <p className="text-sm font-medium">Spreadsheet import</p>
                                        <a className="text-sm text-indigo-700" href={route('admin.takeoffs.import-template')}>Download the import template</a>
                                        <input type="file" accept=".csv,text/csv" onChange={(event) => setImportFile(event.target.files?.[0] ?? null)} />
                                        <label className="block text-sm">Duplicate tags
                                            <select className="mt-1 h-12 w-full rounded-md border-gray-300 py-2 text-sm leading-6" value={duplicateMode} onChange={(event) => setDuplicateMode(event.target.value as 'reject' | 'flag')}>
                                                <option value="reject">Reject the file</option>
                                                <option value="flag">Import and keep them flagged</option>
                                            </select>
                                        </label>
                                        <Button type="submit" variant="outline" size="sm">Preview import</Button>
                                        {importPreview ? (
                                            <div className="space-y-1 text-sm">
                                                <p>{importPreview.rows?.length ?? 0} valid row(s). {importPreview.errors?.length ?? 0} error row(s).</p>
                                                {importPreview.errors?.map((error) => <p key={error.row} className="text-destructive">Row {error.row}: {error.messages.join(' ')}</p>)}
                                                {importPreview.duplicates?.map((message) => <p key={message}>{message}</p>)}
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="create"
                                                    disabled={!importFile || (importPreview.errors?.length ?? 0) > 0 || (duplicateMode === 'reject' && (importPreview.duplicates?.length ?? 0) > 0)}
                                                    onClick={() => {
                                                        if (!importFile) {
                                                            return;
                                                        }

                                                        const data = new FormData();
                                                        data.append('file', importFile);
                                                        data.append('duplicate_mode', duplicateMode);
                                                        router.post(route('admin.takeoffs.import', takeoff.uuid), data, { forceFormData: true, preserveScroll: true });
                                                    }}
                                                >
                                                    Import
                                                </Button>
                                            </div>
                                        ) : null}
                                    </form>
                                ) : null}
                            </div>
                            </div>
                    </div>
                ) : null}

                {section === 'assemblies' ? (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">Matching openings can be grouped. A manual group with different configurations stays separate and shows a warning. One-time costs, such as freight, are not multiplied by quantity.</p>
                        {editable ? (
                            <div className="flex flex-wrap items-center gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => router.post(route('admin.takeoffs.groups.auto', takeoff.uuid), {}, { preserveScroll: true })}>Group matching openings</Button>
                                <TextInput value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Group name" />
                                <Button type="button" variant="create" size="sm" onClick={() => router.post(route('admin.takeoffs.groups.store', takeoff.uuid), { name: groupName, opening_ids: checked }, { preserveScroll: true })}>Group selected</Button>
                            </div>
                        ) : null}
                        <div className="space-y-3">
                            {takeoff.groups.map((group) => (
                                <div key={group.id} className="rounded-md border p-3 border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <h3 className="font-medium">{group.name}</h3>
                                        {group.mismatch ? <Badge variant="outline">Configurations differ</Badge> : null}
                                        {group.manual ? <Badge variant="outline">Manual</Badge> : <Badge variant="outline">Matched</Badge>}
                                    </div>
                                    <p className="text-sm">{group.opening_ids.map((id) => takeoff.openings.find((opening) => opening.id === id)?.label).filter(Boolean).join(', ')}</p>
                                    {group.estimate ? <p className="text-sm">Estimated cost {money(group.estimate.cost)} · selling {money(group.estimate.selling)} · quantity {group.estimate.quantity}</p> : null}
                                    {editable ? <Button type="button" variant="outline" size="sm" onClick={() => router.delete(route('admin.takeoffs.groups.destroy', [takeoff.uuid, group.id]), { preserveScroll: true })}>Ungroup</Button> : null}
                                    {can.pricing ? <CostForm takeoffUuid={takeoff.uuid} groupId={group.id} /> : null}
                                </div>
                            ))}
                        </div>
                        <div className="rounded-md border p-3 border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30">
                            <h3 className="font-medium text-emerald-800 dark:text-emerald-200">Openings</h3>
                            {takeoff.openings.map((opening) => (
                                <label key={opening.id} className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={checked.includes(opening.id)} onChange={(event) => setChecked((current) => event.target.checked ? [...current, opening.id] : current.filter((id) => id !== opening.id))} />
                                    {opening.label} {opening.group_id ? '(grouped)' : ''}
                                </label>
                            ))}
                        </div>
                        {can.pricing && selected ? <CostForm takeoffUuid={takeoff.uuid} openingId={selected.id} /> : <p className="text-sm text-muted-foreground">Select an opening on the schedule to add its unit costs.</p>}
                        <div className="rounded-md border p-3 border-violet-200 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/30">
                            <h3 className="font-medium text-violet-800 dark:text-violet-200">Assembly templates</h3>
                            <p className="text-sm text-muted-foreground">Applying a template copies it onto the opening. Later template edits do not change this estimate.</p>
                            <ul className="mt-2 space-y-1 text-sm">
                                {templates.map((template) => (
                                    <li key={template.id} className="flex items-center justify-between gap-2">
                                        <span>{template.name}</span>
                                        {editable && selected ? <Button type="button" size="sm" variant="outline" onClick={() => router.post(route('admin.takeoffs.templates.apply', [takeoff.uuid, selected.id]), { template_id: template.id }, { preserveScroll: true })}>Apply to {selected.label}</Button> : null}
                                    </li>
                                ))}
                            </ul>
                            {editable ? (
                                <form className="mt-3 grid gap-2 md:grid-cols-3" onSubmit={(event) => {
                                    event.preventDefault();
                                    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
                                    router.post(route('admin.takeoffs.templates.store', takeoff.uuid), {
                                        ...data,
                                        default_costs: data.amount ? [{ kind: 'material', basis: 'per_unit', amount: data.amount, description: data.name }] : [],
                                    }, { preserveScroll: true });
                                    event.currentTarget.reset();
                                }}>
                                    <TextInput name="name" placeholder="Template name" required />
                                    <select name="opening_type" className="h-12 rounded-md border-gray-300 py-2 text-sm leading-6" defaultValue="door"><option value="door">Door</option><option value="window">Window</option></select>
                                    <TextInput name="frame_type" placeholder="Frame" />
                                    <TextInput name="hardware_set" placeholder="Hardware" />
                                    <TextInput name="glazing" placeholder="Glazing" />
                                    <TextInput name="amount" placeholder="Default material cost" />
                                    <Button type="submit" variant="create" size="sm">Save template</Button>
                                </form>
                            ) : null}
                        </div>
                        {can.pricing ? (
                            <form className="grid gap-2 rounded-md border p-3 md:grid-cols-3" onSubmit={(event) => {
                                event.preventDefault();
                                const data = new FormData(event.currentTarget);
                                if (data.get('file') instanceof File && (data.get('file') as File).size === 0) {
                                    data.delete('file');
                                }
                                router.post(route('admin.takeoffs.quotes.store', takeoff.uuid), data, { forceFormData: true, preserveScroll: true });
                            }}>
                                <h3 className="md:col-span-3 font-medium">Supplier quote</h3>
                                <TextInput name="supplier_name" placeholder="Supplier" required />
                                <TextInput name="quote_number" placeholder="Quote number" />
                                <TextInput name="revision_label" placeholder="Revision" />
                                <TextInput name="quote_date" type="date" />
                                <TextInput name="expires_at" type="date" />
                                <select name="opening_id" className="h-12 rounded-md border-gray-300 py-2 text-sm leading-6" defaultValue={selected?.id ?? ''}>
                                    <option value="">Opening</option>
                                    {takeoff.openings.map((opening) => <option key={opening.id} value={opening.id}>{opening.label}</option>)}
                                </select>
                                <textarea name="included_scope" className="rounded-md border-gray-300 text-sm" placeholder="Included scope" />
                                <textarea name="exclusions" className="rounded-md border-gray-300 text-sm" placeholder="Exclusions" />
                                <textarea name="pricing_notes" className="rounded-md border-gray-300 text-sm" placeholder="Pricing notes" />
                                <input name="file" type="file" accept="application/pdf" />
                                <Button type="submit" variant="create" size="sm">Save supplier quote</Button>
                                <ul className="md:col-span-3 space-y-2 text-sm">
                                    {takeoff.supplier_quotes.map((quote) => (
                                        <li key={quote.id} className="rounded border p-2">
                                            {quote.supplier_name} {quote.quote_number} {quote.revision_label}
                                            {quote.expired ? <Badge variant="outline">Expired</Badge> : null}
                                            {quote.accepted_at ? <Badge variant="outline">Accepted</Badge> : null}
                                            {editable && !quote.accepted_at ? <Button type="button" size="sm" variant="outline" onClick={() => router.post(route('admin.takeoffs.quotes.accept', [takeoff.uuid, quote.id]), {}, { preserveScroll: true })}>Accept</Button> : null}
                                            {editable ? <Button type="button" size="sm" variant="outline" onClick={() => router.post(route('admin.takeoffs.quotes.revise', [takeoff.uuid, quote.id]), { supplier_name: quote.supplier_name, quote_number: quote.quote_number, revision_label: 'Next' }, { preserveScroll: true })}>New revision</Button> : null}
                                        </li>
                                    ))}
                                </ul>
                            </form>
                        ) : null}
                    </div>
                ) : null}

                {section === 'review' ? (
                    <div className="space-y-2">
                        {takeoff.flags.length === 0 ? <p className="text-sm">No review flags.</p> : null}
                        {takeoff.flags.map((flag, index) => (
                            <button key={`${flag.code}-${flag.opening_id}-${index}`} type="button" className="block w-full rounded-md border p-3 text-left text-sm" onClick={() => { if (flag.opening_id) { openOpening(flag.opening_id); setSection('workspace'); } }}>
                                {flag.message}
                            </button>
                        ))}
                        {takeoff.previous ? (
                            <div className="rounded-md border p-3 text-sm border-sky-200 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/30">
                                <h3 className="font-medium text-sky-800 dark:text-sky-200">Compared with revision {takeoff.previous.revision_number}</h3>
                                <p>Added: {takeoff.previous.diff.added.map((item) => item.label).join(', ') || 'None'}</p>
                                <p>Removed: {takeoff.previous.diff.removed.map((item) => item.label).join(', ') || 'None'}</p>
                                <p>Changed: {takeoff.previous.diff.changed.map((item) => item.label).join(', ') || 'None'}</p>
                                <p className="mt-2">Previous documents, for a manual comparison:</p>
                                <ul>
                                    {takeoff.previous.documents.map((document) => <li key={document.id}><a className="text-indigo-700" href={document.download_url ?? '#'}>{document.original_filename}</a></li>)}
                                </ul>
                                <Link className="text-indigo-700" href={route('admin.takeoffs.show', takeoff.previous.uuid)}>Open revision {takeoff.previous.revision_number}</Link>
                            </div>
                        ) : null}
                    </div>
                ) : null}

                {section === 'convert' ? (
                    <div className="space-y-3">
                        {can.convert ? (
                            <>
                                <p className="text-sm text-muted-foreground">Selling prices are copied onto the quotation. Internal costs and supplier files stay on the takeoff. Later takeoff edits do not change the quotation unless you replace the transferred lines.</p>
                                <select className="h-12 w-full rounded-md border-gray-300 py-2 text-sm leading-6" value={quotationId} onChange={(event) => setQuotationId(event.target.value)}>
                                    {quotations.map((quotation) => <option key={quotation.id} value={quotation.id}>{quotation.number} — {quotation.title}</option>)}
                                </select>
                                <Button type="button" variant="outline" size="sm" onClick={() => void loadPreview()}>Preview lines</Button>
                                {previewError ? <p className="text-sm text-destructive">{previewError}</p> : null}
                                {lines.map((line) => (
                                    <label key={line.key} className={`block rounded-md border p-3 text-sm ${line.flags.length ? 'border-amber-400' : ''}`}>
                                        <input type="checkbox" checked={chosen.includes(line.key)} onChange={(event) => setChosen((current) => event.target.checked ? [...current, line.key] : current.filter((key) => key !== line.key))} />
                                        <span className="ml-2 font-medium">{line.label}</span>
                                        <span className="ml-2">Qty {line.quantity}</span>
                                        <span className="ml-2">{money(line.extended)}</span>
                                        {line.already_transferred ? <Badge variant="outline">Already transferred</Badge> : null}
                                        <p>{line.description}</p>
                                        <p>{line.scope}</p>
                                        {line.flags.map((flag) => <p key={flag.code} className="text-amber-700">{flag.message}</p>)}
                                    </label>
                                ))}
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={replace} onChange={(event) => setReplace(event.target.checked)} />
                                    Replace previously transferred lines
                                </label>
                                <Button type="button" variant="create" size="sm" disabled={chosen.length === 0 || !quotationId} onClick={() => router.post(route('admin.takeoffs.convert', takeoff.uuid), { quotation_id: Number(quotationId), keys: chosen, replace }, { preserveScroll: true })}>
                                    <PlusIcon data-icon="inline-start" />
                                    Add to quotation
                                </Button>
                            </>
                        ) : <p className="text-sm">Quotation conversion is available to admins who can update quotations and see takeoff pricing.</p>}
                    </div>
                ) : null}

                {section === 'history' ? (
                    <ul className="space-y-2 text-sm">
                        {takeoff.audits.map((audit) => (
                            <li key={audit.id} className="rounded-md border p-3">
                                <span className="font-medium">{audit.summary}</span>
                                <span className="text-muted-foreground"> · {audit.user ?? 'System'} · {audit.created_at ? new Date(audit.created_at).toLocaleString() : ''}</span>
                            </li>
                        ))}
                    </ul>
                ) : null}
            </div>
        </AuthenticatedLayout>
    );
}

function Estimate({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold">{value}</p>
        </div>
    );
}

function CostForm({ takeoffUuid, openingId, groupId }: { takeoffUuid: string; openingId?: number; groupId?: number }) {
    return (
        <form className="mt-3 grid gap-2 md:grid-cols-4" onSubmit={(event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.currentTarget).entries());
            router.post(route('admin.takeoffs.costs.store', takeoffUuid), {
                ...data,
                opening_id: openingId ?? null,
                group_id: groupId ?? null,
            }, { preserveScroll: true });
            event.currentTarget.reset();
        }}>
            <select name="kind" className="h-12 rounded-md border-gray-300 py-2 text-sm leading-6" defaultValue="material">
                <option value="material">Material</option>
                <option value="labor">Labor</option>
                <option value="freight">Freight</option>
                <option value="equipment">Equipment</option>
                <option value="subcontract">Subcontract</option>
                <option value="other">Other</option>
            </select>
            <select name="basis" className="h-12 rounded-md border-gray-300 py-2 text-sm leading-6" defaultValue="per_unit">
                <option value="per_unit">Per unit</option>
                <option value="one_time">One time</option>
            </select>
            <TextInput name="amount" placeholder="Amount" />
            <TextInput name="labor_hours" placeholder="Labor hours" />
            <TextInput name="hourly_rate" placeholder="Hourly rate" />
            <Button type="submit" variant="outline" size="sm">Add cost</Button>
        </form>
    );
}
